// @vitest-environment node
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { GAMES, type Game } from "@miolos/core";
import { ImageResponse } from "next/og";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  formatDayAndMonth,
  formatLongDate,
  formatMonth,
  messages,
  todaySaoPauloDate,
} from "../src/i18n";
import { ogCopy } from "../src/og/copy";
import { FONTS } from "../src/og/fonts";

const FONT_DIR = join(import.meta.dirname, "../assets/fonts");

const spies = vi.hoisted(() => ({
  stubDb: { marker: "stub-db" },
  getDb: vi.fn(),
  getPublishedDaily: vi.fn(),
  getTodayDaily: vi.fn(),

  listArchivedDays: vi.fn(),
  gameCard: vi.fn(),
  archiveCard: vi.fn(),
}));

vi.mock("../src/db", () => ({ getDb: spies.getDb }));
vi.mock("@miolos/db", () => ({
  getPublishedDaily: spies.getPublishedDaily,
  getTodayDaily: spies.getTodayDaily,
  listArchivedDays: spies.listArchivedDays,
}));

vi.mock("../src/og/card", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/og/card")>()),
  gameCard: spies.gameCard,
  archiveCard: spies.archiveCard,
}));

const actualCard =
  await vi.importActual<typeof import("../src/og/card")>("../src/og/card");
const handlers = await import("../src/og/handlers");

const PUBLISHED_DATE = "2026-02-22";
function row(game: Game) {
  return { game, date: PUBLISHED_DATE };
}

function named(name: string): Error {
  const error = new Error(`synthetic ${name}`);
  error.name = name;
  return error;
}

beforeEach(() => {
  spies.getDb.mockReturnValue(spies.stubDb);
  spies.gameCard.mockImplementation(actualCard.gameCard);
  spies.archiveCard.mockImplementation(actualCard.archiveCard);
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("the OG image routes read the wall as an existence proof (T-WEB-S203)", () => {
  describe.each(GAMES)("%s — both families", (game) => {
    const calls: [
      string,
      () => Promise<Response>,
      ReturnType<typeof vi.fn>,
      (date: string) => Promise<Response>,
    ][] = [
      [
        "archive",
        () => handlers.archiveGameCardHandler(game, PUBLISHED_DATE),
        spies.getPublishedDaily,
        (date) => handlers.archiveGameCardHandler(game, date),
      ],
      [
        "daily",
        () => handlers.dailyCardHandler(game),
        spies.getTodayDaily,
        () => handlers.dailyCardHandler(game),
      ],
    ];

    it.each(calls)(
      "(1) %s: a row renders a 1200x630 PNG",
      async (_family, call, reader) => {
        reader.mockResolvedValue(row(game));
        const response = await call();
        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toBe("image/png");
        const png = Buffer.from(await response.arrayBuffer());

        expect([...png.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
        expect(png.readUInt32BE(16)).toBe(1200);
        expect(png.readUInt32BE(20)).toBe(630);
      },
    );

    it.each(calls)(
      "(2) %s: undefined refuses with 404",
      async (_family, call, reader) => {
        reader.mockResolvedValue(undefined);
        const response = await call();
        expect(response.status).toBe(404);
      },
    );

    it.each(calls)(
      "(3) %s: a ZodError throw is a BAD ROW — 404, logged",
      async (_family, call, reader) => {
        const error = vi.spyOn(console, "error").mockImplementation(() => {});
        reader.mockRejectedValue(named("ZodError"));
        expect((await call()).status).toBe(404);
        expect(error).toHaveBeenCalledOnce();
      },
    );

    it.each(calls)(
      "(4) %s: a DailyProjectionUnsupportedError throw is a bad row — 404",
      async (_family, call, reader) => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        reader.mockRejectedValue(named("DailyProjectionUnsupportedError"));
        expect((await call()).status).toBe(404);
      },
    );

    it.each(calls)(
      "(5) %s: a DATABASE OUTAGE propagates — it is not converted to a 404",
      async (_family, call, reader) => {
        const error = vi.spyOn(console, "error").mockImplementation(() => {});
        reader.mockRejectedValue(new Error("connect ETIMEDOUT"));
        await expect(call()).rejects.toThrow("connect ETIMEDOUT");
        expect(error).not.toHaveBeenCalled();
      },
    );

    it.each(calls)(
      "(6) %s: a throw from the CARD BUILDER propagates too — the try wraps the read alone",
      async (_family, call, reader) => {
        const error = vi.spyOn(console, "error").mockImplementation(() => {});
        reader.mockResolvedValue(row(game));
        spies.gameCard.mockImplementation(() => {
          throw new Error("synthetic card-builder failure");
        });
        await expect(call()).rejects.toThrow("synthetic card-builder failure");
        expect(error).not.toHaveBeenCalled();
      },
    );

    it.each(calls)(
      "(7) %s: the PNG carries the private, no-store cache-control",
      async (_family, call, reader) => {
        reader.mockResolvedValue(row(game));
        expect((await call()).headers.get("cache-control")).toBe(
          "private, no-cache, no-store, max-age=0, must-revalidate",
        );
      },
    );

    it.each(calls)(
      "(7b) %s: THE REFUSAL carries it too — a 404 here goes stale at midnight",
      async (_family, call, reader) => {
        reader.mockResolvedValue(undefined);
        expect((await call()).headers.get("cache-control")).toBe(
          "private, no-cache, no-store, max-age=0, must-revalidate",
        );

        vi.spyOn(console, "error").mockImplementation(() => {});
        reader.mockRejectedValue(named("ZodError"));
        const badRow = await call();
        expect(badRow.status).toBe(404);
        expect(badRow.headers.get("cache-control")).toBe(
          "private, no-cache, no-store, max-age=0, must-revalidate",
        );
      },
    );

    it.each(calls)(
      "no field of the row reaches the card except its date",
      async (_family, call, reader, callDated) => {
        const sentinels = {
          game,
          date: PUBLISHED_DATE,
          givens: "__GIVENS__",
          tier: "__TIER__",
          clues: { rows: ["__CLUES__"], columns: ["__CLUES__"] },
        };
        reader.mockResolvedValue(sentinels);
        const first = Buffer.from(await (await call()).arrayBuffer());
        reader.mockResolvedValue({
          ...sentinels,
          givens: "__OTHER__",
          tier: "__OTHER__",
          clues: { rows: ["__OTHER__"], columns: ["__OTHER__"] },
        });
        const second = Buffer.from(await (await call()).arrayBuffer());
        expect(first.equals(second)).toBe(true);

        expect(first.length).toBeGreaterThan(1000);
        reader.mockResolvedValue({ ...sentinels, date: "2026-05-01" });
        const dated = Buffer.from(
          await (await callDated("2026-05-01")).arrayBuffer(),
        );
        expect(dated.equals(first)).toBe(false);
      },
    );
  });

  describe.each(GAMES)("%s — archive only", (game) => {
    it("(8) a malformed segment 404s with the reader NEVER called", async () => {
      for (const segment of ["lixo", "2026-02-30", "", "../../etc/passwd"]) {
        const response = await handlers.archiveGameCardHandler(game, segment);
        expect.soft(response.status, segment).toBe(404);

        expect
          .soft(response.headers.get("cache-control"), segment)
          .toBe("private, no-cache, no-store, max-age=0, must-revalidate");
      }
      expect(spies.getPublishedDaily).not.toHaveBeenCalled();
    });

    it("(9) TODAY's permalink renders — one predicate, no today branch", async () => {
      spies.getPublishedDaily.mockResolvedValue(row(game));
      const response = await handlers.archiveGameCardHandler(
        game,
        "2026-08-15",
      );
      expect(response.status).toBe(200);
      expect(spies.getPublishedDaily).toHaveBeenCalledTimes(1);
      expect(spies.getPublishedDaily).toHaveBeenCalledWith(
        spies.stubDb,
        game,
        "2026-08-15",
      );
    });

    it("(10) the bad-row log line carries the game AND the date", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      spies.getPublishedDaily.mockRejectedValue(named("ZodError"));
      await handlers.archiveGameCardHandler(game, PUBLISHED_DATE);
      const line = String(error.mock.calls[0]?.[0]);
      expect(line).toContain(game);
      expect(line).toContain(PUBLISHED_DATE);
    });
  });

  describe.each(GAMES)("%s — daily only", (game) => {
    it("(11) the bad-row log line carries the GAME ONLY, in its own written form", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      spies.getTodayDaily.mockRejectedValue(named("ZodError"));
      await handlers.dailyCardHandler(game);
      expect(error.mock.calls[0]?.[0]).toBe(
        `og daily card: unreadable today row for ${game}`,
      );
    });

    it("the card's date comes from the DB CLOCK's own row, never from new Date()", async () => {
      spies.getTodayDaily.mockResolvedValue(row(game));
      const fromRow = Buffer.from(
        await (await handlers.dailyCardHandler(game)).arrayBuffer(),
      );
      spies.getPublishedDaily.mockResolvedValue(row(game));
      const fromUrl = Buffer.from(
        await (
          await handlers.archiveGameCardHandler(game, PUBLISHED_DATE)
        ).arrayBuffer(),
      );

      expect([...fromRow.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
      expect(fromRow.length).toBeGreaterThan(1000);

      expect(fromRow.equals(fromUrl)).toBe(true);
      expect(formatLongDate(PUBLISHED_DATE)).toBe("22 de fevereiro de 2026");
    });
  });
});

describe("the committed fonts are the faces the card was designed against (T-WEB-S202)", () => {
  function readFace(file: string) {
    const buffer = readFileSync(join(FONT_DIR, file));
    const tables = new Map<string, number>();
    for (let i = 0; i < buffer.readUInt16BE(4); i += 1) {
      const entry = 12 + i * 16;
      tables.set(
        buffer.toString("ascii", entry, entry + 4),
        buffer.readUInt32BE(entry + 8),
      );
    }

    const names = new Map<number, string>();
    const nameTable = tables.get("name");
    if (nameTable !== undefined) {
      const count = buffer.readUInt16BE(nameTable + 2);
      const strings = nameTable + buffer.readUInt16BE(nameTable + 4);
      for (let i = 0; i < count; i += 1) {
        const record = nameTable + 6 + i * 12;
        const nameId = buffer.readUInt16BE(record + 6);
        const start = strings + buffer.readUInt16BE(record + 10);
        const end = start + buffer.readUInt16BE(record + 8);
        if (names.has(nameId)) {
          continue;
        }
        names.set(
          nameId,
          buffer.readUInt16BE(record) === 3
            ? Buffer.from(buffer.subarray(start, end))
                .swap16()
                .toString("utf16le")
            : buffer.toString("latin1", start, end),
        );
      }
    }

    const os2 = tables.get("OS/2") ?? 0;
    return {
      bytes: buffer.length,
      hasFvar: tables.has("fvar"),
      usWeightClass: buffer.readUInt16BE(os2 + 4),
      xAvgCharWidth: buffer.readInt16BE(os2 + 2),
      nameId1: names.get(1),
      nameId16: names.get(16),
      sha256: createHash("sha256").update(buffer).digest("hex"),
    };
  }

  it("no face carries an fvar table, and each declares the weight the card asks for", () => {
    for (const [file, weight] of [
      ["Fraunces-36pt-500.ttf", 500],
      ["InstrumentSans-400.ttf", 400],
      ["InstrumentSans-600.ttf", 600],
    ] as const) {
      const face = readFace(file);
      expect.soft(face.hasFvar, file).toBe(false);
      expect.soft(face.usWeightClass, file).toBe(weight);
    }
  });

  it("the OPTICAL CUT is the 36pt instance, read out of the binary", () => {
    const fraunces = readFace("Fraunces-36pt-500.ttf");
    expect(fraunces.nameId1).toBe("Fraunces 36pt Medium");
    expect(fraunces.nameId16).toBe("Fraunces 36pt");
    expect(fraunces.xAvgCharWidth).toBe(1148);

    const regular = readFace("InstrumentSans-400.ttf");
    expect(regular.nameId1).toBe("Instrument Sans");
    expect(regular.nameId16).toBeUndefined();

    const semibold = readFace("InstrumentSans-600.ttf");
    expect(semibold.nameId1).toBe("Instrument Sans SemiBold");
    expect(semibold.nameId16).toBe("Instrument Sans");
  });

  it("the on-disk digests equal the ones SHA256SUMS records", () => {
    const sums = readFileSync(join(FONT_DIR, "SHA256SUMS"), "utf8");
    for (const file of [
      "Fraunces-36pt-500.ttf",
      "InstrumentSans-400.ttf",
      "InstrumentSans-600.ttf",
    ]) {
      const face = readFace(file);
      expect.soft(sums, file).toContain(`sha256:  ${face.sha256}`);
      expect.soft(sums, file).toContain(`bytes:   ${face.bytes}`);
    }

    expect(sums).toContain("family=Fraunces:opsz,wght@36,500");
  });

  it("the longest realistic card and the site card both rasterise", async () => {
    for (const [label, tree] of [
      [
        "longest game card",
        actualCard.gameCard({
          game: "nonogram",
          longDate: "22 de fevereiro de 2026",
        }),
      ],
      ["site card", actualCard.siteCard()],

      [
        "widest archive day card",
        actualCard.archiveCard({
          display: formatDayAndMonth("2028-11-20"),
          caption: ogCopy.archiveDayCaption("2028"),
        }),
      ],
      [
        "widest archive month card",
        actualCard.archiveCard({
          display: formatMonth("2028-11-01"),
          caption: messages.archive.title,
        }),
      ],
      ["archive index card", actualCard.archiveIndexCard()],
    ] as const) {
      const png = Buffer.from(
        await new ImageResponse(tree, {
          width: 1200,
          height: 630,
          fonts: FONTS,
        }).arrayBuffer(),
      );
      expect
        .soft([...png.subarray(0, 4)], label)
        .toEqual([0x89, 0x50, 0x4e, 0x47]);
      expect.soft(png.length, label).toBeGreaterThan(10_000);
      expect.soft(png.readUInt32BE(16), label).toBe(1200);
      expect.soft(png.readUInt32BE(20), label).toBe(630);
    }
  });

  it("removing the Fraunces face CHANGES the bytes — satori's silent fallback would not", async () => {
    const tree = () =>
      actualCard.gameCard({
        game: "nonogram",
        longDate: "22 de fevereiro de 2026",
      });
    const withAll = Buffer.from(
      await new ImageResponse(tree(), {
        width: 1200,
        height: 630,
        fonts: FONTS,
      }).arrayBuffer(),
    );
    const withoutFraunces = Buffer.from(
      await new ImageResponse(tree(), {
        width: 1200,
        height: 630,
        fonts: FONTS.filter((face) => face.name !== "Fraunces"),
      }).arrayBuffer(),
    );
    expect(withAll.equals(withoutFraunces)).toBe(false);

    expect(withoutFraunces.length).toBeGreaterThan(10_000);
  });
});

const APP_DIR = join(import.meta.dirname, "..", "app");

const ROOT_CARD_ASSET = join(APP_DIR, "opengraph-image.png");
const ROOT_CARD_ALT = join(APP_DIR, "opengraph-image.alt.txt");
const ROOT_CARD_MODULE = join(APP_DIR, "opengraph-image.tsx");

const ARCHIVE_CARD_ASSET = join(APP_DIR, "arquivo", "opengraph-image.png");
const ARCHIVE_CARD_ALT = join(APP_DIR, "arquivo", "opengraph-image.alt.txt");

const DAY_CARD_ROUTE = join(APP_DIR, "cartao", "[data]", "route.ts");
const MONTH_CARD_ROUTE = join(APP_DIR, "cartao", "mes", "[mes]", "route.ts");

function code(source: string): string {
  return source
    .replaceAll(/\/\*[\s\S]*?\*\//g, "")
    .replaceAll(/(^|[^:])\/\/.*$/gm, "$1");
}

function moduleGraph(entry: string): string[] {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const current = queue.pop();
    if (current === undefined || seen.has(current)) {
      continue;
    }
    seen.add(current);
    for (const match of readFileSync(current, "utf8").matchAll(
      /(?:from|import)\s*\(?\s*"(\.[^"]*)"/g,
    )) {
      const base = join(dirname(current), match[1] ?? "");
      for (const candidate of [
        base,
        `${base}.ts`,
        `${base}.tsx`,
        join(base, "index.ts"),
        join(base, "index.tsx"),
      ]) {
        if (existsSync(candidate) && statSync(candidate).isFile()) {
          queue.push(candidate);
          break;
        }
      }
    }
  }
  return [...seen];
}

const CARD_SOURCE = join(import.meta.dirname, "..", "src", "og", "card.tsx");

describe("the OG route family, as files (T-WEB-S204)", () => {
  const appDir = APP_DIR;
  const cardSource = CARD_SOURCE;

  const dailyCardFile = (game: string) =>
    join(appDir, game, "opengraph-image.tsx");
  const archiveCardFile = (game: string) =>
    join(appDir, "arquivo", "[data]", game, "opengraph-image.tsx");

  it("the ROOT site card reaches no database, transitively", () => {
    const graph = moduleGraph(cardSource);
    for (const path of graph) {
      const source = code(readFileSync(path, "utf8"));
      expect.soft(source, path).not.toContain("@miolos/db");
      expect.soft(source, path).not.toContain('"../src/db"');
      expect.soft(source, path).not.toContain("getDb");
    }

    for (const game of GAMES) {
      for (const entry of [dailyCardFile(game), archiveCardFile(game)]) {
        const reachesTheWall = moduleGraph(entry).filter((path) =>
          code(readFileSync(path, "utf8")).includes("@miolos/db"),
        );
        expect.soft(reachesTheWall, entry).not.toEqual([]);
      }
    }

    expect(graph.length).toBeGreaterThanOrEqual(3);
  });

  it("the eight dated routes are force-dynamic, and the card INVENTORY is complete", () => {
    for (const game of GAMES) {
      for (const entry of [dailyCardFile(game), archiveCardFile(game)]) {
        expect
          .soft(code(readFileSync(entry, "utf8")), entry)
          .toContain('export const dynamic = "force-dynamic"');
      }
    }

    expect(existsSync(ROOT_CARD_MODULE)).toBe(false);
    expect(existsSync(ROOT_CARD_ASSET)).toBe(true);
    expect(existsSync(ROOT_CARD_ALT)).toBe(true);

    expect(readFileSync(ROOT_CARD_ALT, "utf8")).toBe(ogCopy.altSite);

    expect(existsSync(ARCHIVE_CARD_ASSET)).toBe(true);
    expect(existsSync(ARCHIVE_CARD_ALT)).toBe(true);

    expect(readFileSync(ARCHIVE_CARD_ALT, "utf8")).toBe(ogCopy.altArchiveIndex);
    expect(readFileSync(ARCHIVE_CARD_ALT).at(-1)).not.toBe(0x0a);
    expect(readFileSync(ROOT_CARD_ALT).at(-1)).not.toBe(0x0a);

    for (const entry of [DAY_CARD_ROUTE, MONTH_CARD_ROUTE]) {
      expect
        .soft(code(readFileSync(entry, "utf8")), entry)
        .toContain('export const dynamic = "force-dynamic"');
    }
  });

  it("within each family the four files differ ONLY in the game token", () => {
    for (const [family, of] of [
      ["daily", dailyCardFile],
      ["archive", archiveCardFile],
    ] as const) {
      const normalised = GAMES.map((game) =>
        readFileSync(of(game), "utf8").replaceAll(game, "<jogo>"),
      );
      expect.soft(new Set(normalised).size, family).toBe(1);
    }
  });

  it("every member of GAMES has a route in each family and an alt string", () => {
    expect(GAMES).toHaveLength(4);
    for (const game of GAMES) {
      expect.soft(existsSync(dailyCardFile(game)), game).toBe(true);
      expect.soft(existsSync(archiveCardFile(game)), game).toBe(true);
      const name = messages.games[game].name;
      expect.soft(ogCopy.altGame(name), game).toContain(name);
    }
  });
});

describe("every committed card is the code's own render (T-WEB-S212)", () => {
  const committedCards: [
    string,
    string,
    () => ReturnType<typeof actualCard.siteCard>,
    string,
  ][] = [
    [
      "app/opengraph-image.png",
      ROOT_CARD_ASSET,
      actualCard.siteCard,
      "WRITE_SITE_CARD",
    ],
    [
      "app/arquivo/opengraph-image.png",
      ARCHIVE_CARD_ASSET,
      actualCard.archiveIndexCard,
      "WRITE_ARCHIVE_CARD",
    ],
  ];

  it.each(committedCards)(
    "%s equals a fresh rasterisation of its own builder",
    async (label, assetPath, build, variable) => {
      const rendered = Buffer.from(
        await new ImageResponse(build(), {
          width: 1200,
          height: 630,
          fonts: FONTS,
        }).arrayBuffer(),
      );

      if (process.env[variable] === "1") {
        writeFileSync(assetPath, rendered);
      }

      const committed = readFileSync(assetPath);

      for (const [half, png] of [
        ["rendered", rendered],
        ["committed", committed],
      ] as const) {
        expect
          .soft([...png.subarray(0, 4)], `${label} ${half}`)
          .toEqual([0x89, 0x50, 0x4e, 0x47]);
        expect.soft(png.readUInt32BE(16), `${label} ${half}`).toBe(1200);
        expect.soft(png.readUInt32BE(20), `${label} ${half}`).toBe(630);
        expect.soft(png.length, `${label} ${half}`).toBeGreaterThan(10_000);
      }

      expect(
        createHash("sha256").update(committed).digest("hex"),
        `${label} is stale — see this suite's doc block to regenerate`,
      ).toBe(createHash("sha256").update(rendered).digest("hex"));
    },
  );

  it("each committed card is its OWN card and not another one", async () => {
    const gameCardPng = Buffer.from(
      await new ImageResponse(
        actualCard.gameCard({ game: "termo", longDate: "1 de maio de 2026" }),
        { width: 1200, height: 630, fonts: FONTS },
      ).arrayBuffer(),
    );
    const root = readFileSync(ROOT_CARD_ASSET);
    const archive = readFileSync(ARCHIVE_CARD_ASSET);
    expect(root.equals(gameCardPng)).toBe(false);
    expect(archive.equals(gameCardPng)).toBe(false);
    expect(root.equals(archive)).toBe(false);
  });
});

describe("the two archive shell cards are existence proofs (T-WEB-S334)", () => {
  const DAY = "2026-08-21";
  const MONTH = "2026-02";
  const REFUSAL = "private, no-cache, no-store, max-age=0, must-revalidate";

  const pair = (date: string, game: Game) => ({ date, game });

  it("(1) a past day with a PARTIAL game set renders a 1200x630 PNG", async () => {
    spies.listArchivedDays.mockResolvedValue([pair(DAY, "binairo")]);
    const response = await handlers.archiveDayCardHandler(DAY);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe(REFUSAL);
    const png = Buffer.from(await response.arrayBuffer());
    expect([...png.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
  });

  it("(2) the reader is called with limit: 1, and its return is read ONLY for length", async () => {
    spies.listArchivedDays.mockResolvedValue([pair(DAY, "binairo")]);
    const first = Buffer.from(
      await (await handlers.archiveDayCardHandler(DAY)).arrayBuffer(),
    );
    expect(spies.listArchivedDays).toHaveBeenCalledWith(spies.stubDb, {
      from: DAY,
      to: DAY,
      limit: 1,
    });

    spies.listArchivedDays.mockResolvedValue([
      pair(DAY, "termo"),
      pair(DAY, "sudoku"),
      pair(DAY, "nonogram"),
    ]);
    const second = Buffer.from(
      await (await handlers.archiveDayCardHandler(DAY)).arrayBuffer(),
    );
    expect(first.equals(second)).toBe(true);

    expect(first.length).toBeGreaterThan(10_000);
    const other = Buffer.from(
      await (await handlers.archiveDayCardHandler("2026-05-01")).arrayBuffer(),
    );
    expect(other.equals(first)).toBe(false);
  });

  it("(3) an empty day 404s, with CARD_HEADERS", async () => {
    spies.listArchivedDays.mockResolvedValue([]);
    const response = await handlers.archiveDayCardHandler("1999-01-01");
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe(REFUSAL);
    expect(await response.arrayBuffer()).toHaveProperty("byteLength", 0);
  });

  it("(4) TODAY is not special-cased: the same walled read, and its empty answer 404s", async () => {
    const today = todaySaoPauloDate(new Date());
    spies.listArchivedDays.mockResolvedValue([]);
    const response = await handlers.archiveDayCardHandler(today);
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe(REFUSAL);

    expect(spies.listArchivedDays).toHaveBeenCalledWith(spies.stubDb, {
      from: today,
      to: today,
      limit: 1,
    });
  });

  it("(5) a malformed day segment 404s with the reader NEVER called", async () => {
    for (const segment of [
      "mes",
      "lixo",
      "2026-02-30",
      "0000-01-01",
      "",
      "../../etc/passwd",
      "//evil.example.com",
    ]) {
      const response = await handlers.archiveDayCardHandler(segment);
      expect.soft(response.status, segment).toBe(404);
      expect.soft(response.headers.get("cache-control"), segment).toBe(REFUSAL);
    }
    expect(spies.listArchivedDays).not.toHaveBeenCalled();
  });

  it("(6) a month with days renders, over the month's OWN bounds", async () => {
    spies.listArchivedDays.mockResolvedValue([pair("2026-02-22", "sudoku")]);
    const response = await handlers.archiveMonthCardHandler(MONTH);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");

    expect(spies.listArchivedDays).toHaveBeenCalledWith(spies.stubDb, {
      from: "2026-02-01",
      to: "2026-02-28",
      limit: 1,
    });
  });

  it("(7) an empty or future month 404s, and a malformed one never reads", async () => {
    spies.listArchivedDays.mockResolvedValue([]);
    for (const segment of ["9999-01", "1999-12"]) {
      const response = await handlers.archiveMonthCardHandler(segment);
      expect.soft(response.status, segment).toBe(404);
      expect.soft(response.headers.get("cache-control"), segment).toBe(REFUSAL);
    }
    expect(spies.listArchivedDays).toHaveBeenCalledTimes(2);

    spies.listArchivedDays.mockClear();
    for (const segment of ["lixo", "2026-13", "2026-00", "0000-01", ""]) {
      const response = await handlers.archiveMonthCardHandler(segment);
      expect.soft(response.status, segment).toBe(404);
      expect.soft(response.headers.get("cache-control"), segment).toBe(REFUSAL);
    }
    expect(spies.listArchivedDays).not.toHaveBeenCalled();
  });

  it("(8) a throwing READER propagates — these handlers have NO catch, on purpose", async () => {
    for (const error of [
      named("ZodError"),
      named("DailyProjectionUnsupportedError"),
      new Error("neon: connection terminated"),
    ]) {
      spies.listArchivedDays.mockRejectedValue(error);
      await expect
        .soft(handlers.archiveDayCardHandler(DAY), error.name)
        .rejects.toThrow(error.message);
      await expect
        .soft(handlers.archiveMonthCardHandler(MONTH), error.name)
        .rejects.toThrow(error.message);
    }
  });

  it("(9) a throwing CARD BUILDER propagates too, and is not converted into a 404", async () => {
    spies.listArchivedDays.mockResolvedValue([pair(DAY, "binairo")]);
    spies.archiveCard.mockImplementation(() => {
      throw new Error("synthetic satori failure");
    });
    await expect(handlers.archiveDayCardHandler(DAY)).rejects.toThrow(
      "synthetic satori failure",
    );
    await expect(handlers.archiveMonthCardHandler(MONTH)).rejects.toThrow(
      "synthetic satori failure",
    );
  });

  it("(10) the card's two strings come from the URL, never from the row", async () => {
    spies.listArchivedDays.mockResolvedValue([pair(DAY, "binairo")]);
    await handlers.archiveDayCardHandler("2026-11-20");
    expect(spies.archiveCard).toHaveBeenCalledWith({
      display: formatDayAndMonth("2026-11-20"),
      caption: ogCopy.archiveDayCaption("2026"),
    });

    spies.archiveCard.mockClear();
    await handlers.archiveMonthCardHandler("2026-11");
    expect(spies.archiveCard).toHaveBeenCalledWith({
      display: formatMonth("2026-11-01"),
      caption: messages.archive.title,
    });
  });
});

describe("the archive cards' trace shape cannot be simplified back (T-WEB-S336)", () => {
  const MODULE_EXTENSIONS = ["ts", "tsx", "js", "jsx"];
  const SHELL_STEMS = [
    join(APP_DIR, "arquivo", "opengraph-image"),
    join(APP_DIR, "arquivo", "[data]", "opengraph-image"),
    join(APP_DIR, "arquivo", "mes", "[mes]", "opengraph-image"),
  ];

  it("no opengraph-image MODULE exists on any of the three archive SHELL segments", () => {
    const found = SHELL_STEMS.flatMap((stem) =>
      MODULE_EXTENSIONS.map((extension) => `${stem}.${extension}`),
    ).filter((path) => existsSync(path));
    expect(found).toEqual([]);

    const playRouteModules = GAMES.map((game) =>
      join(APP_DIR, "arquivo", "[data]", game, "opengraph-image.tsx"),
    ).filter((path) => existsSync(path));
    expect(playRouteModules).toHaveLength(4);

    expect(existsSync(`${SHELL_STEMS[0]}.png`)).toBe(true);
  });

  it("both card handlers reach the wall and NOTHING from the play surface", () => {
    for (const entry of [DAY_CARD_ROUTE, MONTH_CARD_ROUTE]) {
      const graph = moduleGraph(entry);

      const reachesTheWall = graph.filter((path) =>
        code(readFileSync(path, "utf8")).includes("@miolos/db"),
      );
      expect.soft(reachesTheWall, entry).not.toEqual([]);
      expect.soft(graph.length, entry).toBeGreaterThanOrEqual(5);

      for (const path of graph) {
        const source = code(readFileSync(path, "utf8"));
        for (const forbidden of [
          "/src/play/",
          "/src/day/",
          "readDayState",
          "useDayTruth",
        ]) {
          expect
            .soft(source, `${forbidden} in ${path}`)
            .not.toContain(forbidden);
        }
      }
    }
  });

  it("the archive card BUILDER's own graph reaches no reader at all", () => {
    for (const path of moduleGraph(CARD_SOURCE)) {
      const source = code(readFileSync(path, "utf8"));
      expect.soft(source, path).not.toContain("@miolos/db");
      expect.soft(source, path).not.toContain("getDb");
    }
    expect(moduleGraph(CARD_SOURCE).length).toBeGreaterThanOrEqual(3);
  });
});

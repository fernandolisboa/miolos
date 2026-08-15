// @vitest-environment node
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";

import { ImageResponse } from "next/og";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { formatLongDate, messages } from "../src/i18n";
import { FONTS } from "../src/og/fonts";

const FONT_DIR = join(import.meta.dirname, "../assets/fonts");

/**
 * THE REPO'S FIRST NODE-ENVIRONMENT SUITE, and the pragma above is the whole
 * reason it exists (#34, ADR-0054).
 *
 * `apps/web/vitest.config.ts` is nine lines with `environment: "jsdom"` and
 * no `environmentMatchGlobs`, and `ImageResponse` FAILS under jsdom — not at
 * import but at rasterisation: the bundle calls
 * `sharp(new TextEncoder().encode(svg))`, and jsdom's realm-local
 * `TextEncoder` produces a `Uint8Array` that fails sharp's `instanceof` check
 * in the Node realm, giving `Unsupported input '60,115,118,103,…' of type
 * object`. The docblock pragma fixes it and the default include glob already
 * matches this filename, so no config change is owed.
 *
 * Only the claims that genuinely need a rasteriser or a real `Response` live
 * here. Everything about the element tree is asserted in `og-card.test.tsx`,
 * in jsdom, without pixels.
 */

const spies = vi.hoisted(() => ({
  stubDb: { marker: "stub-db" },
  getDb: vi.fn(),
  getPublishedDaily: vi.fn(),
  getTodayDaily: vi.fn(),
  gameCard: vi.fn(),
}));

vi.mock("../src/db", () => ({ getDb: spies.getDb }));
vi.mock("@miolos/db", () => ({
  getPublishedDaily: spies.getPublishedDaily,
  getTodayDaily: spies.getTodayDaily,
}));
/**
 * The card builder is spied THROUGH, not replaced: every row below renders the
 * real tree, and only row (6) makes it throw. That row needs a genuine
 * builder failure — a throwing field on the mocked row does not reach the
 * archive handler at all, because the archive card's date comes from the URL
 * segment and never from the row (the first green run proved it by passing on
 * the daily family and failing on the archive one).
 */
vi.mock("../src/og/card", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/og/card")>()),
  gameCard: spies.gameCard,
}));

const actualCard =
  await vi.importActual<typeof import("../src/og/card")>("../src/og/card");
const handlers = await import("../src/og/handlers");

const GAMES = ["binairo", "sudoku", "nonogram", "termo"] as const;

/** A published row, with a date that is nothing like today's. */
const PUBLISHED_DATE = "2026-02-22";
function row(game: (typeof GAMES)[number]) {
  return { game, date: PUBLISHED_DATE };
}

/** A throw whose `name` is what the handlers narrow on. */
function named(name: string): Error {
  const error = new Error(`synthetic ${name}`);
  error.name = name;
  return error;
}

beforeEach(() => {
  spies.getDb.mockReturnValue(spies.stubDb);
  spies.gameCard.mockImplementation(actualCard.gameCard);
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("the OG image routes read the wall as an existence proof (T-WEB-S203)", () => {
  // The grid is stated PER FAMILY rather than as "both families", because the
  // two families do not have the same rows: the daily handler parses no date,
  // so three archive rows have no daily analogue and two daily rows have no
  // archive one.

  describe.each(GAMES)("%s — both families", (game) => {
    /**
     * `[family, call, reader, callDated]`. `callDated` exists because the two
     * families take their date from DIFFERENT places and the sentinel row
     * below has to be able to move each one: the archive card's date is the
     * URL segment (parsed before the read), the daily card's is the row the DB
     * clock returned. A floor written against `row.date` alone is vacuous on
     * the archive family — which is exactly how the first green run failed.
     */
    const calls: [
      string,
      () => Promise<Response>,
      ReturnType<typeof vi.fn>,
      (date: string) => Promise<Response>,
    ][] = [
      [
        "archive",
        () => handlers.archiveCardHandler(game, PUBLISHED_DATE),
        spies.getPublishedDaily,
        (date) => handlers.archiveCardHandler(game, date),
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
        // A real PNG: the magic bytes, then the IHDR's own dimensions.
        expect([...png.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
        expect(png.readUInt32BE(16)).toBe(1200);
        expect(png.readUInt32BE(20)).toBe(630);
      },
    );

    it.each(calls)(
      "(2) %s: undefined refuses with 404",
      async (_family, call, reader) => {
        // Archive: future, unpublished or killed. Daily: nothing published today.
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
        // The catch is narrowed ON PURPOSE. A 404 on this surface is
        // negative-cached by social scrapers for days, there is no bad row to
        // name in the log, and the card stays dead long after the database is
        // back. A 500 is retried and pages somebody.
        const error = vi.spyOn(console, "error").mockImplementation(() => {});
        reader.mockRejectedValue(new Error("connect ETIMEDOUT"));
        await expect(call()).rejects.toThrow("connect ETIMEDOUT");
        expect(error).not.toHaveBeenCalled();
      },
    );

    it.each(calls)(
      "(6) %s: a throw from the CARD BUILDER propagates too — the try wraps the read alone",
      async (_family, call, reader) => {
        // Without this row, a later edit could widen the `try` to the whole
        // handler — converting every card-render bug into a silent 404 — and
        // every other row here would stay green.
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
        // Next's `ImageResponse` defaults to `public, max-age=0,
        // must-revalidate` in production, and `public` is precisely the token
        // that lets a shared intermediary hold bytes a `killed_at` takedown
        // must be able to reach. `force-dynamic` governs Next's ROUTE cache,
        // not this header.
        reader.mockResolvedValue(row(game));
        expect((await call()).headers.get("cache-control")).toBe(
          "private, no-cache, no-store, max-age=0, must-revalidate",
        );
      },
    );

    it.each(calls)(
      "no field of the row reaches the card except its date",
      async (_family, call, reader, callDated) => {
        // Every field a sentinel, and none of them may appear in the PNG's
        // own text — which for a raster means: the render is byte-identical
        // to one built from a row carrying different sentinels. The date is
        // the ONE value that does reach the tree, so it is held equal.
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
        // Counted floor: the render is not empty, and the DATE does move it —
        // so the byte-identity above is a real exclusion and not a dead
        // renderer. Each family is moved through its OWN date source.
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
      // Zod before any read: a hostile `[data]` costs no database round trip.
      for (const segment of ["lixo", "2026-02-30", "", "../../etc/passwd"]) {
        const response = await handlers.archiveCardHandler(game, segment);
        expect.soft(response.status, segment).toBe(404);
      }
      expect(spies.getPublishedDaily).not.toHaveBeenCalled();
    });

    it("(9) TODAY's permalink renders — one predicate, no today branch", async () => {
      // `published_at <= now()` IS "date <= today (Sao Paulo)", because the
      // buffer writes `published_at` as the date's own Sao Paulo midnight. So
      // the today case needs no classifier and no second round trip, and the
      // midnight race a three-read path would have is structurally absent.
      spies.getPublishedDaily.mockResolvedValue(row(game));
      const response = await handlers.archiveCardHandler(game, "2026-08-15");
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
      await handlers.archiveCardHandler(game, PUBLISHED_DATE);
      const line = String(error.mock.calls[0]?.[0]);
      expect(line).toContain(game);
      expect(line).toContain(PUBLISHED_DATE);
    });
  });

  describe.each(GAMES)("%s — daily only", (game) => {
    it("(11) the bad-row log line carries the GAME ONLY, in its own written form", async () => {
      // NOT an oversight, and asserted as its own form rather than as the
      // absence of a date: this handler never parses a date, and the value it
      // would log lives on the row `getTodayDaily` threw instead of returning.
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
          await handlers.archiveCardHandler(game, PUBLISHED_DATE)
        ).arrayBuffer(),
      );
      // COUNTED FLOOR, and the red run is what asked for it: against the stub
      // handlers both bodies were empty, so `equals` was trivially true and
      // this was the one row in the suite that passed before either handler
      // had a body. Two real PNGs, or the comparison below means nothing.
      expect([...fromRow.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
      expect(fromRow.length).toBeGreaterThan(1000);
      // Same game, same date, two families, one card: the daily route's
      // `longDate` is `formatLongDate(row.date)` and nothing else.
      expect(fromRow.equals(fromUrl)).toBe(true);
      expect(formatLongDate(PUBLISHED_DATE)).toBe("22 de fevereiro de 2026");
    });
  });
});

describe("the committed fonts are the faces the card was designed against (T-WEB-S202)", () => {
  /**
   * A minimal OpenType table reader. The `pwa-manifest.test.ts:30-40`
   * `pngDimensions` idiom applied to a TTF: read the bytes the gate is about,
   * rather than trusting a filename or a checksum line the same commit could
   * rewrite.
   */
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
    // A VARIABLE FONT IS A 500, NOT A FALLBACK. The bundled satori's
    // `parseFvarAxis` reads `font.names`, which the bundle never assigns, so
    // ANY face with an `fvar` table raises `TypeError: Cannot read properties
    // of undefined` — an uncaught 500 on a crawler-facing route. And satori
    // synthesises no weight either: a missing one renders byte-identically to
    // the nearest registered face, silently.
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
    // THE ARM THE OTHER THREE ARE BLIND TO. `fvar` absence, the family name
    // and `usWeightClass` all pass IDENTICALLY on every Fraunces optical cut,
    // and the 24, 28 and 36pt cuts are 71,648 bytes EACH — so a mistyped
    // `opsz` term landing one bucket away produces a file of exactly the
    // expected size whose every other assertion holds. `name` ID 16 and
    // `OS/2.xAvgCharWidth` are the only two things that can tell them apart
    // (1148 / 1155 / 1159 for 36 / 28 / 24).
    const fraunces = readFace("Fraunces-36pt-500.ttf");
    expect(fraunces.nameId1).toBe("Fraunces 36pt Medium");
    expect(fraunces.nameId16).toBe("Fraunces 36pt");
    expect(fraunces.xAvgCharWidth).toBe(1148);

    // Asserted per face LITERALLY, not as a rule with a fallback: `name` ID 16
    // is ELIDED on the RIBBI regular, so the 400 face has no Typographic
    // Family record at all and a loop asserting `nameId16 === family` would
    // be red on one of three.
    const regular = readFace("InstrumentSans-400.ttf");
    expect(regular.nameId1).toBe("Instrument Sans");
    expect(regular.nameId16).toBeUndefined();

    const semibold = readFace("InstrumentSans-600.ttf");
    expect(semibold.nameId1).toBe("Instrument Sans SemiBold");
    expect(semibold.nameId16).toBe("Instrument Sans");

    // `xAvgCharWidth` is asserted on Fraunces ONLY, deliberately: it is there
    // to pin the optical cut, and Instrument Sans has no optical axis.
  });

  it("the on-disk digests equal the ones SHA256SUMS records", () => {
    // Necessary and NOT sufficient — it compares each file against a line the
    // same commit could rewrite, which is why the cut is also asserted
    // intrinsically above. What it does buy: the recorded `css2` URL, with
    // its `opsz` term, stays attached to the bytes it produced.
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
    // The `opsz` term is the half a plain digest cannot protect.
    expect(sums).toContain("family=Fraunces:opsz,wght@36,500");
  });

  it("the longest realistic card and the site card both rasterise", async () => {
    // "Nonogram" over "22 de fevereiro de 2026" — 23 characters, the true
    // pt-BR maximum at `dateStyle: "long"` (fevereiro beats setembro's 22).
    // Satori OVERFLOWS a fixed container silently rather than wrapping
    // visibly, so the longest content is the case worth a raster.
    for (const [label, tree] of [
      [
        "longest game card",
        actualCard.gameCard({
          game: "nonogram",
          longDate: "22 de fevereiro de 2026",
        }),
      ],
      ["site card", actualCard.siteCard()],
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
    // THE ONLY THING THAT CATCHES A MISSING FACE. Satori synthesises nothing
    // and reports nothing: with a face absent it renders the nearest
    // registered one and returns a perfectly valid PNG. If these two bytes
    // matched, the Fraunces file would not be reaching the card at all.
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
    // Both are real renders, so the difference is the FACE and not a throw.
    expect(withoutFraunces.length).toBeGreaterThan(10_000);
  });
});

describe("the OG route family, as files (T-WEB-S204)", () => {
  const appDir = join(import.meta.dirname, "..", "app");
  const rootCard = join(appDir, "opengraph-image.tsx");
  const dailyCard = (game: string) => join(appDir, game, "opengraph-image.tsx");
  const archiveCard = (game: string) =>
    join(appDir, "arquivo", "[data]", game, "opengraph-image.tsx");

  /**
   * The file with its comments removed, so every scan below counts CODE and
   * not the doc blocks that discuss the wall at length. The same stripper
   * `eslint-db-wall.test.ts` and `archive-routes.test.ts` use, and it is
   * load-bearing twice over here: `src/i18n/sao-paulo-day.ts` says "Declared
   * here rather than imported from `@miolos/db`" in a comment and imports
   * nothing of the kind, and the root card's own doc block explains at length
   * why it carries no `force-dynamic`.
   */
  function code(source: string): string {
    return source
      .replaceAll(/\/\*[\s\S]*?\*\//g, "")
      .replaceAll(/(^|[^:])\/\/.*$/gm, "$1");
  }

  /** Every module reachable from `entry` by RELATIVE import — the walker idiom. */
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

  it("the ROOT site card reaches no database, transitively", () => {
    // A MODULE-GRAPH SCAN, and the mechanism is a source grep over each node
    // rather than path membership. The walker resolves RELATIVE specifiers
    // only, so a bare `@miolos/db` never becomes a node and any assertion
    // written as `graph.filter(p => p.includes("@miolos/db"))` is
    // structurally empty — on the root card and on the eight game routes
    // alike. Both halves are therefore written in the same terms.
    const graph = moduleGraph(rootCard);
    for (const path of graph) {
      const source = code(readFileSync(path, "utf8"));
      expect.soft(source, path).not.toContain("@miolos/db");
      expect.soft(source, path).not.toContain('"../src/db"');
      expect.soft(source, path).not.toContain("getDb");
    }

    // THE COUNTED FLOOR, in the same terms, which is what makes the absence
    // above a DIFFERENCE rather than a broken scan: every one of the eight
    // game routes reaches `src/og/handlers.ts`, whose source DOES contain
    // `@miolos/db`. Same walker, same grep, opposite answer.
    for (const game of GAMES) {
      for (const entry of [dailyCard(game), archiveCard(game)]) {
        const reachesTheWall = moduleGraph(entry).filter((path) =>
          code(readFileSync(path, "utf8")).includes("@miolos/db"),
        );
        expect.soft(reachesTheWall, entry).not.toEqual([]);
      }
    }
    // And the root card's graph is not a one-element accident.
    expect(graph.length).toBeGreaterThanOrEqual(3);
  });

  it("the eight dated routes are force-dynamic and the root card is NOT", () => {
    // Route segment config comes from the layouts on the path plus the leaf,
    // and `find apps/web/app -name layout.tsx` returns exactly one file — the
    // root — so the export is required on each of the eight, not decorative.
    // The ABSENCE on the root card is asserted too: it reads nothing, cannot
    // go stale, and is prerendered at build (one `○`, eight `ƒ`).
    for (const game of GAMES) {
      for (const entry of [dailyCard(game), archiveCard(game)]) {
        expect
          .soft(code(readFileSync(entry, "utf8")), entry)
          .toContain('export const dynamic = "force-dynamic"');
      }
    }
    expect(code(readFileSync(rootCard, "utf8"))).not.toContain("force-dynamic");
  });

  it("within each family the four files differ ONLY in the game token", () => {
    // The `T-WEB-S185` byte-identity idiom: eight near-identical files are
    // exactly where a per-game divergence hides.
    for (const [family, of] of [
      ["daily", dailyCard],
      ["archive", archiveCard],
    ] as const) {
      const normalised = GAMES.map((game) =>
        readFileSync(of(game), "utf8").replaceAll(game, "<jogo>"),
      );
      expect.soft(new Set(normalised).size, family).toBe(1);
    }
  });

  it("every member of GAMES has a route in each family and an alt string", () => {
    // A fifth game would otherwise gain a working page and a silently missing
    // card: none of #34's four per-game surfaces is `ProjectedGame`-bound.
    // This half fires once someone writes the fifth game's entry; the half
    // that reaches the author BEFORE they write anything is the route recipe
    // in ADR-0028 `:179-192` and ADR-0039 `:42-44`.
    expect(GAMES).toHaveLength(4);
    for (const game of GAMES) {
      expect.soft(existsSync(dailyCard(game)), game).toBe(true);
      expect.soft(existsSync(archiveCard(game)), game).toBe(true);
      const name = messages.games[game].name;
      expect.soft(messages.og.altGame(name), game).toContain(name);
    }
  });
});

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
  // #104: the archive SHELL cards' one reader. It is the same wall helper the
  // index, month and day PAGES call, bounded to `limit: 1`.
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
/**
 * The card builder is spied THROUGH, not replaced: every row below renders the
 * real tree, and only `T-WEB-S203` row (6) and `T-WEB-S334` row (9) make one
 * throw. Both are named with their suite, because this file has two numbered
 * row tables and "row (6)" means something in each. Those rows need a genuine
 * builder failure — a throwing field on the mocked row does not reach the
 * archive handler at all, because the archive card's date comes from the URL
 * segment and never from the row (the first green run proved it by passing on
 * the daily family and failing on the archive one).
 */
vi.mock("../src/og/card", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/og/card")>()),
  gameCard: spies.gameCard,
  archiveCard: spies.archiveCard,
}));

const actualCard =
  await vi.importActual<typeof import("../src/og/card")>("../src/og/card");
const handlers = await import("../src/og/handlers");

/**
 * `GAMES` IS IMPORTED FROM `@miolos/core`, never re-typed as a local literal
 * of the same four tokens (step-6 finding Q1). A re-typed copy makes every
 * coverage assertion below self-referential — `expect(GAMES).toHaveLength(4)`
 * against a literal declared four lines up is a tautology — and the fifth
 * game it exists to catch was MEASURED: adding `kakuro` to
 * `packages/core/src/game.ts` left all six OG suites green. Against the
 * imported constant the same length assertion is a real tripwire, and the
 * per-game existence checks below become the thing that reds when a fifth
 * game gains a page and no card. `hoje.smoke.test.tsx:1` is the shipped idiom.
 */

/** A published row, with a date that is nothing like today's. */
const PUBLISHED_DATE = "2026-02-22";
function row(game: Game) {
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
  spies.archiveCard.mockImplementation(actualCard.archiveCard);
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
      "(7b) %s: THE REFUSAL carries it too — a 404 here goes stale at midnight",
      async (_family, call, reader) => {
        // Step-6 finding K2: this arm shipped with no `cache-control` at all,
        // on the surface whose own doc block argues that a 404 is
        // negative-cached by social scrapers for days. A refusal is the
        // response whose truth flips at São Paulo midnight — today's card
        // 404s until the day is published, and tomorrow's archive card 404s
        // until tomorrow — so it needs the header at least as much as the 200
        // does. Both refusal shapes, since they are different `return`s.
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
        const response = await handlers.archiveGameCardHandler(game, segment);
        expect.soft(response.status, segment).toBe(404);
        // The pre-read refusal is a third `return refuse()` and carries the
        // same header as the other two (K2).
        expect
          .soft(response.headers.get("cache-control"), segment)
          .toBe("private, no-cache, no-store, max-age=0, must-revalidate");
      }
      expect(spies.getPublishedDaily).not.toHaveBeenCalled();
    });

    it("(9) TODAY's permalink renders — one predicate, no today branch", async () => {
      // `published_at <= now()` IS "date <= today (Sao Paulo)", because the
      // buffer writes `published_at` as the date's own Sao Paulo midnight. So
      // the today case needs no classifier and no second round trip, and the
      // midnight race a three-read path would have is structurally absent.
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
          await handlers.archiveGameCardHandler(game, PUBLISHED_DATE)
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
      // #104's three archive cards, at the worst cases plan 068 §12.2
      // MEASURED rather than guessed. The widest day-and-month is
      // "20 de novembro" (729px of 890px inner width) and the widest month is
      // "novembro de 2028" (843px) — neither is the longest by character
      // count, because Fraunces' figures are not tabular. The full
      // `formatLongDate` output was 1111px and is why the day card splits.
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

const APP_DIR = join(import.meta.dirname, "..", "app");
/**
 * THE ROOT CARD IS A STATIC ASSET, NOT A ROUTE (step-6 blocker B1). A
 * file-convention metadata MODULE on the root segment is resolved into the
 * metadata graph of every descendant route, so `app/opengraph-image.tsx`
 * dragged `next/og` — `@vercel/og`, `resvg.wasm`, `sharp` and libvips — into
 * the traced payload of 24 routes that mostly render no card at all: 13 of
 * them fell from ~23 MB to ~2.2 MB when it became a PNG, 271 MB across the
 * build. The card is still generated in code (AC 2); only the moment moved,
 * from build-time prerender to commit-time render, pinned by `T-WEB-S212`.
 */
const ROOT_CARD_ASSET = join(APP_DIR, "opengraph-image.png");
const ROOT_CARD_ALT = join(APP_DIR, "opengraph-image.alt.txt");
const ROOT_CARD_MODULE = join(APP_DIR, "opengraph-image.tsx");

/**
 * THE SECOND STATIC ASSET PAIR (#104, ADR-0071 decision 2). The archive INDEX
 * card is dateless, its page never 404s and it reads nothing, so it can be a
 * file — and a file in a segment costs no trace on any descendant page route,
 * which is exactly what D9's measurement proved when the root module became a
 * PNG.
 *
 * **It serves `/arquivo` AND NOTHING UNDER IT**, and plan 068 said otherwise
 * in three places. Measured on a real production build: `/arquivo` shows this
 * card, while `/arquivo/<malformada>` and `/arquivo/mes/<malformado>` both
 * show the ROOT card. Two independent reasons — a `notFound()` DISCARDS the
 * route's composed metadata in Next 16.2.12, and an `opengraph-image` file
 * reaches descendant segments only from a segment owning a `layout.tsx`,
 * which `app/arquivo/` does not (the app has exactly one layout, the root).
 * So ADR-0054 decision 8's malformed-segment residual is UNCHANGED by #104,
 * not narrowed, and the index card's justification is its own page.
 */
const ARCHIVE_CARD_ASSET = join(APP_DIR, "arquivo", "opengraph-image.png");
const ARCHIVE_CARD_ALT = join(APP_DIR, "arquivo", "opengraph-image.alt.txt");

/** The two `/cartao` route handlers — functions, at their own URLs. */
const DAY_CARD_ROUTE = join(APP_DIR, "cartao", "[data]", "route.ts");
const MONTH_CARD_ROUTE = join(APP_DIR, "cartao", "mes", "[mes]", "route.ts");

/**
 * The file with its comments removed, so every scan below counts CODE and
 * not the doc blocks that discuss the wall at length. The same stripper
 * `eslint-db-wall.test.ts` and `archive-routes.test.ts` use, and it is
 * load-bearing here: `src/i18n/sao-paulo-day.ts` says "Declared here rather
 * than imported from `@miolos/db`" in a comment and imports nothing of the
 * kind, and `src/og/card.tsx`'s own doc blocks discuss the wall at length.
 *
 * Hoisted out of `T-WEB-S204`'s describe at #104, unchanged, because
 * `T-WEB-S336` needs the same two helpers over the two `/cartao` handlers.
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

/** The module that BUILDS the root card, now that no route file does. */
const CARD_SOURCE = join(import.meta.dirname, "..", "src", "og", "card.tsx");

describe("the OG route family, as files (T-WEB-S204)", () => {
  const appDir = APP_DIR;
  const cardSource = CARD_SOURCE;
  // PATH builders, named `*File` since #104: `archiveCard` is now an exported
  // BUILDER in `src/og/card.tsx`, and one identifier meaning a path here, a
  // spy above and a React tree there is three meanings of one word in one file.
  const dailyCardFile = (game: string) =>
    join(appDir, game, "opengraph-image.tsx");
  const archiveCardFile = (game: string) =>
    join(appDir, "arquivo", "[data]", game, "opengraph-image.tsx");

  it("the ROOT site card reaches no database, transitively", () => {
    // A MODULE-GRAPH SCAN, and the mechanism is a source grep over each node
    // rather than path membership. The walker resolves RELATIVE specifiers
    // only, so a bare `@miolos/db` never becomes a node and any assertion
    // written as `graph.filter(p => p.includes("@miolos/db"))` is
    // structurally empty — on the card builder and on the eight game routes
    // alike. Both halves are therefore written in the same terms.
    //
    // THE ENTRY IS `src/og/card.tsx` AND NOT A ROUTE FILE, because B1's fix
    // deleted the root route: the property the claim is about — the card
    // that reads nothing reaches no reader — belongs to the builder, and the
    // builder is what `T-WEB-S212` renders to produce the committed PNG.
    const graph = moduleGraph(cardSource);
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
      for (const entry of [dailyCardFile(game), archiveCardFile(game)]) {
        const reachesTheWall = moduleGraph(entry).filter((path) =>
          code(readFileSync(path, "utf8")).includes("@miolos/db"),
        );
        expect.soft(reachesTheWall, entry).not.toEqual([]);
      }
    }
    // And the card builder's graph is not a one-element accident.
    expect(graph.length).toBeGreaterThanOrEqual(3);
  });

  it("the eight dated routes are force-dynamic, and the card INVENTORY is complete", () => {
    // Route segment config comes from the layouts on the path plus the leaf,
    // and `find apps/web/app -name layout.tsx` returns exactly one file — the
    // root — so the export is required on each of the eight, not decorative.
    for (const game of GAMES) {
      for (const entry of [dailyCardFile(game), archiveCardFile(game)]) {
        expect
          .soft(code(readFileSync(entry, "utf8")), entry)
          .toContain('export const dynamic = "force-dynamic"');
      }
    }

    // THE ROOT CARD IS THE ASSET PAIR AND NOTHING ELSE (B1). A module here
    // is not merely a slower way to serve the same bytes: it is resolved
    // into every descendant route's metadata graph, and the whole `next/og`
    // toolchain is traced into functions that render no card. The route
    // table's `○ /opengraph-image` line goes with it — eight `ƒ`, no `○`.
    expect(existsSync(ROOT_CARD_MODULE)).toBe(false);
    expect(existsSync(ROOT_CARD_ASSET)).toBe(true);
    expect(existsSync(ROOT_CARD_ALT)).toBe(true);
    // The `.alt.txt` convention carries the string the deleted module used to
    // export, and Next uses the file's content verbatim — so the deck stays
    // the single source and a translator still edits one place.
    expect(readFileSync(ROOT_CARD_ALT, "utf8")).toBe(ogCopy.altSite);

    // RE-AIMED AT #104 (ADR-0071). "There is no ninth route" was true of #34's
    // tree and is the wrong shape now: the inventory is EIGHT dated `.tsx`
    // routes, TWO static asset pairs and TWO `/cartao` route handlers, and it
    // is stated as an inventory so a later ticket cannot grow it by accident.
    // The second pair is the archive index card. It is a `.png` and NOT a
    // `.tsx`, which is the whole point — `T-WEB-S336` is the tripwire that
    // stops it becoming a module.
    expect(existsSync(ARCHIVE_CARD_ASSET)).toBe(true);
    expect(existsSync(ARCHIVE_CARD_ALT)).toBe(true);
    // Byte-equal to the deck string, and with NO trailing newline: Next reads
    // this file with `readFile(altPath, "utf8")` and uses the bytes verbatim
    // as `og:image:alt`, so a formatter adding a final `\n` would ship it into
    // a meta tag. The root file has none either.
    expect(readFileSync(ARCHIVE_CARD_ALT, "utf8")).toBe(ogCopy.altArchiveIndex);
    expect(readFileSync(ARCHIVE_CARD_ALT).at(-1)).not.toBe(0x0a);
    expect(readFileSync(ROOT_CARD_ALT).at(-1)).not.toBe(0x0a);

    // And the two card handlers carry their own segment config, for the same
    // reason the eight routes do: segment config comes from the layouts on
    // the path plus the leaf, and a sibling `page.tsx` confers nothing.
    for (const entry of [DAY_CARD_ROUTE, MONTH_CARD_ROUTE]) {
      expect
        .soft(code(readFileSync(entry, "utf8")), entry)
        .toContain('export const dynamic = "force-dynamic"');
    }
  });

  it("within each family the four files differ ONLY in the game token", () => {
    // The `T-WEB-S185` byte-identity idiom: eight near-identical files are
    // exactly where a per-game divergence hides.
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
    // A fifth game would otherwise gain a working page and a silently missing
    // card: none of #34's four per-game surfaces is `ProjectedGame`-bound.
    // `GAMES` is the IMPORTED constant (Q1), so this reds the moment
    // `packages/core` grows a member — measured against a `kakuro` probe,
    // which left the old self-referential version green. The half that
    // reaches the author BEFORE they write anything is the route recipe in
    // ADR-0028 `:238-262` — the bullet AND its "(Grown at #34)" note, which
    // is the half naming the two image files — and ADR-0039 `:43-45`.
    // The range moved from `:233` when this same round repaired a "ninth
    // image route" sentence higher in the file (plan 040 D43/D44).
    expect(GAMES).toHaveLength(4);
    for (const game of GAMES) {
      expect.soft(existsSync(dailyCardFile(game)), game).toBe(true);
      expect.soft(existsSync(archiveCardFile(game)), game).toBe(true);
      const name = messages.games[game].name;
      expect.soft(ogCopy.altGame(name), game).toContain(name);
    }
  });
});

// ── T-WEB-S212 ────────────────────────────────────────────────────────

describe("every committed card is the code's own render (T-WEB-S212)", () => {
  /**
   * WHAT KEEPS AC 2 TRUE AFTER B1. "Generated in code" was enforced by the
   * card being a runtime module; with the module deleted, the PNG on disk
   * could drift from `siteCard()` — a hand-edited asset, a token change
   * that never reaches the file, a font swap — and nothing would say so.
   * This is that guard: re-render the tree the same way the deleted route
   * did and compare the bytes.
   *
   * **A TWO-ROW TABLE SINCE #104**, because the repo now commits a SECOND
   * binary: the archive index card at `app/arquivo/opengraph-image.png`. That
   * second binary is the price of ADR-0071 decision 2, and this row is
   * exactly the guard #34 built for the first one — the same render, the same
   * SHA-256, its own `WRITE_` variable.
   *
   * **To regenerate** after an intentional change to a builder, the tokens or
   * the faces:
   *
   * ```
   * WRITE_SITE_CARD=1    pnpm --filter @miolos/web test og-image
   * WRITE_ARCHIVE_CARD=1 pnpm --filter @miolos/web test og-image
   * ```
   *
   * which rewrites that row's PNG from the current tree and then asserts
   * against what it wrote. CI never sets either, so the gate here is a plain
   * equality. Neither variable is on `turbo.json`'s `test.env`, and neither
   * should be: `WRITE_SITE_CARD` is not either, for the same reason — this is
   * a direct package-script invocation, not a turbo task.
   */
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
      // Counted floors first, so a mismatch reports WHICH half moved rather
      // than "two buffers differ": both are real 1200x630 PNGs.
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
    // Anti-vacuity for the equalities above, in the `T-WEB-S202` idiom: two
    // different trees through the same rasteriser must not agree, or the hash
    // comparison would pass on any card at all. Extended at #104 to the
    // sharpest confusion available — the site card and the archive index card
    // share their paper, their tape, their shadow and their two type levels,
    // and differ only in two strings.
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

// ── T-WEB-S334 ────────────────────────────────────────────────────────

describe("the two archive shell cards are existence proofs (T-WEB-S334)", () => {
  /**
   * #104, ADR-0071 decision 4. Each card's existence semantics is its PAGE's,
   * through one bounded `listArchivedDays(…, { limit: 1 })` — the same read
   * the page makes, asked the same question (`days.length === 0`).
   *
   * A refusal is a BARE `Response`, never `notFound()`: there is no page to
   * render a not-found boundary into. And it carries `CARD_HEADERS` for the
   * step-6 finding K2 reason the eight game routes already do — a refusal is
   * exactly the response whose truth flips at São Paulo midnight.
   */
  const DAY = "2026-08-21";
  const MONTH = "2026-02";
  const REFUSAL = "private, no-cache, no-store, max-age=0, must-revalidate";

  /** One archived `(date, game)` pair — no content, by construction. */
  const pair = (date: string, game: Game) => ({ date, game });

  it("(1) a past day with a PARTIAL game set renders a 1200x630 PNG", async () => {
    // THE RAGGED FLOOR IS THE POINT (ADR-0053 decision 3). The archive's
    // oldest days hold one, two or three games, and a `killed_at` takedown
    // produces the same shape. One row is a day, so one row is a card — and
    // the card names no game, so nothing about it is false on such a day.
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
    // The bound is asserted here; the argument for why a bound is NOT what
    // keeps a game off the card lives once, in `handlers.ts`'s module doc
    // block, beside the read. The byte-identity below is the runtime half of
    // the same claim — `archiveCard`'s signature is the structural half, and
    // `T-WEB-S201` polices it from the source side.
    spies.listArchivedDays.mockResolvedValue([pair(DAY, "binairo")]);
    const first = Buffer.from(
      await (await handlers.archiveDayCardHandler(DAY)).arrayBuffer(),
    );
    expect(spies.listArchivedDays).toHaveBeenCalledWith(spies.stubDb, {
      from: DAY,
      to: DAY,
      limit: 1,
    });

    // A DIFFERENT game, and three more rows: the bytes must not move.
    spies.listArchivedDays.mockResolvedValue([
      pair(DAY, "termo"),
      pair(DAY, "sudoku"),
      pair(DAY, "nonogram"),
    ]);
    const second = Buffer.from(
      await (await handlers.archiveDayCardHandler(DAY)).arrayBuffer(),
    );
    expect(first.equals(second)).toBe(true);
    // Counted floor: a real render, and the DATE does move it — so the
    // identity above is a real exclusion and not a dead renderer.
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
    // `listArchivedDays` carries `archivedWallPredicate()` — the publication
    // conjuncts PLUS strictly before the DB clock's São Paulo day — so today
    // comes back empty and the card refuses. Pinned so the semantics cannot
    // change silently. This row is about `/cartao/<hoje>` and makes NO claim
    // about what `/arquivo/<hoje>` emits: that page 307s to `/` with a full
    // HTML body, which is plan 068 §4.2 case B, accepted there.
    // The clock is passed IN, never read inside the helper — which is the
    // shape `sao-paulo-day.ts` requires and the reason this test can name
    // "today" at all without the handler having a clock of its own.
    const today = todaySaoPauloDate(new Date());
    spies.listArchivedDays.mockResolvedValue([]);
    const response = await handlers.archiveDayCardHandler(today);
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe(REFUSAL);
    // No clock branch: the segment goes to the reader unchanged.
    expect(spies.listArchivedDays).toHaveBeenCalledWith(spies.stubDb, {
      from: today,
      to: today,
      limit: 1,
    });
  });

  it("(5) a malformed day segment 404s with the reader NEVER called", async () => {
    // Zod before any read, so a hostile segment costs no round trip. The
    // year-zero case is the one that was a real unauthenticated 500 on the
    // month page, and the card inherits the fix by calling the same parser.
    //
    // `"mes"` IS IN THIS SET DELIBERATELY: `/cartao/mes` with nothing after it
    // matches `app/cartao/[data]/route.ts` with `data = "mes"`, because the
    // `mes` node registers no handler of its own. It parses as no date and
    // refuses, which is correct — and it is exactly the kind of cross-handler
    // shadowing a later tidy-up changes silently.
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
    // 2026 is not a leap year, so February ends on the 28th — the bounds come
    // from `monthDayBounds`, the same helper the month PAGE uses.
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
    // THE ABSENCE IS THE ARGUMENT (plan 068 §4.1). `listArchivedDays` runs no
    // projection and parses nothing, so no member of `PROJECTION_ERROR_NAMES`
    // can arise from it and a narrowed catch would be unreachable code that
    // re-throws everything. Every throw these handlers can see — a Neon
    // timeout, a pool error, a missing credential — is the class that must be
    // a 500. A 404 here would be negative-cached by scrapers for days while
    // the incident went unpaged.
    //
    // `ZodError` is in the table BECAUSE it is the name the game handlers
    // narrow on: if someone ever pastes their catch in here, this reds.
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
    // The `ImageResponse` construction is OUTSIDE any read for exactly this
    // reason, and this is `T-WEB-S203` row (6)'s claim for the new family: a
    // SYNCHRONOUS builder failure must not be converted into a silent 404 by a
    // `try` some later edit widened to the whole handler.
    //
    // WHAT THIS ROW DOES NOT PROVE (step-6 security S4): it mocks the
    // BUILDER, which throws before `new ImageResponse(...)` is reached. A
    // throw inside satori itself lands in the response body's `async start()`,
    // after Next has already committed the 200 and its headers — a truncated
    // 200, not a 500. That is true of all ten card routes and no `try`
    // placement can change it, so the claim is written as the synchronous
    // half rather than as "a satori throw is a 500".
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
    // The day card is RUNG 2: day-and-month at 96px, the year on the caption.
    // Both strings are composed from the segment the URL carried, which is
    // what keeps the read an existence proof rather than a source of pixels.
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

// ── T-WEB-S336 ────────────────────────────────────────────────────────

describe("the archive cards' trace shape cannot be simplified back (T-WEB-S336)", () => {
  /**
   * THE TRIPWIRE UNDER ADR-0071 DECISION 3. The whole reason the day and
   * month cards live at `/cartao/…` is that a metadata image MODULE on an
   * archive shell segment is resolved into the metadata graph of every
   * descendant route: ADR-0054 decision 9 measured `/arquivo`,
   * `/arquivo/[data]` and `/arquivo/mes/[mes]` at 23.5–23.6 MB with one, and
   * 2.7 MB without. A later ticket "simplifying" a card back into its segment
   * would re-inflate three routes silently, and no test in the repo would say
   * so. This is that test.
   *
   * SCOPED BY EXACT PATH AND BY EXTENSION, not by a subtree glob. Four
   * `opengraph-image.tsx` modules DO live under `app/arquivo/**` — the play
   * routes — and must keep existing; and this ticket ships
   * `app/arquivo/opengraph-image.png` at the very stem the negative assertion
   * names, so the assertion has to be about MODULE extensions.
   */
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

    // THE COUNTED FLOOR, the repo's own idiom against a typo'd path making a
    // negative assertion pass vacuously: the FOUR play-route modules under
    // `app/arquivo/[data]/<jogo>/` do exist and are untouched by #104.
    const playRouteModules = GAMES.map((game) =>
      join(APP_DIR, "arquivo", "[data]", game, "opengraph-image.tsx"),
    ).filter((path) => existsSync(path));
    expect(playRouteModules).toHaveLength(4);

    // And the index card really is the PNG at that first stem, which is what
    // makes "by extension, not by stem" load-bearing rather than pedantic.
    expect(existsSync(`${SHELL_STEMS[0]}.png`)).toBe(true);
  });

  it("both card handlers reach the wall and NOTHING from the play surface", () => {
    for (const entry of [DAY_CARD_ROUTE, MONTH_CARD_ROUTE]) {
      const graph = moduleGraph(entry);
      // COUNTED FLOOR, in the same terms as the absences: the graph really
      // does reach the reader, so an empty or broken walk cannot pass below.
      const reachesTheWall = graph.filter((path) =>
        code(readFileSync(path, "utf8")).includes("@miolos/db"),
      );
      expect.soft(reachesTheWall, entry).not.toEqual([]);
      expect.soft(graph.length, entry).toBeGreaterThanOrEqual(5);

      // THE ABSENCES. `T-WEB-S183`'s archive page wall is a list of PAGE
      // files and these are not pages, so the same protection is asserted
      // here instead (plan 068 §10.3) — a card must never reach a user's own
      // day state, which is ADR-0053 decision 10's "why no endpoint".
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
    // The builder takes two formatted strings, so nothing in its graph may
    // touch a database — the same claim `T-WEB-S204` makes for the site card,
    // and the reason the committed index PNG can be rendered at commit time.
    for (const path of moduleGraph(CARD_SOURCE)) {
      const source = code(readFileSync(path, "utf8"));
      expect.soft(source, path).not.toContain("@miolos/db");
      expect.soft(source, path).not.toContain("getDb");
    }
    expect(moduleGraph(CARD_SOURCE).length).toBeGreaterThanOrEqual(3);
  });
});

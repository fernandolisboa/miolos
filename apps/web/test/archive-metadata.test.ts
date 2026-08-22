import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { formatLongDate, formatMonth, messages } from "../src/i18n";
import { ogCopy } from "../src/og/copy";
import { OG_DEFAULTS } from "../src/og/defaults";

// Every archive route's metadata (#31 AC 1, ADR-0053 decision 1 / plan 037
// D6). Titles and descriptions are DISTINCT across dates and across games —
// which is what stops ~5 near-identical board pages a day from being thin
// duplicates — and every canonical is self-referential.

const spies = vi.hoisted(() => ({
  stubDb: {},
  getDb: vi.fn(),
  listArchivedDays: vi.fn(),
  listArchivedMonths: vi.fn(),
  archiveDateClass: vi.fn(),
  getArchivedDaily: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirect: vi.fn(),
}));

vi.mock("../src/db", () => ({ getDb: spies.getDb }));
vi.mock("@miolos/db", () => ({
  listArchivedDays: spies.listArchivedDays,
  listArchivedMonths: spies.listArchivedMonths,
  archiveDateClass: spies.archiveDateClass,
  getArchivedDaily: spies.getArchivedDaily,
}));
vi.mock("next/navigation", () => ({
  notFound: spies.notFound,
  redirect: spies.redirect,
}));

const index = await import("../app/arquivo/page");
const month = await import("../app/arquivo/mes/[mes]/page");
const day = await import("../app/arquivo/[data]/page");

beforeEach(() => {
  spies.getDb.mockReturnValue(spies.stubDb);
});

afterEach(() => {
  vi.clearAllMocks();
});

/**
 * The file with its comments removed. The same stripper `og-card.test.tsx`,
 * `og-image.node.test.ts`, `eslint-db-wall.test.ts` and `archive-routes.test.ts`
 * use, and it is what makes the literal scan below a scan of CODE.
 *
 * ADDED AT #104 STEP 7, and it repairs a trap rather than tidying one. The
 * scan used to slice from `source.indexOf("generateMetadata")` over the RAW
 * file — and in `app/arquivo/[data]/page.tsx` the first textual occurrence of
 * that word is inside the doc block, about fifty lines above the function. So
 * a test whose title is about string literals in a metadata function was
 * policing fifty lines of English, where the effective rule was "no line of
 * prose may carry two apostrophes". The implementer met it by writing "this
 * function result" for "this function's result" and leaving a warning for the
 * next editor; both are now gone, because the scan no longer reaches prose.
 */
function code(source: string): string {
  return source
    .replaceAll(/\/\*[\s\S]*?\*\//g, "")
    .replaceAll(/(^|[^:])\/\/.*$/gm, "$1");
}

/**
 * The body of a file's `generateMetadata`, comments stripped, anchored on the
 * DECLARATION rather than on the bare identifier — `function generateMetadata`
 * matches `export function` and `export async function` alike, and cannot
 * match a mention of the name.
 */
function metadataBody(file: string): string {
  const source = code(
    readFileSync(join(import.meta.dirname, "..", file), "utf8"),
  );
  const body = source.slice(source.indexOf("function generateMetadata"));
  return body.slice(0, body.indexOf("\n}\n") + 3);
}

describe("archive metadata (T-WEB-S173)", () => {
  it("every route composes its title and description from messages.archive, with a SELF-REFERENTIAL canonical", async () => {
    // THE INDEX ARM IS BYTE-UNMOVED at #104, and that is a claim rather than
    // an omission: the index card attaches by the FILE convention
    // (`app/arquivo/opengraph-image.png`), so this function returns no
    // `openGraph` key. The RESOLVED metadata for `/arquivo` certainly will
    // carry one — the file convention injects the image and the root layout
    // supplies `OG_DEFAULTS` — and this assertion is about the return value,
    // not the rendered head.
    expect(index.generateMetadata()).toEqual({
      title: messages.archive.meta.indexTitle,
      description: messages.archive.meta.indexDescription,
      alternates: { canonical: "/arquivo" },
    });

    // The month and day arms DO grow an `openGraph`, because their cards are
    // referenced by an explicit `images` entry (#104, ADR-0071 decision 3).
    // The card URLs are spelled as literals here for the same reason the
    // canonicals are: a URL asserted through the same builder the route calls
    // would agree with itself no matter what either did.
    const monthName = formatMonth("2026-08-01");
    const monthTitle = messages.archive.meta.monthTitle(monthName);
    const monthDescription = messages.archive.meta.monthDescription(monthName);
    expect(
      await month.generateMetadata({
        params: Promise.resolve({ mes: "2026-08" }),
      }),
    ).toEqual({
      title: monthTitle,
      description: monthDescription,
      alternates: { canonical: "/arquivo/mes/2026-08" },
      openGraph: {
        ...OG_DEFAULTS,
        title: monthTitle,
        description: monthDescription,
        images: [
          {
            url: "/cartao/mes/2026-08",
            width: 1200,
            height: 630,
            alt: ogCopy.altArchiveMonth(monthName),
            type: "image/png",
          },
        ],
      },
    });

    const longDate = formatLongDate("2026-08-03");
    const dayTitle = messages.archive.meta.dayTitle(longDate);
    const dayDescription = messages.archive.meta.dayDescription(longDate);
    expect(
      await day.generateMetadata({
        params: Promise.resolve({ data: "2026-08-03" }),
      }),
    ).toEqual({
      title: dayTitle,
      description: dayDescription,
      alternates: { canonical: "/arquivo/2026-08-03" },
      openGraph: {
        ...OG_DEFAULTS,
        title: dayTitle,
        description: dayDescription,
        images: [
          {
            url: "/cartao/2026-08-03",
            width: 1200,
            height: 630,
            alt: ogCopy.altArchiveDay(longDate),
            type: "image/png",
          },
        ],
      },
    });
  });

  it("titles and descriptions are DISTINCT across dates and across months", async () => {
    const titles = new Set<unknown>();
    const descriptions = new Set<unknown>();
    for (const data of ["2026-08-01", "2026-08-02", "2026-08-03"]) {
      const metadata = await day.generateMetadata({
        params: Promise.resolve({ data }),
      });
      titles.add(metadata.title);
      descriptions.add(metadata.description);
    }
    for (const mes of ["2026-07", "2026-08"]) {
      const metadata = await month.generateMetadata({
        params: Promise.resolve({ mes }),
      });
      titles.add(metadata.title);
      descriptions.add(metadata.description);
    }
    titles.add(index.generateMetadata().title);
    descriptions.add(index.generateMetadata().description);

    expect(titles.size).toBe(6);
    expect(descriptions.size).toBe(6);
  });

  it("a HOSTILE segment yields robots.index false, no alternates, and never an off-origin URL", async () => {
    const hostile = [
      "//evil.example.com",
      "https://evil.example.com",
      "..%2F..%2Fetc",
      "2026-08-03/../../evil",
      // Year zero: shape-valid, calendar-invalid, and a Postgres 22008 at the
      // reader if it ever got past the parser (step-6 F2). Refused here too,
      // so `generateMetadata` composes no canonical for it either.
      "0000-01",
      "0000-01-01",
    ];
    for (const raw of hostile) {
      const asMonth = await month.generateMetadata({
        params: Promise.resolve({ mes: raw }),
      });
      const asDay = await day.generateMetadata({
        params: Promise.resolve({ data: raw }),
      });
      for (const metadata of [asMonth, asDay]) {
        expect(metadata.alternates).toBeUndefined();
        expect(metadata.robots).toEqual({ index: false });
        // Nothing attacker-controlled is reflected into the title either.
        expect(JSON.stringify(metadata)).not.toContain("evil.example.com");
      }
    }
  });

  it("no metadata function carries a string literal — every string comes from messages.archive", () => {
    // ADR-0018 :15 applies to `generateMetadata` exactly as it applies to a
    // component: the composers live in `messages.ts`, and a title assembled
    // here would be copy outside the migration contract.
    for (const file of [
      join("app", "arquivo", "page.tsx"),
      join("app", "arquivo", "mes", "[mes]", "page.tsx"),
      join("app", "arquivo", "[data]", "page.tsx"),
    ]) {
      const metadataBlock = metadataBody(file);
      // Anti-vacuity: the slice really is the metadata function's body, so
      // an empty match list below means "no literals", not "no text".
      expect(metadataBlock, file).toContain("canonical");
      // Only the Metadata KEYS may appear here; a pt-BR sentence or a path
      // fragment would show up as quoted text.
      const literals = [...metadataBlock.matchAll(/(["'])(?:(?!\1).){2,}\1/g)];
      expect(
        literals.map((match) => match[0]),
        file,
      ).toEqual([]);
    }
  });
});

// ── T-WEB-S209 ──────────────────────────────────────────────────────────

/**
 * The four PER-GAME archive routes (#34), imported BELOW the block above so
 * that `T-WEB-S173`'s suite and its three module imports stay byte-unmoved.
 * They are called by no other test: `archive-metadata.test.ts` covered the
 * index, the month page and the day page only, so the claim its own `describe`
 * makes — *"every route composes its title and description … with a
 * self-referential canonical"* — held over three of seven routes. This is the
 * other four, in the suite that already claims them. The `openGraph` half of
 * the same four functions is `T-WEB-S207`, in `og-metadata.test.ts`.
 */
const perGame = {
  binairo: await import("../app/arquivo/[data]/binairo/page"),
  nonogram: await import("../app/arquivo/[data]/nonogram/page"),
  sudoku: await import("../app/arquivo/[data]/sudoku/page"),
  termo: await import("../app/arquivo/[data]/termo/page"),
};

const PER_GAME = Object.keys(perGame) as (keyof typeof perGame)[];

describe("the four per-game archive routes' own metadata (T-WEB-S209)", () => {
  it("titles and descriptions are DISTINCT across games AND across dates", async () => {
    const dates = ["2026-02-22", "2026-08-03"];
    const titles = new Set<unknown>();
    const descriptions = new Set<unknown>();
    for (const game of PER_GAME) {
      for (const data of dates) {
        const metadata = await perGame[game].generateMetadata({
          params: Promise.resolve({ data }),
        });
        titles.add(metadata.title);
        descriptions.add(metadata.description);
      }
    }
    // Four games × two dates, no collisions — the same "not thin duplicates"
    // property the block above asserts for the index, month and day routes.
    expect(titles.size).toBe(PER_GAME.length * dates.length);
    expect(descriptions.size).toBe(PER_GAME.length * dates.length);
  });

  it("every canonical is self-referential in BOTH the date and the game", async () => {
    // Spelled as literals here for the reason the block above spells
    // `/arquivo/2026-08-03`: a canonical asserted through the same builder the
    // route calls would agree with itself no matter what either did.
    const expected = {
      binairo: "/arquivo/2026-02-22/binairo",
      nonogram: "/arquivo/2026-02-22/nonogram",
      sudoku: "/arquivo/2026-02-22/sudoku",
      termo: "/arquivo/2026-02-22/termo",
    };
    for (const game of PER_GAME) {
      const metadata = await perGame[game].generateMetadata({
        params: Promise.resolve({ data: "2026-02-22" }),
      });
      expect(metadata.alternates, game).toEqual({ canonical: expected[game] });
    }
  });

  it("no per-game metadata function carries a string literal beyond its own game token", () => {
    // The same slice and the same regex as the scan above, extended to the
    // four files it never reached — with ONE allowlisted literal per file:
    // that file's own game token. It enters through
    // `archiveGameRoute(date, <game>)` as the `Game` union member, an
    // identifier crossing a typed boundary rather than copy, and ADR-0018 :15
    // is about strings a translator would touch. The allowlist is the file's
    // OWN token and not the set of four: allowing all four would let the
    // sudoku route name binairo with this scan still green.
    for (const game of PER_GAME) {
      const metadataBlock = metadataBody(
        join("app", "arquivo", "[data]", game, "page.tsx"),
      );
      // Anti-vacuity, both halves: the slice really is the metadata
      // function's body, and the one literal that IS allowed was really
      // found — so the empty set below is "no other literals" rather than
      // "no text was read".
      expect(metadataBlock, game).toContain("canonical");
      const literals = [
        ...metadataBlock.matchAll(/(["'])(?:(?!\1).){2,}\1/g),
      ].map((match) => match[0]);
      expect(literals, game).toContain(`"${game}"`);
      expect(
        literals.filter((literal) => literal !== `"${game}"`),
        game,
      ).toEqual([]);
    }
  });
});

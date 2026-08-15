import { GAMES } from "@miolos/core";
import { describe, expect, it, vi } from "vitest";

// The layout calls the Next font loaders at module scope, which only the Next
// compiler can execute (the `pwa-manifest.test.ts` idiom); the mock returns
// the one field the layout reads. Nothing here asserts on fonts.
vi.mock("next/font/google", () => ({
  Fraunces: () => ({ variable: "--font-fraunces" }),
  Instrument_Sans: () => ({ variable: "--font-instrument-sans" }),
}));

const spies = vi.hoisted(() => ({
  // The db handle never leaves the mocked seam. None of the assertions below
  // calls a page body — only `metadata` and `generateMetadata` — but the
  // modules still import the readers at module scope, so the seam has to be
  // stubbed for the import to resolve at all.
  stubDb: {},
  getDb: vi.fn(),
  getTodayDaily: vi.fn(),
  getArchivedDaily: vi.fn(),
  archiveDateClass: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirect: vi.fn(),
}));

vi.mock("../src/db", () => ({ getDb: spies.getDb }));
vi.mock("@miolos/db", () => ({
  getTodayDaily: spies.getTodayDaily,
  getArchivedDaily: spies.getArchivedDaily,
  archiveDateClass: spies.archiveDateClass,
}));
vi.mock("next/navigation", () => ({
  notFound: spies.notFound,
  redirect: spies.redirect,
}));

const { locale, messages } = await import("../src/i18n");
const { OG_DEFAULTS } = await import("../src/og/defaults");
const layout = await import("../app/layout");

/**
 * The Open Graph metadata surface (#34 AC 2/AC 4, ADR-0054 decisions 10 and
 * 11).
 *
 * Two families, and the split between this file and `archive-metadata.test.ts`
 * is deliberate: everything here is about `openGraph` and `OG_DEFAULTS`, while
 * the archive routes' TITLE, DESCRIPTION and CANONICAL — the claim
 * `archive-metadata.test.ts`'s own `describe` already makes — are asserted
 * there, as `T-WEB-S209`.
 *
 * The four per-game archive `generateMetadata`s were called by NO test in the
 * repo before #34: `archive-metadata.test.ts` imports the index, month and day
 * routes only. So `T-WEB-S207` and `T-WEB-S209` are first coverage of those
 * four functions, not a widening of an existing gate.
 */

const DAILY_PAGES = {
  binairo: await import("../app/binairo/page"),
  nonogram: await import("../app/nonogram/page"),
  sudoku: await import("../app/sudoku/page"),
  termo: await import("../app/termo/page"),
} as const;

const ARCHIVE_PAGES = {
  binairo: await import("../app/arquivo/[data]/binairo/page"),
  nonogram: await import("../app/arquivo/[data]/nonogram/page"),
  sudoku: await import("../app/arquivo/[data]/sudoku/page"),
  termo: await import("../app/arquivo/[data]/termo/page"),
} as const;

/**
 * THE LOOP VARIABLE IS THE SHIPPED CONSTANT, imported (step-6 finding Q1).
 * The old `Object.keys(DAILY_PAGES)` was self-referential — it could only ever
 * list the routes this file had already imported, so a fifth game gaining a
 * page and no `openGraph` was invisible to every assertion below. Measured:
 * adding `kakuro` to `packages/core/src/game.ts` left all six OG suites green.
 * `hoje.smoke.test.tsx:1` is the shipped idiom for the import, and the
 * coverage arm inside `T-WEB-S198` is what turns it into a tripwire.
 *
 * No local `Game` alias survives either: `DAILY_PAGES[game]` indexes fine with
 * core's own `Game`, and a `keyof typeof DAILY_PAGES` alias is the same
 * self-reference one type level up.
 */

// ── T-WEB-S198 ──────────────────────────────────────────────────────────

describe("the daily play routes carry openGraph and NOTHING else (T-WEB-S198)", () => {
  it("every member of @miolos/core's GAMES is covered by both page maps", () => {
    // Q1's repair. Sorted on both sides because the two orders differ by
    // construction: core declares play order (binairo, sudoku, nonogram,
    // termo) and the maps above are alphabetical. A fifth game reds HERE,
    // which is what makes the `for (const game of GAMES)` loops below a
    // coverage claim rather than a restatement of this file's own imports.
    const covered = [...GAMES].sort();
    expect(covered).toHaveLength(4);
    expect(Object.keys(DAILY_PAGES).sort()).toEqual(covered);
    expect(Object.keys(ARCHIVE_PAGES).sort()).toEqual(covered);
  });

  it("each game's card copy is its own, and the object has no title, no description and no canonical", () => {
    const titles = new Set<unknown>();
    const descriptions = new Set<unknown>();

    for (const game of GAMES) {
      const { metadata } = DAILY_PAGES[game];
      const name = messages.games[game].name;

      // The whole object, key by key. An absence asserted as a key list
      // rather than four `toBeUndefined()`s: a later ticket that adds a page
      // `title`, a `description` or an `alternates.canonical` to a daily
      // route reds HERE, which is what keeps ADR-0028 :36-38's "not an SEO
      // surface" denial literally true (ADR-0054 decision 10). The daily
      // routes' crawl-facing metadata stays byte-unchanged: `<title>` and
      // `<meta name="description">` keep coming from the root layout.
      expect(Object.keys(metadata), game).toEqual(["openGraph"]);

      // And the sharing channel really does gain per-game copy — the
      // positive floor that stops the key list above from passing over an
      // empty `openGraph`.
      expect(metadata.openGraph?.title, game).toBe(
        messages.og.dailyTitle(name),
      );
      expect(metadata.openGraph?.description, game).toBe(
        messages.og.dailyDescription(name),
      );

      titles.add(metadata.openGraph?.title);
      descriptions.add(metadata.openGraph?.description);
    }

    // Distinct per game — four routes sharing one bubble would defeat AC 4.
    expect(titles.size).toBe(GAMES.length);
    expect(descriptions.size).toBe(GAMES.length);
  });

  it("every daily openGraph carries the three members a leaf declaration would otherwise lose", () => {
    for (const game of GAMES) {
      expect(DAILY_PAGES[game].metadata.openGraph, game).toMatchObject(
        OG_DEFAULTS,
      );
    }
  });
});

// ── T-WEB-S199 ──────────────────────────────────────────────────────────

describe("og:locale is pt_BR, and it is asserted on a LEAF (T-WEB-S199)", () => {
  /**
   * On the DECLARED metadata object, not a resolved one: Next exposes no
   * public API for resolved metadata in a unit test. The rendered-head half
   * of the same claim is preview evidence — `/sudoku`'s `<head>` showing
   * `og:locale`, `og:site_name` and `og:type` present on the leaf — not a
   * unit assertion.
   *
   * The subject is a leaf on purpose. The identical assertion on the root
   * layout passes while every share target lacks all three, which is exactly
   * the hole a leaf-blind version of this test left open.
   */
  it("a leaf route declares the underscore locale, the site name and the type", () => {
    const leaf = DAILY_PAGES.sudoku.metadata.openGraph;

    expect(leaf?.locale).toBe("pt_BR");
    expect(leaf?.siteName).toBe(messages.brand.wordmark);
    // `type` is the `OpenGraph` union's DISCRIMINANT, so it is not readable
    // off the un-narrowed union — `toMatchObject` asserts it without a cast.
    expect(leaf).toMatchObject({ type: "website" });
  });

  it("the og: locale is NOT the exported BCP-47 one", () => {
    // `og:locale` is `language_TERRITORY`; `<html lang>` is BCP-47. Sharing
    // one constant between them is the "fix" this asserts against.
    expect(locale).toBe("pt-BR");
    expect(OG_DEFAULTS.locale).not.toBe(locale);
    expect(OG_DEFAULTS.locale.replace("_", "-")).toBe(locale);
  });

  it("the root layout carries the large-image card and the same three members", () => {
    expect(layout.metadata.twitter).toEqual({ card: "summary_large_image" });
    expect(layout.metadata.openGraph).toMatchObject(OG_DEFAULTS);
  });
});

// ── T-WEB-S207 ──────────────────────────────────────────────────────────

describe("the per-game archive routes' openGraph (T-WEB-S207)", () => {
  it("every one of the four spreads OG_DEFAULTS and reuses the strings it already composes", async () => {
    for (const game of GAMES) {
      const metadata = await ARCHIVE_PAGES[game].generateMetadata({
        params: Promise.resolve({ data: "2026-02-22" }),
      });
      expect(metadata.openGraph, game).toMatchObject(OG_DEFAULTS);
      // The archive half adds NO copy: the card's title and description are
      // the page's own, reused verbatim.
      expect(metadata.openGraph?.title, game).toBe(metadata.title);
      expect(metadata.openGraph?.description, game).toBe(metadata.description);
    }
  });

  it("a HOSTILE segment still resolves to robots.index false, with no openGraph in the METADATA OBJECT", async () => {
    // At the object level. At the RENDERED-HEAD level this is false and the
    // test says so rather than overclaiming: the file-convention `og:image`
    // and the root-filled `og:*`/`twitter:*` set are emitted for every
    // `[data]` segment, malformed ones included.
    for (const raw of [
      "//evil.example.com",
      "https://evil.example.com",
      "2026-08-03/../../evil",
      "0000-01-01",
    ]) {
      for (const game of GAMES) {
        const metadata = await ARCHIVE_PAGES[game].generateMetadata({
          params: Promise.resolve({ data: raw }),
        });
        expect(metadata, `${game} ${raw}`).toEqual({
          robots: { index: false },
        });
        expect(metadata.openGraph, `${game} ${raw}`).toBeUndefined();
      }
    }
  });
});

// ── T-WEB-S206a ─────────────────────────────────────────────────────────

describe("the OG deck's accent audit (T-WEB-S206a)", () => {
  /**
   * `T-WEB-S206`'s other half, and it lives here rather than in
   * `share-text.test.ts` because `messages.og` lands two batches after
   * `messages.share`.
   *
   * `então`, `mamãe` and `época` are Termo ANSWER canonicals, and
   * `scripts/route-client-js.mjs`'s `FORBIDDEN_EVERYWHERE` forbids all three
   * in every client chunk. `messages.og` ships in the server bundle rather
   * than the browser, but the deck is pt-BR copy an editor will grow, and a
   * copy edit is exactly how a false positive would reach that grep and red a
   * build for a reason nobody could find.
   */
  const FORBIDDEN = ["então", "mamãe", "época"];

  it("none of the three Termo canonicals appears in messages.og", () => {
    const deck = JSON.stringify(
      Object.values(messages.og).map((value) =>
        typeof value === "function" ? value("Nonogram") : value,
      ),
    );
    for (const word of FORBIDDEN) {
      expect(deck, word).not.toContain(word);
    }
    // Anti-vacuity: the deck really was serialised and really was read.
    expect(deck).toContain(messages.og.siteTagline);
    expect(deck).toContain(messages.og.altSite);
    expect(deck.length).toBeGreaterThan(100);
  });
});

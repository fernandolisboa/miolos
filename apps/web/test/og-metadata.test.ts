import { readFileSync } from "node:fs";
import { join } from "node:path";

import { GAMES } from "@miolos/core";
import { describe, expect, it, vi } from "vitest";

import { ogCopy } from "../src/og/copy";

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
  // #104: the three archive SHELL pages import these at module scope.
  listArchivedDays: vi.fn(),
  listArchivedMonths: vi.fn(),
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
  listArchivedDays: spies.listArchivedDays,
  listArchivedMonths: spies.listArchivedMonths,
}));
vi.mock("next/navigation", () => ({
  notFound: spies.notFound,
  redirect: spies.redirect,
}));

const { formatMonth, locale, messages, ogLocale } = await import("../src/i18n");
const { OG_DEFAULTS } = await import("../src/og/defaults");
const { CARD_HEIGHT, CARD_WIDTH } = await import("../src/og/card");
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
      // route reds HERE, which is what keeps ADR-0028 :37-39's "not an SEO
      // surface" denial literally true (ADR-0054 decision 10). The daily
      // routes' crawl-facing metadata stays byte-unchanged: `<title>` and
      // `<meta name="description">` keep coming from the root layout.
      expect(Object.keys(metadata), game).toEqual(["openGraph"]);

      // And the sharing channel really does gain per-game copy — the
      // positive floor that stops the key list above from passing over an
      // empty `openGraph`.
      expect(metadata.openGraph?.title, game).toBe(ogCopy.dailyTitle(name));
      expect(metadata.openGraph?.description, game).toBe(
        ogCopy.dailyDescription(name),
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
    // one constant between them is the "fix" this asserts against. Both now
    // live in `src/i18n/locale.ts` (step-6 finding W4, ADR-0018 bullet 3),
    // which makes the non-identity arm MORE load-bearing rather than less:
    // adjacent declarations are exactly where a later reader collapses two
    // into one.
    expect(locale).toBe("pt-BR");
    expect(ogLocale).toBe("pt_BR");
    expect(ogLocale).not.toBe(locale);
    expect(OG_DEFAULTS.locale).toBe(ogLocale);
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

// ── T-WEB-S335 ──────────────────────────────────────────────────────────

const SHELL_PAGES = {
  index: await import("../app/arquivo/page"),
  month: await import("../app/arquivo/mes/[mes]/page"),
  day: await import("../app/arquivo/[data]/page"),
} as const;

describe("the archive SHELL routes' openGraph (T-WEB-S335)", () => {
  /**
   * #104, ADR-0071 decision 3. The day and month shells reference their card
   * by an explicit `openGraph.images` entry rather than by the file
   * convention, so what is asserted here is the pair of Next behaviours the
   * whole route shape depends on — and both were confirmed on a real
   * production build before any of this was written:
   *
   *   1. a leaf `openGraph` carrying `images` SUPPRESSES the inherited
   *      file-convention image, and
   *   2. `twitter:image` auto-fills from it, so no `twitter-image.*` is owed.
   *
   * The object-level half is here. The head-level half is preview `curl`
   * evidence, and this file does not overclaim about a rendered head —
   * `T-WEB-S207` already draws that line for the per-game routes.
   */
  const arms = [
    {
      name: "month",
      metadata: () =>
        SHELL_PAGES.month.generateMetadata({
          params: Promise.resolve({ mes: "2026-08" }),
        }),
      url: "/cartao/mes/2026-08",
      dated: formatMonth("2026-08-01"),
    },
    {
      name: "day",
      metadata: () =>
        SHELL_PAGES.day.generateMetadata({
          params: Promise.resolve({ data: "2026-08-03" }),
        }),
      url: "/cartao/2026-08-03",
      dated: "3 de agosto de 2026",
    },
  ] as const;

  it.each(arms)(
    "the $name shell spreads OG_DEFAULTS and carries exactly ONE dated card image",
    async ({ name, metadata, url, dated }) => {
      const resolved = await metadata();
      // Without the spread these two routes would lose `og:type`,
      // `og:locale` and `og:site_name`: Next does not deep-merge a leaf
      // `openGraph` into the root layout, the nearest declaration wins whole.
      expect(resolved.openGraph, name).toMatchObject(OG_DEFAULTS);

      const images = resolved.openGraph?.images;
      expect(Array.isArray(images), name).toBe(true);
      expect(images, name).toHaveLength(1);
      const image = (images as { url: string }[])[0] as Record<string, unknown>;

      // The URL is the card ROUTE, in pt-BR, and it is not the page.
      expect(image["url"], name).toBe(url);
      // The dimensions come off the card module, never re-typed.
      expect(image["width"], name).toBe(CARD_WIDTH);
      expect(image["height"], name).toBe(CARD_HEIGHT);
      expect(image["type"], name).toBe("image/png");
      // And the `alt` CARRIES THE DATE — which is the whole point of shape
      // (b): a metadata route's `alt` is a module export and cannot read
      // `params`, so `ogCopy.altGame` is dateless by constraint. An
      // `images[].alt` composed here can be, and is.
      expect(image["alt"], name).toContain(dated);
      expect(image["alt"], name).toBe(
        name === "day"
          ? ogCopy.altArchiveDay(dated)
          : ogCopy.altArchiveMonth(dated),
      );
    },
  );

  it("the INDEX shell declares no openGraph at all — its card is a FILE", () => {
    // `app/arquivo/opengraph-image.png` attaches by the file convention, so
    // this function stays byte-unmoved and `T-WEB-S173`'s index arm never
    // reds. The claim is about the RETURN VALUE: the resolved head for
    // `/arquivo` certainly carries `openGraph`, because the file convention
    // injects the image and the root layout supplies `OG_DEFAULTS`.
    const resolved = SHELL_PAGES.index.generateMetadata();
    expect(Object.keys(resolved).sort()).toEqual([
      "alternates",
      "description",
      "title",
    ]);
    expect(resolved.openGraph).toBeUndefined();
  });

  it("a HOSTILE shell segment carries no openGraph and no alternates", async () => {
    // The malformed branch composes NOTHING, which is what NARROWS ADR-0054
    // decision 8's residual rather than widening it: such a segment now
    // inherits the archive index card by nearest ancestor — a 200 — instead
    // of advertising a card URL that 404s.
    for (const raw of [
      "//evil.example.com",
      "https://evil.example.com",
      "0000-01-01",
      "2026-08-03/../../evil",
    ]) {
      for (const [name, resolved] of [
        [
          "month",
          await SHELL_PAGES.month.generateMetadata({
            params: Promise.resolve({ mes: raw }),
          }),
        ],
        [
          "day",
          await SHELL_PAGES.day.generateMetadata({
            params: Promise.resolve({ data: raw }),
          }),
        ],
      ] as const) {
        expect.soft(resolved, `${name} ${raw}`).toEqual({
          robots: { index: false },
        });
        expect.soft(resolved.openGraph, `${name} ${raw}`).toBeUndefined();
        expect.soft(resolved.alternates, `${name} ${raw}`).toBeUndefined();
        expect
          .soft(JSON.stringify(resolved), `${name} ${raw}`)
          .not.toContain("cartao");
      }
    }
  });
});

// ── T-WEB-S206a ─────────────────────────────────────────────────────────

describe("the OG deck's accent audit (T-WEB-S206a)", () => {
  /**
   * `T-WEB-S206`'s other half, and it lives here rather than in
   * `share-text.test.ts` because the OG deck lands two batches after
   * `messages.share`.
   *
   * `então`, `mamãe` and `época` are Termo ANSWER canonicals, and
   * `scripts/route-client-js.mjs`'s `FORBIDDEN_EVERYWHERE` forbids all three
   * in every client chunk. `ogCopy` is now genuinely server-only — step-6
   * finding F5 moved it out of `messages` because a bundler eliminates unused
   * exports and not unused object PROPERTIES, so as a member of the deck it
   * was shipping in the browser after all — but the strings are pt-BR copy an
   * editor will grow, and a copy edit is exactly how a false positive would
   * reach that grep and red a build for a reason nobody could find. The arm
   * below keeps the audit whether or not the module stays out of the browser.
   *
   * READ FROM THE GATE, NOT RE-TYPED (step-6 finding Q3). The list used to be
   * a local literal here while its twin `T-WEB-S206` derived the same list
   * from `route-client-js.mjs`, so a fourth marker added to the script was
   * audited against `messages.share` and silently not against the OG deck.
   * The two halves now read the same declaration by the same regex.
   */
  function forbiddenEverywhere(): string[] {
    const script = readFileSync(
      join(import.meta.dirname, "..", "scripts", "route-client-js.mjs"),
      "utf8",
    );
    const declaration = /const FORBIDDEN_EVERYWHERE = \[([^\]]*)\]/.exec(
      script,
    );
    expect(declaration, "FORBIDDEN_EVERYWHERE is not declared").not.toBeNull();
    return [...(declaration?.[1] ?? "").matchAll(/"([^"]+)"/g)].map(
      (match) => match[1] ?? "",
    );
  }

  it("no FORBIDDEN_EVERYWHERE canonical appears in ogCopy", () => {
    const FORBIDDEN = forbiddenEverywhere();
    // Counted floor: an empty list would pass the loop below, and the three
    // Termo canonicals the script ships today are the ones this claim names.
    expect(FORBIDDEN.length).toBeGreaterThanOrEqual(3);
    expect(FORBIDDEN).toContain("então");
    const deck = JSON.stringify(
      Object.values(ogCopy).map((value) =>
        typeof value === "function" ? value("Nonogram") : value,
      ),
    );
    for (const word of FORBIDDEN) {
      expect(deck, word).not.toContain(word);
    }
    // Anti-vacuity: the deck really was serialised and really was read.
    expect(deck).toContain(ogCopy.siteTagline);
    expect(deck).toContain(ogCopy.altSite);
    expect(deck.length).toBeGreaterThan(100);
    // #104's five new strings are named, so the loop above is provably over
    // them and not only over #34's. `Object.values` would cover them either
    // way; naming them is what reds if one is later moved to `messages`.
    expect(deck).toContain(ogCopy.archiveTagline);
    expect(deck).toContain(ogCopy.altArchiveIndex);
    expect(deck).toContain(ogCopy.altArchiveDay("Nonogram"));
    expect(deck).toContain(ogCopy.altArchiveMonth("Nonogram"));
    expect(deck).toContain(ogCopy.archiveDayCaption("Nonogram"));
  });

  it("archiveTagline is the SHIPPED sentence, not a second spelling of it", () => {
    // #104, ADR-0071. The index card's caption is the first sentence of
    // `messages.archive.lead`, already rendered on `/arquivo` — the very page
    // this card serves. It is written out in the deck rather than sliced at
    // runtime (a copy deck holding string surgery is worse than one holding a
    // string, which is the call `siteTagline` already records), so THIS is
    // what keeps the two from drifting apart: `messages.ts:23-25`'s own words
    // are that "a second copy is how two screens drift apart", and two
    // spellings of one claim would sit on one surface.
    expect(messages.archive.lead.startsWith(ogCopy.archiveTagline)).toBe(true);
    // Counted floor: a prefix assertion against an empty string is free.
    expect(ogCopy.archiveTagline.length).toBeGreaterThan(20);
    expect(ogCopy.archiveTagline.endsWith(".")).toBe(true);
    // And it really is a TAGLINE and not the description: the alternative was
    // `meta.indexDescription`, a 90-character wall of body copy where the
    // composition wants one line.
    expect(messages.archive.meta.indexDescription.length).toBeGreaterThan(
      ogCopy.archiveTagline.length,
    );
  });

  it("the archive alt strings compose 'Arquivo' and the wordmark from messages", () => {
    // Never re-typed, and capitalised mid-sentence the way the product
    // already writes it (`backToIndexAria`, `meta.monthTitle`).
    for (const alt of [
      ogCopy.altArchiveIndex,
      ogCopy.altArchiveMonth(formatMonth("2026-08-01")),
    ]) {
      expect.soft(alt, alt).toContain(messages.archive.title);
      expect.soft(alt, alt).toContain(messages.brand.wordmark);
    }
    // The two DATED ones carry their date — the mirror image of `altGame`'s
    // dateless-by-constraint rule, not an exception to it.
    expect(ogCopy.altArchiveDay("3 de agosto de 2026")).toContain(
      "3 de agosto de 2026",
    );
    expect(ogCopy.altArchiveMonth("agosto de 2026")).toContain(
      "agosto de 2026",
    );
    expect(ogCopy.archiveDayCaption("2026")).toContain("2026");
    expect(ogCopy.archiveDayCaption("2026")).toContain(messages.archive.title);
  });

  it("the deck is OUT of `messages` and out of the i18n barrel, both directions", () => {
    // F5's fix, as a gate rather than as a paragraph — the same two edges
    // `src/medals/copy.ts` names in prose and nothing enforces. Either one
    // puts ~350 bytes of server-only pt-BR back into every client chunk,
    // because a bundler eliminates unused EXPORTS and not unused object
    // properties.
    expect(Object.keys(messages)).not.toContain("og");
    const barrel = readFileSync(
      join(import.meta.dirname, "..", "src", "i18n", "index.ts"),
      "utf8",
    );
    const deckSource = readFileSync(
      join(import.meta.dirname, "..", "src", "i18n", "messages.ts"),
      "utf8",
    );
    // Floors: both files were read and are the ones this claim is about.
    expect(barrel).toContain("export { messages");
    expect(deckSource).toContain("export const messages");

    expect(barrel).not.toContain("og/copy");
    expect(barrel).not.toContain("ogCopy");
    expect(deckSource).not.toContain("ogCopy");
  });
});

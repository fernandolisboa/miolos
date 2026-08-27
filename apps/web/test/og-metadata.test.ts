import { readFileSync } from "node:fs";
import { join } from "node:path";

import { GAMES } from "@miolos/core";
import { describe, expect, it, vi } from "vitest";

import { ogCopy } from "../src/og/copy";

vi.mock("next/font/google", () => ({
  Fraunces: () => ({ variable: "--font-fraunces" }),
  Instrument_Sans: () => ({ variable: "--font-instrument-sans" }),
}));

const spies = vi.hoisted(() => ({
  stubDb: {},
  getDb: vi.fn(),
  getTodayDaily: vi.fn(),
  getArchivedDaily: vi.fn(),
  archiveDateClass: vi.fn(),

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

describe("the daily play routes carry openGraph and NOTHING else (T-WEB-S198)", () => {
  it("every member of @miolos/core's GAMES is covered by both page maps", () => {
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

      expect(Object.keys(metadata), game).toEqual(["openGraph"]);

      expect(metadata.openGraph?.title, game).toBe(ogCopy.dailyTitle(name));
      expect(metadata.openGraph?.description, game).toBe(
        ogCopy.dailyDescription(name),
      );

      titles.add(metadata.openGraph?.title);
      descriptions.add(metadata.openGraph?.description);
    }

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

describe("og:locale is pt_BR, and it is asserted on a LEAF (T-WEB-S199)", () => {
  it("a leaf route declares the underscore locale, the site name and the type", () => {
    const leaf = DAILY_PAGES.sudoku.metadata.openGraph;

    expect(leaf?.locale).toBe("pt_BR");
    expect(leaf?.siteName).toBe(messages.brand.wordmark);

    expect(leaf).toMatchObject({ type: "website" });
  });

  it("the og: locale is NOT the exported BCP-47 one", () => {
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

describe("the per-game archive routes' openGraph (T-WEB-S207)", () => {
  it("every one of the four spreads OG_DEFAULTS and reuses the strings it already composes", async () => {
    for (const game of GAMES) {
      const metadata = await ARCHIVE_PAGES[game].generateMetadata({
        params: Promise.resolve({ data: "2026-02-22" }),
      });
      expect(metadata.openGraph, game).toMatchObject(OG_DEFAULTS);

      expect(metadata.openGraph?.title, game).toBe(metadata.title);
      expect(metadata.openGraph?.description, game).toBe(metadata.description);
    }
  });

  it("a HOSTILE segment still resolves to robots.index false, with no openGraph in the METADATA OBJECT", async () => {
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

const SHELL_PAGES = {
  index: await import("../app/arquivo/page"),
  month: await import("../app/arquivo/mes/[mes]/page"),
  day: await import("../app/arquivo/[data]/page"),
} as const;

describe("the archive SHELL routes' openGraph (T-WEB-S335)", () => {
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

      expect(resolved.openGraph, name).toMatchObject(OG_DEFAULTS);

      const images = resolved.openGraph?.images;
      expect(Array.isArray(images), name).toBe(true);
      expect(images, name).toHaveLength(1);
      const image = (images as Record<string, unknown>[])[0] ?? {};

      expect(image["url"], name).toBe(url);

      expect(image["width"], name).toBe(CARD_WIDTH);
      expect(image["height"], name).toBe(CARD_HEIGHT);
      expect(image["type"], name).toBe("image/png");

      expect(image["alt"], name).toContain(dated);
      expect(image["alt"], name).toBe(
        name === "day"
          ? ogCopy.altArchiveDay(dated)
          : ogCopy.altArchiveMonth(dated),
      );
    },
  );

  it("the INDEX shell declares no openGraph at all — its card is a FILE", () => {
    const resolved = SHELL_PAGES.index.generateMetadata();
    expect(Object.keys(resolved).sort()).toEqual([
      "alternates",
      "description",
      "title",
    ]);
    expect(resolved.openGraph).toBeUndefined();
  });

  it("a HOSTILE shell segment carries no openGraph and no alternates", async () => {
    //

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

describe("the OG deck's accent audit (T-WEB-S206a)", () => {
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

    expect(FORBIDDEN.length).toBeGreaterThanOrEqual(3);
    expect(FORBIDDEN).toContain("então");

    const PROBE = "PROBE";
    const deck = JSON.stringify(
      Object.values(ogCopy).map((value) =>
        typeof value === "function" ? value(PROBE) : value,
      ),
    );
    for (const word of FORBIDDEN) {
      expect(deck, word).not.toContain(word);
    }

    expect(deck).toContain(ogCopy.siteTagline);
    expect(deck).toContain(ogCopy.altSite);
    expect(deck.length).toBeGreaterThan(100);

    expect(deck).toContain(ogCopy.archiveTagline);
    expect(deck).toContain(ogCopy.altArchiveIndex);
    expect(deck).toContain(ogCopy.altArchiveDay(PROBE));
    expect(deck).toContain(ogCopy.altArchiveMonth(PROBE));
    expect(deck).toContain(ogCopy.archiveDayCaption(PROBE));
  });

  it("archiveTagline is the SHIPPED sentence, not a second spelling of it", () => {
    expect(messages.archive.lead.startsWith(ogCopy.archiveTagline)).toBe(true);

    expect(ogCopy.archiveTagline.length).toBeGreaterThan(20);
    expect(ogCopy.archiveTagline.endsWith(".")).toBe(true);

    expect(messages.archive.meta.indexDescription.length).toBeGreaterThan(
      ogCopy.archiveTagline.length,
    );
  });

  it("the archive alt strings compose 'Arquivo' and the wordmark from messages", () => {
    for (const alt of [
      ogCopy.altArchiveIndex,
      ogCopy.altArchiveMonth(formatMonth("2026-08-01")),
    ]) {
      expect.soft(alt, alt).toContain(messages.archive.title);
      expect.soft(alt, alt).toContain(messages.brand.wordmark);
    }

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
    expect(Object.keys(messages)).not.toContain("og");
    const barrel = readFileSync(
      join(import.meta.dirname, "..", "src", "i18n", "index.ts"),
      "utf8",
    );
    const deckSource = readFileSync(
      join(import.meta.dirname, "..", "src", "i18n", "messages.ts"),
      "utf8",
    );

    expect(barrel).toContain("export { messages");
    expect(deckSource).toContain("export const messages");

    expect(barrel).not.toContain("og/copy");
    expect(barrel).not.toContain("ogCopy");
    expect(deckSource).not.toContain("ogCopy");
  });
});

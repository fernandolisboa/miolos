import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { formatLongDate, formatMonth, messages } from "../src/i18n";
import { ogCopy } from "../src/og/copy";
import { OG_DEFAULTS } from "../src/og/defaults";

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

function code(source: string): string {
  return source
    .replaceAll(/\/\*[\s\S]*?\*\//g, "")
    .replaceAll(/(^|[^:])\/\/.*$/gm, "$1");
}

function metadataBody(file: string): string {
  const source = code(
    readFileSync(join(import.meta.dirname, "..", file), "utf8"),
  );
  const body = source.slice(source.indexOf("function generateMetadata"));
  return body.slice(0, body.indexOf("\n}\n") + 3);
}

describe("archive metadata (T-WEB-S173)", () => {
  it("every route composes its title and description from messages.archive, with a SELF-REFERENTIAL canonical", async () => {
    expect(index.generateMetadata()).toEqual({
      title: messages.archive.meta.indexTitle,
      description: messages.archive.meta.indexDescription,
      alternates: { canonical: "/arquivo" },
    });

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

        expect(JSON.stringify(metadata)).not.toContain("evil.example.com");
      }
    }
  });

  it("no metadata function carries a string literal — every string comes from messages.archive", () => {
    for (const file of [
      join("app", "arquivo", "page.tsx"),
      join("app", "arquivo", "mes", "[mes]", "page.tsx"),
      join("app", "arquivo", "[data]", "page.tsx"),
    ]) {
      const metadataBlock = metadataBody(file);

      expect(metadataBlock, file).toContain("canonical");

      const literals = [...metadataBlock.matchAll(/(["'])(?:(?!\1).){2,}\1/g)];
      expect(
        literals.map((match) => match[0]),
        file,
      ).toEqual([]);
    }
  });
});

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

    expect(titles.size).toBe(PER_GAME.length * dates.length);
    expect(descriptions.size).toBe(PER_GAME.length * dates.length);
  });

  it("every canonical is self-referential in BOTH the date and the game", async () => {
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
    for (const game of PER_GAME) {
      const metadataBlock = metadataBody(
        join("app", "arquivo", "[data]", game, "page.tsx"),
      );

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

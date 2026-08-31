import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";

import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { generateBinairo } from "@miolos/games/binairo";
import { generateNonogram } from "@miolos/games/nonogram";

import { formatLongDate, formatMonth, messages } from "../src/i18n";
import { solutionMarks } from "../src/nonogram/engine";
import { playRecordKey, readPlayRecord } from "../src/play/play-record";

const spies = vi.hoisted(() => ({
  stubDb: {},
  getDb: vi.fn(),
  listArchivedDays: vi.fn(),
  getArchivedDaily: vi.fn(),
  archiveDateClass: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

vi.mock("../src/db", () => ({ getDb: spies.getDb }));
vi.mock("@miolos/db", () => ({
  listArchivedDays: spies.listArchivedDays,
  getArchivedDaily: spies.getArchivedDaily,
  archiveDateClass: spies.archiveDateClass,
}));
vi.mock("next/navigation", () => ({
  notFound: spies.notFound,
  redirect: spies.redirect,
}));

const { default: ArchiveDayPage, generateMetadata } =
  await import("../app/arquivo/[data]/page");
const { default: ArchiveSudokuPage } =
  await import("../app/arquivo/[data]/sudoku/page");
const { default: ArchiveBinairoPage } =
  await import("../app/arquivo/[data]/binairo/page");
const { default: ArchiveNonogramPage } =
  await import("../app/arquivo/[data]/nonogram/page");
const { default: ArchiveTermoPage } =
  await import("../app/arquivo/[data]/termo/page");

beforeEach(() => {
  spies.getDb.mockReturnValue(spies.stubDb);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("the archive day page (T-WEB-S184)", () => {
  it("renders one card per game that date holds, and a link up to its month", async () => {
    spies.listArchivedDays.mockResolvedValue([
      { date: "2026-08-03", game: "binairo" },
      { date: "2026-08-03", game: "nonogram" },
      { date: "2026-08-03", game: "sudoku" },
      { date: "2026-08-03", game: "termo" },
    ]);

    render(
      await ArchiveDayPage({ params: Promise.resolve({ data: "2026-08-03" }) }),
    );

    expect(spies.listArchivedDays).toHaveBeenCalledWith(spies.stubDb, {
      from: "2026-08-03",
      to: "2026-08-03",
    });

    expect(spies.archiveDateClass).not.toHaveBeenCalled();

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: formatLongDate("2026-08-03"),
      }),
    ).toBeInTheDocument();

    for (const game of ["binairo", "nonogram", "sudoku", "termo"] as const) {
      expect(
        screen.getByRole("link", {
          name: messages.archive.day.cardAria(
            messages.games[game].name,
            formatLongDate("2026-08-03"),
          ),
        }),
      ).toHaveAttribute("href", `/arquivo/2026-08-03/${game}`);
    }

    expect(
      screen.getByRole("link", {
        name: messages.archive.backToMonthAria(formatMonth("2026-08-01")),
      }),
    ).toHaveAttribute("href", "/arquivo/mes/2026-08");
  });

  it("a short date renders fewer cards and NO placeholder", async () => {
    spies.listArchivedDays.mockResolvedValue([
      { date: "2026-08-01", game: "binairo" },
      { date: "2026-08-01", game: "sudoku" },
    ]);

    render(
      await ArchiveDayPage({ params: Promise.resolve({ data: "2026-08-01" }) }),
    );

    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.queryByText(messages.games.termo.name)).toBeNull();
    expect(screen.queryByText(messages.games.nonogram.name)).toBeNull();
  });

  it("an empty date is notFound(), and a malformed segment never reaches the reader", async () => {
    spies.listArchivedDays.mockResolvedValue([]);
    spies.archiveDateClass.mockResolvedValue("past");
    await expect(
      ArchiveDayPage({ params: Promise.resolve({ data: "2026-05-05" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    for (const data of ["2026-02-30", "mes", "../2026-08-01", "2026-8-1"]) {
      spies.listArchivedDays.mockClear();
      await expect(
        ArchiveDayPage({ params: Promise.resolve({ data }) }),
      ).rejects.toThrow("NEXT_NOT_FOUND");
      expect(spies.listArchivedDays).not.toHaveBeenCalled();
    }
  });

  it("generateMetadata and the page share ONE parser — a hostile segment yields no canonical", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ data: "//evil.example.com" }),
    });
    expect(metadata.alternates).toBeUndefined();
    expect(metadata.robots).toEqual({ index: false });
  });
});

describe("AC 1 — a future or malformed date 404s (T-WEB-S170)", () => {
  it("a WELL-FORMED future date 404s because the READER answers undefined, on both the day page and a play page", async () => {
    spies.listArchivedDays.mockResolvedValue([]);
    spies.getArchivedDaily.mockResolvedValue(undefined);
    spies.archiveDateClass.mockResolvedValue("future");

    await expect(
      ArchiveDayPage({ params: Promise.resolve({ data: "2099-01-01" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(
      ArchiveSudokuPage({ params: Promise.resolve({ data: "2099-01-01" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(spies.redirect).not.toHaveBeenCalled();

    expect(spies.listArchivedDays).toHaveBeenCalled();
    expect(spies.getArchivedDaily).toHaveBeenCalledWith(
      spies.stubDb,
      "sudoku",
      "2099-01-01",
    );
  });

  it("a MALFORMED date 404s at calendarDateString, before any read", async () => {
    for (const data of ["2026-02-30", "mes", "../2026-08-01", "%2e%2e"]) {
      spies.listArchivedDays.mockClear();
      spies.getArchivedDaily.mockClear();
      await expect(
        ArchiveDayPage({ params: Promise.resolve({ data }) }),
      ).rejects.toThrow("NEXT_NOT_FOUND");
      await expect(
        ArchiveSudokuPage({ params: Promise.resolve({ data }) }),
      ).rejects.toThrow("NEXT_NOT_FOUND");
      expect(spies.listArchivedDays).not.toHaveBeenCalled();
      expect(spies.getArchivedDaily).not.toHaveBeenCalled();
    }
  });
});

describe("today's URL RESOLVES (T-WEB-S171)", () => {
  it("today's date redirects — the day page to the hub, a play page to that game's daily route", async () => {
    spies.listArchivedDays.mockResolvedValue([]);
    spies.getArchivedDaily.mockResolvedValue(undefined);
    spies.archiveDateClass.mockResolvedValue("today");

    await expect(
      ArchiveDayPage({ params: Promise.resolve({ data: "2026-08-14" }) }),
    ).rejects.toThrow("NEXT_REDIRECT:/");
    await expect(
      ArchiveSudokuPage({ params: Promise.resolve({ data: "2026-08-14" }) }),
    ).rejects.toThrow("NEXT_REDIRECT:/sudoku");

    expect(spies.notFound).not.toHaveBeenCalled();
  });

  it("the ORDER is asserted, not only the outcome — a rendering path never calls the classifier", async () => {
    spies.getArchivedDaily.mockResolvedValue({
      game: "sudoku",
      date: "2026-08-03",
      givens: Array.from({ length: 81 }, () => 0),
      tier: 1,
    });
    await ArchiveSudokuPage({
      params: Promise.resolve({ data: "2026-08-03" }),
    });

    expect(spies.archiveDateClass).not.toHaveBeenCalled();
  });

  it("an empty read classified `past` or `future` 404s rather than redirecting — the midnight straddle", async () => {
    for (const dateClass of ["past", "future"]) {
      spies.getArchivedDaily.mockResolvedValue(undefined);
      spies.archiveDateClass.mockResolvedValue(dateClass);
      await expect(
        ArchiveSudokuPage({ params: Promise.resolve({ data: "2026-08-03" }) }),
      ).rejects.toThrow("NEXT_NOT_FOUND");
    }
    expect(spies.redirect).not.toHaveBeenCalled();
  });
});

describe("a published past day renders the archived board (T-WEB-S172)", () => {
  it("the SERVER's date reaches the client tree, and the pre-hydration paint carries the play-state marker", async () => {
    spies.getArchivedDaily.mockResolvedValue({
      game: "sudoku",
      date: "2026-08-03",
      givens: Array.from({ length: 81 }, () => 0),
      tier: 1,
    });

    const element = await ArchiveSudokuPage({
      params: Promise.resolve({ data: "2026-08-03" }),
    });
    const markup = renderToStaticMarkup(element);

    expect(markup).toContain(formatLongDate("2026-08-03"));

    expect(markup).toContain('data-play-state="skeleton"');

    expect(markup).toContain("/arquivo/2026-08-03");
  });
});

describe("the three remaining archive roots gate the first paint too (T-WEB-S357)", () => {
  const ARCHIVED = "2026-08-03";
  const BINAIRO = generateBinairo({ seed: 20_260_803, weekday: 1 });
  const NONOGRAM = generateNonogram(20_260_803, 1);
  const NONOGRAM_SOLVED = solutionMarks(NONOGRAM.clues);
  if (NONOGRAM_SOLVED === null) {
    throw new Error("the nonogram fixture's clues do not solve");
  }

  const cases = [
    {
      game: "binairo",
      page: ArchiveBinairoPage,
      live: ["data-cell-index", "<button"],
      archived: {
        game: "binairo",
        date: ARCHIVED,
        size: 8,
        givens: [...BINAIRO.givens],
      },
      record: {
        v: 1,
        game: "binairo",
        date: ARCHIVED,
        entries: [...BINAIRO.solution],
        elapsedMs: 272_000,
        hintsUsed: 0,
        concluded: true,
        pendingSync: false,
        syncOutcome: "recorded",
      },
    },
    {
      game: "nonogram",
      page: ArchiveNonogramPage,
      live: ["data-cell-index", "<button"],
      archived: {
        game: "nonogram",
        date: ARCHIVED,
        size: NONOGRAM.size,
        clues: NONOGRAM.clues,
      },
      record: {
        v: 1,
        game: "nonogram",
        date: ARCHIVED,
        size: NONOGRAM.size,
        entries: [...NONOGRAM_SOLVED],
        elapsedMs: 272_000,
        hintsUsed: 0,
        concluded: true,
        pendingSync: false,
        syncOutcome: "recorded",
      },
    },
    {
      game: "termo",
      page: ArchiveTermoPage,
      live: ["<button"],
      archived: { game: "termo", date: ARCHIVED },
      record: {
        v: 1,
        game: "termo",
        date: ARCHIVED,
        guesses: [
          {
            guess: "termo",
            tiles: ["correct", "correct", "correct", "correct", "correct"],
          },
        ],
        answer: "termo",
        outcome: "won",
        elapsedMs: 272_000,
        hintsUsed: 0,
        concluded: true,
        pendingSync: false,
        syncOutcome: "recorded",
      },
    },
  ] as const;

  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it.each(cases)(
    "$game: a concluded play record is in the store, and the pre-hydration paint is still the skeleton",
    async ({ game, page, live, archived, record }) => {
      window.localStorage.setItem(
        playRecordKey(game, ARCHIVED),
        JSON.stringify(record),
      );
      expect(readPlayRecord(game, ARCHIVED)?.concluded).toBe(true);
      spies.getArchivedDaily.mockResolvedValue(archived);

      const element = await page({
        params: Promise.resolve({ data: ARCHIVED }),
      });
      const readStorage = vi.spyOn(Storage.prototype, "getItem");
      const markup = renderToStaticMarkup(element);

      expect(readStorage).not.toHaveBeenCalled();
      expect(markup).toContain('data-play-state="skeleton"');
      expect(markup).not.toContain('data-play-state="concluded"');

      for (const marker of live) {
        expect(markup).not.toContain(marker);
      }
    },
  );
});

describe("the archive never enters the conclusion tree (T-WEB-S183)", () => {
  function moduleGraph(entry: string): string[] {
    const seen = new Set<string>();
    const queue = [entry];
    while (queue.length > 0) {
      const current = queue.pop();
      if (current === undefined || seen.has(current)) {
        continue;
      }
      seen.add(current);
      const source = readFileSync(current, "utf8");
      for (const match of source.matchAll(
        /(?:from|import)\s*\(?\s*"(\.[^"]*)"/g,
      )) {
        const resolved = resolveRelative(current, match[1] ?? "");
        if (resolved !== undefined) {
          queue.push(resolved);
        }
      }
    }
    return [...seen];
  }

  function resolveRelative(
    from: string,
    specifier: string,
  ): string | undefined {
    const base = join(dirname(from), specifier);
    for (const candidate of [
      base,
      `${base}.ts`,
      `${base}.tsx`,
      join(base, "index.ts"),
      join(base, "index.tsx"),
    ]) {
      if (existsSync(candidate) && statSync(candidate).isFile()) {
        return candidate;
      }
    }
    return undefined;
  }

  it("no archive page's module graph contains conclusion-view, termo-conclusion, nonogram-conclusion or readDayState", () => {
    const entries = [
      "app/arquivo/page.tsx",
      "app/arquivo/mes/[mes]/page.tsx",
      "app/arquivo/[data]/page.tsx",
      "app/arquivo/[data]/binairo/page.tsx",
      "app/arquivo/[data]/sudoku/page.tsx",
      "app/arquivo/[data]/nonogram/page.tsx",
      "app/arquivo/[data]/termo/page.tsx",
    ].map((path) => join(import.meta.dirname, "..", path));

    const graph = entries.flatMap((entry) => moduleGraph(entry));

    for (const forbidden of [
      "conclusion-view",
      "termo-conclusion",
      "nonogram-conclusion",
      "binairo-screen",
      "sudoku-screen",
      "nonogram-screen",
      "termo-screen",
    ]) {
      const hits = graph.filter(
        (path) =>
          path.includes(`/src/play/${forbidden}`) ||
          (/\/src\/(?:binairo|sudoku|nonogram|termo)\//.test(path) &&
            path.endsWith(`${forbidden}.tsx`)),
      );
      expect(hits, forbidden).toEqual([]);
    }

    expect(
      graph.filter((path) => path.includes("/src/play/day-state")),
    ).toEqual([]);
    for (const path of graph) {
      expect(readFileSync(path, "utf8")).not.toContain("readDayState");
    }

    expect(graph.filter((path) => path.includes("/src/day/"))).toEqual([]);
    for (const path of graph) {
      expect(readFileSync(path, "utf8")).not.toContain("useDayTruth");
    }
  });

  it("the walker is not vacuous — it really reaches the shared play layer", () => {
    const graph = moduleGraph(
      join(import.meta.dirname, "..", "app/arquivo/[data]/sudoku/page.tsx"),
    );

    expect(graph.some((path) => path.includes("/src/archive/"))).toBe(true);
    expect(
      graph.some((path) => path.endsWith("/src/sudoku/play-view.tsx")),
    ).toBe(true);
    expect(
      graph.some((path) => path.endsWith("/src/play/use-play-lifecycle.ts")),
    ).toBe(true);

    const dailyGraph = moduleGraph(
      join(import.meta.dirname, "..", "app/sudoku/page.tsx"),
    );
    expect(
      dailyGraph.some((path) => path.endsWith("/src/play/conclusion-view.tsx")),
    ).toBe(true);
  });
});

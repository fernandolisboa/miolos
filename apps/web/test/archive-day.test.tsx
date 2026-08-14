import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";

import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { formatLongDate, formatMonth, messages } from "../src/i18n";

// One archived day (#31 AC 1, ADR-0053 decision 1). The page is an async
// server component, invoked as a plain function; the view it returns is
// rendered directly.

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

    // One date, asked for as an inclusive one-day range through the wall.
    expect(spies.listArchivedDays).toHaveBeenCalledWith(spies.stubDb, {
      from: "2026-08-03",
      to: "2026-08-03",
    });
    // The archived path costs exactly ONE round trip: a row in hand is the
    // proof that the date is past, so the classifier is never consulted.
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

    // One level up, never further: the day page's back is its month page.
    expect(
      screen.getByRole("link", {
        name: messages.archive.backToMonthAria(formatMonth("2026-08-01")),
      }),
    ).toHaveAttribute("href", "/arquivo/mes/2026-08");
  });

  it("a short date renders fewer cards and NO placeholder", async () => {
    // 2026-08-01 is the archive's real floor shape: the cron gained sudoku on
    // 01, nonogram on 02 and termo on 03, with no backfill.
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

    // `calendarDateString`, never a shape regex: `2026-02-30` is well-formed
    // and is not a day, and a shape regex accepts it.
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
    // The mechanism that matters: a well-formed future date passes
    // validation and is refused IN SQL, inside the wall (ADR-0004). Nothing
    // in `apps/web` compares it to a clock — the reader simply has no row.
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

    // The reader really was consulted — this is not a validation 404 wearing
    // the wall's clothes.
    expect(spies.listArchivedDays).toHaveBeenCalled();
    expect(spies.getArchivedDaily).toHaveBeenCalledWith(
      spies.stubDb,
      "sudoku",
      "2099-01-01",
    );
  });

  it("a MALFORMED date 404s at calendarDateString, before any read", async () => {
    // The second, separate mechanism. `2026-02-30` is the case a shape regex
    // accepts and `calendarDateString` rejects, which is why the repo's one
    // day validator is used here rather than a hand-rolled pattern.
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
    // The redirect target is a LITERAL from `routes`, so there is no
    // open-redirect surface, and it is TEMPORARY by `redirect()`'s own
    // semantics — a permanent one would be cached against a URL whose truth
    // value changes at midnight.
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
    // A row in hand IS the proof that the date is past, so no clock
    // comparison can contradict it and none is made.
    expect(spies.archiveDateClass).not.toHaveBeenCalled();
  });

  it("an empty read classified `past` or `future` 404s rather than redirecting — the midnight straddle", async () => {
    // The only reachable straddle: the date became past between the two
    // statements. It answers 404 and a reload resolves it, and it can never
    // hit a sitemap-advertised URL, because a URL enters the sitemap only
    // once the row is already returnable.
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

    // The date in the client tree is the SERVER's, never a client clock
    // (ADR-0010 / ADR-0028 decision 4).
    expect(markup).toContain(formatLongDate("2026-08-03"));
    // The marker the visual gate scans for is in the PRE-HYDRATION paint:
    // the screen renders its skeleton first, because the record cannot be
    // read before the mount effect.
    expect(markup).toContain('data-play-state="skeleton"');
    // And the archive's chrome is already there — the back link is the day
    // page's, never "Hoje".
    expect(markup).toContain("/arquivo/2026-08-03");
  });
});

describe("the archive never enters the conclusion tree (T-WEB-S183)", () => {
  /** Every module reachable from `entry` by relative import. */
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
    // PROSE IS NOT A GATE. `conclusion-view.tsx` calls `useDayState(date)`,
    // whose streak card fires `GET /streak` and whose next-puzzle affordance
    // chains to TODAY's routes — so composing a screen ROOT would falsify
    // three of ADR-0053 decision 9's claims at once.
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
    // `readDayState` is reached only through `play/day-state`, which nothing
    // in the archive imports.
    expect(
      graph.filter((path) => path.includes("/src/play/day-state")),
    ).toEqual([]);
    for (const path of graph) {
      expect(readFileSync(path, "utf8")).not.toContain("readDayState");
    }
  });

  it("the walker is not vacuous — it really reaches the shared play layer", () => {
    const graph = moduleGraph(
      join(import.meta.dirname, "..", "app/arquivo/[data]/sudoku/page.tsx"),
    );
    // It crosses from `app/` into `src/archive`, then into the per-game view
    // and the shared lifecycle — so an empty forbidden-hit list above means
    // "not reached", not "nothing walked".
    expect(graph.some((path) => path.includes("/src/archive/"))).toBe(true);
    expect(
      graph.some((path) => path.endsWith("/src/sudoku/play-view.tsx")),
    ).toBe(true);
    expect(
      graph.some((path) => path.endsWith("/src/play/use-play-lifecycle.ts")),
    ).toBe(true);
    // And the DAILY root's graph does contain what the archive's must not,
    // which is what makes the exclusion a real difference.
    const dailyGraph = moduleGraph(
      join(import.meta.dirname, "..", "app/sudoku/page.tsx"),
    );
    expect(
      dailyGraph.some((path) => path.endsWith("/src/play/conclusion-view.tsx")),
    ).toBe(true);
  });
});

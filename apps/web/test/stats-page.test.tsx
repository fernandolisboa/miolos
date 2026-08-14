import { statsResponseSchema, type StatsCalendarResponse } from "@miolos/core";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import StatsPage from "../app/estatisticas/page";
import {
  formatElapsed,
  formatLongDate,
  formatMonth,
  messages,
} from "../src/i18n";

// The /estatisticas screen (#29, plan 033 §6.2), driven through the page
// shell with the stats client MOCKED — the seam the jsdom half owns: CI's
// `impeccable detect` only ever scans the settled-null zero state (the
// endpoints are requireUserId-gated and the preview's credentialed calls
// are anonymous), so the data-bearing renderings below are verified HERE,
// not by the detect green.

const clients = vi.hoisted(() => ({
  fetchStats: vi.fn(),
  fetchStatsCalendar: vi.fn(),
}));
vi.mock("../src/stats/stats-client", () => clients);

// #30's third client, mocked for the same seam reason (B6): without this,
// `useMedals()` would run the real `fetchMedals` in jsdom — a loud
// console.error from the env guard in every test and an un-acted
// `setValue`. The medal renderings themselves are medals-section.test.tsx's
// claim; here the pending promise keeps the section in its no-DOM state.
const medalsClient = vi.hoisted(() => ({
  fetchMedals: vi.fn(),
}));
vi.mock("../src/medals/medals-client", () => medalsClient);

/** A populated summary: sudoku carries values, binairo carries nulls. */
const STATS = statsResponseSchema.parse({
  date: "2026-08-02",
  binairo: {
    solved: 0,
    bestMs: null,
    averageMs: null,
    averageSampleCount: 0,
    histogram: [0, 0, 0, 0, 0, 0],
  },
  sudoku: {
    solved: 7,
    bestMs: 238_000,
    averageMs: 391_000,
    averageSampleCount: 4,
    histogram: [1, 0, 5, 0, 0, 1],
  },
  nonogram: {
    solved: 1,
    bestMs: 512_000,
    averageMs: 512_000,
    averageSampleCount: 1,
    histogram: [0, 0, 0, 0, 1, 0],
  },
  termo: { solved: 12, distribution: [0, 1, 4, 5, 2, 0, 3] },
  perfectDays: 2,
  todayTermoGuesses: null,
});

/** Two months, all three states, one perfect day — newest month last in
 *  the enumeration, first in the rendered grids. */
const CALENDAR: StatsCalendarResponse = {
  days: [
    { date: "2026-07-29", state: "missed", perfect: false },
    { date: "2026-07-30", state: "late", perfect: false },
    { date: "2026-07-31", state: "onTime", perfect: true },
    { date: "2026-08-01", state: "onTime", perfect: false },
    { date: "2026-08-02", state: "missed", perfect: false },
  ],
};

beforeEach(() => {
  // Unsettled forever: every suite here is about the stats surfaces, and
  // an unsettled medals fetch renders no medal DOM at all (D8).
  medalsClient.fetchMedals.mockReturnValue(new Promise(() => undefined));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the stats screen's honest zero (T-WEB-S153)", () => {
  it("renders the marker, every section and blanked tabular slots before any fetch settles", () => {
    clients.fetchStats.mockReturnValue(new Promise(() => undefined));
    clients.fetchStatsCalendar.mockReturnValue(new Promise(() => undefined));

    const { container } = render(<StatsPage />);

    // The shell and its marker — what the impeccable preflight greps for.
    expect(
      container.querySelector('[data-page="estatisticas"]'),
    ).not.toBeNull();
    expect(screen.getByText(messages.stats.title)).toBeInTheDocument();

    // The summary is a skeleton: aria-hidden, value blanked.
    expect(
      screen.getByText(messages.stats.perfectDays.label).closest("section"),
    ).toHaveAttribute("aria-hidden", "true");

    // All four game blocks at final dimensions: the F5 labels are present
    // for the three timed games, Termo's solved row and fail label too.
    expect(screen.getAllByText(messages.stats.rows.best)).toHaveLength(3);
    expect(screen.getAllByText(messages.stats.rows.average)).toHaveLength(3);
    expect(
      screen.getByText(messages.stats.rows.solved(messages.games.termo.name)),
    ).toBeInTheDocument();
    expect(screen.getByText(messages.stats.termo.fail)).toBeInTheDocument();

    // Values are blanked, not zeroed — nothing is claimed pre-fetch — and
    // every value slot aligns through the tabular-nums utility class.
    expect(container.textContent).toContain(" ");
    expect(container.querySelectorAll(".tabular-nums").length).toBeGreaterThan(
      0,
    );

    // The calendar reserves its box without claiming a month.
    expect(
      container.querySelector('[data-stats-state="skeleton"]'),
    ).not.toBeNull();
  });
});

describe("the fetched aggregates render (T-WEB-S154)", () => {
  it("renders the F5 stat rows, histogram arias, Termo distribution and the Dias Perfeitos count", async () => {
    clients.fetchStats.mockResolvedValue(STATS);
    clients.fetchStatsCalendar.mockResolvedValue(CALENDAR);

    render(<StatsPage />);

    // Sudoku's three rows, through the formatters the values ride.
    expect(await screen.findByText(formatElapsed(238_000))).toBeInTheDocument();
    expect(screen.getByText(formatElapsed(391_000))).toBeInTheDocument();
    expect(
      screen.getByText(messages.stats.rows.solved(messages.games.sudoku.name)),
    ).toBeInTheDocument();

    // Null best/average render the honest em dash, never a fake zero.
    expect(screen.getAllByText(messages.stats.emptyValue)).toHaveLength(2);

    // Histogram buckets carry the spoken names, not the glyph labels.
    expect(
      screen.getByLabelText(
        messages.stats.histogram.aria(
          messages.stats.histogram.bucketNames[2] ?? "",
          5,
        ),
      ),
    ).toBeInTheDocument();

    // Termo's distribution rows and the unqualified fail row.
    expect(
      screen.getByLabelText(messages.stats.termo.rowAria(4, 5)),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(messages.stats.termo.failAria(3)),
    ).toBeInTheDocument();

    // The summary's composed accessible name and its numeral.
    const summary = screen.getByLabelText(messages.stats.perfectDays.aria(2));
    expect(summary).toHaveTextContent("2");
  });
});

describe("the calendar renders the three states honestly (T-WEB-S155)", () => {
  it("groups months newest-first with distinct state hooks, the perfect marker and per-state arias", async () => {
    clients.fetchStats.mockResolvedValue(STATS);
    clients.fetchStatsCalendar.mockResolvedValue(CALENDAR);

    const { container } = render(<StatsPage />);

    // Per-state day arias, composed in the messages module.
    expect(
      await screen.findByLabelText(
        messages.stats.calendar.dayAria.late(formatLongDate("2026-07-30")),
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(
        messages.stats.calendar.dayAria.onTimePerfect(
          formatLongDate("2026-07-31"),
        ),
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(
        messages.stats.calendar.dayAria.missed(formatLongDate("2026-08-02")),
      ),
    ).toBeInTheDocument();

    // The states are distinguishable through structural hooks, never
    // colour alone (§6.2's binding carriers ride these attributes).
    expect(
      container.querySelectorAll('[data-state="onTime"]').length,
    ).toBeGreaterThan(0);
    expect(
      container.querySelectorAll('[data-state="late"]').length,
    ).toBeGreaterThan(0);
    // Exactly the fixture's two missed days plus the legend swatch:
    // padding cells and out-of-range days are NOT missed.
    expect(container.querySelectorAll('[data-state="missed"]')).toHaveLength(3);
    expect(container.querySelectorAll("[data-perfect]")).toHaveLength(1);

    // Newest month first: agosto's grid precedes julho's.
    const titles = [...container.querySelectorAll("h3")].map(
      (heading) => heading.textContent,
    );
    expect(titles).toEqual([
      formatMonth("2026-08-01"),
      formatMonth("2026-07-01"),
    ]);

    // The legend renders beside real data, all three words.
    expect(
      screen.getByText(messages.stats.calendar.legend.onTime),
    ).toBeInTheDocument();
    expect(
      screen.getByText(messages.stats.calendar.legend.late),
    ).toBeInTheDocument();
    expect(
      screen.getByText(messages.stats.calendar.legend.missed),
    ).toBeInTheDocument();
  });

  it("renders the neutral current month with no legend claims on settled-null", async () => {
    clients.fetchStats.mockResolvedValue(undefined);
    clients.fetchStatsCalendar.mockResolvedValue(undefined);

    const { container } = render(<StatsPage />);
    await waitFor(() => {
      expect(
        container.querySelector('[data-stats-state="skeleton"]'),
      ).toBeNull();
    });

    // One month grid, geometry only: no day claims any state, and no
    // legend asserts states no cell carries.
    expect(container.querySelectorAll("h3")).toHaveLength(1);
    expect(container.querySelectorAll("[data-state]")).toHaveLength(0);
    expect(
      screen.queryByText(messages.stats.calendar.legend.onTime),
    ).not.toBeInTheDocument();

    // ...and the aggregates render REAL zeros, the hub's streak-0 posture.
    const summary = screen.getByLabelText(messages.stats.perfectDays.aria(0));
    expect(summary).toHaveTextContent("0");
  });
});

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

const clients = vi.hoisted(() => ({
  fetchStats: vi.fn(),
  fetchStatsCalendar: vi.fn(),
}));
vi.mock("../src/stats/stats-client", () => clients);

const medalsClient = vi.hoisted(() => ({
  fetchMedals: vi.fn(),
}));
vi.mock("../src/medals/medals-client", () => medalsClient);

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

    expect(
      container.querySelector('[data-page="estatisticas"]'),
    ).not.toBeNull();
    expect(screen.getByText(messages.stats.title)).toBeInTheDocument();

    expect(
      screen.getByText(messages.stats.perfectDays.label).closest("section"),
    ).toHaveAttribute("aria-hidden", "true");

    expect(screen.getAllByText(messages.stats.rows.best)).toHaveLength(3);
    expect(screen.getAllByText(messages.stats.rows.average)).toHaveLength(3);
    expect(
      screen.getByText(messages.stats.rows.solved(messages.games.termo.name)),
    ).toBeInTheDocument();
    expect(screen.getByText(messages.stats.termo.fail)).toBeInTheDocument();

    expect(container.textContent).toContain(" ");
    expect(container.querySelectorAll(".tabular-nums").length).toBeGreaterThan(
      0,
    );

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

    expect(await screen.findByText(formatElapsed(238_000))).toBeInTheDocument();
    expect(screen.getByText(formatElapsed(391_000))).toBeInTheDocument();
    expect(
      screen.getByText(messages.stats.rows.solved(messages.games.sudoku.name)),
    ).toBeInTheDocument();

    expect(screen.getAllByText(messages.stats.emptyValue)).toHaveLength(2);

    expect(
      screen.getByLabelText(
        messages.stats.histogram.aria(
          messages.stats.histogram.bucketNames[2] ?? "",
          5,
        ),
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByLabelText(messages.stats.termo.rowAria(4, 5)),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(messages.stats.termo.failAria(3)),
    ).toBeInTheDocument();

    const summary = screen.getByLabelText(messages.stats.perfectDays.aria(2));
    expect(summary).toHaveTextContent("2");
  });
});

describe("the calendar renders the three states honestly (T-WEB-S155)", () => {
  it("groups months newest-first with distinct state hooks, the perfect marker and per-state arias", async () => {
    clients.fetchStats.mockResolvedValue(STATS);
    clients.fetchStatsCalendar.mockResolvedValue(CALENDAR);

    const { container } = render(<StatsPage />);

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

    expect(
      container.querySelectorAll('[data-state="onTime"]').length,
    ).toBeGreaterThan(0);
    expect(
      container.querySelectorAll('[data-state="late"]').length,
    ).toBeGreaterThan(0);

    expect(container.querySelectorAll('[data-state="missed"]')).toHaveLength(3);
    expect(container.querySelectorAll("[data-perfect]")).toHaveLength(1);

    const titles = [...container.querySelectorAll("h3")].map(
      (heading) => heading.textContent,
    );
    expect(titles).toEqual([
      formatMonth("2026-08-01"),
      formatMonth("2026-07-01"),
    ]);

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

    expect(container.querySelectorAll("h3")).toHaveLength(1);
    expect(container.querySelectorAll("[data-state]")).toHaveLength(0);
    expect(
      screen.queryByText(messages.stats.calendar.legend.onTime),
    ).not.toBeInTheDocument();

    const summary = screen.getByLabelText(messages.stats.perfectDays.aria(0));
    expect(summary).toHaveTextContent("0");
  });
});

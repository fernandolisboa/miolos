import { statsResponseSchema, type StatsResponse } from "@miolos/core";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConclusionView } from "../src/play/conclusion-view";
import {
  writePlayRecord,
  type BinairoPlayRecord,
  type TermoPlayRecord,
} from "../src/play/play-record";
import { TermoConclusion } from "../src/termo/termo-conclusion";
import { messages } from "../src/i18n";

/**
 * The conclusion's stat block (#29, plan 033 §6.4/D13): mounted by the
 * caller only under `syncOutcome === "recorded"` — the StreakCard's own
 * gate — with today's bucket from the LOCAL duration, the closing line
 * gated on the average's own sample population, and Termo's distribution
 * highlighting today's row on a win (via the server value) and the fail
 * row on a loss (via the local outcome).
 */
const DATE = "2026-07-30";
const ELAPSED_MS = 407_000; // bucket index 3 (360_000 <= x < 420_000)

const sync = vi.hoisted(() => ({
  startCompletionSync: vi.fn(() => () => undefined),
  flushPendingCompletions: vi.fn(() => Promise.resolve()),
}));
vi.mock("../src/play/sync", () => sync);

const clients = vi.hoisted(() => ({
  fetchStats: vi.fn(),
  fetchStatsCalendar: vi.fn(),
}));
vi.mock("../src/stats/stats-client", () => clients);

// The streak card mounts under the same gate; keep its read settled-null
// so this suite's subject is the stat block alone.
const streak = vi.hoisted(() => ({
  fetchStreak: vi.fn(() => Promise.resolve(undefined)),
}));
vi.mock("../src/streak/streak-client", () => streak);

function concludedBinairo(
  overrides: Partial<BinairoPlayRecord> = {},
): BinairoPlayRecord {
  return {
    v: 1,
    game: "binairo",
    date: DATE,
    entries: Array.from({ length: 64 }, () => null),
    grid: Array.from({ length: 64 }, (_unused, index) =>
      index % 2 === 0 ? 0 : 1,
    ),
    elapsedMs: ELAPSED_MS,
    hintsUsed: 0,
    concluded: true,
    pendingSync: false,
    syncOutcome: "recorded",
    ...overrides,
  };
}

type Tiles = TermoPlayRecord["guesses"][number]["tiles"];
const TERMO_MISS: Tiles = ["absent", "present", "absent", "absent", "present"];
const TERMO_WIN: Tiles = [
  "correct",
  "correct",
  "correct",
  "correct",
  "correct",
];

function wonTermo(overrides: Partial<TermoPlayRecord> = {}): TermoPlayRecord {
  return {
    v: 1,
    game: "termo",
    date: DATE,
    guesses: [
      { guess: "cafes", tiles: [...TERMO_MISS] },
      { guess: "praga", tiles: [...TERMO_WIN] },
    ],
    answer: "praga",
    outcome: "won",
    elapsedMs: 188_000,
    hintsUsed: 0,
    concluded: true,
    pendingSync: false,
    syncOutcome: "recorded",
    ...overrides,
  };
}

const lostTermo = () =>
  wonTermo({
    guesses: "abcdef".split("").map((letter) => ({
      guess: letter.repeat(5),
      tiles: [...TERMO_MISS],
    })),
    outcome: "lost",
  });

/** A summary whose binairo block carries `averageMs` and `sampleCount`. */
function statsWith(
  averageMs: number | null,
  averageSampleCount: number,
  todayTermoGuesses: number | null = null,
): StatsResponse {
  const zero = {
    solved: 0,
    bestMs: null,
    averageMs: null,
    averageSampleCount: 0,
    histogram: [0, 0, 0, 0, 0, 0],
  };
  return statsResponseSchema.parse({
    date: DATE,
    binairo: {
      solved: 9,
      bestMs: 238_000,
      averageMs,
      averageSampleCount,
      histogram: [1, 2, 0, 4, 1, 1],
    },
    sudoku: zero,
    nonogram: zero,
    termo: { solved: 5, distribution: [0, 1, 0, 2, 1, 0, 1] },
    perfectDays: 0,
    todayTermoGuesses,
  });
}

function renderBinairoConclusion() {
  return render(
    <ConclusionView
      game="binairo"
      date={DATE}
      copy={messages.games.binairo.conclusion}
    />,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  // Hoisted module mocks survive `restoreAllMocks`; reset them so no call
  // count or resolved value leaks between cases.
  clients.fetchStats.mockReset();
  clients.fetchStatsCalendar.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the conclusion stat block (T-WEB-S157)", () => {
  it("never mounts while the day is not on the server: pending and rejected render the absence", async () => {
    for (const syncOutcome of ["pending", "rejected"] as const) {
      window.localStorage.clear();
      clients.fetchStats.mockResolvedValue(statsWith(400_000, 3));
      writePlayRecord(
        concludedBinairo({
          pendingSync: syncOutcome === "pending",
          syncOutcome,
        }),
      );

      const { unmount } = renderBinairoConclusion();
      await screen.findByText(
        syncOutcome === "pending"
          ? messages.conclusion.sync.pending
          : messages.conclusion.sync.rejected,
      );

      expect(
        screen.queryByText(messages.stats.rows.best),
      ).not.toBeInTheDocument();
      expect(clients.fetchStats).not.toHaveBeenCalled();
      unmount();
    }
  });

  it("renders the rows, the histogram with today's bucket from the LOCAL duration, and the faster closing line", async () => {
    clients.fetchStats.mockResolvedValue(statsWith(430_000, 3));
    writePlayRecord(concludedBinairo());

    const { container } = renderBinairoConclusion();

    expect(await screen.findByText("9")).toBeInTheDocument();
    expect(screen.getByText(messages.stats.rows.best)).toBeInTheDocument();
    expect(
      screen.getByText(messages.stats.rows.solved(messages.games.binairo.name)),
    ).toBeInTheDocument();

    // 407_000 ms → bucket 3, from the local record, never the server.
    const today = container.querySelector("[data-today]");
    expect(today).not.toBeNull();
    expect(today).toHaveAttribute(
      "aria-label",
      messages.stats.histogram.aria(
        messages.stats.histogram.bucketNames[3] ?? "",
        4,
      ),
    );

    // local 407_000 < average 430_000 → the faster line, F5's own words.
    expect(
      screen.getByText(messages.conclusion.closingFaster),
    ).toBeInTheDocument();
  });

  it("renders the slower line when the local time exceeds the average, and neither on a tie", async () => {
    clients.fetchStats.mockResolvedValue(statsWith(390_000, 2));
    writePlayRecord(concludedBinairo());
    const slower = renderBinairoConclusion();
    expect(
      await screen.findByText(messages.conclusion.closingSlower),
    ).toBeInTheDocument();
    slower.unmount();

    window.localStorage.clear();
    clients.fetchStats.mockResolvedValue(statsWith(ELAPSED_MS, 2));
    writePlayRecord(concludedBinairo());
    renderBinairoConclusion();
    await screen.findByText(messages.stats.rows.best);
    expect(
      screen.queryByText(messages.conclusion.closingFaster),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(messages.conclusion.closingSlower),
    ).not.toBeInTheDocument();
  });

  it("holds the closing line back until the average rests on at least two samples", async () => {
    // averageSampleCount 1 is today alone (the recorded gate puts today's
    // row in the sample by construction): a comparison against a mean of
    // itself would always flatter, so the line stays out.
    clients.fetchStats.mockResolvedValue(statsWith(407_000, 1));
    writePlayRecord(concludedBinairo());

    renderBinairoConclusion();
    await screen.findByText(messages.stats.rows.best);

    expect(
      screen.queryByText(messages.conclusion.closingFaster),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(messages.conclusion.closingSlower),
    ).not.toBeInTheDocument();
  });

  it("renders Termo's distribution with today's row highlighted on a win, via the server value", async () => {
    clients.fetchStats.mockResolvedValue(statsWith(null, 0, 4));
    writePlayRecord(wonTermo());

    const { container } = render(<TermoConclusion date={DATE} />);

    expect(
      await screen.findByLabelText(messages.stats.termo.rowAria(4, 2)),
    ).toBeInTheDocument();
    const today = container.querySelector("[data-today]");
    expect(today).toHaveAttribute(
      "aria-label",
      messages.stats.termo.rowAria(4, 2),
    );
    // No time row and no closing line exist for this game (ADR-0045).
    expect(
      screen.queryByText(messages.stats.rows.best),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(messages.conclusion.closingFaster),
    ).not.toBeInTheDocument();
  });

  it("highlights the fail row on a loss, from the local outcome", async () => {
    clients.fetchStats.mockResolvedValue(statsWith(null, 0, null));
    writePlayRecord(lostTermo());

    const { container } = render(<TermoConclusion date={DATE} />);

    expect(
      await screen.findByLabelText(messages.stats.termo.failAria(1)),
    ).toBeInTheDocument();
    const today = container.querySelector("[data-today]");
    expect(today).toHaveAttribute(
      "aria-label",
      messages.stats.termo.failAria(1),
    );
  });

  it("unmounts back to the shipped absence when the fetch settles without a value", async () => {
    clients.fetchStats.mockResolvedValue(undefined);
    writePlayRecord(concludedBinairo());

    renderBinairoConclusion();
    await waitFor(() => {
      expect(clients.fetchStats).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(
        screen.queryByText(messages.stats.rows.best),
      ).not.toBeInTheDocument();
    });
  });
});

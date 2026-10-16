import {
  dailyMinesweeperResponseSchema,
  type DailyMinesweeperResponse,
} from "@miolos/core";
import {
  generateMinesweeperDaily,
  openMinesweeperCell,
} from "@miolos/games/minesweeper";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { formatElapsed, messages } from "../src/i18n";
import { startedGame } from "../src/minesweeper/daily-record";

const captured = vi.hoisted(() => ({
  fallbackOf: undefined as ((props: object) => ReactNode) | undefined,
}));
vi.mock("../src/play/conclusion-lazy", async (original) => {
  const actual = await original<typeof import("../src/play/conclusion-lazy")>();
  return {
    ...actual,
    resilientConclusion: (
      load: Parameters<typeof actual.resilientConclusion>[0],
      fallbackOf: (props: object) => ReactNode,
    ) => {
      captured.fallbackOf = fallbackOf;
      return actual.resilientConclusion(load, fallbackOf);
    },
  };
});

const GENERATED = generateMinesweeperDaily({ seed: 20_261_016, weekday: 5 });
const DAILY: DailyMinesweeperResponse = dailyMinesweeperResponseSchema.parse({
  game: "minesweeper",
  date: "2026-10-16",
  rows: GENERATED.rows,
  columns: GENERATED.columns,
  mines: GENERATED.mines,
  start: GENERATED.start,
});
const RESULT = { elapsedMs: 95_000, hintsUsed: 0 };

async function fallback(won: boolean): Promise<void> {
  await import("../src/minesweeper/minesweeper-screen");
  const started = startedGame(DAILY);
  const live = won
    ? { ...started, status: "won" as const }
    : openMinesweeperCell(started, DAILY.mines.indexOf(1));
  render(<>{captured.fallbackOf?.({ daily: DAILY, result: RESULT, live })}</>);
}

describe("a lost Campo Minado's degraded conclusion shows no time (T-WEB-S923b)", () => {
  it("drops the stamp word and the clock after a loss", async () => {
    await fallback(false);

    expect(
      screen.getByText(messages.games.minesweeper.conclusion.title),
    ).toBeInTheDocument();
    expect(screen.queryByText(messages.conclusion.stampLabel)).toBeNull();
    expect(screen.queryByText(formatElapsed(RESULT.elapsedMs))).toBeNull();
  });

  it("keeps the stamp word and the clock after a win", async () => {
    await fallback(true);

    expect(
      screen.getByText(messages.conclusion.stampLabel),
    ).toBeInTheDocument();
    expect(
      screen.getByText(formatElapsed(RESULT.elapsedMs)),
    ).toBeInTheDocument();
  });
});

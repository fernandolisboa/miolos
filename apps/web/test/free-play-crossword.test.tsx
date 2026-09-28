import type { DailyCrosswordResponse } from "@miolos/core";
import { fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FREE_PLAY_DATE } from "../src/free-play/catalog";
import { CrosswordFreeScreen } from "../src/free-play/crossword-free-screen";
import {
  useFreeCrossword,
  type FreeCrosswordDeps,
} from "../src/free-play/use-free-crossword";
import { messages } from "../src/i18n";

const SEED = 20_260_928;
const NEXT_SEED = 20_260_929;
const copy = messages.games.crossword.play;

function generated(seed: number): DailyCrosswordResponse {
  const deps = { pickSeed: () => seed };
  const { result } = renderHook(() => useFreeCrossword(deps));
  const { phase } = result.current;
  if (phase.kind !== "ready") {
    throw new Error(`seed ${String(seed)} did not generate`);
  }
  return phase.puzzle.daily;
}

function boardOf(): HTMLElement {
  return screen.getByRole("group", { name: copy.boardAria });
}

function cellAt(index: number): HTMLElement {
  const cell = boardOf().querySelector<HTMLElement>(
    `[data-cell-index="${String(index)}"]`,
  );
  if (cell === null) {
    throw new Error(`no cell at index ${String(index)}`);
  }
  return cell;
}

function solve(daily: DailyCrosswordResponse): void {
  for (const [index, letter] of daily.grid.flat().entries()) {
    if (letter === null) {
      continue;
    }
    if (screen.queryByText(messages.freePlay.solved.stamp) !== null) {
      return;
    }
    const cell = cellAt(index);
    fireEvent.pointerDown(cell);
    fireEvent.click(cell);
    fireEvent.keyDown(boardOf(), { key: letter });
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("a free crossword is today's wire shape, dated nowhere, one per seed (T-WEB-S445)", () => {
  it("carries FREE_PLAY_DATE and regenerates identically from the same seed", () => {
    for (const seed of [1, 42, SEED, 0xffff_ffff]) {
      const daily = generated(seed);

      expect(daily.date).toBe(FREE_PLAY_DATE);
      expect(generated(seed)).toEqual(daily);
    }
  });
});

describe("a free crossword plays, solves and goes again with nothing recorded (T-WEB-S446)", () => {
  it("has no clock and no level, solves to its own card, and 'Mais uma' draws a fresh board — zero fetch, zero writes", () => {
    const fetchMock = vi.fn(() => {
      throw new Error("free play must not fetch");
    });
    vi.stubGlobal("fetch", fetchMock);
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const first = generated(SEED);
    const next = generated(NEXT_SEED);
    const seeds = [SEED, NEXT_SEED];
    const pickSeed = vi.fn(() => seeds.shift() ?? 0);

    render(<CrosswordFreeScreen deps={{ pickSeed }} />);

    expect(screen.queryByText(messages.play.timerLabel)).toBeNull();
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(screen.queryByText(messages.freePlay.level.label)).toBeNull();

    solve(first);

    expect(
      screen.getByText(messages.freePlay.solved.stamp),
    ).toBeInTheDocument();
    expect(screen.getByText("Modo livre · Cruzadinha")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Mais uma"));

    expect(pickSeed).toHaveBeenCalledTimes(2);
    const blocks = next.grid.flat().map((cell) => cell === null);
    for (const [index, block] of blocks.entries()) {
      expect(cellAt(index).getAttribute("aria-disabled") === "true").toBe(
        block,
      );
    }
    expect(fetchMock).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });
});

describe("a failed free crossword offers a retry that recovers (T-WEB-S447)", () => {
  it("shows the shared error card, then a board once retry generates", () => {
    const real = generated(SEED);
    let throws = true;
    const generate: NonNullable<FreeCrosswordDeps["generate"]> = (seed) => {
      if (throws) {
        throws = false;
        throw new Error("generation failed");
      }
      return {
        seed,
        grid: real.grid,
        entries: real.clues.map((clue) => ({
          number: clue.number,
          direction: clue.direction,
          row: clue.row,
          col: clue.col,
          normalized: "x".repeat(clue.length),
          canonical: "x".repeat(clue.length),
          clue: clue.clue,
        })),
      };
    };

    render(<CrosswordFreeScreen deps={{ pickSeed: () => SEED, generate }} />);

    expect(screen.getByText(messages.freePlay.error.title)).toBeInTheDocument();

    fireEvent.click(screen.getByText(messages.freePlay.error.retry));

    expect(screen.queryByText(messages.freePlay.error.title)).toBeNull();
    expect(boardOf()).toBeInTheDocument();
  });
});

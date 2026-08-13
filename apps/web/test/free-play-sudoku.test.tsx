/**
 * The free-play Sudoku screen (#28): the generating state, the fresh-seed
 * retry ladder (plan 025 D5.2 — only `SudokuGenerationError` buys a seed),
 * and the zero-fetch solve with no timer anywhere (D8).
 */
import {
  generateDailySudoku,
  sudokuCriteriaForWeekday,
  SudokuGenerationError,
} from "@miolos/games/sudoku";
import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LEVEL_WEEKDAYS } from "../src/free-play/catalog";
import { SudokuFreeScreen } from "../src/free-play/sudoku-free-screen";
import { messages } from "../src/i18n";

const SEED = 20_260_812;
// The solve runs on Leve (weekday 1, tier 1) — the cheapest rung, the
// route the daily fixtures use too (route-ssr.test.tsx's own note).
const LEVE_PUZZLE = generateDailySudoku({
  seed: SEED,
  weekday: LEVEL_WEEKDAYS.leve,
});

function stableDeps(overrides: {
  readonly seeds: readonly number[];
  readonly generate?: typeof generateDailySudoku;
}) {
  const queue = [...overrides.seeds];
  const pickSeed = vi.fn(() => {
    const seed = queue.shift();
    if (seed === undefined) {
      throw new Error("the test drew more seeds than it pinned");
    }
    return seed;
  });
  return {
    deps: {
      pickSeed,
      ...(overrides.generate !== undefined
        ? { generate: overrides.generate }
        : {}),
    },
    pickSeed,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("free-play Sudoku generation states (T-WEB-S118)", () => {
  it("server-renders the generating skeleton with its marker — the static shell", () => {
    // No effect runs on the server: the pre-hydration HTML is the
    // generating state at final dimensions, which is what satisfies the
    // impeccable preflight's grep on a static page (plan 025 D1).
    const markup = renderToStaticMarkup(<SudokuFreeScreen />);

    expect(markup).toContain('data-play-state="generating"');
    expect(markup).toContain(messages.freePlay.generating);
    // The board card and keypad boxes are reserved, values blanked.
    expect(markup).toContain(messages.games.sudoku.play.keypad.erase);
  });

  it("retries with a fresh seed on SudokuGenerationError, up to three", () => {
    vi.stubGlobal("fetch", vi.fn());
    const failures = new SudokuGenerationError(
      1,
      sudokuCriteriaForWeekday(LEVEL_WEEKDAYS.medio),
      1,
    );
    let calls = 0;
    const generate: typeof generateDailySudoku = (options) => {
      calls += 1;
      if (calls <= 2) {
        throw failures;
      }
      return generateDailySudoku(options);
    };
    const { deps, pickSeed } = stableDeps({
      seeds: [1, 2, SEED],
      generate,
    });

    const { container } = render(<SudokuFreeScreen deps={deps} />);

    // Third seed succeeded: the board is up, three seeds were drawn.
    expect(
      container.querySelector("main")?.getAttribute("data-play-state"),
    ).toBe("playing");
    expect(pickSeed).toHaveBeenCalledTimes(3);
  });

  it("shows the error card after three throws, and its retry regenerates", () => {
    vi.stubGlobal("fetch", vi.fn());
    const failure = new SudokuGenerationError(
      1,
      sudokuCriteriaForWeekday(LEVEL_WEEKDAYS.medio),
      1,
    );
    let calls = 0;
    const generate: typeof generateDailySudoku = (options) => {
      calls += 1;
      if (calls <= 3) {
        throw failure;
      }
      return generateDailySudoku(options);
    };
    const { deps, pickSeed } = stableDeps({
      seeds: [1, 2, 3, SEED],
      generate,
    });

    const { container } = render(<SudokuFreeScreen deps={deps} />);

    // The ladder exhausted: never an empty screen (plan 025 §7.4).
    expect(
      container.querySelector("main")?.getAttribute("data-play-state"),
    ).toBe("error");
    expect(screen.getByText(messages.freePlay.error.title)).toBeInTheDocument();
    expect(pickSeed).toHaveBeenCalledTimes(3);

    fireEvent.click(screen.getByText(messages.freePlay.error.retry));

    expect(
      container.querySelector("main")?.getAttribute("data-play-state"),
    ).toBe("playing");
    expect(pickSeed).toHaveBeenCalledTimes(4);
  });
});

describe("free-play Sudoku zero-fetch solve, no timer (T-WEB-S119)", () => {
  it("solves a pinned Leve puzzle into the solved card with zero fetch calls", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    // Two draws: the default Médio mount, then the switch to Leve.
    const { deps } = stableDeps({ seeds: [SEED, SEED] });

    const { container } = render(<SudokuFreeScreen deps={deps} />);

    // No timer rendered ANYWHERE on the free screen (D8) — neither label
    // nor a 00:00 readout.
    expect(
      screen.queryByText(messages.play.timerLabel),
    ).not.toBeInTheDocument();
    expect(container.textContent).not.toContain("00:00");

    // Switch to Leve — the picker regenerates immediately (remount by key).
    fireEvent.click(
      screen.getByRole("radio", { name: messages.freePlay.level.aria("Leve") }),
    );

    // Key the solution in: select each empty cell, press its digit.
    for (const [index, given] of LEVE_PUZZLE.givens.entries()) {
      if (given !== 0) {
        continue;
      }
      const digit = LEVE_PUZZLE.solution[index];
      const cell = container.querySelector<HTMLElement>(
        `[data-cell-index="${index}"]`,
      );
      if (cell === null) {
        break; // solved — the in-place swap took the board with it
      }
      fireEvent.click(cell);
      fireEvent.click(
        screen.getByRole("button", {
          name: messages.games.sudoku.play.keypad.digitAria(Number(digit)),
        }),
      );
    }

    expect(
      screen.getByText(messages.freePlay.solved.stamp),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("control: a deliberate fetch is recorded by the same stub shape", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);

    await fetch("/anything");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

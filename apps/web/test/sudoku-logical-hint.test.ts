import {
  generateDailySudoku,
  nextSudokuStep,
  type SudokuPuzzle,
  type SudokuStep,
  type Weekday,
} from "@miolos/games/sudoku";
import { describe, expect, it } from "vitest";

import { messages } from "../src/i18n";
import { mergedGrid, solutionDigits, solvedDigits } from "../src/sudoku/engine";
import {
  nextSudokuHint,
  sudokuHintExplanation,
  type SudokuHintReason,
} from "../src/sudoku/hint";
import type { SudokuDigit } from "../src/sudoku/state";

const WEEKDAYS: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 7];

const HEAVY = 120_000;

const EMPTY: readonly (SudokuDigit | null)[] = Array.from(
  { length: 81 },
  () => null,
);

const PUZZLES = new Map<Weekday, SudokuPuzzle>();

function puzzleFor(weekday: Weekday): SudokuPuzzle {
  const cached = PUZZLES.get(weekday);
  if (cached !== undefined) {
    return cached;
  }
  const puzzle = generateDailySudoku({ seed: 20_260_801, weekday });
  PUZZLES.set(weekday, puzzle);
  return puzzle;
}

function solutionOf(givens: readonly number[]): readonly SudokuDigit[] {
  const digits = solutionDigits(givens);
  if (digits === null) {
    throw new Error("a generated daily is uniquely solvable by construction");
  }
  return digits;
}

function lastFreeIndex(puzzle: SudokuPuzzle): number {
  return puzzle.givens.lastIndexOf(0);
}

function everyThird(
  puzzle: SudokuPuzzle,
  solution: readonly SudokuDigit[],
): readonly (SudokuDigit | null)[] {
  return solution.map((digit, index) =>
    puzzle.givens[index] === 0 && index % 3 === 0 ? digit : null,
  );
}

describe("a wrong entry is corrected before any step (T-WEB-S538)", () => {
  it(
    "fixes the wrong cell and names it a correction, on every weekday",
    () => {
      for (const weekday of WEEKDAYS) {
        const puzzle = puzzleFor(weekday);
        const solution = solutionOf(puzzle.givens);
        const wrongAt = lastFreeIndex(puzzle);
        const correct = solution[wrongAt] ?? 1;
        const entries = everyThird(puzzle, solution).map((cell, index) =>
          index === wrongAt ? (correct === 9 ? 1 : 9) : cell,
        );

        expect(nextSudokuHint(solution, puzzle.givens, entries)).toEqual({
          index: wrongAt,
          value: correct,
          reason: { kind: "correction" },
        });
      }
    },
    HEAVY,
  );
});

describe("the hint reveals the next logical step (T-WEB-S539)", () => {
  it(
    "places the step's digit on a bare and on a correct partial board, on every weekday",
    () => {
      for (const weekday of WEEKDAYS) {
        const puzzle = puzzleFor(weekday);
        const solution = solutionOf(puzzle.givens);
        for (const entries of [EMPTY, everyThird(puzzle, solution)]) {
          const step = nextSudokuStep(mergedGrid(puzzle.givens, entries));
          if (step === null) {
            throw new Error(`no step on weekday ${String(weekday)}`);
          }

          expect(nextSudokuHint(solution, puzzle.givens, entries)).toEqual({
            index: step.index,
            value: solution[step.index],
            reason: { kind: "step", step },
          });
          expect(entries[step.index]).toBeNull();
          expect(puzzle.givens[step.index]).toBe(0);
        }
      }
    },
    HEAVY,
  );

  it("returns null when the board is full and right", () => {
    const puzzle = puzzleFor(1);
    const solution = solutionOf(puzzle.givens);
    const entries = solution.map((digit, index) =>
      puzzle.givens[index] === 0 ? digit : null,
    );

    expect(nextSudokuHint(solution, puzzle.givens, entries)).toBeNull();
  });
});

describe("the hint falls back to the first empty cell (T-WEB-S540)", () => {
  it("when the ladder cannot move", () => {
    const solution = solutionOf(puzzleFor(1).solution);
    const blank = Array.from({ length: 81 }, () => 0);

    expect(nextSudokuStep(blank)).toBeNull();
    expect(nextSudokuHint(solution, blank, EMPTY)).toEqual({
      index: 0,
      value: solution[0],
      reason: { kind: "fill" },
    });
  });

  it("when the step's digit is not the solution's", () => {
    const puzzle = puzzleFor(1);
    const relabelled = solvedDigits(
      solutionOf(puzzle.givens).map((digit) => (digit % 9) + 1),
    );
    if (relabelled === null) {
      throw new Error("a relabelled solution is still all digits");
    }
    const first = puzzle.givens.indexOf(0);

    expect(nextSudokuHint(relabelled, puzzle.givens, EMPTY)).toEqual({
      index: first,
      value: relabelled[first],
      reason: { kind: "fill" },
    });
  });
});

type SudokuReasonStep = Extract<SudokuHintReason, { kind: "step" }>;

function step(overrides: Partial<SudokuStep>): SudokuReasonStep {
  return {
    kind: "step",
    step: {
      index: 0,
      digit: 4,
      technique: "nakedSingle",
      unit: null,
      cells: [],
      after: null,
      ...overrides,
    },
  };
}

describe("every hint sentence (T-WEB-S543)", () => {
  const hidden = (kind: "row" | "column" | "box", index: number) =>
    ({ technique: "hiddenSingle", unit: { kind, index } }) as const;

  it("says why, in the words the Sudoku screen already uses", () => {
    expect(
      [
        { kind: "correction" } as const,
        { kind: "fill" } as const,
        step({}),
        step(hidden("row", 2)),
        step(hidden("column", 4)),
        step(hidden("box", 8)),
        step({ after: "hiddenPair" }),
        step({ ...hidden("row", 2), after: "pointing" }),
        step({ ...hidden("column", 0), after: "xWingCols" }),
        step({ ...hidden("box", 0), after: "nakedTriple" }),
      ].map(sudokuHintExplanation),
    ).toEqual([
      "Corrigimos um número que não fecha com as regras.",
      "Não achamos um passo lógico simples aqui, então preenchemos uma célula para você.",
      "Só o 4 cabe nesta célula: a linha, a coluna e o bloco já têm os outros números.",
      "Na linha 3, o 4 só cabe nesta célula.",
      "Na coluna 5, o 4 só cabe nesta célula.",
      "Neste bloco, o 4 só cabe nesta célula.",
      "Com uma técnica avançada (par escondido), só o 4 sobra para esta célula.",
      "Com uma técnica avançada (candidato travado), o 4 só cabe nesta célula da linha 3.",
      "Com uma técnica avançada (X-Wing), o 4 só cabe nesta célula da coluna 1.",
      "Com uma técnica avançada (trio fechado), o 4 só cabe nesta célula deste bloco.",
    ]);
  });

  it("names every elimination technique", () => {
    expect(messages.games.sudoku.play.hint.technique).toEqual({
      pointing: "candidato travado",
      claiming: "candidato travado",
      nakedPair: "par fechado",
      hiddenPair: "par escondido",
      nakedTriple: "trio fechado",
      hiddenTriple: "trio escondido",
      xWingRows: "X-Wing",
      xWingCols: "X-Wing",
    });
  });
});

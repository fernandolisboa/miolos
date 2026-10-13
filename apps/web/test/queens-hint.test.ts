import {
  dailyQueensResponseSchema,
  type DailyQueensResponse,
} from "@miolos/core";
import {
  generateQueens,
  nextQueensStep,
  type QueensElimination,
  type QueensPuzzle,
  type QueensStep,
} from "@miolos/games/queens";
import { describe, expect, it } from "vitest";

import { nextQueensHint, queensHintExplanation } from "../src/queens/hint";
import {
  initQueensPlayState,
  queensPlayReducer,
  type QueensCellValue,
  type QueensPlayAction,
  type QueensPlayState,
} from "../src/queens/state";
import { correctPartial, onEveryWeekday } from "./hint-boards";

const PUZZLES: readonly QueensPuzzle[] = onEveryWeekday(8, (seed, weekday) =>
  generateQueens({ seed, weekday }),
);

function daily(puzzle: QueensPuzzle): DailyQueensResponse {
  return dailyQueensResponseSchema.parse({
    game: "queens",
    date: "2026-08-01",
    size: puzzle.size,
    regions: puzzle.regions,
  });
}

function bare(puzzle: QueensPuzzle): readonly QueensCellValue[] {
  return puzzle.solution.map(() => null);
}

describe("nextQueensHint corrects first, then reasons, then falls back (T-WEB-S572)", () => {
  it("never reveals a wrong cell, on a bare board and on correct partial boards with X's, on every weekday", () => {
    for (const [at, puzzle] of PUZZLES.entries()) {
      for (const entries of [
        bare(puzzle),
        correctPartial(puzzle.solution, at + 1),
      ]) {
        const hint = nextQueensHint(puzzle, puzzle.solution, entries);

        expect(hint).not.toBeNull();
        expect(hint?.value).toBe(1);
        expect(puzzle.solution[hint?.index ?? -1]).toBe(1);
        expect(entries[hint?.index ?? -1]).toBeNull();
        expect(hint?.reason.kind).toBe("step");
      }
    }
  });

  it("lights exactly the unit's cells, with the hinted cell among them", () => {
    for (const puzzle of PUZZLES) {
      const hint = nextQueensHint(puzzle, puzzle.solution, bare(puzzle));
      const step = nextQueensStep(puzzle, bare(puzzle));

      expect(hint?.spotlight).toEqual(step?.cells);
      expect(hint?.spotlight).toContain(hint?.index);
      expect(hint?.reason).toEqual({ kind: "step", step });
    }
  });

  it("finds the one missing queen when the rest are placed", () => {
    for (const puzzle of PUZZLES) {
      const missing = puzzle.solution.lastIndexOf(1);
      const entries = puzzle.solution.map((mark, index) =>
        mark === 1 && index !== missing ? 1 : null,
      );

      expect(nextQueensHint(puzzle, puzzle.solution, entries)?.index).toBe(
        missing,
      );
    }
  });

  it("corrects a wrong queen, and an X on a queen's cell, before any step", () => {
    for (const puzzle of PUZZLES) {
      for (const [wrong, put] of [
        [puzzle.solution.indexOf(0), 1],
        [puzzle.solution.indexOf(1), 0],
      ] as const) {
        const entries = bare(puzzle).map((cell, index) =>
          index === wrong ? put : cell,
        );

        expect(nextQueensHint(puzzle, puzzle.solution, entries)).toEqual({
          index: wrong,
          value: 1 - put,
          reason: { kind: "correction" },
          spotlight: [],
        });
      }
    }
  });

  it("returns null once every queen is placed", () => {
    for (const puzzle of PUZZLES) {
      expect(
        nextQueensHint(puzzle, puzzle.solution, puzzle.solution),
      ).toBeNull();
    }
  });

  it("falls back to a plain fill when the engine's queen is not the solution's", () => {
    const [puzzle] = PUZZLES;
    if (puzzle === undefined) {
      throw new Error("no puzzle");
    }
    const hint = nextQueensHint(
      puzzle,
      puzzle.solution.map((mark) => (mark === 1 ? 0 : 1)),
      bare(puzzle),
    );

    expect(hint?.reason).toEqual({ kind: "fill" });
    expect(hint?.spotlight).toEqual([]);
  });
});

describe("every Rainhas hint sentence (T-WEB-S574)", () => {
  const unitStep = (
    kind: QueensStep["unit"]["kind"],
    after: QueensElimination | null,
  ): { kind: "step"; step: QueensStep } => ({
    kind: "step",
    step: { index: 17, unit: { kind, index: 4 }, cells: [17], after },
  });

  it("names the unit and the cell, 1-based, for a row, a column and a region", () => {
    expect(queensHintExplanation(7, unitStep("row", null))).toBe(
      "Na linha 5, só a casa da coluna 4 ainda pode ter rainha.",
    );
    expect(queensHintExplanation(7, unitStep("column", null))).toBe(
      "Na coluna 5, só a casa da linha 3 ainda pode ter rainha.",
    );
    expect(queensHintExplanation(7, unitStep("region", null))).toBe(
      "Na região 5, só a casa da linha 3, coluna 4 ainda pode ter rainha.",
    );
  });

  it.each<[QueensElimination, string]>([
    ["regionInRow", "região presa numa só linha ou coluna"],
    ["regionInColumn", "região presa numa só linha ou coluna"],
    ["rowInRegion", "linha ou coluna presa numa só região"],
    ["columnInRegion", "linha ou coluna presa numa só região"],
    ["blocking", "casa que deixaria uma região sem lugar"],
    ["regionGroupRows", "grupo de regiões presas nas mesmas linhas ou colunas"],
    [
      "regionGroupColumns",
      "grupo de regiões presas nas mesmas linhas ou colunas",
    ],
  ])("prefixes the technique for %s", (after, name) => {
    expect(queensHintExplanation(7, unitStep("row", after))).toBe(
      `Com uma técnica avançada (${name}), na linha 5, só a casa da coluna 4 ainda pode ter rainha.`,
    );
    expect(queensHintExplanation(7, unitStep("region", after))).toBe(
      `Com uma técnica avançada (${name}), na região 5, só a casa da linha 3, coluna 4 ainda pode ter rainha.`,
    );
  });

  it("explains the fallback and the correction, and nothing before a hint", () => {
    expect(queensHintExplanation(7, { kind: "fill" })).toBe(
      "Não achamos um passo lógico simples aqui, então pusemos uma rainha para você.",
    );
    expect(queensHintExplanation(7, { kind: "correction" })).toBe(
      "Corrigimos uma casa que não fecha com a solução.",
    );
    expect(queensHintExplanation(7, null)).toBeNull();
  });
});

describe("use-hint records the reason and the spotlight (T-WEB-S573)", () => {
  const PUZZLE = generateQueens({ seed: 20_260_801, weekday: 1 });
  const STATE = queensPlayReducer(initQueensPlayState(daily(PUZZLE)), {
    type: "restore",
    record: undefined,
    now: 0,
  });
  const STEP = nextQueensStep(PUZZLE, bare(PUZZLE));

  const run = (state: QueensPlayState, ...actions: QueensPlayAction[]) =>
    actions.reduce(queensPlayReducer, state);

  const hinted = () =>
    run(STATE, { type: "select", index: 24 }, { type: "use-hint" });

  it("places the step's queen, lights its unit, spends one hint and keeps the caret", () => {
    const after = hinted();

    expect(STEP).not.toBeNull();
    expect(after.entries[STEP?.index ?? -1]).toBe(1);
    expect(after.hint).toEqual({
      used: 1,
      lastIndex: STEP?.index,
      reason: { kind: "step", step: STEP },
      spotlight: STEP?.cells,
    });
    expect(after.selected).toBe(24);
  });

  it("names a correction and lights nothing", () => {
    const wrong = PUZZLE.solution.indexOf(0);
    const corrected = run(
      STATE,
      { type: "select", index: wrong },
      { type: "enter-value", value: 1 },
      { type: "use-hint" },
    );

    expect(corrected.hint.reason).toEqual({ kind: "correction" });
    expect(corrected.hint.spotlight).toEqual([]);
  });

  it.each<[string, QueensPlayAction]>([
    ["tapping a cell", { type: "tap", index: 0, press: "tap" }],
    ["crossing a cell over", { type: "cross-over", index: 0 }],
    ["selecting another cell", { type: "select", index: 0 }],
    ["moving the selection", { type: "move-selection", rows: 0, columns: -1 }],
  ])("puts the spotlight out on %s, and keeps the reason", (_name, action) => {
    const after = run(hinted(), action);

    expect(after.hint.spotlight).toEqual([]);
    expect(after.hint.reason).toEqual({ kind: "step", step: STEP });
  });
});

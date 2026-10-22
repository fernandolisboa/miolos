import type { DailyBinairoResponse } from "@miolos/core";
import {
  BINAIRO_SIZE,
  generateBinairo,
  nextBinairoStep,
  type BinairoGrid,
  type BinairoPuzzle,
  type BinairoRule,
  type BinairoStep,
  type BinairoSolvedGrid,
} from "@miolos/games/binairo";
import { describe, expect, it } from "vitest";

import { mergeGrid } from "../src/binairo/engine";
import { binairoHintExplanation, nextBinairoHint } from "../src/binairo/hint";
import {
  initPlayState,
  playReducer,
  type CellValue,
  type PlayAction,
  type PlayState,
} from "../src/binairo/state";
import { correctPartial, onEveryWeekday } from "./hint-boards";

const PUZZLES: readonly BinairoPuzzle[] = onEveryWeekday(6, (seed, weekday) =>
  generateBinairo({ seed, weekday }),
);

const NONE: readonly CellValue[] = Array.from({ length: 64 }, () => null);

function board(picture: string): BinairoGrid {
  return [...picture.replaceAll(" ", "")].map((mark) =>
    mark === "." ? null : mark === "0" ? 0 : 1,
  );
}

describe("nextBinairoHint corrects first, then reasons, then falls back (T-WEB-S564)", () => {
  it("never reveals a wrong cell, on a bare board and on correct partial boards of every weekday", () => {
    expect(PUZZLES).toHaveLength(42);
    for (const [at, puzzle] of PUZZLES.entries()) {
      const boards = [NONE, correctPartial(puzzle.solution, at + 1)];
      for (const entries of boards) {
        const hint = nextBinairoHint(puzzle.solution, puzzle.givens, entries);
        const step = nextBinairoStep(mergeGrid(puzzle.givens, entries));

        expect(hint).not.toBeNull();
        expect(hint?.value).toBe(puzzle.solution[hint?.index ?? -1]);
        expect(puzzle.givens[hint?.index ?? -1]).toBeNull();
        expect(entries[hint?.index ?? -1]).toBeNull();
        expect(hint?.reason).toEqual({ kind: "step", step });
        expect(hint?.spotlight).toEqual(step?.cells);
      }
    }
  });

  it("corrects a wrong entry before any step, and lights nothing", () => {
    for (const puzzle of PUZZLES) {
      const wrong = puzzle.givens.findIndex((given) => given === null);
      const entries = NONE.map((cell, index) =>
        index === wrong ? 1 - (puzzle.solution[wrong] ?? 0) : cell,
      ) as readonly CellValue[];

      expect(nextBinairoHint(puzzle.solution, puzzle.givens, entries)).toEqual({
        index: wrong,
        value: puzzle.solution[wrong],
        reason: { kind: "correction" },
        spotlight: [],
      });
    }
  });

  it("returns null once every cell is decided and correct", () => {
    for (const puzzle of PUZZLES) {
      expect(
        nextBinairoHint(puzzle.solution, puzzle.givens, puzzle.solution),
      ).toBeNull();
    }
  });

  describe("on a literal board", () => {
    const GIVENS = board(
      "........ ........ ...11... ........ ........ ........ ........ ........",
    );

    it("takes the step when the solution agrees with it", () => {
      const solution = GIVENS.map(() => 0) as BinairoSolvedGrid;
      const hint = nextBinairoHint(solution, GIVENS, NONE);

      expect(hint?.index).toBe(18);
      expect(hint?.value).toBe(0);
      expect(hint?.spotlight).toEqual([19, 20]);
      expect(hint?.reason).toEqual({
        kind: "step",
        step: {
          index: 18,
          value: 0,
          rule: "pair",
          line: { kind: "row", index: 2 },
          twin: null,
          cells: [19, 20],
        },
      });
    });

    it("falls back to the first empty cell when the solution disagrees with the step", () => {
      const solution = GIVENS.map(() => 1) as BinairoSolvedGrid;

      expect(nextBinairoHint(solution, GIVENS, NONE)).toEqual({
        index: 0,
        value: 1,
        reason: { kind: "fill" },
        spotlight: [],
      });
    });
  });
});

describe("every hint sentence (T-WEB-S566)", () => {
  function explain(
    rule: BinairoRule,
    index: number,
    value: 0 | 1,
    over: Partial<BinairoStep> = {},
  ): string | null {
    return binairoHintExplanation({
      kind: "step",
      step: {
        index,
        value,
        rule,
        line: null,
        twin: null,
        cells: [],
        ...over,
      },
    });
  }

  const ROW = { kind: "row", index: 2 } as const;
  const COLUMN = { kind: "column", index: 5 } as const;
  const lineCells = (kind: "row" | "column", at: number) =>
    Array.from({ length: BINAIRO_SIZE }, (_unused, k) =>
      kind === "row" ? at * BINAIRO_SIZE + k : k * BINAIRO_SIZE + at,
    );

  it("names the pair, in a row and in a column", () => {
    expect(explain("pair", 18, 0, { line: ROW })).toBe(
      "Na linha 3, dois 1 seguidos obrigam um 0 ao lado, na célula da coluna 3.",
    );
    expect(explain("pair", 21, 1, { line: COLUMN })).toBe(
      "Na coluna 6, dois 0 seguidos obrigam um 1 ao lado, na célula da linha 3.",
    );
  });

  it("names the gap, in a row and in a column", () => {
    expect(explain("gap", 49, 0, { line: { kind: "row", index: 6 } })).toBe(
      "Na linha 7, a célula da coluna 2 fica entre dois 1, então leva 0.",
    );
    expect(explain("gap", 15, 1, { line: { kind: "column", index: 7 } })).toBe(
      "Na coluna 8, a célula da linha 2 fica entre dois 0, então leva 1.",
    );
  });

  it("names the count, with the half in words", () => {
    expect(
      explain("count", 14, 1, {
        line: { kind: "row", index: 1 },
        cells: lineCells("row", 1),
      }),
    ).toBe("A linha 2 já tem quatro 0, então a célula da coluna 7 leva 1.");
    expect(
      explain("count", 21, 0, { line: COLUMN, cells: lineCells("column", 5) }),
    ).toBe("A coluna 6 já tem quatro 1, então a célula da linha 3 leva 0.");
  });

  it("names the twin line of a duplicate, 1-based", () => {
    expect(
      explain("duplicate", 18, 1, {
        line: ROW,
        twin: 6,
        cells: lineCells("row", 6),
      }),
    ).toBe(
      "A linha 3 não pode repetir a linha 7, então a célula da coluna 3 leva 1.",
    );
    expect(
      explain("duplicate", 21, 0, {
        line: COLUMN,
        twin: 0,
        cells: lineCells("column", 0),
      }),
    ).toBe(
      "A coluna 6 não pode repetir a coluna 1, então a célula da linha 3 leva 0.",
    );
  });

  it("names the cell of a lookahead by row and column", () => {
    expect(explain("lookahead", 18, 0)).toBe(
      "Um 1 na linha 3, coluna 3 quebraria uma regra logo adiante, então ali vai 0.",
    );
    expect(explain("lookahead", 63, 1)).toBe(
      "Um 0 na linha 8, coluna 8 quebraria uma regra logo adiante, então ali vai 1.",
    );
  });

  it("explains the fallback and the correction, and nothing before a hint", () => {
    expect(binairoHintExplanation(null)).toBeNull();
    expect(binairoHintExplanation({ kind: "fill" })).toBe(
      "Não achamos um passo lógico simples aqui, então preenchemos uma célula para você.",
    );
    expect(binairoHintExplanation({ kind: "correction" })).toBe(
      "Corrigimos uma célula que não fecha com as regras.",
    );
  });
});

describe("use-hint records the reason and the spotlight (T-WEB-S565)", () => {
  const PUZZLE = generateBinairo({ seed: 20_260_730, weekday: 3 });
  const DAILY: DailyBinairoResponse = {
    game: "binairo",
    date: "2026-07-30",
    size: 8,
    givens: [...PUZZLE.givens],
  };
  const STATE = initPlayState(DAILY, PUZZLE.solution);
  const STEP = nextBinairoStep(PUZZLE.givens);

  function hinted(from: PlayState = STATE): PlayState {
    return playReducer(from, { type: "use-hint" });
  }

  const free = PUZZLE.givens.flatMap((given, index) =>
    given === null && index !== STEP?.index ? [index] : [],
  );
  const other = free[0] ?? -1;

  it("reveals the step's cell, lights the rule's cells, spends one hint and keeps the paint mode", () => {
    const painting = playReducer(STATE, { type: "set-mode", value: 1 });
    const after = hinted(painting);

    expect(STEP).not.toBeNull();
    expect(after.entries[STEP?.index ?? -1]).toBe(STEP?.value);
    expect(after.hint).toEqual({
      used: 1,
      lastIndex: STEP?.index,
      reason: { kind: "step", step: STEP },
      spotlight: STEP?.cells,
    });
    expect(after.paint).toEqual({ kind: "paint", value: 1 });
  });

  it("names a correction and lights nothing", () => {
    const wrong = PUZZLE.givens.findIndex((given) => given === null);
    const mistaken = playReducer(STATE, {
      type: "tap",
      index: wrong,
      press: PUZZLE.solution[wrong] === 1 ? "right" : "left",
      first: 1,
    });
    const corrected = hinted(mistaken);

    expect(corrected.hint.reason).toEqual({ kind: "correction" });
    expect(corrected.hint.spotlight).toEqual([]);
  });

  it.each<[string, PlayAction]>([
    ["tapping a cell", { type: "tap", index: other, press: "tap", first: 1 }],
    ["starting a stroke", { type: "stroke-start", index: other, press: "tap" }],
  ])("puts the spotlight out on %s, and keeps the reason", (_name, action) => {
    const painting = playReducer(hinted(), { type: "set-mode", value: 1 });
    const after = playReducer(painting, action);

    expect(after.hint.spotlight).toEqual([]);
    expect(after.hint.reason).toEqual({ kind: "step", step: STEP });
  });

  it("puts the spotlight out when a stroke paints over a cell", () => {
    const stroking = playReducer(
      playReducer(STATE, { type: "set-mode", value: 1 }),
      { type: "stroke-start", index: other, press: "tap" },
    );
    const lit = { ...stroking, hint: hinted().hint };
    const after = playReducer(lit, {
      type: "paint-over",
      index: free[1] ?? -1,
    });

    expect(lit.hint.spotlight).not.toEqual([]);
    expect(after.hint.spotlight).toEqual([]);
  });
});

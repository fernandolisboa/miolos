import {
  dailyNonogramResponseSchema,
  type DailyNonogramResponse,
} from "@miolos/core";
import {
  generateNonogram,
  nextNonogramStep,
  type NonogramClues,
  type NonogramLine,
  type NonogramPuzzle,
  type NonogramStep,
  type Weekday,
} from "@miolos/games/nonogram";
import { describe, expect, it } from "vitest";

import { solutionMarks } from "../src/nonogram/engine";
import {
  nextNonogramHint,
  nonogramHintExplanation,
} from "../src/nonogram/hint";
import { nextBinaryHint, nextHint } from "../src/play/grid-hint";
import {
  initNonogramPlayState,
  nonogramPlayReducer,
  type NonogramCellValue,
  type NonogramMark,
  type NonogramPlayAction,
  type NonogramPlayState,
} from "../src/nonogram/state";

const DATE = "2026-08-01";

const SEEDS: readonly number[] = Array.from(
  { length: 40 },
  (_unused, index) => ((index + 1) * 2_654_435_761) >>> 0,
);

const WEEKDAYS: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 7];

interface Board {
  readonly puzzle: NonogramPuzzle;
  readonly solution: readonly NonogramMark[];
  readonly empty: readonly NonogramCellValue[];
}

function daily(puzzle: NonogramPuzzle): DailyNonogramResponse {
  return dailyNonogramResponseSchema.parse({
    game: "nonogram",
    date: DATE,
    size: puzzle.size,
    clues: puzzle.clues,
  });
}

function board(seed: number, weekday: Weekday): Board {
  const puzzle = generateNonogram(seed, weekday);
  const solution = solutionMarks(daily(puzzle).clues);
  if (solution === null) {
    throw new Error(
      "a published daily is line-solvable to the exact bitmap by construction",
    );
  }
  return {
    puzzle,
    solution,
    empty: solution.map(() => null),
  };
}

const BOARDS: readonly Board[] = WEEKDAYS.flatMap((weekday) =>
  SEEDS.map((seed) => board(seed, weekday)),
);

function pictureIndices(solution: readonly NonogramMark[]): readonly number[] {
  return solution.flatMap((mark, index) => (mark === 1 ? [index] : []));
}

function halfPainted(
  solution: readonly NonogramMark[],
): readonly NonogramCellValue[] {
  const indices = pictureIndices(solution);
  const painted = new Set(indices.slice(0, Math.floor(indices.length / 2)));
  return solution.map((_mark, index) => (painted.has(index) ? 1 : null));
}

function fullyCrossed(
  solution: readonly NonogramMark[],
): readonly NonogramCellValue[] {
  return solution.map((mark) => (mark === 1 ? null : 0));
}

describe("the encoding tripwire (N9)", () => {
  it("never reads a correctly CROSSED cell as a contradiction, on any of the 280 boards", () => {
    const corrections = BOARDS.filter((current) => {
      const hint = nextBinaryHint(
        current.solution,
        fullyCrossed(current.solution),
      );
      return hint?.kind === "correction";
    });

    expect(BOARDS).toHaveLength(280);
    expect(corrections).toHaveLength(0);
  });

  it("hands a fully-crossed board a FILL on a picture cell", () => {
    for (const current of BOARDS) {
      const hint = nextBinaryHint(
        current.solution,
        fullyCrossed(current.solution),
      );

      expect(hint?.value).toBe(1);
      expect(current.solution[hint?.index ?? -1]).toBe(1);
    }
  });
});

describe("the corrections", () => {
  it("corrects a wrongly FILLED cell to 0", () => {
    for (const current of BOARDS) {
      const wrong = current.solution.indexOf(0);
      const entries = current.empty.map((cell, index) =>
        index === wrong ? 1 : cell,
      );
      const hint = nextBinaryHint(current.solution, entries);

      expect(wrong).toBeGreaterThanOrEqual(0);
      expect(hint).toEqual({ index: wrong, value: 0, kind: "correction" });
    }
  });

  it("corrects a wrongly CROSSED cell to 1", () => {
    for (const current of BOARDS) {
      const wrong = current.solution.indexOf(1);
      const entries = current.empty.map((cell, index) =>
        index === wrong ? 0 : cell,
      );
      const hint = nextBinaryHint(current.solution, entries);

      expect(wrong).toBeGreaterThanOrEqual(0);
      expect(hint).toEqual({ index: wrong, value: 1, kind: "correction" });
    }
  });

  it("puts a contradiction ahead of an empty cell, deterministically", () => {
    const first = BOARDS[0];
    if (first === undefined) {
      throw new Error("the harness generates 280 boards");
    }
    const wrong = first.solution.lastIndexOf(0);
    const entries = first.empty.map((cell, index) =>
      index === wrong ? 1 : cell,
    );

    expect(nextBinaryHint(first.solution, entries)?.kind).toBe("correction");
    expect(nextBinaryHint(first.solution, entries)).toEqual(
      nextBinaryHint(first.solution, entries),
    );
  });
});

describe("the second pass (P17)", () => {
  it("is REQUIRED: the plain fill branch returns a cross on 239 of the 280 fresh boards", () => {
    const crosses = BOARDS.filter((current) => {
      const plain = nextHint<NonogramMark>(
        current.solution,
        current.solution.map(() => null),
        current.empty,
      );
      return plain?.value === 0;
    });

    expect(crosses).toHaveLength(239);
  });

  it("lands on a picture cell on every fresh board", () => {
    for (const current of BOARDS) {
      const hint = nextBinaryHint(current.solution, current.empty);

      expect(hint?.kind).toBe("fill");
      expect(hint?.value).toBe(1);
      expect(current.solution[hint?.index ?? -1]).toBe(1);
    }
  });

  it("lands on an UNDECIDED picture cell on every half-painted board", () => {
    for (const current of BOARDS) {
      const entries = halfPainted(current.solution);
      const hint = nextBinaryHint(current.solution, entries);

      expect(hint?.kind).toBe("fill");
      expect(hint?.value).toBe(1);
      expect(current.solution[hint?.index ?? -1]).toBe(1);

      expect(entries[hint?.index ?? -1]).toBeNull();
    }
  });

  it("returns null only once EVERY cell is decided and correct", () => {
    for (const current of BOARDS) {
      const decided = current.solution.map((mark) => mark);

      expect(nextBinaryHint(current.solution, decided)).toBeNull();
    }
  });

  it("hands a board with the picture painted a cross, which the first pass alone refuses", () => {
    for (const current of BOARDS) {
      const painted = current.solution.map((mark) => (mark === 1 ? 1 : null));
      const hint = nextNonogramHint(
        current.puzzle.clues,
        current.solution,
        painted,
      );

      expect(nextBinaryHint(current.solution, painted)?.value).toBe(0);
      expect(hint?.value).toBe(0);
      expect(hint?.reason.kind).toBe("step");
    }
  });
});

describe("nextNonogramHint corrects first, then reasons, then falls back (T-WEB-S563)", () => {
  function correctPartial(
    solution: readonly NonogramMark[],
    seed: number,
  ): readonly NonogramCellValue[] {
    let state = seed;
    return solution.map((mark) => {
      state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
      return state % 3 === 0 ? mark : null;
    });
  }

  it("never reveals a wrong cell, on a bare board and on correct partial boards of every weekday", () => {
    for (const [at, current] of BOARDS.entries()) {
      const boards = [
        current.empty,
        halfPainted(current.solution),
        correctPartial(current.solution, at + 1),
      ];
      for (const entries of boards) {
        const hint = nextNonogramHint(
          current.puzzle.clues,
          current.solution,
          entries,
        );

        expect(hint).not.toBeNull();
        expect(hint?.value).toBe(current.solution[hint?.index ?? -1]);
        expect(entries[hint?.index ?? -1]).toBeNull();
        expect(hint?.reason.kind).toBe("step");
      }
    }
  });

  it("lights the step's line, with the hinted cell on it", () => {
    for (const current of BOARDS) {
      const hint = nextNonogramHint(
        current.puzzle.clues,
        current.solution,
        current.empty,
      );
      const step = nextNonogramStep(
        current.puzzle.clues,
        current.empty.map(() => "unknown"),
      );

      expect(hint?.spotlight).toEqual(step?.cells);
      expect(hint?.spotlight).toContain(hint?.index);
    }
  });

  it("corrects a wrong entry, a wrongly crossed picture cell included, before any step", () => {
    for (const current of BOARDS) {
      for (const [wrong, put] of [
        [current.solution.indexOf(0), 1],
        [current.solution.indexOf(1), 0],
      ] as const) {
        const entries = current.empty.map((cell, index) =>
          index === wrong ? put : cell,
        );
        const hint = nextNonogramHint(
          current.puzzle.clues,
          current.solution,
          entries,
        );

        expect(hint).toEqual({
          index: wrong,
          value: 1 - put,
          reason: { kind: "correction" },
        });
      }
    }
  });

  it("returns null once every cell is decided and correct", () => {
    for (const current of BOARDS) {
      expect(
        nextNonogramHint(
          current.puzzle.clues,
          current.solution,
          current.solution,
        ),
      ).toBeNull();
    }
  });

  describe("when the clues and the solution disagree", () => {
    const CLUES: NonogramClues = {
      size: 5,
      rows: [[5], [], [], [], []],
      cols: [[1], [1], [1], [1], [1]],
    };

    it("falls back to a filled cell of the figure", () => {
      const solution: readonly NonogramMark[] = Array.from(
        { length: 25 },
        (_unused, index) => (index === 24 ? 1 : 0),
      );
      const hint = nextNonogramHint(
        CLUES,
        solution,
        solution.map(() => null),
      );

      expect(hint).toEqual({
        index: 24,
        value: 1,
        reason: { kind: "fill" },
      });
    });

    it("falls back to a cross once the figure is placed", () => {
      const solution: readonly NonogramMark[] = Array.from(
        { length: 25 },
        () => 0,
      );
      const hint = nextNonogramHint(
        CLUES,
        solution,
        solution.map(() => null),
      );

      expect(hint).toEqual({
        index: 0,
        value: 0,
        reason: { kind: "cross" },
      });
    });
  });
});

describe("every hint sentence (T-WEB-S565)", () => {
  const SIDE = 9;

  function explain(
    line: NonogramLine,
    across: number,
    over: Partial<NonogramStep> = {},
  ): string | null {
    const cells = Array.from({ length: SIDE }, (_unused, k) =>
      line.kind === "row" ? line.index * SIDE + k : k * SIDE + line.index,
    );
    return nonogramHintExplanation({
      kind: "step",
      step: {
        index: cells[across] ?? -1,
        value: 1,
        line,
        runs: [4, 1],
        cells,
        ...over,
      },
    });
  }

  const ROW: NonogramLine = { kind: "row", index: 2 };
  const COLUMN: NonogramLine = { kind: "column", index: 5 };

  it("names a row and a column with 1-based numbers, for a fill and for a cross", () => {
    expect(explain(ROW, 5)).toBe(
      "Na linha 3, os números 4, 1 só fecham com a célula da coluna 6 preenchida.",
    );
    expect(explain(ROW, 5, { value: 0 })).toBe(
      "Na linha 3, os números 4, 1 só fecham com a célula da coluna 6 marcada.",
    );
    expect(explain(COLUMN, 3)).toBe(
      "Na coluna 6, os números 4, 1 só fecham com a célula da linha 4 preenchida.",
    );
  });

  it("says the number in the singular for a single run", () => {
    expect(explain(ROW, 0, { runs: [4], value: 0 })).toBe(
      "Na linha 3, o número 4 só fecha com a célula da coluna 1 marcada.",
    );
  });

  it("explains a line with no números", () => {
    expect(explain(ROW, 2, { runs: [], value: 0 })).toBe(
      "A linha 3 não tem números, então a célula da coluna 3 fica marcada.",
    );
    expect(
      explain({ kind: "column", index: 3 }, 4, { runs: [], value: 0 }),
    ).toBe(
      "A coluna 4 não tem números, então a célula da linha 5 fica marcada.",
    );
  });

  it("explains the fallbacks and the correction, and nothing before a hint", () => {
    expect(nonogramHintExplanation(null)).toBeNull();
    expect(nonogramHintExplanation({ kind: "fill" })).toBe(
      "Não achamos um passo lógico simples aqui, então preenchemos uma célula da figura para você.",
    );
    expect(nonogramHintExplanation({ kind: "cross" })).toBe(
      "Não achamos um passo lógico simples aqui, então marcamos uma célula fora da figura.",
    );
    expect(nonogramHintExplanation({ kind: "correction" })).toBe(
      "Corrigimos uma célula que não fecha com os números.",
    );
  });
});

describe("the reducer's accounting", () => {
  const STATE: NonogramPlayState = initNonogramPlayState(
    daily(generateNonogram(20_260_801, 1)),
  );

  function solutionOf(state: NonogramPlayState): readonly NonogramMark[] {
    if (state.solution === null) {
      throw new Error("a published daily solves by construction");
    }
    return state.solution;
  }

  it("reveals one cell, spends a free hint and leaves the caret alone", () => {
    const selected = nonogramPlayReducer(STATE, { type: "select", index: 24 });
    const hinted = nonogramPlayReducer(selected, { type: "use-hint" });

    expect(hinted.hint.used).toBe(1);
    expect(hinted.hint.lastIndex).not.toBeNull();
    expect(hinted.entries[hinted.hint.lastIndex ?? -1]).toBe(1);

    expect(hinted.selected).toBe(24);
  });

  it("drops the ring when the player writes the hinted cell again (T-WEB-S58)", () => {
    const hinted = nonogramPlayReducer(STATE, { type: "use-hint" });
    const index = hinted.hint.lastIndex ?? -1;
    expect(hinted.entries[index]).toBe(1);

    const cleared = nonogramPlayReducer(hinted, {
      type: "mark-cell",
      index,
      press: "tap",
    });
    expect(cleared.entries[index]).toBeNull();
    expect(cleared.hint.lastIndex).toBeNull();

    expect(cleared.hint).toEqual({
      used: 1,
      lastIndex: null,
      reason: hinted.hint.reason,
      spotlight: [],
    });

    const selected = nonogramPlayReducer(hinted, { type: "select", index });
    const overridden = nonogramPlayReducer(selected, {
      type: "enter-value",
      value: 0,
    });
    expect(overridden.entries[index]).toBe(0);
    expect(overridden.hint.lastIndex).toBeNull();

    const elsewhere = nonogramPlayReducer(hinted, {
      type: "mark-cell",
      index: index === 0 ? 1 : 0,
      press: "tap",
    });
    expect(elsewhere.hint.lastIndex).toBe(index);
  });

  it("is a no-op once the board is closed", () => {
    const solved = solutionOf(STATE).reduce<NonogramPlayState>(
      (current, mark, index) =>
        mark === 1
          ? nonogramPlayReducer(current, {
              type: "mark-cell",
              index,
              press: "tap",
            })
          : current,
      STATE,
    );

    expect(solved.status).toBe("solved");
    expect(nonogramPlayReducer(solved, { type: "use-hint" })).toBe(solved);
  });
});

describe("use-hint records the reason and the spotlight (T-WEB-S564)", () => {
  const CLUES = generateNonogram(20_260_801, 1).clues;
  const STATE = initNonogramPlayState(daily(generateNonogram(20_260_801, 1)));
  const STEP = nextNonogramStep(
    CLUES,
    STATE.entries.map(() => "unknown"),
  );

  function hinted(): NonogramPlayState {
    return nonogramPlayReducer(
      nonogramPlayReducer(STATE, { type: "select", index: 24 }),
      { type: "use-hint" },
    );
  }

  it("reveals the step's cell, lights its line, spends one hint and keeps the caret", () => {
    const after = hinted();

    expect(STEP).not.toBeNull();
    expect(after.entries[STEP?.index ?? -1]).toBe(STEP?.value);
    expect(after.hint).toEqual({
      used: 1,
      lastIndex: STEP?.index,
      reason: { kind: "step", step: STEP },
      spotlight: STEP?.cells,
    });
    expect(after.selected).toBe(24);
  });

  it("names a correction and lights nothing", () => {
    const wrong = STATE.solution?.indexOf(0) ?? -1;
    const after = nonogramPlayReducer(
      nonogramPlayReducer(STATE, { type: "select", index: wrong }),
      { type: "enter-value", value: 1 },
    );
    const corrected = nonogramPlayReducer(after, { type: "use-hint" });

    expect(corrected.hint.reason).toEqual({ kind: "correction" });
    expect(corrected.hint.spotlight).toEqual([]);
  });

  it.each<[string, NonogramPlayAction]>([
    ["marking a cell", { type: "mark-cell", index: 0, press: "tap" }],
    ["starting a stroke", { type: "stroke-start", index: 0, press: "tap" }],
    ["selecting another cell", { type: "select", index: 0 }],
    ["moving the selection", { type: "move-selection", rows: 0, columns: -1 }],
  ])("puts the spotlight out on %s, and keeps the reason", (_name, action) => {
    const after = nonogramPlayReducer(hinted(), action);

    expect(after.hint.spotlight).toEqual([]);
    expect(after.hint.reason).toEqual({ kind: "step", step: STEP });
  });

  it("puts the spotlight out when a stroke paints over a cell", () => {
    const stroking = nonogramPlayReducer(hinted(), {
      type: "stroke-start",
      index: 0,
      press: "tap",
    });
    const hintedAgain = { ...stroking, hint: hinted().hint };
    const after = nonogramPlayReducer(hintedAgain, {
      type: "paint-over",
      index: 1,
    });

    expect(after.hint.spotlight).toEqual([]);
  });

  it("forgets the reason and the spotlight on reset", () => {
    const after = nonogramPlayReducer(hinted(), { type: "reset" });

    expect(after.hint).toEqual({
      used: 1,
      lastIndex: null,
      reason: null,
      spotlight: [],
    });
  });
});

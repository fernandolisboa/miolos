import { dailyCrosswordResponseSchema } from "@miolos/core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  activeEntry,
  entryCells,
  type CrosswordClue,
  type CrosswordDirection,
} from "../src/crossword/grid";
import {
  crosswordHintExplanation,
  nextCrosswordHint,
} from "../src/crossword/hint";
import {
  crosswordPlayReducer,
  initCrosswordPlayState,
  type CrosswordCellValue,
  type CrosswordPlayAction,
  type CrosswordPlayState,
} from "../src/crossword/state";
import { messages } from "../src/i18n";

const copy = messages.games.crossword.play;

// row0: c a t # #
// row1: a # o # #
// rows 2-4: all blocks
const GRID: readonly CrosswordCellValue[] = [
  ...["c", "a", "t", null, null],
  ...["a", null, "o", null, null],
  ...Array<null>(15).fill(null),
];

const CLUES: readonly CrosswordClue[] = [
  { number: 1, direction: "across", row: 0, col: 0, length: 3, clue: "felino" },
  { number: 1, direction: "down", row: 0, col: 0, length: 2, clue: "pronome" },
  { number: 2, direction: "down", row: 0, col: 2, length: 2, clue: "verbo" },
];
const [ACROSS_1, DOWN_1, DOWN_2] = CLUES;

function board(filled: Readonly<Record<number, string>>) {
  return GRID.map((_, index) => filled[index] ?? null);
}

function hintFor(
  filled: Readonly<Record<number, string>>,
  selected: number | null = null,
  direction: CrosswordDirection = "across",
) {
  return nextCrosswordHint(GRID, CLUES, board(filled), selected, direction);
}

describe("nextCrosswordHint reveals a letter of the current pista (T-WEB-S576)", () => {
  it("takes the active entry and prefers a cell whose crossing pista is still open", () => {
    const hint = hintFor({}, 7, "down");
    expect(hint).toEqual({
      index: 2,
      value: "t",
      reason: {
        kind: "step",
        step: { clue: DOWN_2, crossing: ACROSS_1, index: 2 },
      },
      spotlight: [],
    });
  });

  it("skips a cell whose crossing pista has nothing else open", () => {
    const hint = hintFor({ 0: "c", 5: "a" }, 1, "across");
    expect(hint?.index).toBe(2);
    expect(hintFor({ 0: "c", 2: "t" }, 1, "across")).toMatchObject({
      index: 1,
      reason: { step: { clue: ACROSS_1, crossing: null } },
    });
  });

  it("with nothing selected, takes the first open pista in list order", () => {
    expect(hintFor({})).toMatchObject({
      index: 0,
      value: "c",
      reason: { step: { clue: ACROSS_1, crossing: DOWN_1 } },
    });
  });

  it("moves to the next open pista once the active one is full, without selecting it", () => {
    expect(hintFor({ 0: "c", 1: "a", 2: "t" }, 0, "across")).toMatchObject({
      index: 5,
      value: "a",
      reason: { step: { clue: DOWN_1, crossing: null } },
    });
  });

  it("falls back to the other direction where the selected cell has no entry in this one", () => {
    expect(hintFor({}, 5, "across")).toMatchObject({
      reason: { step: { clue: DOWN_1 } },
    });
  });

  it("corrects a wrong letter before any step", () => {
    expect(hintFor({ 7: "x" }, 0, "across")).toEqual({
      index: 7,
      value: "o",
      reason: { kind: "correction" },
      spotlight: [],
    });
  });

  it("reveals nothing on a full board", () => {
    expect(hintFor({ 0: "c", 1: "a", 2: "t", 5: "a", 7: "o" })).toBeNull();
  });
});

function cluesOf(solution: readonly CrosswordCellValue[]): CrosswordClue[] {
  const white = (row: number, col: number) =>
    row >= 0 && col >= 0 && solution[row * 5 + col] !== null && col < 5;
  const run = (row: number, col: number, dr: number, dc: number) => {
    let length = 0;
    while (
      row + dr * length < 5 &&
      white(row + dr * length, col + dc * length)
    ) {
      length += 1;
    }
    return length;
  };
  const across: CrosswordClue[] = [];
  const down: CrosswordClue[] = [];
  let number = 0;
  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      if (!white(row, col)) {
        continue;
      }
      const acrossLength = white(row, col - 1) ? 0 : run(row, col, 0, 1);
      const downLength = white(row - 1, col) ? 0 : run(row, col, 1, 0);
      if (acrossLength < 2 && downLength < 2) {
        continue;
      }
      number += 1;
      const base = { number, row, col, clue: "pista" };
      if (acrossLength >= 2) {
        across.push({ ...base, direction: "across", length: acrossLength });
      }
      if (downLength >= 2) {
        down.push({ ...base, direction: "down", length: downLength });
      }
    }
  }
  return [...across, ...down];
}

const dailyShaped = fc
  .record({
    cells: fc.array(
      fc.record({
        block: fc.integer({ min: 0, max: 4 }).map((n) => n === 0),
        letter: fc.constantFrom("a", "b", "c"),
        state: fc.constantFrom("empty", "right", "right", "wrong"),
      }),
      { minLength: 25, maxLength: 25 },
    ),
    selected: fc.option(fc.integer({ min: 0, max: 24 }), { nil: null }),
    direction: fc.constantFrom<CrosswordDirection>("across", "down"),
  })
  .map(({ cells, selected, direction }) => {
    const solution = cells.map((cell) => (cell.block ? null : cell.letter));
    const entries = cells.map((cell, index) => {
      if (cell.block || cell.state === "empty") {
        return null;
      }
      return cell.state === "right" ? (solution[index] ?? null) : "z";
    });
    return { solution, clues: cluesOf(solution), entries, selected, direction };
  })
  .filter(({ solution, clues }) =>
    solution.every(
      (cell, index) =>
        cell === null || clues.some((clue) => entryCells(clue).includes(index)),
    ),
  );

describe("a Cruzadinha hint reveals an empty letter of the target pista (T-WEB-S576)", () => {
  it("holds for random daily-shaped boards", () => {
    fc.assert(
      fc.property(
        dailyShaped,
        ({ solution, clues, entries, selected, direction }) => {
          const hint = nextCrosswordHint(
            solution,
            clues,
            entries,
            selected,
            direction,
          );
          const wrong = entries.some(
            (entry, index) => entry !== null && entry !== solution[index],
          );
          const open = entries.some(
            (entry, index) => solution[index] !== null && entry === null,
          );
          if (!wrong && !open) {
            expect(hint).toBeNull();
            return;
          }
          if (hint === null) {
            throw new Error("an unfinished board revealed nothing");
          }
          expect(hint.value).toBe(solution[hint.index]);
          if (hint.reason.kind === "correction") {
            expect(entries[hint.index]).not.toBeNull();
            return;
          }
          expect(wrong).toBe(false);
          expect(entries[hint.index]).toBeNull();
          if (hint.reason.kind !== "step") {
            throw new Error("a daily-shaped board fell back to a plain fill");
          }
          const { step } = hint.reason;
          expect(entryCells(step.clue)).toContain(hint.index);
          const active =
            selected === null
              ? undefined
              : activeEntry(clues, selected, direction);
          if (
            active !== undefined &&
            entryCells(active).some((at) => entries[at] === null)
          ) {
            expect(step.clue).toBe(active);
          }
          if (step.crossing !== null) {
            expect(
              entryCells(step.crossing).some(
                (at) => at !== hint.index && entries[at] === null,
              ),
            ).toBe(true);
          }
        },
      ),
      { seed: 297_576, numRuns: 300 },
    );
  });
});

function freshState(): CrosswordPlayState {
  return initCrosswordPlayState(
    dailyCrosswordResponseSchema.parse({
      game: "crossword",
      date: "2026-08-01",
      grid: [0, 5, 10, 15, 20].map((from) => GRID.slice(from, from + 5)),
      clues: CLUES,
    }),
  );
}

function play(
  state: CrosswordPlayState,
  ...actions: readonly CrosswordPlayAction[]
): CrosswordPlayState {
  return actions.reduce(crosswordPlayReducer, state);
}

describe("the Cruzadinha reducer records the hint's reason (T-WEB-S577)", () => {
  it("writes the letter, spends a hint, keeps the selection and names the pista", () => {
    const hinted = play(
      freshState(),
      { type: "select-entry", index: 7, direction: "down" },
      { type: "use-hint" },
    );
    expect(hinted.entries[2]).toBe("t");
    expect(hinted.hint).toEqual({
      used: 1,
      lastIndex: 2,
      reason: {
        kind: "step",
        step: { clue: DOWN_2, crossing: ACROSS_1, index: 2 },
      },
      spotlight: [],
    });
    expect(hinted.selected).toBe(7);
    expect(hinted.direction).toBe("down");
  });
});

describe("the Cruzadinha hint sentences (T-WEB-S578)", () => {
  it("names the pista and the cell, and the crossing pista when there is one", () => {
    expect(
      crosswordHintExplanation({
        kind: "step",
        step: { clue: ACROSS_1!, crossing: null, index: 7 },
      }),
    ).toBe("Uma letra da pista 1 horizontal: linha 2, coluna 3.");
    expect(
      crosswordHintExplanation({
        kind: "step",
        step: { clue: ACROSS_1!, crossing: DOWN_2!, index: 2 },
      }),
    ).toBe(
      "Uma letra da pista 1 horizontal, que também ajuda na 2 vertical: linha 1, coluna 3.",
    );
  });

  it("keeps the correction copy, words the plain fill and says nothing before a hint", () => {
    expect(crosswordHintExplanation({ kind: "correction" })).toBe(
      "Corrigimos uma letra errada.",
    );
    expect(crosswordHintExplanation({ kind: "fill" })).toBe(
      copy.hint.explain.fill,
    );
    expect(crosswordHintExplanation(null)).toBeNull();
  });
});

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  MINESWEEPER_LEVELS,
  chordBlock,
  chordMinesweeper,
  cycleMinesweeperMark,
  layMines,
  newMinesweeperGame,
  openMinesweeperCell,
  startMinesweeper,
  type MinesweeperLevel,
  type MinesweeperState,
} from "../../src/minesweeper/index";
import { beginnerPlaying, fieldFrom, neighboursOf } from "./fixtures";

const levelArb = fc.constantFrom<MinesweeperLevel>(
  "beginner",
  "intermediate",
  "expert",
);
const seedArb = fc.integer({ min: 0, max: 0xffffffff });

const firstRevealArb = levelArb.chain((level) => {
  const { rows, columns } = MINESWEEPER_LEVELS[level];
  return fc.record({
    level: fc.constant(level),
    seed: seedArb,
    start: fc.integer({ min: 0, max: rows * columns - 1 }),
  });
});

type Action =
  | { readonly kind: "reveal"; readonly at: number }
  | { readonly kind: "chord"; readonly at: number }
  | {
      readonly kind: "mark";
      readonly at: number;
      readonly questionMarks: boolean;
    };

const actionArb: fc.Arbitrary<Action> = fc.oneof(
  fc.record({ kind: fc.constant("reveal" as const), at: fc.nat() }),
  fc.record({ kind: fc.constant("chord" as const), at: fc.nat() }),
  fc.record({
    kind: fc.constant("mark" as const),
    at: fc.nat(),
    questionMarks: fc.boolean(),
  }),
);

function apply(state: MinesweeperState, action: Action): MinesweeperState {
  const { rows, columns } = state.size;
  const at = action.at % (rows * columns);
  switch (action.kind) {
    case "reveal":
      return openMinesweeperCell(state, at);
    case "chord":
      return chordMinesweeper(state, at);
    case "mark":
      return cycleMinesweeperMark(state, at, action.questionMarks);
  }
}

function zeroRegionFrom(state: MinesweeperState, start: number): Set<number> {
  const field = state.field!;
  const region = new Set<number>();
  if (field.counts[start] !== 0) {
    return region;
  }
  const queue = [start];
  region.add(start);
  while (queue.length > 0) {
    const cell = queue.pop()!;
    for (const n of neighboursOf(field.rows, field.columns, cell)) {
      if (!region.has(n) && state.open[n] && field.counts[n] === 0) {
        region.add(n);
        queue.push(n);
      }
    }
  }
  return region;
}

function expectConsistent(
  before: MinesweeperState,
  after: MinesweeperState,
): void {
  const nonMinesOpen =
    after.field !== null &&
    after.field.mines.every((mine, i) => mine || after.open[i]);

  after.open.forEach((open, i) => {
    if (open) {
      expect(after.marks[i]).toBeNull();
      expect(after.field?.mines[i]).toBe(false);
    }
    if (before.open[i]) {
      expect(open).toBe(true);
    }
  });
  expect(after.status === "won").toBe(nonMinesOpen);
  expect(after.status === "lost").toBe(after.hit !== null);
  if (after.hit !== null) {
    expect(after.field?.mines[after.hit]).toBe(true);
  }
  if (after.status === "won") {
    after.field!.mines.forEach((mine, i) => {
      if (mine) {
        expect(after.marks[i]).toBe("flag");
      }
    });
  }
  if (before.status === "won" || before.status === "lost") {
    expect(after).toBe(before);
  }
  if (before.field !== null) {
    expect(after.field).toBe(before.field);
  }
}

describe("newMinesweeperGame", () => {
  it("starts ready, with no field, nothing open and nothing marked", () => {
    expect(newMinesweeperGame(MINESWEEPER_LEVELS.beginner, 7)).toEqual({
      size: MINESWEEPER_LEVELS.beginner,
      seed: 7,
      field: null,
      open: Array.from({ length: 81 }, () => false),
      marks: Array.from({ length: 81 }, () => null),
      status: "ready",
      hit: null,
    });
  });
});

describe("startMinesweeper", () => {
  it("opens exactly what a first open of the same field opens", () => {
    fc.assert(
      fc.property(firstRevealArb, ({ level, seed, start }) => {
        const size = MINESWEEPER_LEVELS[level];
        const field = layMines({ seed, size, safe: [start] });

        expect(startMinesweeper(field, start)).toEqual(
          openMinesweeperCell(newMinesweeperGame(size, seed), start),
        );
      }),
      { numRuns: 300 },
    );
  });

  it("is playing with only the start's flood open, its size read off the field", () => {
    const field = fieldFrom(3, 4, [0, 2]);

    const state = startMinesweeper(field, 11);

    expect(state).toEqual({
      size: { rows: 3, columns: 4, mines: 2 },
      field,
      open: [false, false, false, false, ...Array<boolean>(8).fill(true)],
      marks: Array.from({ length: 12 }, () => null),
      status: "playing",
      hit: null,
    });
  });

  it("rejects a start outside the field", () => {
    const field = fieldFrom(3, 4, [0]);
    expect(() => startMinesweeper(field, 12)).toThrow(RangeError);
    expect(() => startMinesweeper(field, -1)).toThrow(RangeError);
  });
});

describe("openMinesweeperCell", () => {
  it("lays the mines at the first open and never on that cell", () => {
    fc.assert(
      fc.property(firstRevealArb, ({ level, seed, start }) => {
        const state = openMinesweeperCell(
          newMinesweeperGame(MINESWEEPER_LEVELS[level], seed),
          start,
        );

        expect(state.field).not.toBeNull();
        expect(state).not.toHaveProperty("seed");
        expect(state.field!.mines[start]).toBe(false);
        expect(state.field!.mines.filter(Boolean)).toHaveLength(
          MINESWEEPER_LEVELS[level].mines,
        );
        expect(state.open[start]).toBe(true);
        expect(["playing", "won"]).toContain(state.status);
      }),
      { numRuns: 300 },
    );
  });

  it("flood-opens exactly the zero region around the start and its border", () => {
    fc.assert(
      fc.property(firstRevealArb, ({ level, seed, start }) => {
        const state = openMinesweeperCell(
          newMinesweeperGame(MINESWEEPER_LEVELS[level], seed),
          start,
        );
        const field = state.field!;
        const zeros = zeroRegionFrom(state, start);

        state.open.forEach((open, i) => {
          if (open && field.counts[i] === 0) {
            for (const n of neighboursOf(field.rows, field.columns, i)) {
              expect(state.open[n]).toBe(true);
            }
          }
          if (open && i !== start) {
            const touchesRegion = neighboursOf(
              field.rows,
              field.columns,
              i,
            ).some((n) => zeros.has(n));
            expect(touchesRegion).toBe(true);
          }
        });
        if (field.counts[start] !== 0) {
          expect(state.open.filter(Boolean)).toHaveLength(1);
        }
      }),
      { numRuns: 300 },
    );
  });

  it("does not flood through a flag, and opening clears a question mark", () => {
    const flagged = cycleMinesweeperMark(beginnerPlaying([80]), 1, false);
    const questioned = cycleMinesweeperMark(
      cycleMinesweeperMark(flagged, 2, true),
      2,
      true,
    );

    const state = openMinesweeperCell(questioned, 0);

    expect(state.open[1]).toBe(false);
    expect(state.marks[1]).toBe("flag");
    expect(state.open[2]).toBe(true);
    expect(state.marks[2]).toBeNull();
    expect(state.status).toBe("playing");
  });

  it("clears a question mark on the cell it opens", () => {
    const questioned = cycleMinesweeperMark(
      cycleMinesweeperMark(beginnerPlaying([0, 2]), 1, true),
      1,
      true,
    );

    const state = openMinesweeperCell(questioned, 1);

    expect(state.open[1]).toBe(true);
    expect(state.marks[1]).toBeNull();
  });

  it("loses on a mine and records the hit", () => {
    const state = openMinesweeperCell(beginnerPlaying([0, 80]), 0);

    expect(state.status).toBe("lost");
    expect(state.hit).toBe(0);
    expect(state.open[0]).toBe(false);
  });

  it("wins once every safe cell is open, and flags every mine", () => {
    const state = openMinesweeperCell(beginnerPlaying([80]), 0);

    expect(state.status).toBe("won");
    expect(state.marks[80]).toBe("flag");
    expect(state.open.filter(Boolean)).toHaveLength(80);
  });

  it("ignores a flagged cell, an open cell and a finished game", () => {
    const flagged = cycleMinesweeperMark(beginnerPlaying([80]), 0, false);
    expect(openMinesweeperCell(flagged, 0)).toBe(flagged);

    const ready = cycleMinesweeperMark(
      newMinesweeperGame(MINESWEEPER_LEVELS.beginner, 3),
      4,
      false,
    );
    expect(openMinesweeperCell(ready, 4)).toBe(ready);

    const opened = openMinesweeperCell(beginnerPlaying([0, 2]), 1);
    expect(openMinesweeperCell(opened, 1)).toBe(opened);

    const lost = openMinesweeperCell(beginnerPlaying([0, 80]), 0);
    expect(openMinesweeperCell(lost, 40)).toBe(lost);
  });

  it("rejects an index outside the board", () => {
    const state = newMinesweeperGame(MINESWEEPER_LEVELS.beginner, 1);
    expect(() => openMinesweeperCell(state, 81)).toThrow(RangeError);
    expect(() => openMinesweeperCell(state, -1)).toThrow(RangeError);
    expect(() => chordMinesweeper(state, 81)).toThrow(RangeError);
    expect(() => cycleMinesweeperMark(state, 81, false)).toThrow(RangeError);
  });
});

describe("chordMinesweeper", () => {
  it("opens the other neighbours when the flags match the number", () => {
    let state = openMinesweeperCell(beginnerPlaying([0, 80]), 10);
    state = cycleMinesweeperMark(state, 0, false);

    state = chordMinesweeper(state, 10);

    for (const n of [1, 2, 9, 11, 18, 19, 20]) {
      expect(state.open[n]).toBe(true);
    }
    expect(state.open[0]).toBe(false);
    expect(state.hit).toBeNull();
  });

  it("does nothing unless the flags equal the number", () => {
    fc.assert(
      fc.property(firstRevealArb, fc.nat(), ({ level, seed, start }, pick) => {
        const opened = openMinesweeperCell(
          newMinesweeperGame(MINESWEEPER_LEVELS[level], seed),
          start,
        );
        const field = opened.field!;
        const numbered = opened.open
          .map((open, i) => (open && field.counts[i]! > 0 ? i : -1))
          .filter((i) => i >= 0);
        fc.pre(opened.status === "playing" && numbered.length > 0);
        const cell = numbered[pick % numbered.length]!;
        const hidden = neighboursOf(field.rows, field.columns, cell).filter(
          (n) => !opened.open[n],
        );
        const flags = (field.counts[cell]! + 1) % (hidden.length + 1);
        fc.pre(flags !== field.counts[cell]);
        let state = opened;
        for (const n of hidden.slice(0, flags)) {
          state = cycleMinesweeperMark(state, n, false);
        }

        expect(chordMinesweeper(state, cell)).toBe(state);
      }),
      { numRuns: 300 },
    );
  });

  it("loses when a flag is wrong, recording the unflagged mine", () => {
    let state = openMinesweeperCell(beginnerPlaying([0, 80]), 10);
    state = cycleMinesweeperMark(state, 1, false);

    state = chordMinesweeper(state, 10);

    expect(state.status).toBe("lost");
    expect(state.hit).toBe(0);
    expect(state.marks[1]).toBe("flag");
  });

  it("records the first mine in reading order when two flags are wrong", () => {
    let state = openMinesweeperCell(beginnerPlaying([0, 2, 80]), 10);
    state = cycleMinesweeperMark(state, 1, false);
    state = cycleMinesweeperMark(state, 9, false);

    state = chordMinesweeper(state, 10);

    expect(state.status).toBe("lost");
    expect(state.hit).toBe(0);
  });

  it("ignores a hidden cell and a finished game", () => {
    let hidden = beginnerPlaying([0, 2, 80]);
    hidden = cycleMinesweeperMark(hidden, 0, false);
    hidden = cycleMinesweeperMark(hidden, 2, false);
    expect(chordMinesweeper(hidden, 1)).toBe(hidden);

    const ready = newMinesweeperGame(MINESWEEPER_LEVELS.beginner, 1);
    expect(chordMinesweeper(ready, 0)).toBe(ready);

    let lost = openMinesweeperCell(beginnerPlaying([0, 2, 80]), 10);
    lost = cycleMinesweeperMark(lost, 0, false);
    lost = cycleMinesweeperMark(lost, 2, false);
    lost = openMinesweeperCell(lost, 80);
    expect(lost.status).toBe("lost");
    expect(chordMinesweeper(lost, 10)).toBe(lost);
  });

  it("opens a zero's neighbour that was flagged and then unflagged", () => {
    let state = cycleMinesweeperMark(beginnerPlaying([0, 2, 80]), 41, false);
    state = openMinesweeperCell(state, 40);
    expect(state.open[41]).toBe(false);
    state = cycleMinesweeperMark(state, 41, false);

    expect(chordMinesweeper(state, 40).open[41]).toBe(true);
    const settled = chordMinesweeper(state, 40);
    expect(chordMinesweeper(settled, 40)).toBe(settled);
  });

  it("counts only flags, and opens a question-marked neighbour", () => {
    let state = openMinesweeperCell(beginnerPlaying([0, 3, 80]), 10);
    state = cycleMinesweeperMark(state, 0, true);
    state = cycleMinesweeperMark(state, 0, true);
    expect(state.marks[0]).toBe("question");
    expect(chordMinesweeper(state, 10)).toBe(state);

    state = cycleMinesweeperMark(state, 0, true);
    state = cycleMinesweeperMark(state, 0, true);
    state = cycleMinesweeperMark(state, 2, true);
    state = cycleMinesweeperMark(state, 2, true);
    expect([state.marks[0], state.marks[2]]).toEqual(["flag", "question"]);

    state = chordMinesweeper(state, 10);

    expect(state.open[2]).toBe(true);
    expect(state.marks[2]).toBeNull();
    expect(state.hit).toBeNull();
  });
});

describe("chordBlock", () => {
  it("names the hidden, unflagged neighbours of an open cell, the cells a matched chord opens", () => {
    fc.assert(
      fc.property(firstRevealArb, fc.nat(), ({ level, seed, start }, pick) => {
        const opened = openMinesweeperCell(
          newMinesweeperGame(MINESWEEPER_LEVELS[level], seed),
          start,
        );
        const field = opened.field!;
        const numbered = opened.open
          .map((open, i) => (open && field.counts[i]! > 0 ? i : -1))
          .filter((i) => i >= 0);
        fc.pre(opened.status === "playing" && numbered.length > 0);
        const cell = numbered[pick % numbered.length]!;
        const around = neighboursOf(field.rows, field.columns, cell);
        let state = opened;
        for (const n of around.filter((n) => field.mines[n])) {
          state = cycleMinesweeperMark(state, n, false);
        }
        const targets = chordBlock(state, cell);

        expect([...targets].sort((a, b) => a - b)).toEqual(
          around
            .filter((n) => !state.open[n] && !field.mines[n])
            .sort((a, b) => a - b),
        );
        const chorded = chordMinesweeper(state, cell);
        for (const n of targets) {
          expect(chorded.open[n]).toBe(true);
        }
      }),
      { numRuns: 300 },
    );
  });

  it("names a hidden cell itself with its hidden, unflagged neighbours, before the first open too", () => {
    let hidden = beginnerPlaying([0, 2, 80]);
    hidden = cycleMinesweeperMark(hidden, 2, false);
    hidden = cycleMinesweeperMark(hidden, 10, true);
    hidden = cycleMinesweeperMark(hidden, 10, true);
    expect(hidden.marks[10]).toBe("question");
    expect([...chordBlock(hidden, 1)].sort((a, b) => a - b)).toEqual([
      0, 1, 9, 10, 11,
    ]);

    const ready = newMinesweeperGame(MINESWEEPER_LEVELS.beginner, 1);
    expect([...chordBlock(ready, 0)].sort((a, b) => a - b)).toEqual([
      0, 1, 9, 10,
    ]);
    expect(chordMinesweeper(ready, 0)).toBe(ready);
  });

  it("names nothing after the end", () => {
    let lost = openMinesweeperCell(beginnerPlaying([0, 2, 80]), 10);
    lost = openMinesweeperCell(lost, 80);
    expect(lost.status).toBe("lost");
    expect(chordBlock(lost, 10)).toEqual([]);
    expect(chordBlock(lost, 79)).toEqual([]);
  });

  it("never chords a hidden cell, whatever its flags", () => {
    let state = beginnerPlaying([0, 80]);
    state = cycleMinesweeperMark(state, 0, false);
    expect(chordMinesweeper(state, 1)).toBe(state);
  });
});

describe("cycleMinesweeperMark", () => {
  it("cycles hidden, flag, hidden with question marks off", () => {
    const state = beginnerPlaying([80]);
    const flag = cycleMinesweeperMark(state, 5, false);
    const back = cycleMinesweeperMark(flag, 5, false);

    expect(flag.marks[5]).toBe("flag");
    expect(back.marks[5]).toBeNull();
  });

  it("cycles hidden, flag, question, hidden with question marks on", () => {
    const state = beginnerPlaying([80]);
    const flag = cycleMinesweeperMark(state, 5, true);
    const question = cycleMinesweeperMark(flag, 5, true);
    const back = cycleMinesweeperMark(question, 5, true);

    expect([flag.marks[5], question.marks[5], back.marks[5]]).toEqual([
      "flag",
      "question",
      null,
    ]);
  });

  it("clears a question mark left over after the setting goes off", () => {
    const question = cycleMinesweeperMark(
      cycleMinesweeperMark(beginnerPlaying([80]), 5, true),
      5,
      true,
    );

    expect(cycleMinesweeperMark(question, 5, false).marks[5]).toBeNull();
  });

  it("marks before the first open without laying mines", () => {
    const state = cycleMinesweeperMark(
      newMinesweeperGame(MINESWEEPER_LEVELS.expert, 9),
      3,
      false,
    );

    expect(state.status).toBe("ready");
    expect(state.field).toBeNull();
    expect(state.marks[3]).toBe("flag");
  });

  it("ignores an open cell and a finished game", () => {
    const opened = openMinesweeperCell(beginnerPlaying([0, 2]), 1);
    expect(cycleMinesweeperMark(opened, 1, false)).toBe(opened);

    const lost = openMinesweeperCell(beginnerPlaying([0, 80]), 0);
    expect(cycleMinesweeperMark(lost, 40, false)).toBe(lost);
  });
});

describe("any sequence of moves", () => {
  // ADR-0055: CI gate 3726 ms × 4 → 15_000.
  it("keeps the board consistent after every move", () => {
    fc.assert(
      fc.property(
        levelArb,
        seedArb,
        fc.array(actionArb, { maxLength: 60 }),
        (level, seed, actions) => {
          let state = newMinesweeperGame(MINESWEEPER_LEVELS[level], seed);
          for (const action of actions) {
            const next = apply(state, action);
            expectConsistent(state, next);
            state = next;
          }
        },
      ),
      { numRuns: 200 },
    );
  }, 15_000);
});

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { FC_SEED, seedArb, weekdayArb } from "../daily-arbitraries";
import {
  MINESWEEPER_DAILY_SIZE,
  MINESWEEPER_WEEKDAY_MINES,
  generateMinesweeperDaily,
  minesweeperField,
  startMinesweeper,
  validateMinesweeperDaily,
  type MinesweeperDaily,
} from "../../src/minesweeper/index";
import { solveMinesweeper } from "../../src/minesweeper/solve";
import { neighboursOf } from "./fixtures";

const MONDAY = generateMinesweeperDaily({ seed: 20_261_019, weekday: 1 });

function fieldOf(puzzle: MinesweeperDaily) {
  return minesweeperField(
    puzzle.rows,
    puzzle.columns,
    puzzle.mines.map((mine) => mine === 1),
  );
}

function closedSafe(puzzle: MinesweeperDaily): number {
  const field = fieldOf(puzzle);
  const opened = startMinesweeper(field, puzzle.start).open;
  return field.mines.filter((mine, cell) => !mine && !opened[cell]).length;
}

function minesAt(start: number, cells: readonly number[]): MinesweeperDaily {
  return withMines({ ...MONDAY, start }, (mines) => {
    mines.fill(0);
    cells.forEach((cell) => {
      mines[cell] = 1;
    });
  });
}

function withMines(
  puzzle: MinesweeperDaily,
  move: (mines: (0 | 1)[]) => void,
): MinesweeperDaily {
  const mines = [...puzzle.mines];
  move(mines);
  return { ...puzzle, mines };
}

describe("the daily table", () => {
  it("is 16 rows by 10 columns, 20 mines on Monday ramping by two to 32 on Sunday", () => {
    expect(MINESWEEPER_DAILY_SIZE).toEqual({ rows: 16, columns: 10 });
    expect(MINESWEEPER_WEEKDAY_MINES).toEqual({
      1: 20,
      2: 22,
      3: 24,
      4: 26,
      5: 28,
      6: 30,
      7: 32,
    });
  });
});

describe("generateMinesweeperDaily", () => {
  it("P1 — every field is 16×10, on the ramp, clear around the start and solved from it without a guess", () => {
    fc.assert(
      fc.property(seedArb, weekdayArb, (seed, weekday) => {
        const puzzle = generateMinesweeperDaily({ seed, weekday });
        const field = fieldOf(puzzle);

        expect(puzzle.seed).toBe(seed);
        expect(puzzle.weekday).toBe(weekday);
        expect([puzzle.rows, puzzle.columns]).toEqual([16, 10]);
        expect(puzzle.mines).toHaveLength(160);
        expect(puzzle.mines.filter((mine) => mine === 1)).toHaveLength(
          MINESWEEPER_WEEKDAY_MINES[weekday],
        );
        for (const cell of [
          puzzle.start,
          ...neighboursOf(16, 10, puzzle.start),
        ]) {
          expect(puzzle.mines[cell]).toBe(0);
        }
        expect(validateMinesweeperDaily(puzzle)).toEqual({ ok: true });
        expect(startMinesweeper(field, puzzle.start).status).toBe("playing");
        expect(closedSafe(puzzle)).toBeGreaterThanOrEqual(40);

        const solved = solveMinesweeper(field, puzzle.start);
        expect(solved.status).toBe("won");
        expect(solved.open).toEqual(field.mines.map((mine) => !mine));
        expect(
          solved.marks.every(
            (mark, cell) => mark !== "flag" || field.mines[cell],
          ),
        ).toBe(true);
      }),
      { seed: FC_SEED, numRuns: 200 },
    );
  });

  it("P1 — Monday lays 20 mines and Sunday 32", () => {
    const sunday = generateMinesweeperDaily({ seed: 20_261_025, weekday: 7 });

    expect(MONDAY.mines.filter((mine) => mine === 1)).toHaveLength(20);
    expect(sunday.mines.filter((mine) => mine === 1)).toHaveLength(32);
  });

  it("pins a Monday and a Sunday field", () => {
    const sunday = generateMinesweeperDaily({ seed: 20_261_025, weekday: 7 });
    const minesOf = (puzzle: MinesweeperDaily) =>
      puzzle.mines.flatMap((mine, cell) => (mine === 1 ? [cell] : []));

    expect(MONDAY.start).toBe(99);
    expect(minesOf(MONDAY)).toEqual([
      21, 28, 38, 47, 64, 84, 87, 94, 97, 104, 111, 112, 122, 126, 128, 129,
      132, 140, 142, 157,
    ]);
    expect(sunday.start).toBe(152);
    expect(minesOf(sunday)).toEqual([
      7, 13, 15, 17, 23, 26, 34, 37, 40, 52, 53, 55, 56, 63, 73, 75, 84, 86, 91,
      92, 93, 100, 103, 114, 118, 119, 122, 133, 145, 147, 155, 159,
    ]);
  });

  it("P2 — determinism: same (seed, weekday) yields a deep-equal field", () => {
    fc.assert(
      fc.property(seedArb, weekdayArb, (seed, weekday) => {
        expect(generateMinesweeperDaily({ seed, weekday })).toEqual(
          generateMinesweeperDaily({ seed, weekday }),
        );
      }),
      { seed: FC_SEED, numRuns: 100 },
    );
  });

  it("P3 — seed normalization: seeds alias modulo 2^32", () => {
    fc.assert(
      fc.property(seedArb, weekdayArb, (seed, weekday) => {
        expect(
          generateMinesweeperDaily({ seed: seed + 2 ** 32, weekday }),
        ).toEqual(generateMinesweeperDaily({ seed, weekday }));
      }),
      { seed: FC_SEED, numRuns: 25 },
    );
  });

  it("generates every Sunday of 200 fixed seeds within the attempt cap", () => {
    for (let seed = 0; seed < 200; seed += 1) {
      expect(generateMinesweeperDaily({ seed, weekday: 7 }).seed).toBe(seed);
    }
  });

  it("rejects a weekday outside 1..7", () => {
    expect(() =>
      generateMinesweeperDaily({ seed: 1, weekday: 8 as 1 }),
    ).toThrow(RangeError);
  });
});

describe("validateMinesweeperDaily", () => {
  it("rejects a field of the wrong size", () => {
    expect(validateMinesweeperDaily({ ...MONDAY, columns: 16 })).toEqual({
      ok: false,
      failures: ["size-mismatch"],
    });
  });

  it("rejects a mine list that is not 160 zeros and ones, or a start off the board", () => {
    const malformed = { ok: false, failures: ["malformed"] };
    expect(
      validateMinesweeperDaily({ ...MONDAY, mines: MONDAY.mines.slice(1) }),
    ).toEqual(malformed);
    expect(
      validateMinesweeperDaily(
        withMines(MONDAY, (mines) => {
          mines[0] = 2 as 1;
        }),
      ),
    ).toEqual(malformed);
    expect(validateMinesweeperDaily({ ...MONDAY, start: 160 })).toEqual(
      malformed,
    );
  });

  it("rejects the wrong mine count for the weekday", () => {
    expect(validateMinesweeperDaily({ ...MONDAY, weekday: 7 })).toEqual({
      ok: false,
      failures: ["mine-count"],
    });
  });

  it("rejects a mine next to the start", () => {
    const moved = withMines(MONDAY, (mines) => {
      const from = mines.indexOf(1);
      mines[from] = 0;
      mines[neighboursOf(16, 10, MONDAY.start)[0]!] = 1;
    });

    const result = validateMinesweeperDaily(moved);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.failures).toContain("start-not-clear");
  });

  it("rejects a field walled off by a row of mines, which needs a guess", () => {
    const walled = withMines({ ...MONDAY, start: 155 }, (mines) => {
      mines.fill(0);
      for (let column = 0; column < 10; column += 1) {
        mines[column] = 1;
        mines[80 + column] = 1;
      }
    });

    expect(validateMinesweeperDaily(walled)).toEqual({
      ok: false,
      failures: ["needs-a-guess"],
    });
  });

  it("rejects a field whose start flood leaves 39 safe cells closed: a stepped wall under rows 0–4", () => {
    const stepped = minesAt(155, [
      ...[0, 1, 2, 3, 4, 5, 6, 7, 8],
      ...[48, 49, 50, 51, 52, 53, 54, 55, 56, 57],
      129,
    ]);
    expect(closedSafe(stepped)).toBe(39);

    expect(validateMinesweeperDaily(stepped)).toEqual({
      ok: false,
      failures: ["opens-too-much"],
    });
  });

  it("accepts the flood leaving 40 safe cells closed: a full wall on row 5 and row 0 mined", () => {
    const walled = minesAt(155, [
      ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      ...[50, 51, 52, 53, 54, 55, 56, 57, 58, 59],
    ]);
    expect(closedSafe(walled)).toBe(40);

    expect(validateMinesweeperDaily(walled)).toEqual({
      ok: false,
      failures: ["needs-a-guess"],
    });
  });

  it("does not run the solver from a start next to a mine", () => {
    const blocked = minesAt(155, [
      ...[1, 2, 3, 4, 5, 6, 7, 8, 9],
      ...[80, 81, 82, 83, 84, 85, 86, 87, 88, 89],
      154,
    ]);

    expect(validateMinesweeperDaily(blocked)).toEqual({
      ok: false,
      failures: ["start-not-clear"],
    });
  });

  it("rejects a weekday outside 1..7 as malformed", () => {
    for (const weekday of [0, 8, 1.5]) {
      expect(
        validateMinesweeperDaily({ ...MONDAY, weekday: weekday as 1 }),
      ).toEqual({ ok: false, failures: ["malformed"] });
    }
  });
});

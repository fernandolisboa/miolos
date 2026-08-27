import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { type TileState, type TileStates } from "../../src/termo/evaluate";
import { deriveBoardStatus, MAX_GUESSES } from "../../src/termo/status";

const tileState = fc.constantFrom<TileState>("correct", "present", "absent");

const anyRow = fc
  .tuple(tileState, tileState, tileState, tileState, tileState)
  .map((tiles): TileStates => tiles);

const nonWinningRow = anyRow.filter(
  (row) => !row.every((tile) => tile === "correct"),
);

const WIN_ROW: TileStates = [
  "correct",
  "correct",
  "correct",
  "correct",
  "correct",
];

const LOSE_ROW: TileStates = ["absent", "absent", "absent", "absent", "absent"];

describe("deriveBoardStatus", () => {
  it("returns playing for an empty board", () => {
    expect(deriveBoardStatus([])).toBe("playing");
  });

  it("returns won for a win on row 1", () => {
    expect(deriveBoardStatus([WIN_ROW])).toBe("won");
  });

  it("returns won for a win on row 6", () => {
    expect(
      deriveBoardStatus([
        LOSE_ROW,
        LOSE_ROW,
        LOSE_ROW,
        LOSE_ROW,
        LOSE_ROW,
        WIN_ROW,
      ]),
    ).toBe("won");
  });

  it("returns lost for six non-winning rows", () => {
    expect(deriveBoardStatus(Array<TileStates>(6).fill(LOSE_ROW))).toBe("lost");
  });

  it("returns playing for five non-winning rows", () => {
    expect(deriveBoardStatus(Array<TileStates>(5).fill(LOSE_ROW))).toBe(
      "playing",
    );
  });

  it("throws RangeError for more than six rows", () => {
    expect(() =>
      deriveBoardStatus(Array<TileStates>(7).fill(LOSE_ROW)),
    ).toThrow(RangeError);
  });

  it("throws RangeError for a row after a win (guessing past a win is a caller bug)", () => {
    expect(() => deriveBoardStatus([WIN_ROW, LOSE_ROW])).toThrow(RangeError);
  });

  it("is won whenever the last row is all-correct (property)", () => {
    fc.assert(
      fc.property(
        fc.array(nonWinningRow, { minLength: 0, maxLength: MAX_GUESSES - 1 }),
        (rows) => {
          expect(deriveBoardStatus([...rows, WIN_ROW])).toBe("won");
        },
      ),
    );
  });

  it("is lost iff exactly MAX_GUESSES non-winning rows, else playing (property)", () => {
    fc.assert(
      fc.property(
        fc.array(nonWinningRow, { minLength: 0, maxLength: MAX_GUESSES }),
        (rows) => {
          expect(deriveBoardStatus(rows)).toBe(
            rows.length === MAX_GUESSES ? "lost" : "playing",
          );
        },
      ),
    );
  });
});

import { describe, expect, it } from "vitest";

import { GAMES, recordFor, TIMED_GAMES, type Game } from "../src/index";

describe("recordFor", () => {
  it("T-CORE-S130: builds a total record over exactly the given keys, in key order, one call per key", () => {
    const calls: Game[] = [];
    const record = recordFor(GAMES, (game) => {
      calls.push(game);
      return game.length;
    });

    expect(Object.keys(record)).toEqual([...GAMES]);
    expect(calls).toEqual([...GAMES]);
    expect(record.crossword).toBe("crossword".length);

    expect(Object.keys(recordFor(TIMED_GAMES, () => 0))).toEqual([
      ...TIMED_GAMES,
    ]);
    expect(recordFor([], () => 1)).toEqual({});
  });

  it("T-CORE-S130: the crossword is the fifth game, last, and a timed one", () => {
    expect([...GAMES]).toEqual([
      "binairo",
      "sudoku",
      "nonogram",
      "termo",
      "crossword",
    ]);
    expect([...TIMED_GAMES]).toEqual([
      "binairo",
      "sudoku",
      "nonogram",
      "crossword",
    ]);
  });
});

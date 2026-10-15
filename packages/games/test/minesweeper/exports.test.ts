import { describe, expect, it } from "vitest";

describe("@miolos/games exports map", () => {
  it("resolves the ./minesweeper subpath with exactly its public surface", async () => {
    const mod = await import("@miolos/games/minesweeper");
    expect(Object.keys(mod).sort()).toEqual([
      "MINESWEEPER_LEVELS",
      "chordMinesweeper",
      "cycleMinesweeperMark",
      "layMines",
      "newMinesweeperGame",
      "openMinesweeperCell",
    ]);
  });
});

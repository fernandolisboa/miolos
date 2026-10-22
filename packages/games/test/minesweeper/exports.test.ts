import { describe, expect, it } from "vitest";

describe("@miolos/games exports map", () => {
  it("resolves the ./minesweeper subpath with exactly its public surface", async () => {
    const mod = await import("@miolos/games/minesweeper");
    expect(Object.keys(mod).sort()).toEqual([
      "MINESWEEPER_CUSTOM_LIMITS",
      "MINESWEEPER_DAILY_SIZE",
      "MINESWEEPER_LEVELS",
      "MINESWEEPER_WEEKDAY_MINES",
      "MinesweeperGenerationError",
      "chordBlock",
      "chordMinesweeper",
      "customMinesweeperSize",
      "cycleMinesweeperMark",
      "generateMinesweeperDaily",
      "layMines",
      "minesweeperField",
      "newMinesweeperGame",
      "openMinesweeperCell",
      "startMinesweeper",
      "validateMinesweeperDaily",
    ]);
  });
});

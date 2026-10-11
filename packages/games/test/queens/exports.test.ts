import { describe, expect, it } from "vitest";

describe("@miolos/games exports map", () => {
  it("resolves the ./queens subpath with exactly its public surface", async () => {
    const mod = await import("@miolos/games/queens");
    expect(Object.keys(mod).sort()).toEqual([
      "QUEENS_MAX_GENERATION_ATTEMPTS",
      "QUEENS_SIZES",
      "QUEENS_WEEKDAY_CRITERIA",
      "QueensGenerationError",
      "countQueensSolutions",
      "findQueensViolations",
      "generateQueens",
      "gradeQueens",
      "isValidQueensSolution",
      "solveQueens",
      "validateQueens",
    ]);
    expect(mod.QUEENS_SIZES).toEqual([7, 8, 9]);
  });
});

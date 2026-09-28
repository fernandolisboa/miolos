import { describe, expect, it } from "vitest";

describe("@miolos/games exports map", () => {
  it("resolves the ./crossword subpath with exactly its public surface", async () => {
    const mod = await import("@miolos/games/crossword");
    expect(Object.keys(mod).sort()).toEqual([
      "CROSSWORD_SIZE",
      "CrosswordGenerationError",
      "generateCrossword",
      "validateCrossword",
    ]);
    expect(mod.CROSSWORD_SIZE).toBe(5);
  });
});

import { describe, expect, it } from "vitest";

describe("@miolos/games exports map", () => {
  it("resolves the ./colored-nonogram subpath with exactly its public surface", async () => {
    const mod = await import("@miolos/games/colored-nonogram");
    expect(Object.keys(mod).sort()).toEqual([
      "CONFUSABLE_TONE_PAIRS",
      "coloredRuns",
      "formsColoredClue",
      "generateColoredNonogram",
      "nextColoredStep",
      "placedColoredClues",
    ]);
  });
});

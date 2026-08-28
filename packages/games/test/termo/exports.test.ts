import { describe, expect, it } from "vitest";

describe("@miolos/games exports map", () => {
  it("resolves the ./termo subpath", async () => {
    const mod = await import("@miolos/games/termo");
    expect(mod.WORD_LENGTH).toBe(5);
    expect(mod.MAX_GUESSES).toBe(6);
    expect(typeof mod.evaluateGuess).toBe("function");

    expect(typeof mod.isValidGuess).toBe("function");
    expect(mod.TERMO_ANSWERS).toHaveLength(400);
  });

  it("resolves the root barrel (shared substrate only)", async () => {
    const mod = await import("@miolos/games");
    expect(mod.WEEKDAYS).toHaveLength(7);
    expect(typeof mod.createSeededRandom).toBe("function");
  });
});

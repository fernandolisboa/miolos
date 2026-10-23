import { describe, expect, it } from "vitest";

describe("@miolos/games exports map", () => {
  it("resolves the ./termo subpath", async () => {
    const mod = await import("@miolos/games/termo");
    expect(mod.WORD_LENGTH).toBe(5);
    expect(mod.MAX_GUESSES).toBe(6);
    expect(typeof mod.evaluateGuess).toBe("function");

    expect(typeof mod.isValidGuess).toBe("function");
    expect(typeof mod.judgeBoards).toBe("function");
    expect("TERMO_ANSWERS" in mod).toBe(false);
  });

  it("resolves the ./termo-answers subpath", async () => {
    const mod = await import("@miolos/games/termo-answers");
    expect(mod.TERMO_ANSWERS).toHaveLength(1714);
  });

  it("resolves the ./termo-free subpath", async () => {
    const mod = await import("@miolos/games/termo-free");
    expect(mod.drawFreeTermoWords(1, 2)).toHaveLength(2);
  });

  it("resolves the root barrel (shared substrate only)", async () => {
    const mod = await import("@miolos/games");
    expect(mod.WEEKDAYS).toHaveLength(7);
    expect(typeof mod.createSeededRandom).toBe("function");
  });
});

import { describe, expect, it } from "vitest";

// Exercises the package.json exports map itself via Node self-reference, the
// sibling of `test/binairo/exports.test.ts`: every other test imports by
// relative path, so a typo in the "./termo" key or its target would pass the
// whole suite and only surface in the first consumer — which is #27.

describe("@miolos/games exports map", () => {
  it("resolves the ./termo subpath", async () => {
    const mod = await import("@miolos/games/termo");
    expect(mod.WORD_LENGTH).toBe(5);
    expect(mod.MAX_GUESSES).toBe(6);
    expect(typeof mod.evaluateGuess).toBe("function");
    // The word list reaches consumers through THIS subpath and no other:
    // ADR-0019 vetoes both a `./termo/word-list` sub-barrel and a deep
    // import, so a broken key here has no legal workaround.
    expect(typeof mod.isValidGuess).toBe("function");
    expect(mod.TERMO_ANSWERS).toHaveLength(400);
  });

  it("resolves the root barrel (shared substrate only)", async () => {
    const mod = await import("@miolos/games");
    expect(mod.WEEKDAYS).toHaveLength(7);
    expect(typeof mod.createSeededRandom).toBe("function");
  });
});

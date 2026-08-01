import { describe, expect, it } from "vitest";

// Exercises the package.json exports map itself via Node self-reference
// (step-6 quality review): every other test imports by relative path, so
// a typo in the "./binairo" key or its target would pass the whole suite
// and only surface in the first consumer (#18).

describe("@miolos/games exports map", () => {
  it("resolves the ./binairo subpath", async () => {
    const mod = await import("@miolos/games/binairo");
    expect(mod.BINAIRO_SIZE).toBe(8);
    expect(typeof mod.generateBinairo).toBe("function");
  });

  it("resolves the root barrel (shared substrate only)", async () => {
    const mod = await import("@miolos/games");
    expect(mod.WEEKDAYS).toHaveLength(7);
    expect(typeof mod.createSeededRandom).toBe("function");
  });
});

import { describe, expect, it } from "vitest";

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

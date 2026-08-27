import { GAMES } from "@miolos/core";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_FREE_PLAY_LEVEL,
  FREE_PLAY_GAMES,
  FREE_PLAY_LEVELS,
  LEVEL_WEEKDAYS,
  pickSeed,
} from "../src/free-play/catalog";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the free-play game set and level mapping (T-WEB-S109)", () => {
  it("FREE_PLAY_GAMES set-equals GAMES minus termo", () => {
    expect(GAMES).toHaveLength(4);
    expect(GAMES).toContain("termo");

    const expected = GAMES.filter((game) => game !== "termo");
    expect([...FREE_PLAY_GAMES].sort()).toEqual([...expected].sort());
    expect(FREE_PLAY_GAMES).not.toContain("termo");
  });

  it("maps the three levels onto the ramp's endpoints and middle (D2)", () => {
    expect(FREE_PLAY_LEVELS).toEqual(["leve", "medio", "dificil"]);
    expect(LEVEL_WEEKDAYS).toEqual({ leve: 1, medio: 4, dificil: 7 });
    expect(FREE_PLAY_LEVELS).toContain(DEFAULT_FREE_PLAY_LEVEL);
    expect(DEFAULT_FREE_PLAY_LEVEL).toBe("medio");
  });
});

describe("pickSeed (T-WEB-S110)", () => {
  it("draws from crypto.getRandomValues, never Math.random", () => {
    const sentinel = 0xdead_beef;
    const spy = vi
      .spyOn(crypto, "getRandomValues")
      .mockImplementation(<T extends ArrayBufferView | null>(array: T): T => {
        if (array instanceof Uint32Array) {
          array.fill(sentinel);
        }
        return array;
      });

    expect(pickSeed()).toBe(sentinel);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("yields a uint32", () => {
    for (let draw = 0; draw < 32; draw += 1) {
      const seed = pickSeed();
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThanOrEqual(0xffff_ffff);

      expect(seed >>> 0).toBe(seed);
    }
  });
});

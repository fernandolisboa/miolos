import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { createSeededRandom } from "../src/index";

describe("createSeededRandom", () => {
  it("is deterministic: the same seed yields the same sequence", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 0xffffffff }), (seed) => {
        const a = createSeededRandom(seed);
        const b = createSeededRandom(seed);
        for (let i = 0; i < 100; i += 1) {
          expect(b.next()).toBe(a.next());
        }
      }),
    );
  });

  it("always produces values in [0, 1)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 0xffffffff }), (seed) => {
        const random = createSeededRandom(seed);
        for (let i = 0; i < 100; i += 1) {
          const value = random.next();
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThan(1);
        }
      }),
    );
  });

  it("nextInt stays within [0, maxExclusive) and is deterministic per seed", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 0xffffffff }),
        fc.integer({ min: 1, max: 1_000_000 }),
        (seed, maxExclusive) => {
          const a = createSeededRandom(seed);
          const b = createSeededRandom(seed);
          for (let i = 0; i < 50; i += 1) {
            const value = a.nextInt(maxExclusive);
            expect(Number.isInteger(value)).toBe(true);
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThan(maxExclusive);
            expect(b.nextInt(maxExclusive)).toBe(value);
          }
        },
      ),
    );
  });

  it("rejects a non-positive or non-integer maxExclusive", () => {
    const random = createSeededRandom(1);
    expect(() => random.nextInt(0)).toThrow(RangeError);
    expect(() => random.nextInt(-1)).toThrow(RangeError);
    expect(() => random.nextInt(1.5)).toThrow(RangeError);
  });
});

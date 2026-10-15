import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { generateCrossword } from "../../src/crossword/generate";

describe("generateCrossword 5×5 output", () => {
  // ADR-0055: CI gate 2053 ms × 4 → 10_000.
  it("seeds 0-199 produce the pinned puzzles, byte for byte", () => {
    const hash = createHash("sha256");
    for (let seed = 0; seed < 200; seed += 1) {
      hash.update(JSON.stringify(generateCrossword(seed)));
    }
    expect(hash.digest("hex")).toBe(
      "cc212db803bc055517809961e6d60a7daee07811df2cc9ad1b07f134a4728fdb",
    );
  }, 10_000);
});

import os from "node:os";

import { describe, expect, it } from "vitest";

import { maxWorkers } from "../../../vitest.shared";

// #114: vitest's default `cpus - 1` ties memory demand to CORE COUNT, and six
// packages x 7 workers drove a 15.5 GB box into swap. The bound is
// `min(4, cpus - 1)` rather than a flat 4 so the 2-vCPU CI runner still gets
// 1 worker, which is what it had before the bound existed.
const bound = (cpus: number): number => Math.max(1, Math.min(4, cpus - 1));

describe("the shared vitest worker bound (#114)", () => {
  it("is at most 4, at least 1, and never above `cpus - 1`", () => {
    expect(maxWorkers).toBe(bound(os.cpus().length));
    expect(maxWorkers).toBeGreaterThanOrEqual(1);
    expect(maxWorkers).toBeLessThanOrEqual(4);
  });

  it("leaves the 2-vCPU runner at 1 and caps a large box at 4", () => {
    expect(bound(1)).toBe(1);
    expect(bound(2)).toBe(1);
    expect(bound(5)).toBe(4);
    expect(bound(8)).toBe(4);
    expect(bound(64)).toBe(4);
  });
});

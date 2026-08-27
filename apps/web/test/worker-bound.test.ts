import os from "node:os";

import { describe, expect, it } from "vitest";

import { maxWorkers } from "../../../vitest.shared";

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

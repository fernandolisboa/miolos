import { readFileSync } from "node:fs";
import os from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { maxWorkers } from "../../../vitest.shared";

describe("the shared vitest worker bound (#114, ADR-0057 decision 6)", () => {
  it("is min(4, cpus - 1), floored at 1", () => {
    expect(maxWorkers).toBe(Math.max(1, Math.min(4, os.cpus().length - 1)));
    expect(maxWorkers).toBeGreaterThanOrEqual(1);
    expect(maxWorkers).toBeLessThanOrEqual(4);
    expect(maxWorkers).toBeLessThanOrEqual(Math.max(1, os.cpus().length - 1));
  });

  it("keeps the formula rather than a flat 4, which is what leaves the 2-vCPU runner at 1", () => {
    const source = readFileSync(
      join(import.meta.dirname, "..", "..", "..", "vitest.shared.ts"),
      "utf8",
    );
    expect(source).toContain("Math.max(1, Math.min(4, os.cpus().length - 1))");
  });

  it("is what every workspace config imports — packages/games has none, by design", () => {
    const importers = [
      "apps/web",
      "apps/api",
      "packages/core",
      "packages/db",
      "packages/ui",
    ];
    for (const pkg of importers) {
      const config = readFileSync(
        join(import.meta.dirname, "..", "..", "..", pkg, "vitest.config.ts"),
        "utf8",
      );
      expect(config, pkg).toContain("maxWorkers");
    }
    expect(() =>
      readFileSync(
        join(
          import.meta.dirname,
          "..",
          "..",
          "..",
          "packages/games/vitest.config.ts",
        ),
      ),
    ).toThrow();
  });
});

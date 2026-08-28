import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

async function source(): Promise<string> {
  return readFile(new URL("../src/testing.ts", import.meta.url), "utf8");
}

describe("createTestDb's boot instrument (ADR-0057 decision 4)", () => {
  it("reads t0 BEFORE constructing PGlite, or pglite_ms measures nothing", async () => {
    const text = await source();
    const t0 = text.indexOf("const t0 = performance.now()");
    const construct = text.indexOf("new PGlite(");
    const settle = text.indexOf("await client.waitReady");
    const t1 = text.indexOf("const t1 = performance.now()");

    expect(t0).toBeGreaterThan(-1);
    expect(construct).toBeGreaterThan(-1);
    expect(settle).toBeGreaterThan(-1);
    expect(t1).toBeGreaterThan(-1);

    // `new PGlite()` STARTS the boot and assigns the promise without
    // awaiting, so a t0 read after it times the await alone.
    expect(t0).toBeLessThan(construct);
    expect(construct).toBeLessThan(settle);
    expect(settle).toBeLessThan(t1);
  });

  it("derives every reported phase from those marks, so a reorder cannot go unnoticed", async () => {
    const text = await source();
    for (const phase of [
      "pglite_ms: (t1 - t0)",
      "drizzle_ms: (t2 - t1)",
      "migrate_ms: (t3 - t2)",
      "total_ms: (t3 - t0)",
    ]) {
      expect(text).toContain(phase);
    }
  });
});

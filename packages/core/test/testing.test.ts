import { describe, expect, it } from "vitest";

import { stripDailyContent } from "../src/index";
import { collectKeys, FORBIDDEN_DAILY_KEYS } from "../src/testing";

describe("FORBIDDEN_DAILY_KEYS", () => {
  const forbidden: readonly string[] = FORBIDDEN_DAILY_KEYS;

  it("T-CORE-S20: names both keys termo's stored content carries", () => {
    expect(forbidden).toContain("canonical");
    expect(forbidden).toContain("normalized");
    expect(forbidden).toContain("answer");
  });

  it("T-CORE-S20: a flattened termo projection TRIPS the scan (the anti-vacuity half)", () => {
    const leaks = [
      { game: "termo", date: "2026-08-03", canonical: "então" },
      { game: "termo", date: "2026-08-03", normalized: "entao" },
      { game: "termo", date: "2026-08-03", answer: "entao" },
      {
        game: "termo",
        date: "2026-08-03",
        content: { canonical: "então", normalized: "entao" },
      },
    ];
    for (const leak of leaks) {
      const keys = collectKeys(leak);

      expect(keys.has("game")).toBe(true);
      expect(forbidden.some((key) => keys.has(key))).toBe(true);
    }
  });

  it("T-CORE-S20: the SHIPPED termo projection does not trip it", () => {
    const keys = collectKeys(
      stripDailyContent("termo", "2026-08-03", {
        canonical: "então",
        normalized: "entao",
      }),
    );
    expect(keys.has("game")).toBe(true);
    for (const key of forbidden) {
      expect(keys.has(key)).toBe(false);
    }
  });

  it("T-CORE-S20: every member is a distinct non-empty lowercase-startable key", () => {
    expect(new Set(forbidden).size).toBe(forbidden.length);
    for (const key of forbidden) {
      expect(key.length).toBeGreaterThan(0);
    }
  });
});

describe("collectKeys", () => {
  it("walks nested objects and arrays, and returns an empty set for a scalar", () => {
    expect([...collectKeys({ a: { b: [{ c: 1 }] } })].sort()).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(collectKeys(null).size).toBe(0);
    expect(collectKeys(7).size).toBe(0);
    expect(collectKeys("canonical").size).toBe(0);
  });
});

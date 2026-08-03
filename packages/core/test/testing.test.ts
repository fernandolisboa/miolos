import { describe, expect, it } from "vitest";

import { stripDailyContent } from "../src/index";
import { collectKeys, FORBIDDEN_DAILY_KEYS } from "../src/testing";

// The first dedicated suite for `@miolos/core/testing` itself. Every other
// consumer USES `FORBIDDEN_DAILY_KEYS` — ten leak scans across four packages —
// and none of them can see whether the list is meaningful for the game it
// was extended for. That gap is exactly what ADR-0033 decision 3 refused for
// `"reveal"`: a key nothing has ever emitted makes every scan pass unchanged,
// which reads as coverage and is not (plan 018 S22, plan 022 §19.3).

describe("FORBIDDEN_DAILY_KEYS", () => {
  const forbidden: readonly string[] = FORBIDDEN_DAILY_KEYS;

  it("T-CORE-S20: names both keys termo's stored content carries", () => {
    // `"answer"` was already here before #27 and is NOT enough on its own:
    // the stored shape is `{canonical, normalized}` (ADR-0040), so a
    // projection that flattened it to top-level keys would carry the word
    // under names no scan looked at.
    expect(forbidden).toContain("canonical");
    expect(forbidden).toContain("normalized");
    expect(forbidden).toContain("answer");
  });

  it("T-CORE-S20: a flattened termo projection TRIPS the scan (the anti-vacuity half)", () => {
    // The synthetic leak this list exists to catch, written out rather than
    // assumed: each of the three shapes a careless termo projection could
    // take must be caught by at least one member. Without this case the
    // additions above would be two strings nothing ever tests.
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
      // Anti-vacuity for the anti-vacuity test: the probe walked an object.
      expect(keys.has("game")).toBe(true);
      expect(forbidden.some((key) => keys.has(key))).toBe(true);
    }
  });

  it("T-CORE-S20: the SHIPPED termo projection does not trip it", () => {
    // The other direction, and the one that would make the two additions a
    // false alarm rather than a guard: `stripDailyContent`'s termo arm must
    // still pass the scan every consumer runs.
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
    // The list is also a SUBSTRING ban on three page suites' rendered markup
    // (this module's own TSDoc), so a duplicate or an empty string would be a
    // scan that bans everything or nothing.
    expect(new Set(forbidden).size).toBe(forbidden.length);
    for (const key of forbidden) {
      expect(key.length).toBeGreaterThan(0);
    }
  });
});

describe("collectKeys", () => {
  it("walks nested objects and arrays, and returns an empty set for a scalar", () => {
    // The property every leak scan's anti-vacuity assertion depends on: a
    // non-object input yields NO keys, so `has(forbidden)` is false for a
    // reason that has nothing to do with the payload being clean.
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

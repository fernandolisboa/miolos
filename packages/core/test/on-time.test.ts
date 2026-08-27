import { describe, expect, it } from "vitest";

import { LATE_SYNC_CREDIT_DAYS_BACK, onTimeAtWrite } from "../src/on-time";

describe("onTimeAtWrite — the write-time on-time rule (#58, ADR-0066)", () => {
  it("T-CORE-S105: the truth table — today is true unconditionally; one day back is true iff seen; further back is false even when seen", () => {
    const today = "2026-08-20";

    expect(onTimeAtWrite(today, today, false)).toBe(true);
    expect(onTimeAtWrite(today, today, true)).toBe(true);

    expect(onTimeAtWrite("2026-08-19", today, true)).toBe(true);
    expect(onTimeAtWrite("2026-08-19", today, false)).toBe(false);

    expect(onTimeAtWrite("2026-08-18", today, true)).toBe(false);
    expect(onTimeAtWrite("2026-08-18", today, false)).toBe(false);
    expect(onTimeAtWrite("2026-01-01", today, true)).toBe(false);

    expect(onTimeAtWrite("2026-07-31", "2026-08-01", true)).toBe(true);

    expect(onTimeAtWrite("2025-12-31", "2026-01-01", true)).toBe(true);

    expect(onTimeAtWrite("2026-08-21", today, true)).toBe(false);

    expect(LATE_SYNC_CREDIT_DAYS_BACK).toBe(1);
  });
});

import { describe, expect, it } from "vitest";

import { LATE_SYNC_CREDIT_DAYS_BACK, onTimeAtWrite } from "../src/on-time";

describe("onTimeAtWrite — the write-time on-time rule (#58, ADR-0066)", () => {
  it("T-CORE-S105: the truth table — today is true unconditionally; one day back is true iff seen; further back is false even when seen", () => {
    const today = "2026-08-20";

    // The puzzle's own day: true whatever the seen flag says — identical
    // to the pre-#58 derivation, where the write instant sat inside the
    // puzzle's day by construction.
    expect(onTimeAtWrite(today, today, false)).toBe(true);
    expect(onTimeAtWrite(today, today, true)).toBe(true);

    // Exactly one day back: the credit exists iff the server itself saw
    // the user on that day. Unseen stays late — the failure direction is
    // the status quo, never a false credit.
    expect(onTimeAtWrite("2026-08-19", today, true)).toBe(true);
    expect(onTimeAtWrite("2026-08-19", today, false)).toBe(false);

    // Two-plus days back: false EVEN WHEN SEEN — going dark banks at most
    // one day (Fernando's 2026-08-02 rule; the window is
    // LATE_SYNC_CREDIT_DAYS_BACK = 1 and widening it is an ADR amendment).
    expect(onTimeAtWrite("2026-08-18", today, true)).toBe(false);
    expect(onTimeAtWrite("2026-08-18", today, false)).toBe(false);
    expect(onTimeAtWrite("2026-01-01", today, true)).toBe(false);

    // A month boundary is plain calendar arithmetic, not string arithmetic.
    expect(onTimeAtWrite("2026-07-31", "2026-08-01", true)).toBe(true);
    // A year boundary too.
    expect(onTimeAtWrite("2025-12-31", "2026-01-01", true)).toBe(true);

    // A FUTURE date is never on time through this rule (the route's wall
    // and write window refuse it earlier; this is defence in depth, not a
    // reachable production shape).
    expect(onTimeAtWrite("2026-08-21", today, true)).toBe(false);

    // The window constant is the decision's literal value; a widening PR
    // must touch ADR-0066, the retention predicate and the guard fold —
    // this pin is what makes that edit visible.
    expect(LATE_SYNC_CREDIT_DAYS_BACK).toBe(1);
  });
});

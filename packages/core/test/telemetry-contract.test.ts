import { describe, expect, it } from "vitest";

import {
  TELEMETRY_EVENTS,
  telemetryEventPropertiesSchemas,
  telemetryRelayRequestSchema,
} from "../src";

describe("the telemetry contract (#33, ADR-0069)", () => {
  it("T-CORE-S110: exactly the five founding events exist, and every property schema is strict — an extra or PII-shaped field fails the parse", () => {
    expect(TELEMETRY_EVENTS).toEqual([
      "puzzle_started",
      "puzzle_completed",
      "streak_broken",
      "notification_opt_in",
      "login_linked",
    ]);

    expect(Object.keys(telemetryEventPropertiesSchemas).sort()).toEqual(
      [...TELEMETRY_EVENTS].sort(),
    );

    const valid = {
      puzzle_started: { game: "binairo", date: "2026-08-21", archive: false },
      puzzle_completed: {
        game: "termo",
        date: "2026-08-21",
        elapsed_ms: 61_000,
        outcome: "lost",
        on_time: true,
      },
      streak_broken: {
        previous_streak: 4,
        broken_after_date: "2026-08-15",
        gap_days: 2,
      },
      notification_opt_in: {},
      login_linked: { merged: true },
    } as const;

    for (const event of TELEMETRY_EVENTS) {
      const schema = telemetryEventPropertiesSchemas[event];
      expect(schema.safeParse(valid[event]).success, event).toBe(true);

      expect(
        schema.safeParse({ ...valid[event], email: "a@b.c" }).success,
        `${event} + extra`,
      ).toBe(false);
    }

    expect(
      telemetryRelayRequestSchema.safeParse({
        event: "puzzle_started",
        properties: { game: "sudoku", date: "2026-08-21" },
      }).success,
    ).toBe(true);
    for (const rejected of [
      {
        event: "puzzle_completed",
        properties: { game: "sudoku", date: "2026-08-21" },
      },

      {
        event: "puzzle_started",
        properties: { game: "sudoku", date: "2026-08-21", archive: true },
      },

      {
        event: "puzzle_started",
        properties: { game: "sudoku", date: "2026-02-30" },
      },

      {
        event: "puzzle_started",
        properties: { game: "sudoku", date: "2026-08-21" },
        distinct_id: "attacker-chosen",
      },
    ]) {
      expect(
        telemetryRelayRequestSchema.safeParse(rejected).success,
        JSON.stringify(rejected),
      ).toBe(false);
    }
  });
});

import { describe, expect, it } from "vitest";

import {
  TELEMETRY_EVENTS,
  telemetryEventPropertiesSchemas,
  telemetryRelayRequestSchema,
} from "../src";

/**
 * The telemetry contract (#33, ADR-0069): exactly five product-analytics
 * events exist, each with a strict, closed property schema. The ceiling is
 * enforced by construction — `captureEvent`'s event parameter is typed off
 * `TELEMETRY_EVENTS`, so a sixth event is a compile error before it is a
 * test failure — and this suite pins the runtime half: the list itself, and
 * that every schema rejects extra (PII-shaped) fields rather than passing
 * them through to the processor.
 */
describe("the telemetry contract (#33, ADR-0069)", () => {
  it("T-CORE-S110: exactly the five founding events exist, and every property schema is strict — an extra or PII-shaped field fails the parse", () => {
    // The five names, verbatim from the founding handoff :63 — order and
    // spelling both pinned, because the dashboard keys on the strings.
    expect(TELEMETRY_EVENTS).toEqual([
      "puzzle_started",
      "puzzle_completed",
      "streak_broken",
      "notification_opt_in",
      "login_linked",
    ]);
    // One schema per event, no strays: the schema map's keys ARE the list.
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
      // Strict on every event: a smuggled extra key — the PII shape a
      // future call site could leak (an email, an endpoint, puzzle
      // content) — fails the parse rather than riding to the processor.
      expect(
        schema.safeParse({ ...valid[event], email: "a@b.c" }).success,
        `${event} + extra`,
      ).toBe(false);
    }

    // The relay contract is the client-originated SUBSET: `puzzle_started`
    // only — `archive` is server-derived in the relay route, never
    // client-asserted, so the wire shape carries game + date and nothing
    // else.
    expect(
      telemetryRelayRequestSchema.safeParse({
        event: "puzzle_started",
        properties: { game: "sudoku", date: "2026-08-21" },
      }).success,
    ).toBe(true);
    for (const rejected of [
      // A server-seam event through the relay is a forgery vector, not a
      // contract member.
      {
        event: "puzzle_completed",
        properties: { game: "sudoku", date: "2026-08-21" },
      },
      // The client may not assert `archive` — the route derives it.
      {
        event: "puzzle_started",
        properties: { game: "sudoku", date: "2026-08-21", archive: true },
      },
      // Not a calendar date.
      {
        event: "puzzle_started",
        properties: { game: "sudoku", date: "2026-02-30" },
      },
      // Extra top-level key.
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

import { z } from "zod";

import { completionOutcomeSchema } from "../completion";
import { gameSchema } from "../game";
import { calendarDateString } from "./daily";

/**
 * The telemetry contract (#33, ADR-0069): the five product-analytics events
 * the founding handoff names (:63), and nothing else. The list is the
 * ceiling — `captureEvent` in apps/api types its `event` parameter off this
 * tuple, so a sixth event is a compile error, and the hand-rolled capture
 * helper (no SDK, ADR-0069 decision 1) structurally cannot autocapture,
 * page-view or session-replay its way past it.
 *
 * Property schemas are `z.strictObject` on every event: telemetry payloads
 * are minimal by decision (no PII, no puzzle content — ADR-0004 discipline),
 * and strictness is what turns "minimal" from a review promise into a parse
 * failure. THE PARSE IS REAL AND RUNS IN PRODUCTION: `captureEvent`
 * (apps/api/src/telemetry/capture.ts) parses against these schemas before it
 * builds the request body, so a call site that spread a wider object drops
 * the event rather than sending it (step-6 quality B1 — until then the
 * schemas were compile-time surface plus a test, which is exactly the
 * "review promise" this sentence claims to have replaced). T-CORE-S110 pins
 * the schemas; T-API-S175 pins the drop.
 */
export const TELEMETRY_EVENTS = [
  "puzzle_started",
  "puzzle_completed",
  "streak_broken",
  "notification_opt_in",
  "login_linked",
] as const;

export type TelemetryEvent = (typeof TELEMETRY_EVENTS)[number];

/**
 * Per-event property shapes (ADR-0069 decision 4's payload table):
 *
 * - `puzzle_started`: `archive` is derived SERVER-side in the relay route
 *   against `todaySaoPaulo(db)` — the client never asserts it (see
 *   `telemetryRelayRequestSchema` below).
 * - `puzzle_completed`: the stored verdict travels (`outcome`, `on_time`) —
 *   a lost Termo fires with `outcome: "lost"`; `on_time` is the write-time
 *   decision (ADR-0066), which is also the honest archive/daily
 *   distinction the server can actually make.
 * - `streak_broken`: derived on return in POST /completions (ADR-0069
 *   decision 3). `gap_days` is the count of fully missed days —
 *   `epochDay(insertedDate) − epochDay(brokenAfterDate) − 1`.
 * - `notification_opt_in`: empty by decision — never the endpoint or keys.
 * - `login_linked`: the resolver's `merged` flag — never the email.
 */
export const telemetryEventPropertiesSchemas = {
  puzzle_started: z.strictObject({
    game: gameSchema,
    date: calendarDateString,
    archive: z.boolean(),
  }),
  puzzle_completed: z.strictObject({
    game: gameSchema,
    date: calendarDateString,
    elapsed_ms: z.number().int().min(0),
    outcome: completionOutcomeSchema,
    on_time: z.boolean(),
  }),
  streak_broken: z.strictObject({
    previous_streak: z.number().int().min(1),
    broken_after_date: calendarDateString,
    gap_days: z.number().int().min(1),
  }),
  notification_opt_in: z.strictObject({}),
  login_linked: z.strictObject({ merged: z.boolean() }),
} as const;

/** The typed payload for one event — what `captureEvent` accepts. */
export type TelemetryEventProperties = {
  [E in TelemetryEvent]: z.infer<(typeof telemetryEventPropertiesSchemas)[E]>;
};

/**
 * Body of POST /telemetry — the first-party relay (ADR-0069 decision 2),
 * and the client-originated SUBSET of the contract: `puzzle_started` only,
 * because it is the one event with no server fact behind it (no row exists
 * before completion). The other four fire at their server truth seams and
 * accepting them here would be a forgery surface. `archive` is deliberately
 * absent: the route derives it from the DB clock's SP today, never from a
 * client claim.
 */
export const telemetryRelayRequestSchema = z.strictObject({
  event: z.literal("puzzle_started"),
  properties: z.strictObject({
    game: gameSchema,
    date: calendarDateString,
  }),
});

export type TelemetryRelayRequest = z.infer<typeof telemetryRelayRequestSchema>;

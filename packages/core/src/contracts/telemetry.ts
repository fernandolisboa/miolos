import { z } from "zod";

import { completionOutcomeSchema } from "../completion";
import { gameSchema } from "../game";
import { calendarDateString } from "./daily";

/**
 * The telemetry contract (ADR-0069): the five product-analytics events the
 * founding handoff names, and nothing else. `captureEvent` in apps/api
 * types its `event` parameter off this tuple, so a sixth event is a compile
 * error — no SDK, no autocapture, no session replay can smuggle one past it.
 *
 * Every property schema is `z.strictObject`: telemetry payloads are minimal
 * by decision (no PII, no puzzle content — ADR-0004 discipline), and
 * `captureEvent` parses against these schemas before building the request
 * body, so a call site that spreads a wider object drops the event rather
 * than sending it.
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
 * Per-event property shapes (ADR-0069 decision 4):
 *
 * - `puzzle_started`: `archive` is derived server-side in the relay route
 *   against `todaySaoPaulo(db)` — the client never asserts it.
 * - `puzzle_completed`: the stored verdict travels (`outcome`, `on_time`) —
 *   `on_time` is the write-time decision (ADR-0066).
 * - `streak_broken`: derived on return in POST /completions. `gap_days` is
 *   the count of fully missed days.
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
 * and the client-originated subset of the contract: `puzzle_started` only,
 * the one event with no server fact behind it. The other four fire at their
 * server truth seams; accepting them here would be a forgery surface.
 * `archive` is deliberately absent — the route derives it from the DB
 * clock's SP today, never from a client claim.
 */
export const telemetryRelayRequestSchema = z.strictObject({
  event: z.literal("puzzle_started"),
  properties: z.strictObject({
    game: gameSchema,
    date: calendarDateString,
  }),
});

export type TelemetryRelayRequest = z.infer<typeof telemetryRelayRequestSchema>;

import { z } from "zod";

import { completionOutcomeSchema } from "../completion";
import { gameSchema } from "../game";
import { calendarDateString } from "./daily";

export const TELEMETRY_EVENTS = [
  "puzzle_started",
  "puzzle_completed",
  "streak_broken",
  "notification_opt_in",
  "login_linked",
] as const;

export type TelemetryEvent = (typeof TELEMETRY_EVENTS)[number];

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

export type TelemetryEventProperties = {
  [E in TelemetryEvent]: z.infer<(typeof telemetryEventPropertiesSchemas)[E]>;
};

export const telemetryRelayRequestSchema = z.strictObject({
  event: z.literal("puzzle_started"),
  properties: z.strictObject({
    game: gameSchema,
    date: calendarDateString,
  }),
});

export type TelemetryRelayRequest = z.infer<typeof telemetryRelayRequestSchema>;

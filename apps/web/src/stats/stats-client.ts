import {
  fullDaysResponseSchema,
  statsCalendarResponseSchema,
  statsResponseSchema,
  type FullDaysResponse,
  type StatsCalendarResponse,
  type StatsResponse,
} from "@miolos/core";

import { apiGet } from "../api/client";

export async function fetchStats(): Promise<StatsResponse | undefined> {
  return await apiGet(
    "/stats",
    statsResponseSchema,
    "stats fetch skipped, the screen keeps the zero state",
  );
}

export async function fetchStatsCalendar(): Promise<
  StatsCalendarResponse | undefined
> {
  return await apiGet(
    "/stats/calendar",
    statsCalendarResponseSchema,
    "stats calendar fetch skipped, the screen keeps the zero state",
  );
}

export async function fetchFullDays(): Promise<FullDaysResponse | undefined> {
  return await apiGet(
    "/stats/full-days",
    fullDaysResponseSchema,
    "full days fetch skipped, the screen shows no Dias Cheios",
  );
}

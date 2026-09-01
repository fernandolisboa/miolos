import {
  statsCalendarResponseSchema,
  statsResponseSchema,
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

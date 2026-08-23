"use client";

import type { StatsCalendarResponse } from "@miolos/core";

import { useMountFetch } from "../api/use-mount-fetch";
import { fetchStatsCalendar } from "./stats-client";

export function useStatsCalendar(): StatsCalendarResponse | null | undefined {
  return useMountFetch(fetchStatsCalendar);
}

"use client";

import type { StatsCalendarResponse } from "@miolos/core";
import { useEffect, useState } from "react";

import { fetchStatsCalendar } from "./stats-client";

/**
 * The mount-time calendar read (#29) — `use-stats.ts`'s twin over
 * GET /stats/calendar, with the same three honest states: `undefined`
 * unsettled, `null` settled without a value (the stats screen renders the
 * neutral current month), or the server's full enumeration. One consumer:
 * the stats screen (plan 033 D4).
 */
export function useStatsCalendar(): StatsCalendarResponse | null | undefined {
  const [value, setValue] = useState<StatsCalendarResponse | null | undefined>(
    undefined,
  );

  useEffect(() => {
    // The effect-scoped flag makes React 19 strict-mode double effects and
    // out-of-order resolutions harmless: the duplicate GET is idempotent
    // and cheap, and only the live effect's answer lands.
    let cancelled = false;
    void fetchStatsCalendar().then((response) => {
      if (!cancelled) {
        setValue(response ?? null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return value;
}

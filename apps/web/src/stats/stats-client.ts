import {
  statsCalendarResponseSchema,
  statsResponseSchema,
  type StatsCalendarResponse,
  type StatsResponse,
} from "@miolos/core";

/**
 * The client half of GET /stats and GET /stats/calendar (#29, ADR-0051,
 * plan 033 §6.1) — fetch and parse only, no React, so it is testable
 * without rendering. Every value is SERVER-computed: nothing here reads a
 * clock, a play record or storage, and every failure path answers
 * `undefined` so the UI keeps the honest zero state (ADR-0031 decision 6:
 * device state can never back a statistic).
 *
 * BEHIND THE FREE-PLAY WALL: this module and its sibling hooks are banned
 * from apps/web/src/free-play and app/modo-livre by name
 * (eslint.config.mjs, ADR-0046) — free play never touches the statistics.
 */
export async function fetchStats(): Promise<StatsResponse | undefined> {
  // Loud, not silent (the session/bootstrap.ts guard): without the var the
  // fetch would hit the relative URL "undefined/stats" and the catch below
  // would swallow the misconfiguration forever.
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    console.error(
      "NEXT_PUBLIC_API_URL is unset: stats fetch skipped, the screen keeps the zero state",
    );
    return undefined;
  }
  try {
    // No custom headers: a credentialed GET stays a CORS simple request,
    // so the read never preflights (the same Fetch-spec reasoning the
    // body-less session POST records).
    const response = await fetch(`${apiUrl}/stats`, {
      credentials: "include",
    });
    if (!response.ok) {
      // A 401 is a normal answer (cold visitor mid-mint), not an error to
      // surface — the zero state is the honest reading either way.
      return undefined;
    }
    // Parsed, never cast (boundary rule) — the same strict schema the
    // route parsed before sending.
    const parsed = statsResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : undefined;
  } catch {
    // Swallow network errors: an offline screen must not break.
    return undefined;
  }
}

export async function fetchStatsCalendar(): Promise<
  StatsCalendarResponse | undefined
> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    console.error(
      "NEXT_PUBLIC_API_URL is unset: stats calendar fetch skipped, the screen keeps the zero state",
    );
    return undefined;
  }
  try {
    const response = await fetch(`${apiUrl}/stats/calendar`, {
      credentials: "include",
    });
    if (!response.ok) {
      return undefined;
    }
    const parsed = statsCalendarResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

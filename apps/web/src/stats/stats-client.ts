import {
  statsCalendarResponseSchema,
  statsResponseSchema,
  type StatsCalendarResponse,
  type StatsResponse,
} from "@miolos/core";

export async function fetchStats(): Promise<StatsResponse | undefined> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    console.error(
      "NEXT_PUBLIC_API_URL is unset: stats fetch skipped, the screen keeps the zero state",
    );
    return undefined;
  }
  try {
    const response = await fetch(`${apiUrl}/stats`, {
      credentials: "include",
    });
    if (!response.ok) {
      return undefined;
    }

    const parsed = statsResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : undefined;
  } catch {
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

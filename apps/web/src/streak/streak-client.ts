import { streakResponseSchema, type StreakResponse } from "@miolos/core";

import { apiGet } from "../api/client";

export async function fetchStreak(): Promise<StreakResponse | undefined> {
  return await apiGet(
    "/streak",
    streakResponseSchema,
    "streak fetch skipped, the hub keeps the zero state",
  );
}

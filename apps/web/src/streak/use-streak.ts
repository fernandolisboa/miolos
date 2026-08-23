"use client";

import type { StreakResponse } from "@miolos/core";

import { useMountFetch } from "../api/use-mount-fetch";
import { fetchStreak } from "./streak-client";

export function useStreak(): StreakResponse | null | undefined {
  return useMountFetch(fetchStreak);
}

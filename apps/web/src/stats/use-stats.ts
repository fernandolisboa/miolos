"use client";

import type { StatsResponse } from "@miolos/core";

import { useMountFetch } from "../api/use-mount-fetch";
import { fetchStats } from "./stats-client";

export function useStats(): StatsResponse | null | undefined {
  return useMountFetch(fetchStats);
}

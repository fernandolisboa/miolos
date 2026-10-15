"use client";

import type { FullDaysResponse } from "@miolos/core";

import { useMountFetch } from "../api/use-mount-fetch";
import { fetchFullDays } from "./stats-client";

export function useFullDays(): FullDaysResponse | null | undefined {
  return useMountFetch(fetchFullDays);
}

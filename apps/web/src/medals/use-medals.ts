"use client";

import type { MedalsResponse } from "@miolos/core";

import { useMountFetch } from "../api/use-mount-fetch";
import { fetchMedals } from "./medals-client";

export function useMedals(): MedalsResponse | null | undefined {
  return useMountFetch(fetchMedals);
}

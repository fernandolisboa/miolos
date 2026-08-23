"use client";

import type { OnboardingStateResponse } from "@miolos/core";

import { useMountFetch } from "../api/use-mount-fetch";
import { fetchOnboardingState } from "./onboarding-client";

export function useOnboardingState():
  OnboardingStateResponse | null | undefined {
  return useMountFetch(fetchOnboardingState);
}

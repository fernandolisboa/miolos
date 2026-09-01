import {
  onboardingStateResponseSchema,
  type OnboardingStateResponse,
} from "@miolos/core";

import { apiGet, apiPost } from "../api/client";

const ABSENCE = "onboarding calls skipped, the card stays absent";

export async function fetchOnboardingState(): Promise<
  OnboardingStateResponse | undefined
> {
  return await apiGet(
    "/onboarding/state",
    onboardingStateResponseSchema,
    ABSENCE,
  );
}

export async function markOnboardingSeen(): Promise<boolean> {
  return await apiPost("/onboarding/seen", {}, ABSENCE);
}

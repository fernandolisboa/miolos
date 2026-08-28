import {
  onboardingStateResponseSchema,
  type OnboardingStateResponse,
} from "@miolos/core";

function apiUrl(): string | undefined {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) {
    console.error(
      "NEXT_PUBLIC_API_URL is unset: onboarding calls skipped, the card stays absent",
    );
    return undefined;
  }
  return url;
}

export async function fetchOnboardingState(): Promise<
  OnboardingStateResponse | undefined
> {
  const base = apiUrl();
  if (!base) {
    return undefined;
  }
  try {
    const response = await fetch(`${base}/onboarding/state`, {
      credentials: "include",
    });
    if (!response.ok) {
      return undefined;
    }
    const parsed = onboardingStateResponseSchema.safeParse(
      await response.json(),
    );
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

export async function markOnboardingSeen(): Promise<boolean> {
  const base = apiUrl();
  if (!base) {
    return false;
  }
  try {
    const response = await fetch(`${base}/onboarding/seen`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    return response.ok;
  } catch {
    return false;
  }
}

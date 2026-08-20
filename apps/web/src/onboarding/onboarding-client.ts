import {
  onboardingStateResponseSchema,
  type OnboardingStateResponse,
} from "@miolos/core";

/**
 * The client half of the onboarding endpoints (#35, ADR-0061) — fetch and
 * parse only, no React, so it is testable without rendering. The
 * attach-client posture throughout: `NEXT_PUBLIC_API_URL`,
 * `credentials: "include"`, an explicit JSON content type on the write
 * (deliberately triggering the CORS preflight, so the WEB_ORIGIN grant is
 * load-bearing), and STRICT parsing of the read's response body.
 *
 * Failures resolve to `undefined` (the streak-client rule): an unreachable
 * server must never nag, so the card simply stays absent on that visit and
 * appears on the next one.
 *
 * BEHIND THE FREE-PLAY WALL: this module and its siblings are banned from
 * apps/web/src/free-play and app/modo-livre by name (eslint.config.mjs) —
 * free play never touches identity.
 */

function apiUrl(): string | undefined {
  // Loud, not silent (the session/bootstrap.ts guard): without the var the
  // fetch would hit "undefined/…" and the catch would swallow the
  // misconfiguration forever.
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) {
    console.error(
      "NEXT_PUBLIC_API_URL is unset: onboarding calls skipped, the card stays absent",
    );
    return undefined;
  }
  return url;
}

/** GET /onboarding/state — a CORS simple request, never preflighted. */
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

/** POST /onboarding/seen — the strict empty body; `true` when stamped. */
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

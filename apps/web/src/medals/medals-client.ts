import { medalsResponseSchema, type MedalsResponse } from "@miolos/core";

/**
 * The client half of GET /medals (#30, ADR-0052) — fetch and parse only,
 * no React, so it is testable without rendering. Every value is
 * SERVER-computed: nothing here reads a clock, a play record or storage,
 * and every failure path answers `undefined` so the UI keeps the honest
 * zero state (ADR-0031 decision 6: device state can never back a medal).
 *
 * BEHIND THE FREE-PLAY WALL: this module and its sibling hook are banned
 * from apps/web/src/free-play and app/modo-livre by name
 * (eslint.config.mjs, ADR-0046) — free play never touches the medals.
 */
export async function fetchMedals(): Promise<MedalsResponse | undefined> {
  // Loud, not silent (the session/bootstrap.ts guard): without the var the
  // fetch would hit the relative URL "undefined/medals" and the catch below
  // would swallow the misconfiguration forever.
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    console.error(
      "NEXT_PUBLIC_API_URL is unset: medals fetch skipped, the screen keeps the zero state",
    );
    return undefined;
  }
  try {
    // No custom headers: a credentialed GET stays a CORS simple request,
    // so the read never preflights (the same Fetch-spec reasoning the
    // body-less session POST records).
    const response = await fetch(`${apiUrl}/medals`, {
      credentials: "include",
    });
    if (!response.ok) {
      // A 401 is a normal answer (cold visitor mid-mint), not an error to
      // surface — the zero state is the honest reading either way.
      return undefined;
    }
    // Parsed, never cast (boundary rule) — the same strict schema the
    // route parsed before sending. A shape-valid UNKNOWN id passes on
    // purpose (the skew posture, ADR-0052): ids are validated by shape,
    // not enum, and the drop-unknown rule fires at render — so a user's
    // medal history never disappears on deploy skew.
    const parsed = medalsResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : undefined;
  } catch {
    // Swallow network errors: an offline screen must not break.
    return undefined;
  }
}

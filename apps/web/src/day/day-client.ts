import { dayResponseSchema, type DayResponse } from "@miolos/core";

/**
 * The client half of GET /day (#83, ADR-0060) — fetch and parse only, no
 * React, so it is testable without rendering.
 *
 * EVERY FAILURE PATH ANSWERS `undefined`, and `undefined` means "no server
 * truth, for any reason" — the caller falls back to the device's own
 * projection, which is ADR-0031 decision 1's first fact and the reason a
 * conclusion can finish offline at all. NOTHING ON A PLAY PATH AWAITS THIS
 * FETCH.
 */
export async function fetchDayTruth(): Promise<DayResponse | undefined> {
  // Loud, not silent (the session/bootstrap.ts guard): without the var the
  // fetch would hit the relative URL "undefined/day" and the catch below
  // would swallow the misconfiguration forever.
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    console.error(
      "NEXT_PUBLIC_API_URL is unset: day fetch skipped, the hub keeps this device's own day state",
    );
    return undefined;
  }
  try {
    // No custom headers: a credentialed GET stays a CORS simple request, so
    // the read never preflights (the same Fetch-spec reasoning the
    // body-less session POST records). No parameters either — the user is
    // the cookie and the day is the DB clock (ADR-0060 decision 1).
    const response = await fetch(`${apiUrl}/day`, {
      credentials: "include",
    });
    if (!response.ok) {
      // A 401 is a normal answer (cold visitor mid-mint), not an error to
      // surface — the device's own day state is the honest reading either
      // way, and it is never blank.
      return undefined;
    }
    const parsed = dayResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : undefined;
  } catch {
    // Swallow network errors: an offline hub must not break, it reads what
    // this device knows.
    return undefined;
  }
}

/**
 * Anonymous-identity bootstrap (issue #15), extracted from
 * `components/session-bootstrap.tsx` so the completion flush can await the
 * same mint (plan 017 §9.2). Without that ordering, a fast solve on a cold
 * first visit reliably races the in-flight mint and takes the 401 branch.
 *
 * No `Date` appears here or in anything it calls — the client clock is
 * never an identity input (#15 AC 5).
 */
import { sessionResponseSchema } from "@miolos/core";

// Module-level fire-once guard, now a SHARED PROMISE rather than a boolean:
// callers need to await the mint, not merely skip it. Survives React
// StrictMode's double effect and re-mounts, so one page load makes exactly
// one mint/resolve request (plan 009 D11 — the client half of the
// concurrency story).
let pending: Promise<void> | undefined;

/**
 * Resolve (or mint) the anonymous session, once per page load. Never
 * rejects: an offline first paint must not break the page, and every
 * caller treats "no session" as a retryable state rather than an error.
 *
 * `force` exists for exactly one caller — the completion flush, which
 * re-mints once after a 401 (plan 017 §9.2). A 401 means the cookie the
 * first mint produced is gone or expired, so returning the cached promise
 * would retry the same failure forever.
 */
export function ensureSession(options?: {
  readonly force?: boolean;
}): Promise<void> {
  if (options?.force === true || pending === undefined) {
    pending = mintSession();
  }
  return pending;
}

async function mintSession(): Promise<void> {
  // Loud, not silent: without the var the fetch would hit the relative URL
  // "undefined/session" and the catch below would swallow the failure —
  // identity would never mint on a misconfigured build.
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    console.error(
      "NEXT_PUBLIC_API_URL is unset: session bootstrap skipped, no identity will be minted",
    );
    return;
  }
  try {
    // Deliberately body-less: the POST stays a CORS "simple request", so
    // the hot path needs no preflight.
    const response = await fetch(`${apiUrl}/session`, {
      method: "POST",
      credentials: "include",
    });
    if (!response.ok) {
      return;
    }
    // Parsed, never cast (boundary rule). The result is unused today —
    // the cookie is the identity; the body only proves the contract.
    sessionResponseSchema.parse(await response.json());
  } catch {
    // Swallow network errors: an offline first paint must not break the
    // page. The next visit simply tries again.
  }
}

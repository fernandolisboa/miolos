"use client";

import { sessionResponseSchema } from "@miolos/core";
import { useEffect } from "react";

// Module-level fire-once guard: survives React StrictMode's double effect
// and re-mounts, so one page load makes exactly one mint/resolve request
// (plan 009 D11 — the client half of the concurrency story).
let fired = false;

/**
 * Fire-once anonymous-identity bootstrap (issue #15). Renders nothing; on
 * first mount it POSTs to the api so the very first visit mints a user with
 * zero interaction and every later visit slides the session window. No
 * `Date` appears here or in anything it calls — the client clock is never
 * an identity input (AC 5).
 */
export function SessionBootstrap() {
  useEffect(() => {
    if (fired) {
      return;
    }
    fired = true;
    void bootstrapSession();
  }, []);
  return null;
}

async function bootstrapSession(): Promise<void> {
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

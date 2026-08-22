import { magicLinkBody, magicLinkSubject } from "./copy";

// Resend over plain `fetch`, zero new dependencies. This module is the test
// seam: routes import it, tests `vi.mock` it and harvest the raw token from
// the mocked call's URL to drive the confirm tests. Fail-closed dormancy
// (both `isAttachConfigured` halves) — see ADR-0050 decision 10.

const RESEND_ENDPOINT = "https://api.resend.com/emails";

// Module-private: bound to the Resend-verified sending domain, so a literal
// rather than env (ADR-0050 decision 10) — no other module names it.
const MAGIC_LINK_SENDER = "Miolos <conta@miolos.app>";

// Resend's own p99 is single-digit seconds; 10 s distinguishes "slow" from
// "gone" without holding the serverless invocation to its own limit.
const SEND_TIMEOUT_MS = 10_000;

/**
 * Read at call time, never cached, so a key added to the environment
 * activates the flow on its next invocation — of a deployment BUILT with
 * it. `apps/api/vercel.json`'s `ignoreCommand: npx turbo-ignore` skips a
 * build with no `apps/api` diff, so an env var added without a real commit
 * silently never lands — see the identical trap documented in
 * src/cron/auth.ts. Runbook: `docs/pending-fernando.md`.
 */
export function isAttachConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY) && Boolean(process.env.WEB_ORIGIN);
}

/**
 * Send the magic link. Throws on any non-2xx AND on the send timeout —
 * the request route maps either throw to `502 email-send-failed`; the
 * already-minted token row simply expires, and a re-request supersedes it.
 */
export async function sendMagicLinkEmail(init: {
  to: string;
  url: string;
}): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    // Unreachable behind the route's own isAttachConfigured() gate; loud
    // rather than silent if a future caller skips it.
    throw new Error("email transport: RESEND_API_KEY is unset");
  }
  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: MAGIC_LINK_SENDER,
      to: [init.to],
      subject: magicLinkSubject,
      text: magicLinkBody(init.url),
    }),
    // A hung Resend must not hang the route: the abort rejects this fetch
    // and surfaces through the same 502 path.
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  });
  if (!response.ok) {
    // No response body in the message: it could echo the address.
    throw new Error(`email transport: Resend answered ${response.status}`);
  }
}

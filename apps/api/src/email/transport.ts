import { magicLinkBody, magicLinkSubject } from "./copy";

/**
 * The email transport (#21, ADR-0050 decision 10): Resend over plain
 * `fetch`, ZERO new dependencies — the hand-rolled-cookie/base64url
 * posture, and the cheapest vulnerability is the dependency never
 * installed. This module is the test seam: routes import it, seam tests
 * `vi.mock("../src/email/transport")` (the `../src/db` idiom, spreading
 * `importOriginal` and overriding only the send) and harvest the raw token
 * from the mocked call's URL to drive the confirm tests.
 *
 * FAIL-CLOSED (the CRON_SECRET posture): the attach flow is dormant unless
 * BOTH halves of its configuration exist — `RESEND_API_KEY` (the send) and
 * `WEB_ORIGIN` (the link target). `isAttachConfigured` below is the ONE
 * dormancy switch, shared by `POST /attach/request` (503 before minting
 * any token) and `GET /attach/state` (reports ineligible), so a
 * half-configured environment can never render a prompt whose submit would
 * 503 (step-7 finding H). Activation is `vercel env add` for both vars —
 * the grantHints posture applied to a flow. The throw below is a
 * belt-and-braces backstop, not the check.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/**
 * The sender identity — the one address this product ever writes from.
 * Module-private on purpose (step-7 finding F): no other module has any
 * business naming it. A literal rather than env (ADR-0050 decision 10):
 * the sender is bound to the Resend-verified sending domain — operational
 * content, not a routable origin, so ADR-0013's env-config rule does not
 * cover it.
 */
const MAGIC_LINK_SENDER = "Miolos <conta@miolos.app>";

/**
 * How long one send may hang before the request route answers: Resend's
 * own p99 is single-digit seconds, so 10 s distinguishes "slow" from
 * "gone" without holding the serverless invocation to its own limit.
 */
const SEND_TIMEOUT_MS = 10_000;

/**
 * The dormancy switch (both halves — see the header): read at call time,
 * never cached, so keys added to the environment activate the flow on the
 * next invocation.
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
    // A hung Resend must not hang the route (step-7 finding J): the abort
    // rejects this fetch and surfaces through the same 502 path.
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  });
  if (!response.ok) {
    // No response body in the message: it could echo the address.
    throw new Error(`email transport: Resend answered ${response.status}`);
  }
}

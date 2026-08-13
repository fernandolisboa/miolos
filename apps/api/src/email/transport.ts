import { magicLinkBody, magicLinkSubject } from "./copy";

/**
 * The email transport (#21, ADR-0050 decision 10): Resend over plain
 * `fetch`, ZERO new dependencies — the hand-rolled-cookie/base64url
 * posture, and the cheapest vulnerability is the dependency never
 * installed. This module is the test seam: routes import it, seam tests
 * `vi.mock("../src/email/transport")` (the `../src/db` idiom) and harvest
 * the raw token from the mocked call's URL to drive the confirm tests.
 *
 * FAIL-CLOSED (the CRON_SECRET posture): `RESEND_API_KEY` unset means the
 * request route answers 503 BEFORE minting any token, and
 * `GET /attach/state` reports ineligible — the whole feature is dormant
 * until `vercel env add RESEND_API_KEY` (the grantHints posture applied to
 * a flow). The throw below is a belt-and-braces backstop, not the check.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/** The sender identity — the one address this product ever writes from. */
export const MAGIC_LINK_SENDER = "Miolos <conta@miolos.app>";

/**
 * The dormancy switch: read at call time, never cached, so a key added to
 * the environment activates the flow on the next invocation.
 */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

/**
 * Send the magic link. Throws on any non-2xx — the request route maps the
 * throw to `502 email-send-failed`; the already-minted token row simply
 * expires, and a re-request supersedes it.
 */
export async function sendMagicLinkEmail(init: {
  to: string;
  url: string;
}): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    // Unreachable behind the route's own isEmailConfigured() gate; loud
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
  });
  if (!response.ok) {
    // No response body in the message: it could echo the address.
    throw new Error(`email transport: Resend answered ${response.status}`);
  }
}

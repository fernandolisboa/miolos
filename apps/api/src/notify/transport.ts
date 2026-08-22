import type { PushNudgePayload } from "@miolos/core";
import { sendNotification, setVapidDetails, WebPushError } from "web-push";

/**
 * The one place the product talks to a push service — `web-push` is the
 * recorded composition-crypto exception, `apps/api` only; `packages/games`
 * stays dependency-free. Injected into the dispatcher as a plain function,
 * so every tick test runs a fake transport with zero `vi.mock`.
 */

/** One send's verdict — never a throw for a send failure. */
export type SendResult = { ok: true } | { ok: false; statusCode?: number };

export type NudgeSend = (
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: PushNudgePayload,
) => Promise<SendResult>;

/**
 * The real transport. VAPID details are read at CALL time, never cached at
 * module load: keys added to the environment activate the next tick, and
 * the route's 503 gate has already guaranteed the triple is present before
 * this runs.
 *
 * TTL 3600 IS A DECISION: web-push's default TTL is four weeks, and a
 * streak nudge delivered tomorrow is worse than none — one hour matches
 * the mechanic's granularity (the next hourly tick would have been the
 * next chance anyway).
 *
 * `WebPushError` is caught and its `statusCode` surfaced — the dispatcher
 * prunes on 404/410 and counts anything else as `failed`. A non-WebPushError
 * throw (DNS, TLS, a broken key) surfaces as `{ok: false}` with no status:
 * the row stays, the claim stands.
 */
export const sendWebPush: NudgeSend = async (subscription, payload) => {
  // Non-null assertions are avoided on purpose: the route 503s before this
  // path when any of the triple is missing, but a fail-closed re-check
  // costs one comparison and keeps this module safe to call from anywhere.
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) {
    return { ok: false };
  }
  try {
    setVapidDetails(subject, publicKey, privateKey);
    await sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload),
      { TTL: 3600 },
    );
    return { ok: true };
  } catch (thrown) {
    if (thrown instanceof WebPushError) {
      return { ok: false, statusCode: thrown.statusCode };
    }
    return { ok: false };
  }
};

/**
 * The push dormancy switch — the `isAttachConfigured` posture: read at
 * call time, never cached, so keys added to the environment activate the
 * flow on the next invocation. Shared by `POST`/`DELETE
 * /push/subscriptions` (503 before any side effect) and
 * `GET /notifications/state` (reports ineligible with a null key), so a
 * half-configured environment never renders a prompt whose accept would
 * fail.
 *
 * FAIL-CLOSED over the full triple even though the current caller uses
 * only the public key: a half-configured environment must not collect
 * subscriptions the dispatcher can never serve. Activation is
 * `vercel env add` for all three vars.
 *
 * See ADR-0064.
 */
export function isPushConfigured(): boolean {
  return (
    Boolean(process.env.VAPID_PUBLIC_KEY) &&
    Boolean(process.env.VAPID_PRIVATE_KEY) &&
    Boolean(process.env.VAPID_SUBJECT)
  );
}

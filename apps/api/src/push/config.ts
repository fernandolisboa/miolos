/**
 * The push dormancy switch (#145, ADR-0064) — the `isAttachConfigured`
 * posture verbatim: read at call time, never cached, so keys added to the
 * environment activate the flow on the next invocation. Shared by
 * `POST`/`DELETE /push/subscriptions` (503 before any side effect) and
 * `GET /notifications/state` (reports ineligible with a null key), so a
 * half-configured environment never renders a prompt whose accept would
 * fail (the attach flow's step-7 finding H, inherited).
 *
 * FAIL-CLOSED over the full triple even though slice A uses only the
 * public key: a half-configured environment must not collect subscriptions
 * the dispatcher (#146) can never serve. Activation is `vercel env add`
 * for all three vars — the checklist lives in #145's PR body.
 */
export function isPushConfigured(): boolean {
  return (
    Boolean(process.env.VAPID_PUBLIC_KEY) &&
    Boolean(process.env.VAPID_PRIVATE_KEY) &&
    Boolean(process.env.VAPID_SUBJECT)
  );
}

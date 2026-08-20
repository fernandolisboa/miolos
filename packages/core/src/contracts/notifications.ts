import { z } from "zod";

/**
 * The notification contracts (#145, ADR-0064; the #32 shape §2): the push
 * opt-in's server-owned eligibility, the subscription writes, and the
 * prompt's one permanent dismissal — the onboarding.ts register throughout.
 *
 * Every schema here is STRICT ON BOTH ENDS (the streak.ts register): the
 * routes parse before `Response.json`, and the web client strict-parses the
 * GET's body (the write clients read only `response.ok` and discard the
 * body — the dismissAttachPrompt precedent). So future payload growth MUST
 * arrive as a new endpoint and contract — an appended field would fail
 * every deployed client's parse (ADR-0048's rule).
 */

/**
 * Response of GET /notifications/state — one derived boolean plus the VAPID
 * public key, which is non-null iff push is configured (`isPushConfigured`,
 * the full triple — a half-configured environment never renders a prompt
 * whose accept would fail). The key is public by design and has ONE source
 * of truth, the api env — no `NEXT_PUBLIC_` twin in apps/web to drift.
 * `eligible` is the prompt gate; the threshold itself never ships to the
 * client (ADR-0048's rule, the attach-state posture).
 */
export const notificationsStateResponseSchema = z.strictObject({
  eligible: z.boolean(),
  vapidPublicKey: z.string().nullable(),
});
export type NotificationsStateResponse = z.infer<
  typeof notificationsStateResponseSchema
>;

/**
 * Body of POST /push/subscriptions — the browser's own `PushSubscription`
 * as JSON, narrowed to exactly what the dispatcher needs (RFC 8291's two
 * client keys plus the capability URL). `z.url()` is the zod-4 top-level
 * form (`z.string().url()` is the deprecated zod-3 idiom); the URL-shape
 * check is load-bearing — a non-URL endpoint is a row #146 can never send
 * to, so it is a 400 here, not a stored dud.
 */
export const pushSubscribeSchema = z.strictObject({
  endpoint: z.url(),
  keys: z.strictObject({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});
export type PushSubscribeRequest = z.infer<typeof pushSubscribeSchema>;

export const pushSubscribeResponseSchema = z.strictObject({
  subscribed: z.literal(true),
});
export type PushSubscribeResponse = z.infer<typeof pushSubscribeResponseSchema>;

/** Body of DELETE /push/subscriptions — own rows only, idempotent. */
export const pushUnsubscribeSchema = z.strictObject({
  endpoint: z.url(),
});
export type PushUnsubscribeRequest = z.infer<typeof pushUnsubscribeSchema>;

export const pushUnsubscribeResponseSchema = z.strictObject({
  removed: z.literal(true),
});
export type PushUnsubscribeResponse = z.infer<
  typeof pushUnsubscribeResponseSchema
>;

/**
 * Body of POST /notifications/dismiss — the strict EMPTY object (the
 * onboardingSeenSchema shape): the client posts a literal `{}` and any key
 * is a 400. The stamp is permanent — decline and browser denial both land
 * here, once per account (the attach-prompt lifecycle).
 */
export const notificationsDismissSchema = z.strictObject({});
export type NotificationsDismissRequest = z.infer<
  typeof notificationsDismissSchema
>;

export const notificationsDismissResponseSchema = z.strictObject({
  dismissed: z.literal(true),
});
export type NotificationsDismissResponse = z.infer<
  typeof notificationsDismissResponseSchema
>;

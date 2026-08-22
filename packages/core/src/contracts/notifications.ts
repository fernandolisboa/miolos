import { z } from "zod";

/**
 * The notification contracts (ADR-0064): the push opt-in's server-owned
 * eligibility, the subscription writes, and the prompt's one permanent
 * dismissal.
 *
 * Every schema here is strict on both ends (the streak.ts register): the
 * routes parse before `Response.json`, and the web client strict-parses the
 * GET's body, so future payload growth must arrive as a new endpoint and
 * contract, never an appended field.
 */

/**
 * Response of GET /notifications/state — one derived boolean plus the VAPID
 * public key, which is non-null iff push is configured (`isPushConfigured`'s
 * full triple, so a half-configured environment never renders a prompt
 * whose accept would fail). `eligible` is the prompt gate; the threshold
 * itself never ships to the client.
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
 * client keys plus the capability URL).
 *
 * The endpoint is https-only and every field is capped. Rows written here
 * are the exact input set of the dispatcher, which makes a server-side HTTP
 * request per row — an uncapped `z.url()` would admit
 * `http://169.254.169.254/…`, `file:`, `data:` and `javascript:`, an
 * attacker-written SSRF target list behind an anonymously mintable session.
 * A host allow-list is deliberately not attempted: FCM/Mozilla/Apple/
 * self-hosted endpoints are open-ended. The `.max()`s bound storage and
 * keep an over-long endpoint a 400 here rather than a 500 at the primary
 * key's btree tuple-size limit (`endpoint` is the PK).
 */
export const pushSubscribeSchema = z.strictObject({
  endpoint: z.url({ protocol: /^https$/ }).max(2048),
  keys: z.strictObject({
    p256dh: z.string().min(1).max(128),
    auth: z.string().min(1).max(128),
  }),
});
export type PushSubscribeRequest = z.infer<typeof pushSubscribeSchema>;

export const pushSubscribeResponseSchema = z.strictObject({
  subscribed: z.literal(true),
});
export type PushSubscribeResponse = z.infer<typeof pushSubscribeResponseSchema>;

/**
 * Body of DELETE /push/subscriptions — own rows only, idempotent. The
 * endpoint constraint mirrors the subscribe schema's: a value the POST
 * refuses can never be a stored row, so the DELETE has nothing to
 * reconcile for it either.
 */
export const pushUnsubscribeSchema = z.strictObject({
  endpoint: z.url({ protocol: /^https$/ }).max(2048),
});
export type PushUnsubscribeRequest = z.infer<typeof pushUnsubscribeSchema>;

export const pushUnsubscribeResponseSchema = z.strictObject({
  removed: z.literal(true),
});
export type PushUnsubscribeResponse = z.infer<
  typeof pushUnsubscribeResponseSchema
>;

/**
 * The push nudge payload (ADR-0064 decision 6): exactly the two keys
 * `apps/web/public/sw.js` reads, both non-empty, nothing else. No puzzle
 * content, ever — the body carries the streak number and pt-BR copy only.
 */
export const pushNudgePayloadSchema = z.strictObject({
  title: z.string().min(1),
  body: z.string().min(1),
});
export type PushNudgePayload = z.infer<typeof pushNudgePayloadSchema>;

/**
 * Body of POST /notifications/dismiss — the strict empty object: the client
 * posts a literal `{}` and any key is a 400. The stamp is permanent —
 * decline and browser denial both land here, once per account.
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

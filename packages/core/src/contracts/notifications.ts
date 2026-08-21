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
 *
 * THE ENDPOINT IS `https` ONLY, AND EVERY FIELD IS CAPPED (#145 step-6
 * security 1/2). Rows written here are the exact input set of #146's
 * dispatcher, which makes a server-side HTTP request per row — an
 * uncapped `z.url()` admits `http://169.254.169.254/…`, `file:`, `data:`
 * and `javascript:`, i.e. an attacker-written SSRF target list behind an
 * anonymously mintable session. A browser push service is always https,
 * so the scheme floor rejects nothing real. A host allow-list is
 * deliberately NOT attempted: FCM/Mozilla/Apple/self-hosted endpoints are
 * open-ended. The `.max()`s bound storage and keep an over-long endpoint a
 * 400 at this boundary rather than a 500 at the btree PK's ~2704-byte
 * tuple limit; real values are far under them (a p256dh is ~88 base64url
 * chars, an auth ~22).
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
 * endpoint constraint mirrors the subscribe schema's, for symmetry: a
 * value the POST refuses can never be a stored row, so the DELETE has
 * nothing to reconcile for it either.
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
 * The push nudge payload (#146, ADR-0064 decision 6): exactly the two keys
 * `apps/web/public/sw.js` reads, both non-empty, nothing else — parsed by
 * the dispatcher BEFORE stringify (Zod at the boundary), so a malformed
 * composition can never reach a push service. No puzzle content, ever: the
 * body carries the streak number (from `computeStreak`, the only streak
 * authority) and pt-BR copy, and nothing about any puzzle. This is the
 * shipped shape the `pushSubscribeSchema` comment above points at — the
 * dispatcher is live, no longer a forward reference.
 */
export const pushNudgePayloadSchema = z.strictObject({
  title: z.string().min(1),
  body: z.string().min(1),
});
export type PushNudgePayload = z.infer<typeof pushNudgePayloadSchema>;

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

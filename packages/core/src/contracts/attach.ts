import { z } from "zod";

/**
 * The attach contracts (ADR-0050): one magic-link flow — request/confirm —
 * that serves attach, recovery, device move and merge-on-collision, plus the
 * prompt's server-owned eligibility and dismissal.
 *
 * Every schema here is strict on both ends (the streak.ts register): the
 * route parses before `Response.json` and the web client parses what it
 * receives, so future payload growth must arrive as a new endpoint and
 * contract, never an appended field.
 */

/**
 * Normalization IS the boundary (ADR-0050 decision 6): trim + lowercase
 * before validating the shape, so every email that reaches an
 * `attach_tokens` row or a `users` row is already canonical. 254 is RFC
 * 5321's practical address ceiling.
 */
export const attachEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email());

/**
 * Body of POST /attach/request. `recoveryConsent` is a literal `true` —
 * attaching IS the recovery consent, so a request without it is a 400,
 * never a defaulted value. `reminderConsent` has no default: the client
 * states the choice explicitly.
 */
export const attachRequestSchema = z.strictObject({
  email: attachEmailSchema,
  recoveryConsent: z.literal(true),
  reminderConsent: z.boolean(),
});
export type AttachRequest = z.infer<typeof attachRequestSchema>;

export const attachRequestResponseSchema = z.strictObject({
  sent: z.literal(true),
});
export type AttachRequestResponse = z.infer<typeof attachRequestResponseSchema>;

/**
 * Body of POST /attach/confirm — exactly the token, nothing else: both
 * merge ids derive from the token row and the verified-holder lookup, never
 * from the request. The shape is the session-token generator's own output:
 * 32 bytes, base64url, 43 chars, no padding.
 */
export const attachConfirmSchema = z.strictObject({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
});
export type AttachConfirmRequest = z.infer<typeof attachConfirmSchema>;

export const attachConfirmResponseSchema = z.strictObject({
  merged: z.boolean(),
});
export type AttachConfirmResponse = z.infer<typeof attachConfirmResponseSchema>;

/**
 * Body of GET /attach/state — one boolean (ADR-0050 decision 9): the
 * threshold never ships to the client, the streak is not duplicated here
 * (GET /streak already serves it), and the island stays a dumb renderer of
 * a server-owned decision.
 */
export const attachStateResponseSchema = z.strictObject({
  eligible: z.boolean(),
});
export type AttachStateResponse = z.infer<typeof attachStateResponseSchema>;

/** Body of POST /attach/dismiss — the strict empty object: the client posts
 *  a literal `{}` and any key is a 400. */
export const attachDismissSchema = z.strictObject({});
export type AttachDismissRequest = z.infer<typeof attachDismissSchema>;

export const attachDismissResponseSchema = z.strictObject({
  dismissed: z.literal(true),
});
export type AttachDismissResponse = z.infer<typeof attachDismissResponseSchema>;

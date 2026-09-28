import { z } from "zod";

export const googleTokenResponseSchema = z.object({ id_token: z.string() });

export const googleIdTokenClaimsSchema = z.object({
  iss: z.enum(["https://accounts.google.com", "accounts.google.com"]),
  aud: z.string(),
  exp: z.number(),
  sub: z.string().min(1).max(255),
});

export const googleCallbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

export const googleSignInOutcomeSchema = z.enum([
  "ok",
  "switched",
  "failed",
  "conflict",
]);
export type GoogleSignInOutcome = z.infer<typeof googleSignInOutcomeSchema>;

export const accountGoogleResponseSchema = z.strictObject({
  google: z.enum(["unavailable", "unlinked", "linked"]),
});
export type AccountGoogleResponse = z.infer<typeof accountGoogleResponseSchema>;

export const accountUnlinkGoogleSchema = z.strictObject({
  confirm: z.literal(true),
});
export type AccountUnlinkGoogleRequest = z.infer<
  typeof accountUnlinkGoogleSchema
>;

export const accountUnlinkGoogleResponseSchema = z.strictObject({
  unlinked: z.literal(true),
});
export type AccountUnlinkGoogleResponse = z.infer<
  typeof accountUnlinkGoogleResponseSchema
>;

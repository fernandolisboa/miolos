import { z } from "zod";

export const attachEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email());

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

export const attachConfirmSchema = z.strictObject({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
});
export type AttachConfirmRequest = z.infer<typeof attachConfirmSchema>;

export const attachConfirmResponseSchema = z.strictObject({
  merged: z.boolean(),
});
export type AttachConfirmResponse = z.infer<typeof attachConfirmResponseSchema>;

export const attachStateResponseSchema = z.strictObject({
  eligible: z.boolean(),
});
export type AttachStateResponse = z.infer<typeof attachStateResponseSchema>;

export const attachDismissSchema = z.strictObject({});
export type AttachDismissRequest = z.infer<typeof attachDismissSchema>;

export const attachDismissResponseSchema = z.strictObject({
  dismissed: z.literal(true),
});
export type AttachDismissResponse = z.infer<typeof attachDismissResponseSchema>;

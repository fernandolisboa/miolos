import { z } from "zod";

export const accountDeleteSchema = z.strictObject({
  confirm: z.literal(true),
});
export type AccountDeleteRequest = z.infer<typeof accountDeleteSchema>;

export const accountDeleteResponseSchema = z.strictObject({
  deleted: z.literal(true),
});
export type AccountDeleteResponse = z.infer<typeof accountDeleteResponseSchema>;

export const accountStateResponseSchema = z.strictObject({
  email: z.string().nullable(),
  reminderConsent: z.boolean(),
});
export type AccountStateResponse = z.infer<typeof accountStateResponseSchema>;

export const reminderConsentSchema = z.strictObject({
  granted: z.boolean(),
});
export type ReminderConsentRequest = z.infer<typeof reminderConsentSchema>;

export const reminderConsentResponseSchema = z.strictObject({
  reminderConsent: z.boolean(),
});
export type ReminderConsentResponse = z.infer<
  typeof reminderConsentResponseSchema
>;

export const accountDetachEmailSchema = z.strictObject({
  confirm: z.literal(true),
});
export type AccountDetachEmailRequest = z.infer<
  typeof accountDetachEmailSchema
>;

export const accountDetachEmailResponseSchema = z.strictObject({
  detached: z.literal(true),
});
export type AccountDetachEmailResponse = z.infer<
  typeof accountDetachEmailResponseSchema
>;

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

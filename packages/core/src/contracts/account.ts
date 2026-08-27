import { z } from "zod";

export const accountDeleteSchema = z.strictObject({
  confirm: z.literal(true),
});
export type AccountDeleteRequest = z.infer<typeof accountDeleteSchema>;

export const accountDeleteResponseSchema = z.strictObject({
  deleted: z.literal(true),
});
export type AccountDeleteResponse = z.infer<typeof accountDeleteResponseSchema>;

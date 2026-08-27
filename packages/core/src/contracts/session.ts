import { z } from "zod";

export const sessionResponseSchema = z.object({
  userId: z.uuid(),
  created: z.boolean(),
});

export type SessionResponse = z.infer<typeof sessionResponseSchema>;

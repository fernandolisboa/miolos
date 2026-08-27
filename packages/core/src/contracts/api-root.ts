import { z } from "zod";

export const apiRootResponseSchema = z.object({
  service: z.literal("api"),
});

export type ApiRootResponse = z.infer<typeof apiRootResponseSchema>;

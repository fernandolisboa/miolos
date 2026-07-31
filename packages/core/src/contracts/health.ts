import { z } from "zod";

/**
 * First API boundary contract (`src/contracts/` is the home of all Zod
 * boundary schemas). The api route parses its response with this schema
 * before responding; the api integration test parses with the same schema.
 */
export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("api"),
  timestamp: z.iso.datetime(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

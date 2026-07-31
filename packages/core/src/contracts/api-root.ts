import { z } from "zod";

/**
 * Boundary contract for the api root (`GET /`). Minimal on purpose: the
 * route only identifies the service. The api route parses its response
 * with this schema before responding; the api integration test parses
 * with the same schema.
 */
export const apiRootResponseSchema = z.object({
  service: z.literal("api"),
});

export type ApiRootResponse = z.infer<typeof apiRootResponseSchema>;

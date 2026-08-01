import { z } from "zod";

/**
 * Boundary contract for POST /session (issue #15, ADR-0022). The caller
 * learns its own id and whether this call minted — nothing else. No
 * timestamps and no internal columns leak, and the request has no schema
 * at all: the endpoint accepts no body, so no time or identity input
 * exists at this boundary (AC 5).
 */
export const sessionResponseSchema = z.object({
  userId: z.uuid(),
  created: z.boolean(),
});

export type SessionResponse = z.infer<typeof sessionResponseSchema>;

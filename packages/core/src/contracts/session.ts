import { z } from "zod";

/**
 * Boundary contract for POST /session (ADR-0022). The caller learns its own
 * id and whether this call minted — nothing else. The endpoint accepts no
 * body, so no time or identity input exists at this boundary.
 */
export const sessionResponseSchema = z.object({
  userId: z.uuid(),
  created: z.boolean(),
});

export type SessionResponse = z.infer<typeof sessionResponseSchema>;

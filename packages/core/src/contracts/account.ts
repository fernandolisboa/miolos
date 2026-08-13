import { z } from "zod";

/**
 * The account-deletion contract (#21, ADR-0050 decision 12): real,
 * immediate, self-service deletion — the LGPD path the /privacidade page
 * hosts. Strict on both ends (the streak.ts register; ADR-0048's rule):
 * growth is a new endpoint and contract, never an appended field.
 */

/**
 * Body of POST /account/delete. The literal `confirm: true` is a
 * deliberate second factor against drive-by fetches: the UI's two-step
 * confirm supplies it, and nothing else may.
 */
export const accountDeleteSchema = z.strictObject({
  confirm: z.literal(true),
});
export type AccountDeleteRequest = z.infer<typeof accountDeleteSchema>;

export const accountDeleteResponseSchema = z.strictObject({
  deleted: z.literal(true),
});
export type AccountDeleteResponse = z.infer<typeof accountDeleteResponseSchema>;

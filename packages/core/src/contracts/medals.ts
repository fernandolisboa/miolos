import { z } from "zod";

/** A wire medal id — validated by SHAPE (the DB CHECK's slug grammar),
 *  never by enum (ADR-0052): the id SET is content, and content growth
 *  must be additive. ADR-0048 decision 3 protects the SHAPE — new
 *  keys/fields are a new contract, and the object below stays strict on
 *  keys — but it does not close a value set. An old client hit with a
 *  newly-added id parses fine and silently drops the unknown id at
 *  render (the drop-unknown rule, ADR-0052's honesty mechanism): a
 *  user's medal history never disappears on deploy skew. */
export const medalIdSchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  .max(64);

/** Body of GET /medals — the earned id set ONLY (ADR-0051 decision 3's
 *  "own endpoint and contract"; ADR-0052). Strict on keys on both ends.
 *  No names/descriptions on the wire: the client owns them (medalCopy).
 *  No earnedDate: the row renders name + description only, and for a
 *  late-counted feat the honest earning day is structurally unavailable
 *  (StatsRow carries no completedAt) — so no date field exists to lie
 *  (ADR-0052 hands the projection decision forward in writing). The
 *  array cap is a sanity bound deliberately DECOUPLED from the catalog
 *  length — coupling it would recreate the deploy-skew break the shape
 *  validation exists to avoid. Empty array = zero earned — a real,
 *  honest answer (D8 renders nothing). */
export const medalsResponseSchema = z.strictObject({
  medals: z
    .array(medalIdSchema)
    .max(64)
    .refine((medals) => new Set(medals).size === medals.length, {
      message: "duplicate medal id",
    }),
});
export type MedalsResponse = z.infer<typeof medalsResponseSchema>;

import { z } from "zod";

/**
 * A wire medal id — validated by shape (the DB CHECK's slug grammar), never
 * by enum (ADR-0052): the id set is content, and content growth must be
 * additive. An old client hit with a newly-added id parses fine and
 * silently drops the unknown id at render — a user's medal history never
 * disappears on deploy skew.
 */
export const medalIdSchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  .max(64);

/**
 * Body of GET /medals — the earned id set only (ADR-0052). Strict on keys
 * on both ends. No names/descriptions on the wire: the client owns them
 * (medalCopy). No earnedDate: for a late-counted feat the honest earning
 * day is structurally unavailable (`StatsRow` carries no `completedAt`), so
 * no date field exists to lie. The array cap is a sanity bound deliberately
 * decoupled from the catalog length — coupling it would recreate the
 * deploy-skew break the shape validation exists to avoid.
 */
export const medalsResponseSchema = z.strictObject({
  medals: z
    .array(medalIdSchema)
    .max(64)
    .refine((medals) => new Set(medals).size === medals.length, {
      message: "duplicate medal id",
    }),
});
export type MedalsResponse = z.infer<typeof medalsResponseSchema>;

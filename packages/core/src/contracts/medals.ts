import { z } from "zod";

export const medalIdSchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  .max(64);

export const medalsResponseSchema = z.strictObject({
  medals: z
    .array(medalIdSchema)
    .max(64)
    .refine((medals) => new Set(medals).size === medals.length, {
      message: "duplicate medal id",
    }),
});
export type MedalsResponse = z.infer<typeof medalsResponseSchema>;

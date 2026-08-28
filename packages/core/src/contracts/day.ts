import { z } from "zod";

import { dayGameStateSchema } from "../day";
import { isoDateString } from "./daily";

export const dayResponseSchema = z.strictObject({
  date: isoDateString,
  games: z.strictObject({
    termo: dayGameStateSchema,
    sudoku: dayGameStateSchema,
    nonogram: dayGameStateSchema,
    binairo: dayGameStateSchema,
  }),
});

export type DayResponse = z.infer<typeof dayResponseSchema>;

import { z } from "zod";

import { dayGameStateSchema } from "../day";
import { GAMES, recordFor } from "../game";
import { isoDateString } from "./daily";

export const dayResponseSchema = z.strictObject({
  date: isoDateString,
  games: z.strictObject(recordFor(GAMES, () => dayGameStateSchema)),
});

export type DayResponse = z.infer<typeof dayResponseSchema>;

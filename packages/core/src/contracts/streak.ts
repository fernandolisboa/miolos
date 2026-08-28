import { z } from "zod";

import { isoDateString } from "./daily";

export const streakResponseSchema = z.strictObject({
  date: isoDateString,
  streak: z.number().int().min(0),

  todayCounts: z.boolean(),
});

export type StreakResponse = z.infer<typeof streakResponseSchema>;

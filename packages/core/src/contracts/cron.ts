import { z } from "zod";

import { isoDateString } from "./daily";

export const cronPublishGameResultSchema = z.strictObject({
  generated: z.number().int().min(0),
  depth: z.number().int().min(0),
  failures: z.array(
    z.strictObject({ date: isoDateString, reason: z.string() }),
  ),

  error: z.string().nullable(),
});

export type CronPublishGameResult = z.infer<typeof cronPublishGameResultSchema>;

export const cronPublishResponseSchema = z.strictObject({
  games: z.strictObject({
    termo: cronPublishGameResultSchema,
    binairo: cronPublishGameResultSchema,
    nonogram: cronPublishGameResultSchema,
    sudoku: cronPublishGameResultSchema,
  }),
});

export type CronPublishResponse = z.infer<typeof cronPublishResponseSchema>;

export const cronNotifyResponseSchema = z.strictObject({
  candidates: z.number().int().min(0),
  claimed: z.number().int().min(0),
  sent: z.number().int().min(0),
  pruned: z.number().int().min(0),
  failed: z.number().int().min(0),
});

export type CronNotifyResponse = z.infer<typeof cronNotifyResponseSchema>;

export const bufferDepthResponseSchema = z.strictObject({
  depths: z.strictObject({
    termo: z.number().int().min(0),
    binairo: z.number().int().min(0),
    nonogram: z.number().int().min(0),
    sudoku: z.number().int().min(0),
  }),
  threshold: z.number().int().positive(),

  shallow: z.boolean(),
});

export type BufferDepthResponse = z.infer<typeof bufferDepthResponseSchema>;

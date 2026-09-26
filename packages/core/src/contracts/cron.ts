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

const notifyCount = z.number().int().min(0);

export const cronNotifyResponseSchema = z.strictObject({
  push: z.strictObject({
    candidates: notifyCount,
    claimed: notifyCount,
    sent: notifyCount,
    pruned: notifyCount,
    failed: notifyCount,
  }),
  email: z.strictObject({
    candidates: notifyCount,
    claimed: notifyCount,
    sent: notifyCount,
    failed: notifyCount,
  }),
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
  termoAnswersRemaining: z.number().int().min(0),
  termoAnswersLow: z.boolean(),
});

export type BufferDepthResponse = z.infer<typeof bufferDepthResponseSchema>;

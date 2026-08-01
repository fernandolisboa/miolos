import { z } from "zod";

import { isoDateString } from "./daily";

/**
 * Body of GET /cron/publish (plan 014 §5.1). `failures` reports dates the
 * top-up could not cover after its per-date retry budget — the run itself
 * never aborts on a bad date. The HTTP status (200 healthy / 500 shallow)
 * is Vercel-log observability only; the real alerting reads depth
 * (issue #17 AC 3).
 */
export const cronPublishResponseSchema = z.strictObject({
  game: z.literal("binairo"),
  generated: z.number().int().min(0),
  depth: z.number().int().min(0),
  failures: z.array(
    z.strictObject({ date: isoDateString, reason: z.string() }),
  ),
});

export type CronPublishResponse = z.infer<typeof cronPublishResponseSchema>;

/**
 * Body of GET /buffer-depth, the monitoring read (issue #17 AC 3).
 * `threshold` is the EFFECTIVE alert threshold — min(constant, configured
 * depth) — so a deliberately tuned-low depth is healthy, not permanently
 * alarming (plan 014 A3). The poller reads `shallow`, never the HTTP
 * status.
 */
export const bufferDepthResponseSchema = z.strictObject({
  depths: z.strictObject({ binairo: z.number().int().min(0) }),
  threshold: z.number().int().positive(),
  shallow: z.boolean(),
});

export type BufferDepthResponse = z.infer<typeof bufferDepthResponseSchema>;

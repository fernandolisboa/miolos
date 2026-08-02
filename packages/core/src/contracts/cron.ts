import { z } from "zod";

import { isoDateString } from "./daily";

/**
 * One game's slice of GET /cron/publish (plan 014 §5.1). `failures`
 * reports dates the top-up could not cover after its retry budgets — the
 * run itself never aborts on a bad date.
 */
export const cronPublishGameResultSchema = z.strictObject({
  generated: z.number().int().min(0),
  depth: z.number().int().min(0),
  failures: z.array(
    z.strictObject({ date: isoDateString, reason: z.string() }),
  ),
  /**
   * The message of a throw that ESCAPED this game's top-up, `null` on a
   * normal run. `failures[].date` is an `isoDateString` and must stay one,
   * so an aborted run cannot be reported through it (plan 018 §7.2). One
   * game throwing must never stop the other's buffer from being topped up,
   * and the body must still parse strictly when it happens.
   */
  error: z.string().nullable(),
});

export type CronPublishGameResult = z.infer<typeof cronPublishGameResultSchema>;

/**
 * Body of GET /cron/publish, keyed BY GAME and strict on BOTH levels. The
 * HTTP status (200 healthy / 500 shallow-or-threw) is Vercel-log
 * observability only; the real alerting reads depth (issue #17 AC 3).
 *
 * EXTENSION POINT: the extension property the single-game shape had is
 * preserved exactly — a new game must widen this in the same PR that wires
 * its top-up. An array of results, or a `gameSchema`-keyed record, would
 * accept anything and silently lose that (plan 018 S15).
 *
 * Keyed binairo → nonogram → sudoku: the cron's COST-ASCENDING run order
 * (plan 020 P7, and `apps/api/app/cron/publish/route.ts` states the rule).
 * It happens to read alphabetically today, and that coincidence ENDS at
 * termo: a curated-word-list pick (ADR-0015) is not a generate-and-validate
 * loop at all, so cost-ascending puts termo first while the alphabet puts it
 * last. Cost-ascending is the rule that wins; #27 must not read the current
 * order as alphabetical.
 */
export const cronPublishResponseSchema = z.strictObject({
  games: z.strictObject({
    binairo: cronPublishGameResultSchema,
    nonogram: cronPublishGameResultSchema,
    sudoku: cronPublishGameResultSchema,
  }),
});

export type CronPublishResponse = z.infer<typeof cronPublishResponseSchema>;

/**
 * Body of GET /buffer-depth, the monitoring read (issue #17 AC 3).
 * `threshold` is the EFFECTIVE alert threshold — min(constant, configured
 * depth) — so a deliberately tuned-low depth is healthy, not permanently
 * alarming (plan 014 A3). It stays ONE scalar: `remoteConfigSchema`'s
 * single `bufferDepth` knob is shared by every game. The poller reads
 * `shallow`, never the HTTP status.
 *
 * EXTENSION POINT: `depths` is strict and REJECTS a game it does not
 * list — #27 adds its key here in the same PR that wires its top-up.
 */
export const bufferDepthResponseSchema = z.strictObject({
  depths: z.strictObject({
    binairo: z.number().int().min(0),
    nonogram: z.number().int().min(0),
    sudoku: z.number().int().min(0),
  }),
  threshold: z.number().int().positive(),
  /**
   * TRUE when ANY game is below the threshold (plan 018 S16). Deriving it
   * from one game while reporting several would report a drained buffer
   * and never page on it — `.github/workflows/buffer-alert.yml` reads
   * `jq -r .shallow` and nothing else.
   */
  shallow: z.boolean(),
});

export type BufferDepthResponse = z.infer<typeof bufferDepthResponseSchema>;

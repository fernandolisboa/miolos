import { z } from "zod";

import { isoDateString } from "./daily";

/**
 * One game's slice of GET /cron/publish. `failures` lists dates the top-up
 * could not cover after its retry budgets; the run itself never aborts on
 * a bad date.
 */
export const cronPublishGameResultSchema = z.strictObject({
  generated: z.number().int().min(0),
  depth: z.number().int().min(0),
  failures: z.array(
    z.strictObject({ date: isoDateString, reason: z.string() }),
  ),
  /** The message of a throw that escaped this game's top-up; `null` on a normal run. */
  error: z.string().nullable(),
});

export type CronPublishGameResult = z.infer<typeof cronPublishGameResultSchema>;

/**
 * Body of GET /cron/publish, keyed by game and strict on both levels. The
 * HTTP status is Vercel-log observability only; the real alerting reads
 * `depth`.
 *
 * Keyed termo → binairo → nonogram → sudoku, the cron's cost-ascending run
 * order (a curated word-list pick is far cheaper than a
 * generate-and-validate loop), not alphabetical order.
 *
 * A new game must widen this in the same PR that wires its top-up: an
 * array of results, or a `gameSchema`-keyed record, would accept anything
 * and silently lose that guarantee.
 */
export const cronPublishResponseSchema = z.strictObject({
  games: z.strictObject({
    termo: cronPublishGameResultSchema,
    binairo: cronPublishGameResultSchema,
    nonogram: cronPublishGameResultSchema,
    sudoku: cronPublishGameResultSchema,
  }),
});

export type CronPublishResponse = z.infer<typeof cronPublishResponseSchema>;

/**
 * Body of POST /cron/notify — the streak-at-risk dispatcher's tick
 * counters, strict on both ends. `candidates`/`claimed`/`sent`/`pruned`/
 * `failed` count SUBSCRIPTION ROWS, not users: one user can hold several
 * endpoints, each tallied independently. A tick that ran with `failed > 0`
 * is still a successful run — a lost nudge is a priced residual (ADR-0064
 * decision 7), not an outage; failures are observed via the per-tick JSON
 * log, never the HTTP status.
 */
export const cronNotifyResponseSchema = z.strictObject({
  candidates: z.number().int().min(0),
  claimed: z.number().int().min(0),
  sent: z.number().int().min(0),
  pruned: z.number().int().min(0),
  failed: z.number().int().min(0),
});

export type CronNotifyResponse = z.infer<typeof cronNotifyResponseSchema>;

/**
 * Body of GET /buffer-depth, the monitoring read. `threshold` is the
 * EFFECTIVE alert threshold — min(constant, configured depth) — so a
 * deliberately tuned-low depth reads healthy, not permanently alarming.
 * It is ONE scalar because `remoteConfigSchema`'s `bufferDepth` knob is
 * shared by every game. The poller reads `shallow`, never the HTTP status.
 */
export const bufferDepthResponseSchema = z.strictObject({
  depths: z.strictObject({
    termo: z.number().int().min(0),
    binairo: z.number().int().min(0),
    nonogram: z.number().int().min(0),
    sudoku: z.number().int().min(0),
  }),
  threshold: z.number().int().positive(),
  /**
   * TRUE when ANY game is below the threshold. Deriving it from one game
   * while reporting several would silently stop paging on a drained
   * buffer — `.github/workflows/buffer-alert.yml` reads `jq -r .shallow`
   * and nothing else, so this key's name and boolean semantics are
   * load-bearing outside this package's own type-checking.
   */
  shallow: z.boolean(),
});

export type BufferDepthResponse = z.infer<typeof bufferDepthResponseSchema>;

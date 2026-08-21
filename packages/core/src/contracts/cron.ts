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
 * Keyed termo → binairo → nonogram → sudoku: the cron's COST-ASCENDING run
 * order (plan 020 P7, plan 022 §10.3, and `apps/api/app/cron/publish/route.ts`
 * states the rule). It NO LONGER reads alphabetically, and that is the point
 * — a curated-word-list pick (ADR-0015, ADR-0040) is not a
 * generate-and-validate loop at all, measured at 0.019 ms per cold week
 * against binairo's ~7 ms, so cost-ascending puts termo first while the
 * alphabet would put it last. `GAMES` is now fully covered, so the
 * strictness this schema exists for is pinned against an unknown key rather
 * than against a fifth game (T-CORE-S24 aims at `crossword`).
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
 * Body of POST /cron/notify (#146, ADR-0068 decision 4) — the streak-at-risk
 * dispatcher's tick counters, strict on both ends (the publish precedent:
 * parsed before `Response.json`).
 *
 * Status semantics, recorded here because the counters only make sense with
 * them: 401 unauthorized; 503 when push is unconfigured, BEFORE any DB read
 * (the subscribe routes' fail-closed posture — and a red hourly Actions run
 * on a misconfigured prod IS the alert, `curl -fsS` makes it one); 200
 * whenever the tick RAN, even with `failed > 0` — a lost nudge is ADR-0064
 * decision 7's priced residual, not an outage. The observability channel for
 * failures is the per-line `{event:"cron-notify", …}` JSON log (the publish
 * idiom), never the HTTP status.
 *
 * - `candidates`: users the at-risk query answered for this tick's hour.
 * - `claimed`: candidates whose ledger claim THIS tick won (a concurrent or
 *   replayed tick loses claims, so `claimed <= candidates`).
 * - `sent` / `pruned` / `failed` count SUBSCRIPTION ROWS, not users: one
 *   user can hold several endpoints, each sent, pruned (404/410) or failed
 *   independently.
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
 * Body of GET /buffer-depth, the monitoring read (issue #17 AC 3).
 * `threshold` is the EFFECTIVE alert threshold — min(constant, configured
 * depth) — so a deliberately tuned-low depth is healthy, not permanently
 * alarming (plan 014 A3). It stays ONE scalar: `remoteConfigSchema`'s
 * single `bufferDepth` knob is shared by every game. The poller reads
 * `shallow`, never the HTTP status.
 *
 * `depths` is strict and REJECTS a game it does not list. #27 added the
 * fourth and last v1 key in the same PR that wired its top-up, in the
 * cron's cost-ascending order rather than alphabetically, so the two
 * `strictObject`s in this file read the same way.
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
   * TRUE when ANY game is below the threshold (plan 018 S16). Deriving it
   * from one game while reporting several would report a drained buffer
   * and never page on it — `.github/workflows/buffer-alert.yml` reads
   * `jq -r .shallow` and nothing else.
   */
  shallow: z.boolean(),
});

export type BufferDepthResponse = z.infer<typeof bufferDepthResponseSchema>;

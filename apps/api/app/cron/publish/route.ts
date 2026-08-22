import {
  cronPublishResponseSchema,
  type CronPublishGameResult,
  type CronPublishResponse,
} from "@miolos/core";
import type { Db } from "@miolos/db";
import { bufferDepth, getRemoteConfig } from "@miolos/db/publishing";
import { pruneSeenDays } from "@miolos/db/user";
import type { NextRequest } from "next/server";

import { isAuthorized } from "../../../src/cron/auth";
import { getDb } from "../../../src/db";
import {
  effectiveThreshold,
  TopUpAbortedError,
  topUpBinairoBuffer,
  topUpNonogramBuffer,
  topUpSudokuBuffer,
  topUpTermoBuffer,
  type TopUpResult,
} from "../../../src/publishing/service";

// Never statically cached: every invocation must reconcile against the db.
export const dynamic = "force-dynamic";

// Auth: see src/cron/auth.ts (CRON_SECRET-gated, fail-closed). POST
// /cron/notify shares the same check.

/**
 * The games this cron tops up, taken from the response contract rather than
 * from `Game`: widening `cronPublishResponseSchema` is what admits a new
 * game here, and nothing else can.
 */
type CronGame = keyof CronPublishResponse["games"];

/**
 * One game's top-up, fault-isolated: this try/catch is deliberate, not a
 * detail. No top-up catches its own errors, so with four games composed
 * serially and no isolation here, ONE game's transient failure would
 * silently stop every LATER game's buffer from being topped up.
 *
 * On a throw, `depth` is re-read from the database rather than zeroed, and
 * `generated`/`failures` are the counters `TopUpAbortedError` carried out
 * of the rejected promise — the result reflects the run that happened.
 */
async function runTopUp(
  db: Db,
  game: CronGame,
  topUp: (db: Db, depth: number) => Promise<TopUpResult>,
  configuredDepth: number,
): Promise<CronPublishGameResult> {
  try {
    const result = await topUp(db, configuredDepth);
    return { ...result, error: null };
  } catch (thrown) {
    // Depth is re-read separately so a failed read still forces 0, which
    // trips the alert threshold below rather than reporting stale health.
    const depth = await bufferDepth(db, game).catch(() => 0);
    // Rows inserted before a mid-loop throw are durable (no transaction
    // wraps the loop); `TopUpAbortedError` carries their count out of the
    // rejected promise. `error` is the ORIGINAL failure, never the
    // wrapper's own message.
    const aborted = thrown instanceof TopUpAbortedError ? thrown : undefined;
    // SECURITY: Drizzle's `DrizzleQueryError` embeds the bound parameters
    // in its own message (separator "\nparams: "). For termo those
    // parameters include the drawn answer word, and this string reaches
    // both the /cron/publish response body and the Vercel log line — so
    // keep the query text an operator needs and drop everything from
    // "\nparams:" on. Splitting on a comma would not work: Drizzle joins
    // params with `Array.prototype.toString()`, so a JSON payload's own
    // commas are indistinguishable from parameter separators.
    //
    // LANDMINE: this sanitizes the MESSAGE only. `query`, `params` and
    // `cause` are still enumerable properties of the thrown error itself,
    // so a future `JSON.stringify(thrown)` or error-reporting SDK reopens
    // the leak. Nothing does today — do not "helpfully" log the whole
    // error.
    const cause = aborted ? aborted.cause : thrown;
    const error =
      cause instanceof Error
        ? (cause.message.split("\nparams:")[0] ?? "")
        : String(cause);
    return {
      generated: aborted?.partial.generated ?? 0,
      depth,
      failures: aborted?.partial.failures ?? [],
      error,
    };
  }
}

/**
 * GET /cron/publish — idempotent top-up of every game's buffer to the
 * remote-configured depth; see ADR-0010. Not a browser endpoint: no CORS,
 * no OPTIONS. The non-2xx on a shallow post-run depth or an escaped throw
 * is Vercel-log observability only — the real alerting reads
 * GET /buffer-depth, never this route's exit code.
 *
 * The top-ups run SERIALLY in a fixed COST-ASCENDING order: Neon
 * round-trips dominate, so concurrency buys nothing, and running
 * cheapest-first means a CPU overrun in an expensive game can never starve
 * a cheaper one. It is the principle that fixes the order, not the shape of
 * the list — termo is the last game added and the cheapest by orders of
 * magnitude, so its property is what sends it FIRST rather than appended
 * last.
 *
 * The `await` order below IS the execution order; the key order in the
 * object literal is what the log loop and the response body inherit.
 */
export async function GET(request: NextRequest): Promise<Response> {
  if (!isAuthorized(request.headers.get("authorization"))) {
    return new Response(null, { status: 401 });
  }
  const db = getDb();
  const config = await getRemoteConfig(db);
  const games = {
    termo: await runTopUp(db, "termo", topUpTermoBuffer, config.bufferDepth),
    binairo: await runTopUp(
      db,
      "binairo",
      topUpBinairoBuffer,
      config.bufferDepth,
    ),
    nonogram: await runTopUp(
      db,
      "nonogram",
      topUpNonogramBuffer,
      config.bufferDepth,
    ),
    sudoku: await runTopUp(db, "sudoku", topUpSudokuBuffer, config.bufferDepth),
  };

  // One line PER GAME, so the shipped {event:"cron-publish", game:…} log
  // query keeps working unchanged as games are added.
  for (const [game, result] of Object.entries(games)) {
    console.log(JSON.stringify({ event: "cron-publish", game, ...result }));
  }

  // Seen-days retention (see ADR-0066): the credit only ever reads
  // `today − 1`, so older rows are dead weight. Piggybacked on this cron
  // rather than a job of its own, and WRAPPED so a failure here never masks
  // the publish result this route exists to report.
  try {
    await pruneSeenDays(db);
  } catch (thrown) {
    console.error(
      "cron-publish: seen-days retention delete failed (puzzles above published normally)",
      thrown,
    );
  }

  const body = cronPublishResponseSchema.parse({ games });
  const threshold = effectiveThreshold(config.bufferDepth);
  const healthy = Object.values(body.games).every(
    (result) => result.error === null && result.depth >= threshold,
  );
  return Response.json(body, { status: healthy ? 200 : 500 });
}

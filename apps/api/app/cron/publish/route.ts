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

// `isAuthorized` moved to src/cron/auth.ts at #146 (ADR-0068), doc block
// and behavior verbatim: POST /cron/notify shares the exact gate.

/**
 * The games this cron tops up, taken from the response contract rather than
 * from `Game`: widening `cronPublishResponseSchema` is what admits a new
 * game here, in the same PR, and nothing else can (plan 018 S15).
 */
type CronGame = keyof CronPublishResponse["games"];

/**
 * One game's top-up, fault-isolated. This try/catch is a decision, not a
 * detail: no top-up catches anything but its own `*GenerationError`, so
 * `insertDailyPuzzle`, `bufferDepth`, `todaySaoPaulo` and the
 * derived-weekday `RangeError` all propagate. With four games composed
 * serially and no isolation, ONE game's transient Neon blip silently stops
 * every LATER game's buffer from being topped up — and against
 * `BUFFER_ALERT_THRESHOLD = 4` on a default depth of 7 each victim drains
 * one day per occurrence and pages only after three-plus consecutive days
 * (plan 018 §7.2). The drain arithmetic is per game and unchanged by the
 * fourth one, which now runs FIRST and so has every other game downstream
 * of it.
 *
 * The result on a throw is still the run that happened, not a zeroed one:
 * `depth` is re-read from the database, and `generated`/`failures` are the
 * counters the top-up carried out on `TopUpAbortedError`.
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
    // Depth is read separately so the strict body still parses AND the
    // threshold gate below still sees this game's real coverage. If that
    // read throws too the database is gone: 0 forces the 500 and the alert.
    const depth = await bufferDepth(db, game).catch(() => 0);
    // A throw does NOT mean nothing was written: there is no transaction
    // around the loop, so the rows inserted before it are durable, and
    // `TopUpAbortedError` is what carries their count out of the rejected
    // promise (finding `cron-generated-understated-on-partial-failure`).
    // `error` stays the ORIGINAL failure — never the wrapper's own message,
    // which is the operator's only string here.
    const aborted = thrown instanceof TopUpAbortedError ? thrown : undefined;
    // Drizzle's `DrizzleQueryError` embeds the BOUND PARAMETERS in its own
    // message (drizzle-orm/errors.js, separator "\nparams: ", verified
    // empirically and identical on the neon-http and pglite sessions). For
    // termo those parameters are `{"canonical":…,"normalized":…}` for a date
    // that may be up to 30 days in the FUTURE and is by definition
    // unpublished — and this string goes into the /cron/publish RESPONSE
    // BODY below and into the Vercel log line. Keep the query text, which is
    // what an operator actually needs; drop the tail. Fixes the three grid
    // games at the same time — a nonogram `reveal.solution` was leaking the
    // same way (plan 022 §10.3.1, T-API-S41).
    //
    // LANDMINE N46: this sanitizes the MESSAGE only. `query`, `params` and
    // `cause` are own ENUMERABLE properties of the thrown error, so a future
    // `JSON.stringify(thrown)`, structured-log call or error-reporting SDK
    // re-opens the channel with the answer word in it. Nothing does today.
    // A "log the whole error for debuggability" change is the trap, and it
    // will look like an improvement.
    //
    // Splitting on "\nparams:" and not on a comma: drizzle joins the params
    // with `Array.prototype.toString()`, so commas inside a JSON payload are
    // indistinguishable from parameter separators.
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
 * remote-configured depth (issue #17 AC 2/AC 4, #23, ADR-0010). Not a
 * browser endpoint: no CORS, no OPTIONS. The non-2xx on a shallow post-run
 * depth or an escaped throw is Vercel-log observability only — the real
 * alerting reads GET /buffer-depth (AC 3; cron exit codes are not the
 * signal).
 *
 * The top-ups run SERIALLY in a fixed COST-ASCENDING order — termo
 * (0.019 ms) → binairo (~7 ms) → nonogram (~34-80 ms) → sudoku (~150 ms) per
 * cold week: Neon round-trips dominate, so concurrency buys nothing and
 * multiplies connection pressure, and running the games cheapest-first means
 * a CPU overrun in an expensive one can never starve a cheaper one (plan 018
 * §7.2, plan 020 P7). It is the principle that fixes the order, not the
 * shape of the list: appending each new game last would keep the diff
 * smaller and is exactly what this rule refuses — and #27 is where that
 * stopped being hypothetical, because termo is both the last game added and
 * the cheapest by two orders of magnitude, so its property goes FIRST.
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

  // Seen-days retention (#58, ADR-0066): the credit only ever reads
  // `today − 1`, so older rows are dead weight (~365/user/year, unioned
  // forever by the merge). One idempotent delete on the day's existing cron
  // rather than a job of its own — WRAPPED so its failure logs loudly and
  // never masks the publish result this route exists to report. Widening
  // the credit window widens `pruneSeenDays`'s predicate too.
  try {
    await pruneSeenDays(db);
  } catch (thrown) {
    // The error object rides as the second argument (the attach/confirm
    // idiom) so the stack, class and any `cause` survive into the log of a
    // failure nobody watches happen.
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

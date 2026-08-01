import { createHash, timingSafeEqual } from "node:crypto";

import {
  cronPublishResponseSchema,
  type CronPublishGameResult,
  type CronPublishResponse,
} from "@miolos/core";
import type { Db } from "@miolos/db";
import { bufferDepth, getRemoteConfig } from "@miolos/db/publishing";
import type { NextRequest } from "next/server";

import { getDb } from "../../../src/db";
import {
  effectiveThreshold,
  TopUpAbortedError,
  topUpBinairoBuffer,
  topUpNonogramBuffer,
  topUpSudokuBuffer,
  type TopUpResult,
} from "../../../src/publishing/service";

// Never statically cached: every invocation must reconcile against the db.
export const dynamic = "force-dynamic";

/**
 * Fail-closed cron auth (plan 014 D15): unset CRON_SECRET → 401, missing
 * or mismatched bearer → 401. Deliberately NOT WEB_ORIGIN's fail-open —
 * an open publish endpoint is a generation-loop DoS. Comparison is
 * SHA-256-both-sides then timingSafeEqual (equal-length digests by
 * construction): after ADR-0022 engineered timing-sensitive comparisons
 * out of the codebase, this endpoint does not reintroduce one. Vercel
 * sends `Authorization: Bearer <CRON_SECRET>` on cron invocations.
 */
function isAuthorized(authorizationHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !authorizationHeader) {
    return false;
  }
  const received = createHash("sha256").update(authorizationHeader).digest();
  const expected = createHash("sha256").update(`Bearer ${secret}`).digest();
  return timingSafeEqual(received, expected);
}

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
 * derived-weekday `RangeError` all propagate. With three games composed
 * serially and no isolation, ONE game's transient Neon blip silently stops
 * every LATER game's buffer from being topped up — and against
 * `BUFFER_ALERT_THRESHOLD = 4` on a default depth of 7 each victim drains
 * one day per occurrence and pages only after three-plus consecutive days
 * (plan 018 §7.2). The drain arithmetic is per game and unchanged by the
 * third one.
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
    return {
      generated: aborted?.partial.generated ?? 0,
      depth,
      failures: aborted?.partial.failures ?? [],
      error: String(aborted ? aborted.cause : thrown),
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
 * The top-ups run SERIALLY in a fixed COST-ASCENDING order — binairo
 * (~7 ms) → nonogram (~34-80 ms) → sudoku (~150 ms) per cold week: Neon
 * round-trips dominate, so concurrency buys nothing and multiplies
 * connection pressure, and running the games cheapest-first means a CPU
 * overrun in an expensive one can never starve a cheaper one (plan 018
 * §7.2, plan 020 P7). It is the principle that fixes the order, not the
 * shape of the list: appending each new game last would keep the diff
 * smaller and is exactly what this rule refuses.
 */
export async function GET(request: NextRequest): Promise<Response> {
  if (!isAuthorized(request.headers.get("authorization"))) {
    return new Response(null, { status: 401 });
  }
  const db = getDb();
  const config = await getRemoteConfig(db);
  const games = {
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

  const body = cronPublishResponseSchema.parse({ games });
  const threshold = effectiveThreshold(config.bufferDepth);
  const healthy = Object.values(body.games).every(
    (result) => result.error === null && result.depth >= threshold,
  );
  return Response.json(body, { status: healthy ? 200 : 500 });
}

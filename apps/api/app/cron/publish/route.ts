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
  topUpBinairoBuffer,
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
 * detail: neither top-up catches anything but its own `*GenerationError`,
 * so `insertDailyPuzzle`, `bufferDepth`, `todaySaoPaulo` and the
 * derived-weekday `RangeError` all propagate. With two games composed
 * serially and no isolation, ONE game's transient Neon blip silently stops
 * the OTHER game's buffer from being topped up — and against
 * `BUFFER_ALERT_THRESHOLD = 4` on a default depth of 7 the victim drains
 * one day per occurrence and pages only after three-plus consecutive days
 * (plan 018 §7.2).
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
    return { generated: 0, depth, failures: [], error: String(thrown) };
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
 * The top-ups run SERIALLY in a fixed order, binairo first: Neon
 * round-trips dominate, so concurrency buys nothing and doubles connection
 * pressure, and running the cheap game first means a sudoku CPU overrun can
 * never starve it (plan 018 §7.2).
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

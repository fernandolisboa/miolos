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

export const dynamic = "force-dynamic";

type CronGame = keyof CronPublishResponse["games"];

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
    const depth = await bufferDepth(db, game).catch(() => 0);

    const aborted = thrown instanceof TopUpAbortedError ? thrown : undefined;

    // Only the MESSAGE is sanitised below. `query`, `params` and `cause`
    // stay enumerable on the error, so logging the whole object re-opens the
    // answer leak this split closes (ADR-0004).
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

  for (const [game, result] of Object.entries(games)) {
    console.log(JSON.stringify({ event: "cron-publish", game, ...result }));
  }

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

import { bufferDepthResponseSchema, GAMES, type Game } from "@miolos/core";
import { bufferDepth, getRemoteConfig } from "@miolos/db/publishing";

import { corsHeaders } from "../../src/cors";
import { getDb } from "../../src/db";
import {
  effectiveThreshold,
  isTermoAnswerListLow,
  unusedTermoAnswers,
} from "../../src/publishing/service";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const db = getDb();
  const config = await getRemoteConfig(db);

  const depthEntries = await Promise.all(
    GAMES.map(async (game) => [game, await bufferDepth(db, game)] as const),
  );
  const depths = Object.fromEntries(depthEntries) as Record<Game, number>;
  const threshold = effectiveThreshold(config.bufferDepth);
  const termoAnswersRemaining = (await unusedTermoAnswers(db)).length;
  const body = bufferDepthResponseSchema.parse({
    depths,
    threshold,
    shallow: Object.values(depths).some((depth) => depth < threshold),
    termoAnswersRemaining,
    termoAnswersLow: isTermoAnswerListLow(termoAnswersRemaining),
  });
  return Response.json(body, { headers: corsHeaders() });
}

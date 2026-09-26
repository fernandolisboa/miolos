import { bufferDepthResponseSchema } from "@miolos/core";
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

  const depths = {
    termo: await bufferDepth(db, "termo"),
    binairo: await bufferDepth(db, "binairo"),
    nonogram: await bufferDepth(db, "nonogram"),
    sudoku: await bufferDepth(db, "sudoku"),
  };
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

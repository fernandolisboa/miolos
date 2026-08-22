import { bufferDepthResponseSchema } from "@miolos/core";
import { bufferDepth, getRemoteConfig } from "@miolos/db/publishing";

import { corsHeaders } from "../../src/cors";
import { getDb } from "../../src/db";
import { effectiveThreshold } from "../../src/publishing/service";

// Never statically cached: the depth must reflect the live table.
export const dynamic = "force-dynamic";

/**
 * GET /buffer-depth — the monitoring read. Public: depth is not sensitive
 * (no content, no dates). Always 200 — the scheduled poller reads
 * `shallow`, never the HTTP status.
 *
 * `shallow` is the OR across games, not per-game. Reporting a drained
 * buffer under `depths` while deriving `shallow` from a different game
 * would silently never page, because `.github/workflows/buffer-alert.yml`
 * reads only `jq -r .shallow`.
 */
export async function GET(): Promise<Response> {
  const db = getDb();
  const config = await getRemoteConfig(db);
  // Keyed in the same order as `/cron/publish`'s read. Cosmetic — these
  // are four independent counts — which is exactly why it should match
  // rather than drift.
  const depths = {
    termo: await bufferDepth(db, "termo"),
    binairo: await bufferDepth(db, "binairo"),
    nonogram: await bufferDepth(db, "nonogram"),
    sudoku: await bufferDepth(db, "sudoku"),
  };
  const threshold = effectiveThreshold(config.bufferDepth);
  const body = bufferDepthResponseSchema.parse({
    depths,
    threshold,
    shallow: Object.values(depths).some((depth) => depth < threshold),
  });
  return Response.json(body, { headers: corsHeaders() });
}

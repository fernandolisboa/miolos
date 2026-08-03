import { bufferDepthResponseSchema } from "@miolos/core";
import { bufferDepth, getRemoteConfig } from "@miolos/db/publishing";

import { corsHeaders } from "../../src/cors";
import { getDb } from "../../src/db";
import { effectiveThreshold } from "../../src/publishing/service";

// Never statically cached: the depth must reflect the live table.
export const dynamic = "force-dynamic";

/**
 * GET /buffer-depth — the monitoring read (issue #17 AC 3). Public:
 * depth is not sensitive (no content, no dates). Always 200 — the
 * scheduled poller reads `shallow`, never the HTTP status; cron exit
 * codes are explicitly not the signal. `threshold` is the effective one:
 * min(BUFFER_ALERT_THRESHOLD, configured depth) (plan 014 A3).
 *
 * `shallow` is the OR ACROSS GAMES (plan 018 S16). The failure mode this
 * shape exists to prevent is specific and silent: reporting `depths.sudoku`
 * while deriving `shallow` from binairo alone would REPORT a drained sudoku
 * buffer and never PAGE on it, because
 * `.github/workflows/buffer-alert.yml` reads `jq -r .shallow` and nothing
 * else.
 */
export async function GET(): Promise<Response> {
  const db = getDb();
  const config = await getRemoteConfig(db);
  // Keyed in the cron's cost-ascending order (termo first) so this object
  // and `/cron/publish`'s read the same way. The order is cosmetic here —
  // these are four independent counts — and that is exactly why it should
  // match rather than drift.
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

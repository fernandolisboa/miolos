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
 */
export async function GET(): Promise<Response> {
  const db = getDb();
  const config = await getRemoteConfig(db);
  const binairo = await bufferDepth(db, "binairo");
  const threshold = effectiveThreshold(config.bufferDepth);
  const body = bufferDepthResponseSchema.parse({
    depths: { binairo },
    threshold,
    shallow: binairo < threshold,
  });
  return Response.json(body, { headers: corsHeaders() });
}

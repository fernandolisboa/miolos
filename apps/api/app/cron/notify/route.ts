import { cronNotifyResponseSchema } from "@miolos/core";
import { readTickInstant } from "@miolos/db/user";
import type { NextRequest } from "next/server";

import { isAuthorized } from "../../../src/cron/auth";
import { getDb } from "../../../src/db";
import { runNotifyTick } from "../../../src/notify/dispatcher";
import { sendWebPush } from "../../../src/notify/transport";
import { isPushConfigured } from "../../../src/push/config";

// NO `export const dynamic = "force-dynamic"` here, unlike the publish
// route, and that asymmetry is a decision (#146, plan 063 §4.1): only GET
// handlers participate in Next's static optimisation — a POST handler is
// dynamic by definition, so the export would be a no-op dressed as one.

/**
 * POST /cron/notify (#146, ADR-0064 decisions 6–9; ADR-0067) — the hourly
 * streak-at-risk tick. POST because the tick causes writes and sends, and
 * this route is never Vercel-cron-driven (Vercel cron sends GET, which is
 * why /cron/publish is one; the Actions curl does `-X POST` trivially —
 * `.github/workflows/streak-notify.yml`, ADR-0064 decision 8). Not a
 * browser endpoint: no CORS, no OPTIONS, no body parsing (the publish
 * posture).
 *
 * Status semantics (ADR-0067 decision 4, recorded on
 * `cronNotifyResponseSchema` too): 401 unauthorized (the shared
 * fail-closed `isAuthorized`); 503 when push is unconfigured, BEFORE any
 * DB read — a red hourly Actions run on a misconfigured prod IS the alert
 * (`curl -fsS` makes it one); 200 whenever the tick ran, even with
 * `failed > 0` — a lost nudge is decision 7's priced residual, not an
 * outage, and the per-line `{event:"cron-notify"}` log line carries the
 * observability (the publish idiom). An escaped throw 500s naturally.
 *
 * SEND TIMING IS DECIDED HERE, against the DB clock's SP hour, in ONE
 * snapshot (`readTickInstant` — the day and the hour can never straddle
 * midnight against each other), never by the workflow's nominal fire
 * time: Actions jitter is absorbed by the hour-equality match. A tick
 * GitHub skips or delays past the hour loses that hour's cohort's nudge
 * for the day — priced by ADR-0064 decision 8's granularity choice,
 * restated in ADR-0067; no catch-up pass exists (`habitual_hour <= hour`
 * would change decision 6's closed equality).
 */
export async function POST(request: NextRequest): Promise<Response> {
  if (!isAuthorized(request.headers.get("authorization"))) {
    return new Response(null, { status: 401 });
  }
  if (!isPushConfigured()) {
    return new Response(null, { status: 503 });
  }
  const db = getDb();
  const { today, hour } = await readTickInstant(db);
  const result = await runNotifyTick(db, { today, hour, send: sendWebPush });
  console.log(JSON.stringify({ event: "cron-notify", today, hour, ...result }));
  return Response.json(cronNotifyResponseSchema.parse(result), {
    status: 200,
  });
}

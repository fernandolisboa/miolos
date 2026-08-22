import { cronNotifyResponseSchema } from "@miolos/core";
import { readTickInstant } from "@miolos/db/user";
import type { NextRequest } from "next/server";

import { isAuthorized } from "../../../src/cron/auth";
import { getDb } from "../../../src/db";
import { runNotifyTick } from "../../../src/notify/dispatcher";
import { sendWebPush } from "../../../src/notify/transport";
import { isPushConfigured } from "../../../src/push/config";

// No `dynamic` export here, unlike /cron/publish: a POST handler is
// dynamic by definition, so the export would be a no-op.

// No `export const dynamic` here, unlike the publish route: only GET
// handlers participate in Next static optimisation, so on a POST the export
// would be a no-op dressed as a decision.

/**
 * POST /cron/notify — the hourly streak-at-risk tick (see ADR-0064
 * decisions 6-9, ADR-0068 decisions 3-4). POST because the tick writes and
 * sends; Vercel cron always drives GET, so `.github/workflows/streak-notify.yml`
 * triggers this route with `curl -X POST` instead. Not a browser endpoint:
 * no CORS, no OPTIONS, no body parsing.
 *
 * 401 unauthorized; 503 when push is unconfigured, before any DB read (a
 * red hourly Actions run on a misconfigured prod IS the alert); 200
 * whenever the tick ran, even with `failed > 0`. `readTickInstant` reads
 * the day and hour in one snapshot so they can never straddle midnight;
 * there is no catch-up pass, so a skipped or delayed tick loses that
 * hour's cohort's nudge for the day.
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

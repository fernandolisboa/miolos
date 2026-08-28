import { cronNotifyResponseSchema } from "@miolos/core";
import { readTickInstant } from "@miolos/db/user";
import type { NextRequest } from "next/server";

import { isAuthorized } from "../../../src/cron/auth";
import { getDb } from "../../../src/db";
import { runNotifyTick } from "../../../src/notify/dispatcher";
import { sendWebPush } from "../../../src/notify/transport";
import { isPushConfigured } from "../../../src/push/config";

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

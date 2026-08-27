import { telemetryRelayRequestSchema } from "@miolos/core";
import { todaySaoPaulo } from "@miolos/db/publishing";
import type { NextRequest } from "next/server";

import {
  corsHeaders,
  isJsonContentType,
  preflightResponse,
} from "../../src/cors";
import { errorResponse } from "../../src/http/responses";
import { getDb } from "../../src/db";
import { SESSION_COOKIE_NAME } from "../../src/session/cookie";
import {
  isCrossSiteWrite,
  warnIfGuardDegraded,
} from "../../src/session/origin-guard";
import { requireUserId } from "../../src/session/service";
import { captureEvent, runAfterResponse } from "../../src/telemetry/capture";

export const dynamic = "force-dynamic";

function dropResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders({ credentials: true }),
  });
}

export function OPTIONS(): Response {
  return preflightResponse();
}

export async function POST(request: NextRequest): Promise<Response> {
  warnIfGuardDegraded();

  if (
    isCrossSiteWrite(
      {
        secFetchSite: request.headers.get("sec-fetch-site"),
        origin: request.headers.get("origin"),
      },
      process.env.WEB_ORIGIN,
    )
  ) {
    return errorResponse(403, "cross-site");
  }

  if (!isJsonContentType(request.headers.get("content-type"))) {
    return errorResponse(415, "unsupported-media-type");
  }

  const db = getDb();
  const userId = await requireUserId(
    db,
    request.cookies.get(SESSION_COOKIE_NAME)?.value,
  );
  if (!userId) {
    return dropResponse();
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return errorResponse(400, "invalid-body");
  }
  const parsed = telemetryRelayRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return errorResponse(400, "invalid-body");
  }
  const { game, date } = parsed.data.properties;

  const archive = date !== (await todaySaoPaulo(db));

  runAfterResponse(() =>
    captureEvent({
      distinctId: userId,
      event: "puzzle_started",
      properties: { game, date, archive },
    }),
  );

  return dropResponse();
}

import {
  apiErrorResponseSchema,
  telemetryRelayRequestSchema,
} from "@miolos/core";
import { todaySaoPaulo } from "@miolos/db/publishing";
import type { NextRequest } from "next/server";

import {
  corsHeaders,
  isJsonContentType,
  preflightResponse,
} from "../../src/cors";
import { getDb } from "../../src/db";
import { SESSION_COOKIE_NAME } from "../../src/session/cookie";
import {
  isCrossSiteWrite,
  warnIfGuardDegraded,
} from "../../src/session/origin-guard";
import { requireUserId } from "../../src/session/service";
import { captureEvent, runAfterResponse } from "../../src/telemetry/capture";

// Never statically cached: every request resolves the caller's session.
export const dynamic = "force-dynamic";

/**
 * POST /telemetry — the first-party relay, and the ONE client-originated
 * telemetry path (see ADR-0069 decisions 2 and 7): `puzzle_started` has
 * no server fact behind it, so the client posts it here and the server
 * captures — the PostHog key never ships in a bundle, and the closed
 * relay contract (a single event literal) means the other four events
 * cannot be forged through this door.
 *
 * One deliberate divergence from the sibling credentialed-POST shape: no
 * session is a 204 drop, not a 401 — there is no error surface to probe,
 * and a started event with no identity is not a fact this system
 * records. `archive` is derived against the DB clock's SP today, never
 * client-asserted.
 */
function errorResponse(status: number, error: string): Response {
  return Response.json(apiErrorResponseSchema.parse({ error }), {
    status,
    headers: corsHeaders({ credentials: true }),
  });
}

/** The success shape either way: nothing to say, only the CORS grant. */
function dropResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders({ credentials: true }),
  });
}

export function OPTIONS(): Response {
  // The relay body carries a JSON content type, so every cross-origin call
  // preflights (unlike the body-less session POST).
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
    // The 204 drop (see the header): no error surface, nothing captured.
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

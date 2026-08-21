import {
  apiErrorResponseSchema,
  pushSubscribeResponseSchema,
  pushSubscribeSchema,
  pushUnsubscribeResponseSchema,
  pushUnsubscribeSchema,
} from "@miolos/core";
import type { NextRequest } from "next/server";

import {
  corsHeaders,
  isJsonContentType,
  preflightResponse,
} from "../../../src/cors";
import { getDb } from "../../../src/db";
import { isPushConfigured } from "../../../src/push/config";
import {
  deleteSubscription,
  upsertSubscription,
} from "../../../src/push/service";
import { SESSION_COOKIE_NAME } from "../../../src/session/cookie";
import {
  isCrossSiteWrite,
  warnIfGuardDegraded,
} from "../../../src/session/origin-guard";
import { requireUserId } from "../../../src/session/service";
import { captureEvent, runAfterResponse } from "../../../src/telemetry/capture";

// Never statically cached: every request writes the caller's rows.
export const dynamic = "force-dynamic";

/**
 * POST + DELETE /push/subscriptions (#145, ADR-0064) — one file, the
 * onboarding-seen write template twice over. Both verbs 503 via
 * `isPushConfigured()` BEFORE any side effect (the fail-closed dormancy
 * switch, the full VAPID triple): an unconfigured environment must not
 * collect subscriptions the dispatcher (#146) can never serve, and must
 * not pretend to delete what it never stores. Zod-parsed bodies, never
 * cast (the mechanical gate's boundary rule).
 *
 * - POST upserts on the endpoint PK: the browser install is the authority
 *   for its own capability URL — key rotation and the
 *   endpoint-follows-the-cookie case both land as an update, one row.
 * - DELETE removes the caller's OWN row only (endpoint AND user id):
 *   knowing another account's capability URL deletes nothing. Idempotent
 *   `{removed: true}` — the caller reconciles browser-side state, not a
 *   row count. It is #36's settings-toggle seam and #146's pruning
 *   sibling, live from this slice.
 *
 * The whole body of each verb is caught (the onboarding-seen route's
 * discipline): a transient DB throw would otherwise be the one branch
 * without the CORS grant.
 */

/** The per-route error envelope (the completions route's own convention). */
function errorResponse(status: number, error: string): Response {
  return Response.json(apiErrorResponseSchema.parse({ error }), {
    status,
    headers: corsHeaders({ credentials: true }),
  });
}

export function OPTIONS(): Response {
  // DELETE joins the grant (the preflightResponse doc's #145 note): the
  // JSON content type forces a preflight on both verbs.
  return preflightResponse("POST, DELETE, OPTIONS");
}

/**
 * The shared write preamble: origin guard, dormancy 503, content type,
 * auth, JSON body — in that order, so the cheap refusals cost nothing and
 * the 503 precedes every side effect. Returns either the failure Response
 * or the authenticated context.
 */
async function writePreamble(request: NextRequest): Promise<
  | { failure: Response }
  | {
      failure?: undefined;
      db: ReturnType<typeof getDb>;
      userId: string;
      raw: unknown;
    }
> {
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
    return { failure: errorResponse(403, "cross-site") };
  }

  if (!isPushConfigured()) {
    return { failure: errorResponse(503, "push-not-configured") };
  }

  if (!isJsonContentType(request.headers.get("content-type"))) {
    return { failure: errorResponse(415, "unsupported-media-type") };
  }

  const db = getDb();
  const userId = await requireUserId(
    db,
    request.cookies.get(SESSION_COOKIE_NAME)?.value,
  );
  if (!userId) {
    return { failure: errorResponse(401, "no-session") };
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { failure: errorResponse(400, "invalid-body") };
  }
  // The handle rides the context (#145 step-6 quality m5): getDb() has
  // deliberately no module-level cache, so returning this one saves each
  // verb constructing a second client for the same request.
  return { db, userId, raw };
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const context = await writePreamble(request);
    if (context.failure) {
      return context.failure;
    }

    const parsed = pushSubscribeSchema.safeParse(context.raw);
    if (!parsed.success) {
      return errorResponse(400, "invalid-body");
    }

    const { stored, inserted } = await upsertSubscription(context.db, {
      userId: context.userId,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
    });
    if (!stored) {
      // The per-user ceiling refused the row (#146, ADR-0068 decision 1 —
      // the late-write-ceiling status precedent). The shipped client reads
      // `response.ok` only, so this takes T-WEB-S271's unwind path: the
      // browser-side subscription is rolled back and nothing is stamped.
      return errorResponse(429, "too-many-requests");
    }

    // THE TELEMETRY SEAM (#33, ADR-0069): a GENUINE first insert only —
    // `inserted`, not `stored`, because the DO UPDATE arm also answers
    // `stored: true` (key rotation, identical re-subscribe, cross-user
    // repoint, #36's settings toggle) and each would re-count an opt-in
    // that already happened. A new endpoint on a second device IS a real
    // opt-in act and fires. Payload empty by decision: never the endpoint
    // or the keys. Post-response and throw-proof via `runAfterResponse`.
    if (inserted) {
      const userId = context.userId;
      runAfterResponse(() =>
        captureEvent({
          distinctId: userId,
          event: "notification_opt_in",
          properties: {},
        }),
      );
    }

    return Response.json(
      pushSubscribeResponseSchema.parse({ subscribed: true }),
      { headers: corsHeaders({ credentials: true }) },
    );
  } catch {
    return errorResponse(500, "internal");
  }
}

export async function DELETE(request: NextRequest): Promise<Response> {
  try {
    const context = await writePreamble(request);
    if (context.failure) {
      return context.failure;
    }

    const parsed = pushUnsubscribeSchema.safeParse(context.raw);
    if (!parsed.success) {
      return errorResponse(400, "invalid-body");
    }

    await deleteSubscription(context.db, context.userId, parsed.data.endpoint);

    return Response.json(
      pushUnsubscribeResponseSchema.parse({ removed: true }),
      { headers: corsHeaders({ credentials: true }) },
    );
  } catch {
    return errorResponse(500, "internal");
  }
}

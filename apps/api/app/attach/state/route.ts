import {
  apiErrorResponseSchema,
  attachStateResponseSchema,
  computeStreak,
} from "@miolos/core";
import { getRemoteConfig, todaySaoPaulo } from "@miolos/db/publishing";
import { listCompletionsForStreak } from "@miolos/db/user";
import type { NextRequest } from "next/server";

import { getAttachAccountState } from "../../../src/attach/service";
import { corsHeaders } from "../../../src/cors";
import { getDb } from "../../../src/db";
import { isAttachConfigured } from "../../../src/email/transport";
import { SESSION_COOKIE_NAME } from "../../../src/session/cookie";
import { requireUserId } from "../../../src/session/service";

// Never statically cached: every request reads the caller's rows.
export const dynamic = "force-dynamic";

/**
 * GET /attach/state (#21, ADR-0050 decision 9) — the authenticated-READ
 * template (the streak route's own conventions: no OPTIONS, no origin
 * guard, no-store on every branch, whole body caught). Serves ONE derived
 * boolean: the threshold never ships to the client (ADR-0048's rule kept
 * by a NEW endpoint, never a field appended to /streak), and "exactly
 * once" is fully server-owned — eligibility is
 *
 *   streak >= attachStreakThreshold (remote config, ADR-0025)
 *   AND email IS NULL
 *   AND attach_prompt_dismissed_at IS NULL
 *   AND the attach flow is configured — `isAttachConfigured`, the SAME
 *       full switch (RESEND_API_KEY and WEB_ORIGIN) the request route
 *       503s under, so a half-configured environment never renders a
 *       form whose submit would 503 (step-7 finding H).
 */

/** The per-route error envelope (the completions route's own convention). */
function errorResponse(status: number, error: string): Response {
  return Response.json(apiErrorResponseSchema.parse({ error }), {
    status,
    headers: {
      ...corsHeaders({ credentials: true }),
      "Cache-Control": "no-store",
    },
  });
}

function stateResponse(eligible: boolean): Response {
  return Response.json(attachStateResponseSchema.parse({ eligible }), {
    headers: {
      ...corsHeaders({ credentials: true }),
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: NextRequest): Promise<Response> {
  // The whole body is caught (the streak route's discipline): an unhandled
  // throw would be the one branch without no-store and the CORS grant.
  try {
    const db = getDb();
    // `requireUserId` never mints; auth stays first and a 401 costs zero
    // further queries.
    const userId = await requireUserId(
      db,
      request.cookies.get(SESSION_COOKIE_NAME)?.value,
    );
    if (!userId) {
      return errorResponse(401, "no-session");
    }

    // The cheap suppressions first; the streak read is the expensive one.
    if (!isAttachConfigured()) {
      return stateResponse(false);
    }
    const account = await getAttachAccountState(db, userId);
    if (
      !account ||
      account.email !== null ||
      account.attachPromptDismissedAt !== null
    ) {
      return stateResponse(false);
    }

    const [config, today, rows] = await Promise.all([
      getRemoteConfig(db),
      todaySaoPaulo(db),
      listCompletionsForStreak(db, userId),
    ]);
    const status = computeStreak(rows, today);
    return stateResponse(status.streak >= config.attachStreakThreshold);
  } catch {
    return errorResponse(500, "internal");
  }
}

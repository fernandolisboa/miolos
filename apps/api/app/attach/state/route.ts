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

/**
 * GET /attach/state — the authenticated-READ template (ADR-0048),
 * following ADR-0050 decision 9. Serves one derived boolean; the threshold
 * itself never ships to the client, so eligibility got a NEW endpoint
 * rather than a field appended to /streak.
 *
 * `isAttachConfigured` is the SAME full switch (RESEND_API_KEY and
 * WEB_ORIGIN) the request route 503s under, so a half-configured
 * environment never renders a form whose submit would fail.
 */
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const db = getDb();
    const userId = await requireUserId(
      db,
      request.cookies.get(SESSION_COOKIE_NAME)?.value,
    );
    if (!userId) {
      return errorResponse(401, "no-session");
    }

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

import {
  apiErrorResponseSchema,
  computeStreak,
  notificationsStateResponseSchema,
} from "@miolos/core";
import { getRemoteConfig, todaySaoPaulo } from "@miolos/db/publishing";
import { listCompletionsForStreak } from "@miolos/db/user";
import type { NextRequest } from "next/server";

import { corsHeaders } from "../../../src/cors";
import { getDb } from "../../../src/db";
import { isPushConfigured } from "../../../src/push/config";
import { getPushAccountState } from "../../../src/push/service";
import { SESSION_COOKIE_NAME } from "../../../src/session/cookie";
import { requireUserId } from "../../../src/session/service";

// Never statically cached: every request reads the caller's rows.
export const dynamic = "force-dynamic";

/**
 * GET /notifications/state (#145, ADR-0064) — the authenticated-READ
 * template, cloned from GET /attach/state (its own conventions: no OPTIONS
 * — a credentialed GET with no custom header never preflights — no origin
 * guard, no-store on every branch, whole body caught, cheap suppressions
 * before the streak read). Serves ONE derived boolean plus the VAPID
 * public key: the threshold never ships (ADR-0048's rule kept by a NEW
 * endpoint), and "exactly once" is fully server-owned — eligibility is
 *
 *   isPushConfigured() — the SAME full triple the subscribe routes 503
 *       under, so a half-configured environment never renders a prompt
 *       whose accept would fail
 *   AND push_prompt_dismissed_at IS NULL
 *   AND streak >= pushOptInStreakThreshold (remote config, ADR-0025)
 *
 * `vapidPublicKey` is the env value whenever configured (public by design;
 * one source of truth, the api env — no `NEXT_PUBLIC_` twin to drift), and
 * null otherwise.
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

function stateResponse(eligible: boolean, vapidPublicKey: string | null) {
  return Response.json(
    notificationsStateResponseSchema.parse({ eligible, vapidPublicKey }),
    {
      headers: {
        ...corsHeaders({ credentials: true }),
        "Cache-Control": "no-store",
      },
    },
  );
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
    if (!isPushConfigured()) {
      return stateResponse(false, null);
    }
    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY ?? null;
    const account = await getPushAccountState(db, userId);
    if (!account || account.pushPromptDismissedAt !== null) {
      return stateResponse(false, vapidPublicKey);
    }

    const [config, today, rows] = await Promise.all([
      getRemoteConfig(db),
      todaySaoPaulo(db),
      listCompletionsForStreak(db, userId),
    ]);
    const status = computeStreak(rows, today);
    return stateResponse(
      status.streak >= config.pushOptInStreakThreshold,
      vapidPublicKey,
    );
  } catch {
    return errorResponse(500, "internal");
  }
}

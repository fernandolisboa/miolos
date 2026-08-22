import { computeStreak, notificationsStateResponseSchema } from "@miolos/core";
import { getRemoteConfig, todaySaoPaulo } from "@miolos/db/publishing";
import { listCompletionsForStreak } from "@miolos/db/user";
import type { NextRequest } from "next/server";

import { authenticatedRead } from "../../../src/http/authenticated-read";
import { isPushConfigured } from "../../../src/push/config";
import { getPushAccountState } from "../../../src/push/service";

// Never statically cached: every request reads the caller's rows.
export const dynamic = "force-dynamic";

function statePayload(eligible: boolean, vapidPublicKey: string | null) {
  return notificationsStateResponseSchema.parse({ eligible, vapidPublicKey });
}

/**
 * GET /notifications/state — see ADR-0064. Serves one derived boolean plus
 * the VAPID public key; the threshold itself never ships.
 *
 * `isPushConfigured()` is the SAME full triple the subscribe routes 503
 * under, so a half-configured environment never renders a prompt whose
 * accept would fail. `vapidPublicKey` is the env value whenever
 * configured (public by design; one source of truth, the api env — no
 * `NEXT_PUBLIC_` twin to drift), and null otherwise.
 */
export function GET(request: NextRequest): Promise<Response> {
  return authenticatedRead(request, async (db, userId) => {
    if (!isPushConfigured()) {
      return statePayload(false, null);
    }
    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY ?? null;
    const account = await getPushAccountState(db, userId);
    if (!account || account.pushPromptDismissedAt !== null) {
      return statePayload(false, vapidPublicKey);
    }

    const [config, today, rows] = await Promise.all([
      getRemoteConfig(db),
      todaySaoPaulo(db),
      listCompletionsForStreak(db, userId),
    ]);
    const status = computeStreak(rows, today);
    return statePayload(
      status.streak >= config.pushOptInStreakThreshold,
      vapidPublicKey,
    );
  });
}

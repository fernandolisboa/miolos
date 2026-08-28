import { computeStreak, notificationsStateResponseSchema } from "@miolos/core";
import { getRemoteConfig, todaySaoPaulo } from "@miolos/db/publishing";
import { listCompletionsForStreak } from "@miolos/db/user";
import type { NextRequest } from "next/server";

import { authenticatedRead } from "../../../src/http/authenticated-read";
import { isPushConfigured } from "../../../src/push/config";
import { getPushAccountState } from "../../../src/push/service";

export const dynamic = "force-dynamic";

function statePayload(eligible: boolean, vapidPublicKey: string | null) {
  return notificationsStateResponseSchema.parse({ eligible, vapidPublicKey });
}

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

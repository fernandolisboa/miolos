import { attachStateResponseSchema, computeStreak } from "@miolos/core";
import { getRemoteConfig, todaySaoPaulo } from "@miolos/db/publishing";
import { listCompletionsForStreak } from "@miolos/db/user";
import type { NextRequest } from "next/server";

import { getAttachAccountState } from "../../../src/attach/service";
import { isEmailConfigured } from "../../../src/email/transport";
import { authenticatedRead } from "../../../src/http/authenticated-read";

export const dynamic = "force-dynamic";

function statePayload(eligible: boolean) {
  return attachStateResponseSchema.parse({ eligible });
}

export function GET(request: NextRequest): Promise<Response> {
  return authenticatedRead(request, async (db, userId) => {
    if (!isEmailConfigured()) {
      return statePayload(false);
    }
    const account = await getAttachAccountState(db, userId);
    if (
      !account ||
      account.email !== null ||
      account.attachPromptDismissedAt !== null
    ) {
      return statePayload(false);
    }

    const [config, today, rows] = await Promise.all([
      getRemoteConfig(db),
      todaySaoPaulo(db),
      listCompletionsForStreak(db, userId),
    ]);
    const status = computeStreak(rows, today);
    return statePayload(status.streak >= config.attachStreakThreshold);
  });
}

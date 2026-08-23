import { attachStateResponseSchema, computeStreak } from "@miolos/core";
import { getRemoteConfig, todaySaoPaulo } from "@miolos/db/publishing";
import { listCompletionsForStreak } from "@miolos/db/user";
import type { NextRequest } from "next/server";

import { getAttachAccountState } from "../../../src/attach/service";
import { isAttachConfigured } from "../../../src/email/transport";
import { authenticatedRead } from "../../../src/http/authenticated-read";

// Never statically cached: every request reads the caller's rows.
export const dynamic = "force-dynamic";

function statePayload(eligible: boolean) {
  return attachStateResponseSchema.parse({ eligible });
}

/**
 * GET /attach/state — ADR-0050 decision 9. Serves one derived boolean; the
 * threshold itself never ships to the client, so eligibility got a NEW
 * endpoint rather than a field appended to /streak.
 *
 * `isAttachConfigured` is the SAME full switch (RESEND_API_KEY and
 * WEB_ORIGIN) the request route 503s under, so a half-configured
 * environment never renders a form whose submit would fail.
 */
export function GET(request: NextRequest): Promise<Response> {
  return authenticatedRead(request, async (db, userId) => {
    if (!isAttachConfigured()) {
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

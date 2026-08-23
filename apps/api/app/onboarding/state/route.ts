import { onboardingStateResponseSchema } from "@miolos/core";
import type { NextRequest } from "next/server";

import { authenticatedRead } from "../../../src/http/authenticated-read";
import { getOnboardingState } from "../../../src/onboarding/service";

// Never statically cached: every request reads the caller's row.
export const dynamic = "force-dynamic";

/**
 * GET /onboarding/state — see ADR-0061. Serves one derived boolean; the
 * timestamp itself never ships (ADR-0048 decision 3).
 *
 * An unknown user id resolves `show: false` — fail closed: an identity we
 * cannot read is never nagged. `requireUserId` never mints: on a
 * genuinely first visit the card waits for the layout's own mint (the web
 * hook awaits `ensureSession()` before calling here).
 */
export function GET(request: NextRequest): Promise<Response> {
  return authenticatedRead(request, async (db, userId) => {
    const account = await getOnboardingState(db, userId);
    return onboardingStateResponseSchema.parse({
      show: account !== undefined && account.onboardingSeenAt === null,
    });
  });
}

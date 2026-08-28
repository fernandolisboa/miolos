import { onboardingStateResponseSchema } from "@miolos/core";
import type { NextRequest } from "next/server";

import { authenticatedRead } from "../../../src/http/authenticated-read";
import { getOnboardingState } from "../../../src/onboarding/service";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest): Promise<Response> {
  return authenticatedRead(request, async (db, userId) => {
    const account = await getOnboardingState(db, userId);
    return onboardingStateResponseSchema.parse({
      show: account !== undefined && account.onboardingSeenAt === null,
    });
  });
}

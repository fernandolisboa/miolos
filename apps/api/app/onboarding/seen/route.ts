import {
  onboardingSeenResponseSchema,
  onboardingSeenSchema,
} from "@miolos/core";
import type { NextRequest } from "next/server";

import { corsHeaders, preflightResponse } from "../../../src/cors";
import { errorResponse } from "../../../src/http/responses";
import { writePreamble } from "../../../src/http/write-preamble";
import { markOnboardingSeen } from "../../../src/onboarding/service";

export const dynamic = "force-dynamic";

export function OPTIONS(): Response {
  return preflightResponse();
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const context = await writePreamble(request, onboardingSeenSchema);
    if (context.failure) {
      return context.failure;
    }
    const { db, userId } = context;

    await markOnboardingSeen(db, userId);

    return Response.json(onboardingSeenResponseSchema.parse({ seen: true }), {
      headers: corsHeaders({ credentials: true }),
    });
  } catch {
    return errorResponse(500, "internal");
  }
}

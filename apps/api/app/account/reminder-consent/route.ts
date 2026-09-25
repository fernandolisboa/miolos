import {
  reminderConsentResponseSchema,
  reminderConsentSchema,
} from "@miolos/core";
import type { NextRequest } from "next/server";

import {
  grantReminderConsent,
  withdrawReminderConsent,
} from "../../../src/account/service";
import { corsHeaders, preflightResponse } from "../../../src/cors";
import { errorResponse } from "../../../src/http/responses";
import { writePreamble } from "../../../src/http/write-preamble";

export const dynamic = "force-dynamic";

export function OPTIONS(): Response {
  return preflightResponse();
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const context = await writePreamble(request, reminderConsentSchema);
    if (context.failure) {
      return context.failure;
    }

    if (!context.body.granted) {
      await withdrawReminderConsent(context.db, context.userId);
    } else if (!(await grantReminderConsent(context.db, context.userId))) {
      return errorResponse(409, "no-email");
    }

    return Response.json(
      reminderConsentResponseSchema.parse({
        reminderConsent: context.body.granted,
      }),
      { headers: corsHeaders({ credentials: true }) },
    );
  } catch {
    return errorResponse(500, "internal");
  }
}

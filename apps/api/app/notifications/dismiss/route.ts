import {
  notificationsDismissResponseSchema,
  notificationsDismissSchema,
} from "@miolos/core";
import type { NextRequest } from "next/server";

import { corsHeaders, preflightResponse } from "../../../src/cors";
import { errorResponse } from "../../../src/http/responses";
import { writePreamble } from "../../../src/http/write-preamble";
import { dismissPushPrompt } from "../../../src/push/service";

export const dynamic = "force-dynamic";

export function OPTIONS(): Response {
  return preflightResponse();
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const context = await writePreamble(request, notificationsDismissSchema);
    if (context.failure) {
      return context.failure;
    }
    const { db, userId } = context;

    await dismissPushPrompt(db, userId);

    return Response.json(
      notificationsDismissResponseSchema.parse({ dismissed: true }),
      { headers: corsHeaders({ credentials: true }) },
    );
  } catch {
    return errorResponse(500, "internal");
  }
}

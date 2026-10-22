import { telemetryChoiceSchema } from "@miolos/core";
import type { NextRequest } from "next/server";

import { setTelemetrySending } from "../../../src/account/service";
import { corsHeaders, preflightResponse } from "../../../src/cors";
import { errorResponse } from "../../../src/http/responses";
import { writePreamble } from "../../../src/http/write-preamble";

export const dynamic = "force-dynamic";

export function OPTIONS(): Response {
  return preflightResponse();
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const context = await writePreamble(request, telemetryChoiceSchema);
    if (context.failure) {
      return context.failure;
    }
    await setTelemetrySending(context.db, context.userId, context.body.sending);
    return Response.json(
      telemetryChoiceSchema.parse({ sending: context.body.sending }),
      { headers: corsHeaders({ credentials: true }) },
    );
  } catch {
    return errorResponse(500, "internal");
  }
}

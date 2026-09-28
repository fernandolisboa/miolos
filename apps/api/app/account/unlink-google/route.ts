import {
  accountUnlinkGoogleResponseSchema,
  accountUnlinkGoogleSchema,
} from "@miolos/core";
import type { NextRequest } from "next/server";

import { corsHeaders, preflightResponse } from "../../../src/cors";
import { unlinkGoogle } from "../../../src/google/service";
import { errorResponse } from "../../../src/http/responses";
import { writePreamble } from "../../../src/http/write-preamble";

export const dynamic = "force-dynamic";

export function OPTIONS(): Response {
  return preflightResponse();
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const context = await writePreamble(request, accountUnlinkGoogleSchema);
    if (context.failure) {
      return context.failure;
    }

    if (!(await unlinkGoogle(context.db, context.userId))) {
      return errorResponse(409, "no-google");
    }

    return Response.json(
      accountUnlinkGoogleResponseSchema.parse({ unlinked: true }),
      { headers: corsHeaders({ credentials: true }) },
    );
  } catch {
    return errorResponse(500, "internal");
  }
}

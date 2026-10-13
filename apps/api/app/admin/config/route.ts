import { adminConfigWriteSchema, adminStateResponseSchema } from "@miolos/core";
import { getRemoteConfig, setRemoteConfigValue } from "@miolos/db/publishing";
import type { NextRequest } from "next/server";

import { isAdmin } from "../../../src/admin/allow-list";
import { corsHeaders, preflightResponse } from "../../../src/cors";
import { errorResponse } from "../../../src/http/responses";
import { writePreamble } from "../../../src/http/write-preamble";

export const dynamic = "force-dynamic";

export function OPTIONS(): Response {
  return preflightResponse();
}

function webOriginUnset(): Response | undefined {
  return process.env.WEB_ORIGIN
    ? undefined
    : errorResponse(503, "web-origin-unconfigured");
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const context = await writePreamble(
      request,
      adminConfigWriteSchema,
      webOriginUnset,
    );
    if (context.failure) {
      return context.failure;
    }
    if (!isAdmin(context.userId)) {
      return errorResponse(403, "not-admin");
    }

    await setRemoteConfigValue(
      context.db,
      context.body.key,
      context.body.value,
    );
    return Response.json(
      adminStateResponseSchema.parse({
        userId: context.userId,
        config: await getRemoteConfig(context.db),
      }),
      { headers: corsHeaders({ credentials: true }) },
    );
  } catch {
    return errorResponse(500, "internal");
  }
}

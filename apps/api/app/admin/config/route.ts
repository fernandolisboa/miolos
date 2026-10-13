import { adminConfigWriteSchema } from "@miolos/core";
import { adminRoleOf, setRemoteConfigValue } from "@miolos/db/publishing";
import type { NextRequest } from "next/server";

import { adminState } from "../../../src/admin/state";
import { corsHeaders, preflightResponse } from "../../../src/cors";
import { errorResponse } from "../../../src/http/responses";
import { writePreamble } from "../../../src/http/write-preamble";
import { webOriginUnset } from "../../../src/http/web-origin-unset";

export const dynamic = "force-dynamic";

export function OPTIONS(): Response {
  return preflightResponse();
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
    const { role } = await adminRoleOf(context.db, context.userId);
    if (role === null) {
      return errorResponse(403, "not-admin");
    }

    await setRemoteConfigValue(
      context.db,
      context.body.key,
      context.body.value,
    );
    console.info("admin config write", {
      userId: context.userId,
      key: context.body.key,
      value: context.body.value,
    });
    return Response.json(await adminState(context.db, context.userId), {
      headers: corsHeaders({ credentials: true }),
    });
  } catch {
    return errorResponse(500, "internal");
  }
}

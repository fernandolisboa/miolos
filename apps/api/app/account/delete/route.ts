import { accountDeleteResponseSchema, accountDeleteSchema } from "@miolos/core";
import { eq, users } from "@miolos/db";
import type { NextRequest } from "next/server";

import { corsHeaders, preflightResponse } from "../../../src/cors";
import { writePreamble } from "../../../src/http/write-preamble";
import { buildSessionClearingCookie } from "../../../src/session/cookie";

export const dynamic = "force-dynamic";

export function OPTIONS(): Response {
  return preflightResponse();
}

export async function POST(request: NextRequest): Promise<Response> {
  const context = await writePreamble(request, accountDeleteSchema);
  if (context.failure) {
    return context.failure;
  }
  const { db, userId } = context;

  await db.delete(users).where(eq(users.id, userId));

  const response = Response.json(
    accountDeleteResponseSchema.parse({ deleted: true }),
    { headers: corsHeaders({ credentials: true }) },
  );
  response.headers.append("Set-Cookie", buildSessionClearingCookie());
  return response;
}

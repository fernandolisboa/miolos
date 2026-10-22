import { attachDismissResponseSchema, attachDismissSchema } from "@miolos/core";
import type { NextRequest } from "next/server";

import { writePreamble } from "../../../src/http/write-preamble";
import { dismissAttachPrompt } from "../../../src/attach/service";
import { corsHeaders, preflightResponse } from "../../../src/cors";

export const dynamic = "force-dynamic";

export function OPTIONS(): Response {
  return preflightResponse();
}

export async function POST(request: NextRequest): Promise<Response> {
  const context = await writePreamble(request, attachDismissSchema);
  if (context.failure) {
    return context.failure;
  }
  const { db, userId } = context;

  await dismissAttachPrompt(db, userId);

  return Response.json(attachDismissResponseSchema.parse({ dismissed: true }), {
    headers: corsHeaders({ credentials: true }),
  });
}

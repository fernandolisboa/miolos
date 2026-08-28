import { apiErrorResponseSchema } from "@miolos/core";

import { corsHeaders } from "../cors";

export function errorResponse(status: number, error: string): Response {
  return Response.json(apiErrorResponseSchema.parse({ error }), {
    status,
    headers: corsHeaders({ credentials: true }),
  });
}

export function readResponse(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      ...corsHeaders({ credentials: true }),
      "Cache-Control": "no-store",
    },
  });
}

export function readErrorResponse(status: number, error: string): Response {
  return readResponse(apiErrorResponseSchema.parse({ error }), status);
}

import { apiErrorResponseSchema } from "@miolos/core";

import { corsHeaders } from "../cors";

/**
 * The error envelope for a MUTATION route: the credentialed CORS grant, and
 * deliberately no `Cache-Control` — browsers and intermediaries do not cache
 * POST or DELETE responses, so the header the reads carry would be noise here.
 * `readResponse` below is the read side, and the split is the whole point:
 * every GET gets `no-store`, no mutation does.
 */
export function errorResponse(status: number, error: string): Response {
  return Response.json(apiErrorResponseSchema.parse({ error }), {
    status,
    headers: corsHeaders({ credentials: true }),
  });
}

/**
 * The envelope for an authenticated READ, on every branch including the
 * catch — see ADR-0048 D3 and ADR-0060 D1. Only `authenticatedRead` calls it;
 * it lives here so the error envelope has one owner rather than two.
 */
export function readResponse(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      ...corsHeaders({ credentials: true }),
      "Cache-Control": "no-store",
    },
  });
}

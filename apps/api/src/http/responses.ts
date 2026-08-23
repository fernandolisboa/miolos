import { apiErrorResponseSchema } from "@miolos/core";

import { corsHeaders } from "../cors";

/**
 * The error envelope for a MUTATION route: the credentialed CORS grant, and
 * deliberately no `Cache-Control` — browsers and intermediaries do not cache
 * POST or DELETE responses, so the header the reads carry would be noise here.
 * `readResponse` below is the read side, and the split is the whole point:
 * every AUTHENTICATED GET — the eight that go through `authenticatedRead` —
 * gets `no-store`, and no mutation does. The public GETs (the four `daily/*`,
 * `buffer-depth`, `health`, `cron/publish` and the root) set no
 * `Cache-Control` at all; this rule does not reach them.
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

/**
 * The error envelope for an authenticated READ: the same body as
 * `errorResponse`, with the read side's `no-store`. Both of
 * `authenticatedRead`'s error branches go through it, so the body is built in
 * one place rather than once per cache posture.
 */
export function readErrorResponse(status: number, error: string): Response {
  return readResponse(apiErrorResponseSchema.parse({ error }), status);
}

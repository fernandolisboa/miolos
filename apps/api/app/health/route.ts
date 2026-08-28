import { healthResponseSchema, type HealthResponse } from "@miolos/core";

import { corsHeaders } from "../../src/cors";

export const dynamic = "force-dynamic";

export function GET(): Response {
  const body: HealthResponse = {
    status: "ok",
    service: "api",
    timestamp: new Date().toISOString(),
  };
  return Response.json(healthResponseSchema.parse(body), {
    headers: corsHeaders(),
  });
}

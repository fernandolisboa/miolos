import { apiRootResponseSchema, type ApiRootResponse } from "@miolos/core";

import { corsHeaders } from "../src/cors";

// Root response so the app answers at / without any page or layout.
export function GET(): Response {
  const body: ApiRootResponse = { service: "api" };
  return Response.json(apiRootResponseSchema.parse(body), {
    headers: corsHeaders(),
  });
}

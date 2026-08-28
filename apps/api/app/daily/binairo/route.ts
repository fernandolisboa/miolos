import { dailyBinairoResponseSchema } from "@miolos/core";
import { getTodayDaily } from "@miolos/db";

import { corsHeaders } from "../../../src/cors";
import { getDb } from "../../../src/db";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const db = getDb();
  const daily = await getTodayDaily(db, "binairo");
  if (!daily) {
    return Response.json({}, { status: 404, headers: corsHeaders() });
  }

  return Response.json(dailyBinairoResponseSchema.parse(daily), {
    headers: corsHeaders(),
  });
}

import type { ProjectedGame } from "@miolos/core";
import { getTodayDaily } from "@miolos/db";

import { corsHeaders } from "./cors";
import { getDb } from "./db";

export function dailyRoute(
  game: ProjectedGame,
  schema: { parse(daily: unknown): unknown },
): () => Promise<Response> {
  return async () => {
    const daily = await getTodayDaily(getDb(), game);
    if (!daily) {
      return Response.json({}, { status: 404, headers: corsHeaders() });
    }

    return Response.json(schema.parse(daily), { headers: corsHeaders() });
  };
}

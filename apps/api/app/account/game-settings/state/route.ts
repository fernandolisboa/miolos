import { gameSettingsStateResponseSchema } from "@miolos/core";
import type { NextRequest } from "next/server";

import { readGameSettings } from "../../../../src/account/service";
import { authenticatedRead } from "../../../../src/http/authenticated-read";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest): Promise<Response> {
  return authenticatedRead(request, async (db, userId) =>
    gameSettingsStateResponseSchema.parse({
      settings: await readGameSettings(db, userId),
    }),
  );
}

import { accountGoogleResponseSchema } from "@miolos/core";
import type { NextRequest } from "next/server";

import { googleClient } from "../../../src/google/oauth";
import { readGoogleState } from "../../../src/google/service";
import { authenticatedRead } from "../../../src/http/authenticated-read";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest): Promise<Response> {
  return authenticatedRead(request, async (db, userId) =>
    accountGoogleResponseSchema.parse({
      google: await readGoogleState(db, userId, googleClient() !== undefined),
    }),
  );
}

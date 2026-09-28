import { accountGoogleResponseSchema } from "@miolos/core";
import type { NextRequest } from "next/server";

import { googleClient } from "../../../src/google/oauth";
import { readGoogleLink } from "../../../src/google/service";
import { authenticatedRead } from "../../../src/http/authenticated-read";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest): Promise<Response> {
  return authenticatedRead(request, async (db, userId) => {
    let google: "unavailable" | "unlinked" | "linked" = "unavailable";
    if (await readGoogleLink(db, userId)) {
      google = "linked";
    } else if (googleClient()) {
      google = "unlinked";
    }
    return accountGoogleResponseSchema.parse({ google });
  });
}

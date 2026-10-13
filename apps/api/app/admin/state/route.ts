import { adminStateResponseSchema } from "@miolos/core";
import { getRemoteConfig } from "@miolos/db/publishing";
import type { NextRequest } from "next/server";

import { isAdmin } from "../../../src/admin/allow-list";
import { authenticatedRead } from "../../../src/http/authenticated-read";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest): Promise<Response> {
  return authenticatedRead(request, async (db, userId) =>
    adminStateResponseSchema.parse({
      userId,
      config: isAdmin(userId) ? await getRemoteConfig(db) : null,
    }),
  );
}

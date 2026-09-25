import { accountStateResponseSchema } from "@miolos/core";
import type { NextRequest } from "next/server";

import { getAccountState } from "../../../src/account/service";
import { authenticatedRead } from "../../../src/http/authenticated-read";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest): Promise<Response> {
  return authenticatedRead(request, async (db, userId) =>
    accountStateResponseSchema.parse(await getAccountState(db, userId)),
  );
}

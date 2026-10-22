import { telemetryChoiceSchema } from "@miolos/core";
import type { NextRequest } from "next/server";

import { telemetryOptedOut } from "../../../../src/account/service";
import { authenticatedRead } from "../../../../src/http/authenticated-read";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest): Promise<Response> {
  return authenticatedRead(request, async (db, userId) =>
    telemetryChoiceSchema.parse({
      sending: !(await telemetryOptedOut(db, userId)),
    }),
  );
}

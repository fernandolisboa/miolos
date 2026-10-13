import type { NextRequest } from "next/server";

import { adminState } from "../../../src/admin/state";
import { authenticatedRead } from "../../../src/http/authenticated-read";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest): Promise<Response> {
  return authenticatedRead(request, adminState);
}

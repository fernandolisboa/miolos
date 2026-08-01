import { createHash, timingSafeEqual } from "node:crypto";

import { cronPublishResponseSchema } from "@miolos/core";
import { getRemoteConfig } from "@miolos/db/publishing";
import type { NextRequest } from "next/server";

import { getDb } from "../../../src/db";
import {
  effectiveThreshold,
  topUpBinairoBuffer,
} from "../../../src/publishing/service";

// Never statically cached: every invocation must reconcile against the db.
export const dynamic = "force-dynamic";

/**
 * Fail-closed cron auth (plan 014 D15): unset CRON_SECRET → 401, missing
 * or mismatched bearer → 401. Deliberately NOT WEB_ORIGIN's fail-open —
 * an open publish endpoint is a generation-loop DoS. Comparison is
 * SHA-256-both-sides then timingSafeEqual (equal-length digests by
 * construction): after ADR-0022 engineered timing-sensitive comparisons
 * out of the codebase, this endpoint does not reintroduce one. Vercel
 * sends `Authorization: Bearer <CRON_SECRET>` on cron invocations.
 */
function isAuthorized(authorizationHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !authorizationHeader) {
    return false;
  }
  const received = createHash("sha256").update(authorizationHeader).digest();
  const expected = createHash("sha256").update(`Bearer ${secret}`).digest();
  return timingSafeEqual(received, expected);
}

/**
 * GET /cron/publish — idempotent top-up of the binairo buffer to the
 * remote-configured depth (issue #17 AC 2/AC 4, ADR-0010). Not a browser
 * endpoint: no CORS, no OPTIONS. The non-2xx on a shallow post-run depth
 * is Vercel-log observability only — the real alerting reads
 * GET /buffer-depth (AC 3; cron exit codes are not the signal).
 */
export async function GET(request: NextRequest): Promise<Response> {
  if (!isAuthorized(request.headers.get("authorization"))) {
    return new Response(null, { status: 401 });
  }
  const db = getDb();
  const config = await getRemoteConfig(db);
  const { generated, depth, failures } = await topUpBinairoBuffer(
    db,
    config.bufferDepth,
  );
  console.log(
    JSON.stringify({
      event: "cron-publish",
      game: "binairo",
      generated,
      depth,
      failures,
    }),
  );
  const body = cronPublishResponseSchema.parse({
    game: "binairo",
    generated,
    depth,
    failures,
  });
  return Response.json(body, {
    status: depth >= effectiveThreshold(config.bufferDepth) ? 200 : 500,
  });
}

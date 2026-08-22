import {
  apiErrorResponseSchema,
  dayGamesFromRows,
  dayResponseSchema,
  dayStateFromRows,
} from "@miolos/core";
import {
  getPublishedNonogramMotifName,
  todaySaoPaulo,
} from "@miolos/db/publishing";
import { listCompletionsForDay } from "@miolos/db/user";
import type { NextRequest } from "next/server";

import { corsHeaders } from "../../src/cors";
import { getDb } from "../../src/db";
import { SESSION_COOKIE_NAME } from "../../src/session/cookie";
import { requireUserId } from "../../src/session/service";

// Never statically cached: every request reads the caller's rows.
export const dynamic = "force-dynamic";

/**
 * GET /day — the server day-truth payload; see ADR-0060.
 *
 * SECURITY: this route takes NO parameters — the user comes from the
 * cookie, the day from the DB clock. A `?date=` would be the archive read
 * ADR-0053 decision 10 already refused, and it is the ADR-0004 surface:
 * with nothing to ask, there is no way to request tomorrow. That absence is
 * also what makes the Nonogram motif name (ADR-0070) safe to carry — it
 * only ever rides the caller's OWN completed day.
 *
 * `Cache-Control: no-store` and the credentialed CORS grant apply on every
 * branch including the catch: this is per-user data, and a shared cache
 * serving one user's day to another is the failure this discipline exists
 * to prevent.
 *
 * No OPTIONS handler: a credentialed GET with no custom request headers is
 * a CORS simple request, so the browser never preflights it.
 */

function errorResponse(status: number, error: string): Response {
  return Response.json(apiErrorResponseSchema.parse({ error }), {
    status,
    headers: {
      ...corsHeaders({ credentials: true }),
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: NextRequest): Promise<Response> {
  // The whole body is caught: an unhandled throw would otherwise be the one
  // branch without `no-store` and the CORS grant every intentional branch
  // carries.
  try {
    const db = getDb();
    // `requireUserId` never mints: a cookieless GET is 401, and
    // SessionBootstrap owns minting. Auth runs FIRST and sequential — a 401
    // must cost zero queries.
    const userId = await requireUserId(
      db,
      request.cookies.get(SESSION_COOKIE_NAME)?.value,
    );
    if (!userId) {
      return errorResponse(401, "no-session");
    }

    // SEQUENTIAL: the completions read is scoped by `today`, so it cannot
    // start before the clock answers (ADR-0051 decision 3).
    const today = await todaySaoPaulo(db);
    const rows = await listCompletionsForDay(db, userId, today);

    // The motif name (ADR-0070) is read CONDITIONALLY, on the same status
    // derivation the claim fold itself uses (`dayStateFromRows`), never a
    // hand-rolled "did they win the nonogram" scan that could drift from
    // it. Most callers pay no extra query: the read only runs for a user
    // whose Nonogram is already `completed`. The helper never throws — a
    // bad row degrades to no name rather than 500ing the whole payload.
    const motifName =
      dayStateFromRows(rows).nonogram === "completed"
        ? await getPublishedNonogramMotifName(db, today)
        : undefined;

    return Response.json(
      // Parse, never cast (boundary rule) — the same strict schema the web
      // client parses on arrival.
      dayResponseSchema.parse({
        date: today,
        games: dayGamesFromRows(
          rows,
          // Truthiness, not `!== undefined`: belt-and-suspenders with the
          // wall read's own blank-name normalisation above.
          motifName ? { nonogramMotifName: motifName } : undefined,
        ),
      }),
      {
        headers: {
          ...corsHeaders({ credentials: true }),
          "Cache-Control": "no-store",
        },
      },
    );
  } catch {
    return errorResponse(500, "internal");
  }
}

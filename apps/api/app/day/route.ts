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
 * GET /day — the server day-truth payload (#83, ADR-0060). A verbatim clone
 * of the `GET /streak` authenticated-read template (ADR-0048, plan 027 §7),
 * including its deliberate absences, each of which is a decision rather
 * than an omission:
 *
 * - No OPTIONS handler and no `preflightResponse` change: a credentialed
 *   GET with no custom request headers is a CORS simple request — the
 *   browser never preflights it (the same Fetch-spec reasoning
 *   `session/bootstrap.ts` records for the body-less POST). Widening the
 *   shared preflight's "POST, OPTIONS" for a preflight that never occurs
 *   would be change without a caller.
 * - No origin guard: it protects writes; a read mutates nothing, and its
 *   confidentiality is the CORS allowlist plus the cookie.
 * - No content-type check: there is no body.
 * - No request parameters at all: the user is the cookie, the day is the DB
 *   clock. A `?date=` would be an archive feature and ADR-0053 decision 10
 *   refuses it; it is also the ADR-0004 surface — with no parameter there
 *   is no way to ask this route about tomorrow. `T-API-S113` pins that a
 *   query string is ignored rather than honoured. **This is what makes #64's
 *   motif name safe to carry** (ADR-0070): the payload is the caller's own
 *   day and nothing else, so a name that rides a `completed` claim rides a
 *   day this user has already finished. There is no parameter to point at
 *   someone else's day or at a future one.
 *
 * SINCE #64 THIS ROUTE READS `daily_puzzles`, which it never did before —
 * it touched only the clock and `completions`. The read is conditional (only
 * for a caller whose Nonogram already reads `completed`) and the helper
 * behind it never throws, both of which matter: an escaping error there
 * would 500 the whole day payload — hub, four tiles, every completed view —
 * over a field that is progressive enhancement.
 *
 * `Cache-Control: no-store` on EVERY branch including the catch, and the
 * CORS grant with it: this is user data, and a shared cache serving one
 * user's day to another is the failure the discipline exists for (step-6
 * finding security LOW 1; `T-API-S53`'s shape, `T-API-S111` here).
 *
 * ANONYMOUS-TOLERANT WAS REJECTED. A 200 with four `pending`s for a caller
 * with no session is indistinguishable from a real answer and would cost a
 * branch on every consumer to tell them apart. 401 is the shipped
 * precedent, and the web client treats every non-200 identically — it
 * degrades to the local reader, which is the honest offline answer anyway.
 */

/** The per-route error envelope (the completions route's own convention). */
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
  // branch whose response carries neither `no-store` nor the CORS grant, so
  // the failure mode would leak the discipline every intentional branch
  // keeps (step-6 finding security LOW 1). T-API-S111 pins it.
  try {
    const db = getDb();
    // `requireUserId` never mints (service.ts): a GET from a cookieless
    // client is 401, and SessionBootstrap owns minting. Auth stays FIRST
    // and sequential — a 401 must cost zero queries (T-API-S110).
    const userId = await requireUserId(
      db,
      request.cookies.get(SESSION_COOKIE_NAME)?.value,
    );
    if (!userId) {
      return errorResponse(401, "no-session");
    }

    // SEQUENTIAL, where `/streak` runs its two reads in one round-trip
    // window: the day read is SCOPED BY the day, so it cannot start before
    // the clock answers. That is the cost of a narrow read and it is the
    // trade ADR-0051 decision 3 asks for — two round trips against four
    // rows, instead of one against the user's whole history.
    const today = await todaySaoPaulo(db);
    const rows = await listCompletionsForDay(db, userId, today);

    // The motif name (#64, ADR-0070), folded ONCE and read CONDITIONALLY.
    //
    // The condition is the same status derivation the claim fold itself
    // uses — `dayStateFromRows`, exported for exactly this — never a
    // hand-rolled "did they win the nonogram" scan, which would be a second
    // spelling of the publication rule and free to drift from the first.
    // Because of it most callers pay for no extra query at all: the read
    // only happens for a user who has already finished today's Nonogram.
    //
    // `if (motifName)` below is TRUTHINESS, deliberately, never
    // `!== undefined`: `getPublishedNonogramMotifName` already normalises a
    // blank stored name away, and this is the second guard on the path that
    // would otherwise put `motifName: ""` into the parse two lines down and
    // 500 the entire payload.
    const motifName =
      dayStateFromRows(rows).nonogram === "completed"
        ? await getPublishedNonogramMotifName(db, today)
        : undefined;

    return Response.json(
      // Parse, never cast (boundary rule) — the same strict schema the web
      // client parses on arrival. `dayGamesFromRows` (#141) is
      // `dayStateFromRows` plus the completed grid row's `elapsedMs`, plus
      // since #142 its `hintsUsed` and since #64 the completed Nonogram's
      // `motifName`; the per-game publication rules all live in
      // packages/core, beside the fold, and this route supplies content
      // rather than deciding who may see it.
      dayResponseSchema.parse({
        date: today,
        games: dayGamesFromRows(
          rows,
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

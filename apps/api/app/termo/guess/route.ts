import {
  apiErrorResponseSchema,
  termoDailyContentSchema,
  termoGuessRequestSchema,
  termoGuessResponseSchema,
} from "@miolos/core";
import {
  getPublishedDailyWithSolution,
  todaySaoPaulo,
} from "@miolos/db/publishing";
import {
  deriveBoardStatus,
  evaluateGuess,
  isValidGuess,
} from "@miolos/games/termo";
import type { NextRequest } from "next/server";

import { corsHeaders, preflightResponse } from "../../../src/cors";
import { getDb } from "../../../src/db";
import { ACCEPTED_DAYS_BACK, addDays } from "../../../src/publishing/dates";
import { SESSION_COOKIE_NAME } from "../../../src/session/cookie";
import {
  isCrossSiteWrite,
  warnIfGuardDegraded,
} from "../../../src/session/origin-guard";
import { requireUserId } from "../../../src/session/service";

// Never statically cached: every request judges against the database.
export const dynamic = "force-dynamic";

/**
 * Every response carries the credentialed CORS grant, 4xx included — the same
 * rule and the same reason as `POST /completions`, applied to a TURN rather
 * than to a result. On a credentialed cross-origin fetch a response without
 * these headers is unreadable to JS (the promise rejects with a TypeError
 * indistinguishable from being offline), and on this route the STATUS is the
 * screen's control flow: a 422 clears the guess with "não está na lista", a
 * 5xx or a network failure HOLDS the turn (ADR-0039 decision 3). Losing the
 * distinction would cost the player a guess or hang the board.
 *
 * Duplicated from `app/completions/route.ts` rather than shared: two six-line
 * helpers in two route modules is cheaper than a new `apps/api/src` surface,
 * and a route's error envelope is exactly the thing that should stay visible
 * in the route.
 */
function errorResponse(status: number, error: string): Response {
  return Response.json(apiErrorResponseSchema.parse({ error }), {
    status,
    headers: corsHeaders({ credentials: true }),
  });
}

/** `application/json`, parameters allowed (`; charset=utf-8`). */
function isJsonContentType(header: string | null): boolean {
  if (header === null) {
    return false;
  }
  return header.split(";")[0]?.trim().toLowerCase() === "application/json";
}

export function OPTIONS(): Response {
  return preflightResponse();
}

/**
 * POST /termo/guess — the product's first MID-GAME judgement (ADR-0038).
 *
 * STATELESS by construction: the client posts the whole guess list every time
 * and the server re-judges all of it against the stored answer, holding
 * nothing between requests. There is no guess table and no session-scoped
 * memory, so a replay is idempotent for free and a lost response costs a
 * re-post rather than a turn. **This route WRITES NOTHING.**
 *
 * The gate order copies `app/completions/route.ts` exactly, because every one
 * of those gates has a recorded reason:
 *
 *  1. `warnIfGuardDegraded()` — called first by every route that depends on
 *     the guard.
 *  2. the cross-site guard, BEFORE `getDb()`               → 403 cross-site
 *  3. `Content-Type: application/json`, before the body    → 415
 *  4. `requireUserId` — never mints                        → 401 no-session
 *  5. `termoGuessRequestSchema.safeParse`                  → 400 invalid-body
 *  6. the shared `ACCEPTED_DAYS_BACK` bound                → 404 no-puzzle
 *  7. `getPublishedDailyWithSolution` (the wall)           → 404 no-puzzle
 *  8. `termoDailyContentSchema.parse` on the stored row    → 500 (a drifted
 *     row is deliberately loud: a 200 has to mean playable)
 *  9. `isValidGuess` on every guess                        → 422 invalid-guess
 * 10. the explicit "no row follows a winning row" check    → 422 invalid-guess
 * 11. `evaluateGuess` × n, then `deriveBoardStatus`
 * 12. `termoGuessResponseSchema.parse`                     → 200
 *
 * TWO HONEST CAVEATS, because neither is what it looks like. The cross-site
 * guard is NOT load-bearing here: `isCrossSiteWrite` denies on positive
 * evidence only and allows a request carrying neither header, so `curl` walks
 * past it — what stops a hostile browser PAGE reading a response is the
 * exact-origin CORS grant. And minting is unthrottled (ADR-0022 as amended by
 * ADR-0026), so "one session cookie" is not a real cost to an attacker.
 *
 * THE ABUSE POSTURE, counted in neon-http round trips — the unit that bills,
 * and `src/session/service.ts` records the rule ("each statement is its own
 * neon-http round trip"). Three per guess, each its own trip: `resolveSession`
 * through `requireUserId` (plus a conditional `last_seen_at` bump, at most
 * once an hour per session), `todaySaoPaulo`, and
 * `getPublishedDailyWithSolution`. `GET /daily/<game>` is ONE. So this route
 * costs 3× per request, not less — the "strictly cheaper than the public
 * read" claim an earlier draft made is false and is withdrawn here and in
 * ADR-0038 consequence (f). `apps/web` calls `/daily/termo` ZERO times, while
 * a player who finishes a Termo calls this ~6× per day: ≈18 round trips per
 * player-day. **No rate limiting ships in #27**, and the posture rests on
 * four things that do not depend on the comparison: the route is
 * authenticated where the public reads are not; it writes nothing; its work
 * is bounded by the schema at ≤6 words of exactly five bytes before any
 * engine call; and ADR-0026's revisit trigger is an observed abuse signal,
 * not a new route with a different cost profile.
 *
 * WHAT THE `.max(6)` DOES NOT BOUND: zod parses every array element before
 * the `.max()` rejects the array, so a body carrying 10 000 five-letter
 * strings is fully parsed first (≈4.4 ms). That is byte-for-byte the shape
 * `POST /completions` has shipped since #18, so nothing new is introduced —
 * and the real bound is Vercel's ~4.5 MB request-body limit, not the schema.
 * No `Content-Length` pre-check ships; it would guard a limit the platform
 * already enforces.
 *
 * THE ORACLE, stated rather than papered over (ADR-0038 decision 9). ONE
 * authenticated request carrying six arbitrary dictionary words returns the
 * canonical answer: six rows with no all-correct row is a terminal board, so
 * `status` is `"lost"` and the response schema then REQUIRES `answer`. There
 * is no adaptivity and no search. This is not a confidentiality boundary and
 * must never be cited as one — server judging exists because the client
 * structurally has no answer to judge against.
 */
export async function POST(request: NextRequest): Promise<Response> {
  warnIfGuardDegraded();

  if (
    isCrossSiteWrite(
      {
        secFetchSite: request.headers.get("sec-fetch-site"),
        origin: request.headers.get("origin"),
      },
      process.env.WEB_ORIGIN,
    )
  ) {
    // No DB touch at all: the guard runs before getDb().
    return errorResponse(403, "cross-site");
  }

  // Before the body is read: requiring a JSON content type forces a CORS
  // preflight on every cross-origin attempt, so the WEB_ORIGIN grant becomes
  // load-bearing rather than the origin guard alone.
  if (!isJsonContentType(request.headers.get("content-type"))) {
    return errorResponse(415, "unsupported-media-type");
  }

  const db = getDb();
  const userId = await requireUserId(
    db,
    request.cookies.get(SESSION_COOKIE_NAME)?.value,
  );
  if (!userId) {
    return errorResponse(401, "no-session");
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return errorResponse(400, "invalid-body");
  }
  const parsed = termoGuessRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return errorResponse(400, "invalid-body");
  }
  const body = parsed.data;

  // Enforced against the DATABASE clock (ADR-0010 single authority), never
  // `new Date()`. String comparison is exact for 'YYYY-MM-DD'. The bound is
  // shared with the completion route so the two windows cannot drift: a
  // player mid-game at the São Paulo rollover must be able to submit guess
  // five for yesterday, or Termo becomes unfinishable at midnight.
  const earliestAccepted = addDays(
    await todaySaoPaulo(db),
    -ACCEPTED_DAYS_BACK,
  );
  if (body.date < earliestAccepted) {
    return errorResponse(404, "no-puzzle");
  }

  // The wall (ADR-0004/ADR-0024): a future date and a killed row are rejected
  // by the published predicate itself, not by argument checks.
  const row = await getPublishedDailyWithSolution(db, "termo", body.date);
  if (!row) {
    return errorResponse(404, "no-puzzle");
  }

  // jsonb is untyped at the boundary: parsed, never cast. A drifted row
  // THROWS rather than degrading — a 200 from this route has to mean the day
  // is playable, and a half-readable answer would judge a real board wrongly.
  const content = termoDailyContentSchema.parse(row.content);

  // The dictionary gate, and it is the same predicate over the same
  // byte-pinned list the client runs (ADR-0038 (j)). The server check exists
  // because the server never trusts the client, not because the client's is
  // unreliable — a word the client's copy accepts and this one does not is a
  // real player outcome after an independent deploy, which is why the screen
  // renders it as "não está na lista" rather than as a fault.
  if (!body.guesses.every((guess) => isValidGuess(guess))) {
    return errorResponse(422, "invalid-guess");
  }

  // NOT A NICETY. `deriveBoardStatus` throws a RangeError when a winning row
  // is followed by another, that case is reachable from a hostile body, and
  // an uncaught RangeError in a route handler is a 500. The check runs BEFORE
  // the call, exactly as ADR-0032 puts the length check before the compare
  // loop for the same class of reason.
  //
  // It needs no tiles, because "all five correct" ⟺ "the guess equals the
  // answer": `evaluateGuess` writes "correct" in exactly one place — pass 1's
  // `if (letter === a.charAt(i))` — and pass 2 never writes it. Both operands
  // are `^[a-z]{5}$` here (the request schema for the guess, the word-list
  // harness for `normalized`), so this is plain ASCII equality and the check
  // is EXACT rather than conservative: it can never 422 a legitimate board.
  const winAt = body.guesses.findIndex((guess) => guess === content.normalized);
  if (winAt !== -1 && winAt !== body.guesses.length - 1) {
    return errorResponse(422, "invalid-guess");
  }

  const tiles = body.guesses.map((guess) =>
    evaluateGuess(guess, content.normalized),
  );
  const status = deriveBoardStatus(tiles);

  // `date` is the STORED row's, not the body's — server-derived by the time
  // it is echoed, which is why the response schema types it `isoDateString`.
  // The answer is spread conditionally so the key is ABSENT mid-game rather
  // than present-and-undefined, and the schema's `.refine` then checks the
  // biconditional on the OUTGOING object: a change that leaked it mid-game
  // throws a 500 instead of leaking, and one that dropped it from a closed
  // board throws too. It fails closed in both directions.
  return Response.json(
    termoGuessResponseSchema.parse({
      game: "termo",
      date: row.date,
      tiles,
      status,
      ...(status === "playing" ? {} : { answer: content.canonical }),
    }),
    { headers: corsHeaders({ credentials: true }) },
  );
}

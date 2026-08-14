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
import { isValidGuess } from "@miolos/games/termo";
import type { NextRequest } from "next/server";

import {
  corsHeaders,
  isJsonContentType,
  preflightResponse,
} from "../../../src/cors";
import { getDb } from "../../../src/db";
import { isWritableDate } from "../../../src/publishing/dates";
import { SESSION_COOKIE_NAME } from "../../../src/session/cookie";
import {
  isCrossSiteWrite,
  warnIfGuardDegraded,
} from "../../../src/session/origin-guard";
import { requireUserId } from "../../../src/session/service";
import { judgeGuessList } from "../../../src/termo/judge";

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
 * Duplicated from `app/completions/route.ts` rather than shared, and that is
 * a decision about THIS helper only: a route's error envelope is exactly the
 * thing that should stay visible in the route. `isJsonContentType` was
 * duplicated alongside it on a "no new `apps/api/src` surface" argument that
 * was never true — `src/cors.ts` already exists and already holds
 * `corsHeaders` — so that half now lives there (#27 step-7 finding A-6).
 */
function errorResponse(status: number, error: string): Response {
  return Response.json(apiErrorResponseSchema.parse({ error }), {
    status,
    headers: corsHeaders({ credentials: true }),
  });
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
 *  6. the shared write window (`isWritableDate`)          → 404 no-puzzle
 *  7. `getPublishedDailyWithSolution` (the wall)           → 404 no-puzzle
 *  8. `termoDailyContentSchema.parse` on the stored row    → 500 (a drifted
 *     row is deliberately loud: a 200 has to mean playable)
 *  9. `isValidGuess` on the NEWEST guess only              → 422 invalid-guess
 * 10. `judgeGuessList` — `null` when a row follows a win   → 422 board-closed
 * 11. `termoGuessResponseSchema.parse`                     → 200
 *
 * Steps 9 and 10 answer with DIFFERENT codes because they are different
 * facts, and the client renders them differently (ADR-0039 decision 3 as
 * qualified at #27). `invalid-guess` is a legitimate player outcome — the
 * word the player just typed is not in the server's dictionary — and reads
 * "não está na lista". `board-closed` is a client bug or tampering and reads
 * as a generic fault. The completion route already distinguished the second
 * case by name (`guess-mismatch`); before #27's step 7 this route answered
 * both with `invalid-guess`, so a desynced board was told a correct word was
 * not in the dictionary.
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

  // The write window (ADR-0026 decision 6 as amended by ADR-0053 decision
  // 5), enforced against the DATABASE clock (ADR-0010 single authority),
  // never `new Date()`. The predicate is shared with the completion route so
  // the two windows cannot drift: a player mid-game at the São Paulo
  // rollover must be able to submit guess five for yesterday, or Termo
  // becomes unfinishable at midnight — and after #31 an archived Termo needs
  // both windows to agree or it is unfinishable too.
  //
  // NO CEILING HERE, and that is a decision (ADR-0053 decision 13). This
  // route writes nothing, allocates nothing unbounded (≤ 6 elements of
  // ^[a-z]{5}$) and was already unthrottled per request before #31 — the
  // date axis was never what bounded its request count. What #31 changes is
  // the number of distinct days whose answer it will yield, which is the
  // exposure ADR-0038 decision 9 already discloses and which is LESS
  // objectionable after #31, because those days are now genuinely playable.
  if (!isWritableDate(body.date, await todaySaoPaulo(db))) {
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
  //
  // THE NEWEST GUESS ONLY, and that is the whole point (#27 step-7 finding
  // A-1). The route is stateless, so the client re-posts every earlier guess
  // every turn; gating on the accumulated list would let one word dropped
  // from `validation.txt` after an independent `apps/web` deploy reject every
  // subsequent turn of a board that already contains it — the player retypes
  // forever, and the completion POST then 422s permanently. Only the word the
  // player just typed can honestly be handed back. `judgeGuessList` gates
  // nothing on the dictionary for the same reason, and its TSDoc records why
  // an earlier non-word is harmless.
  //
  // `.min(1)` on the request schema guarantees the element exists;
  // `noUncheckedIndexedAccess` cannot see that, and a guard is the shape this
  // repo uses over a non-null assertion.
  const newest = body.guesses[body.guesses.length - 1];
  if (newest !== undefined && !isValidGuess(newest)) {
    return errorResponse(422, "invalid-guess");
  }

  const judged = judgeGuessList(body.guesses, content.normalized);
  if (!judged) {
    // A row follows a winning row: the board was already closed and the
    // client kept posting. Never a player outcome — a distinct code so the
    // screen renders a fault rather than "não está na lista", and so this
    // route and `POST /completions` stop disagreeing about the same fact.
    return errorResponse(422, "board-closed");
  }
  const { tiles, status } = judged;

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

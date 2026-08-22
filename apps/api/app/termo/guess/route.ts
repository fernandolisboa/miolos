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
 * Every response carries the credentialed CORS grant, 4xx included — same
 * rule as `POST /completions`, applied to a TURN rather than a result. A
 * credentialed cross-origin fetch without these headers is unreadable to
 * JS (a TypeError, indistinguishable from being offline), and on this
 * route the STATUS is the screen's control flow: a 422 clears the guess
 * with "não está na lista", a 5xx or a network failure HOLDS the turn
 * (ADR-0039 decision 3). Losing the distinction would cost the player a
 * guess or hang the board.
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
 * POST /termo/guess — mid-game judgement for Termo (ADR-0038).
 *
 * STATELESS by construction: the client posts the whole guess list every
 * time and the server re-judges all of it against the stored answer,
 * holding nothing between requests. There is no guess table and no
 * session-scoped memory, so a replay is idempotent for free and a lost
 * response costs a re-post rather than a turn. This route WRITES NOTHING.
 *
 * TWO HONEST CAVEATS, because neither is what it looks like. The
 * cross-site guard is NOT load-bearing here: `isCrossSiteWrite` denies on
 * positive evidence only and allows a request carrying neither header, so
 * `curl` walks past it — what stops a hostile browser PAGE reading a
 * response is the exact-origin CORS grant. And minting is unthrottled
 * (ADR-0022 as amended by ADR-0026), so "one session cookie" is not a
 * real cost to an attacker.
 *
 * THE ABUSE POSTURE rests on cost, not comparison: this route is
 * authenticated where the public reads are not, writes nothing, and does
 * bounded work (≤6 words of exactly five bytes before any engine call).
 * It is NOT cheaper than the public read — each statement is its own
 * neon-http round trip (`src/session/service.ts`'s own words), and this
 * route costs more of them, not fewer (see ADR-0066's "what this costs"
 * bullet for the corrected count). No rate limiting ships; ADR-0026's
 * revisit trigger is the abuse signal to watch instead.
 *
 * `.max(6)` does not bound parse cost: zod parses every array element
 * before `.max()` rejects it, so an oversized array is fully parsed
 * first — the real bound is the platform's request-body limit, not this
 * schema. Same shape `POST /completions` has always had.
 *
 * THE ORACLE (ADR-0038 decision 9): one authenticated request carrying
 * six dictionary words that exclude the answer returns it — six rows with
 * no winner makes `status` `"lost"`, which the response schema then
 * requires `answer` for. This is not a confidentiality boundary and must
 * never be cited as one.
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

  // The write window (ADR-0026 decision 6, amended by ADR-0053 decision
  // 5), enforced against the DATABASE clock (ADR-0010), never `new
  // Date()`. Shared with the completion route so the two windows cannot
  // drift — a player mid-game at the São Paulo rollover must be able to
  // submit guess five for yesterday, or Termo becomes unfinishable at
  // midnight, and an archived Termo needs both windows to agree or it is
  // unfinishable too.
  //
  // No ceiling here, deliberately (ADR-0053 decision 13): this route
  // writes nothing and does bounded work, so the date axis was never what
  // bounded its request count. Widening the window only widens the
  // exposure ADR-0038 decision 9 already discloses.
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

  // The dictionary gate runs the same predicate over the same byte-pinned
  // list the client runs (ADR-0038 (j)) — the server never trusts the
  // client, so a word the client's copy accepts and this one does not is
  // a real player outcome, not a fault.
  //
  // It checks only the NEWEST guess, never the accumulated list the
  // stateless client re-posts every turn — gating the whole list would
  // let one word dropped from `validation.txt` after an independent
  // deploy reject every future turn of an already-valid board, and the
  // completion POST would then 422 permanently. See ADR-0038 §4(i) for
  // the full argument; `judgeGuessList` gates nothing on the dictionary
  // for the same reason.
  //
  // `.min(1)` on the request schema guarantees the element exists;
  // `noUncheckedIndexedAccess` cannot see that, and a guard is the shape
  // this repo uses over a non-null assertion.
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

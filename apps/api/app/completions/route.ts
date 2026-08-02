import {
  apiErrorResponseSchema,
  binairoDailyContentSchema,
  completionRequestSchema,
  completionResponseSchema,
  nonogramDailyContentSchema,
  sudokuDailyContentSchema,
  termoDailyContentSchema,
  type CompletionOutcome,
  type CompletionRequest,
} from "@miolos/core";
import {
  getPublishedDailyWithSolution,
  todaySaoPaulo,
} from "@miolos/db/publishing";
import {
  getCompletion,
  recordCompletion,
  type CompletionRecord,
} from "@miolos/db/user";
import {
  deriveBoardStatus,
  evaluateGuess,
  isValidGuess,
} from "@miolos/games/termo";
import type { NextRequest } from "next/server";

import { corsHeaders, preflightResponse } from "../../src/cors";
import { getDb } from "../../src/db";
import { ACCEPTED_DAYS_BACK, addDays } from "../../src/publishing/dates";
import { SESSION_COOKIE_NAME } from "../../src/session/cookie";
import {
  isCrossSiteWrite,
  warnIfGuardDegraded,
} from "../../src/session/origin-guard";
import { requireUserId } from "../../src/session/service";

// Never statically cached: every request judges against the database.
export const dynamic = "force-dynamic";

/**
 * Every response carries the credentialed CORS grant, 4xx included (plan
 * 017 D31). For a credentialed cross-origin fetch a response without those
 * headers is unreadable to JS — the promise rejects with a TypeError
 * indistinguishable from being offline — and on this route the STATUS is
 * the offline queue's control flow: 404/422/400/415/403 are terminal,
 * 401/5xx are retried. /session gets away without them because an
 * unreadable error there is harmless.
 */
function errorResponse(status: number, error: string): Response {
  return Response.json(apiErrorResponseSchema.parse({ error }), {
    status,
    headers: corsHeaders({ credentials: true }),
  });
}

function completionResponse(
  record: CompletionRecord,
  recorded: boolean,
): Response {
  return Response.json(
    completionResponseSchema.parse({ ...record, recorded }),
    { headers: corsHeaders({ credentials: true }) },
  );
}

/**
 * The three games whose completion IS a grid. Termo's is a guess list, so it
 * is excluded by type rather than by convention — `judgeTermo` is its
 * counterpart and the route must narrow before calling either.
 */
type GridCompletionGame = Exclude<CompletionRequest["game"], "termo">;

/**
 * The stored solution for a submitted GRID game. Deliberately LOCAL to this
 * route and NARROWED — never widened — because Termo has no grid: a
 * core-level "get the solution" abstraction would be wrong, and a
 * `readonly number[]` return has no honest Termo meaning (ADR-0038 decision
 * 5). The `Exclude` is what makes TypeScript PROVE the route narrowed
 * `body.game` before calling this; it is the same tripwire the old
 * `CompletionRequest["game"]` signature was, one ticket later.
 *
 * Exhaustive over the narrowed union, so a fifth grid game gets a compile
 * error here instead of a silent fallthrough — without it a sudoku row would
 * reach `binairoDailyContentSchema.parse`, throw a ZodError and 500 the route
 * the moment the request union widened.
 *
 * jsonb is untyped at the boundary: parsed, never cast.
 */
function storedSolution(
  game: GridCompletionGame,
  content: unknown,
): readonly number[] {
  switch (game) {
    case "binairo":
      return binairoDailyContentSchema.parse(content).solution;
    case "nonogram":
      // `NonogramReveal.solution` is [row][col] booleans — the picture itself
      // (nonogram/types.ts:5-6,29). The judge compares a FLAT numeric grid, so
      // flatten row-major and map true -> 1. That mapping is the wire contract
      // (ADR-0032): 1 = filled, 0 = not filled. A crossed cell and an
      // untouched cell are both 0 BY CONSTRUCTION, so a player who crossed
      // every empty cell and one who crossed none post the identical body —
      // there is no leniency here to get wrong, and no third state ever
      // reaches the server.
      return nonogramDailyContentSchema
        .parse(content)
        .reveal.solution.flatMap((row) => row.map((cell) => (cell ? 1 : 0)));
    case "sudoku":
      return sudokuDailyContentSchema.parse(content).solution;
  }
}

/**
 * Judge a submitted GRID against the stored row: `"won"`, or `null` for a
 * body that is not this puzzle. `null` and not a thrown error, because the
 * caller turns it into the 422 that writes no row — for a grid game a wrong
 * grid is not a game outcome (ADR-0008 keeps `lost` Termo-only), it is a
 * client bug or tampering.
 *
 * These are the shipped lines, moved behind the narrowing branch unchanged.
 */
function judgeGrid(
  body: Extract<CompletionRequest, { game: GridCompletionGame }>,
  content: unknown,
): CompletionOutcome | null {
  const solution = storedSolution(body.game, content);

  // Binairo pins .length(64) and sudoku .length(81), so for those two the
  // request schema already proves this and the check can never fire. A
  // nonogram grid is 25/64/100/225 cells and the STORED row decides which,
  // so the wire length is checked against THIS row's solution: the loop below
  // iterates `solution.entries()`, and without this a LONGER grid whose
  // prefix matched would score zero mismatches and be recorded (plan 020 N7).
  // Comparing two lengths reveals nothing about the picture, so this sits
  // outside the constant-work comparison deliberately. The check is
  // game-generic and must not be simplified away (ADR-0032 consequence (c)).
  // 422, not 400: the body is well-formed, it just is not this puzzle — and
  // `TERMINAL_STATUSES` already treats 422 as terminal, so the client record
  // settles rather than retrying forever.
  if (body.grid.length !== solution.length) {
    return null;
  }

  // Constant-work comparison — every cell is examined even after the first
  // mismatch. Neither grid game has a secret worth a timing channel, and
  // Termo does not add one: `judgeTermo` returns its verdict in the response
  // body, so there is nothing a clock could learn that the answer does not
  // already state (ADR-0038's rejected list). This repo has engineered
  // timing-sensitive comparisons out twice (cron/publish/route.ts,
  // session/token.ts) and the loop stays as it is.
  let mismatches = 0;
  for (const [index, cell] of solution.entries()) {
    if (cell !== body.grid[index]) {
      mismatches += 1;
    }
  }
  return mismatches > 0 ? null : "won";
}

/**
 * Judge a submitted Termo GUESS LIST against the stored answer: `"won"`,
 * `"lost"`, or `null` for a list the server refuses to score.
 *
 * `"lost"` becomes reachable here for the first time in the product's
 * history. THIS IS WHERE TERMO INVERTS THE GRID RULE, and over-reading the
 * inversion is the real risk, so both halves are stated:
 *
 * - `null` (→ 422 `guess-mismatch`, NO ROW) for a list that is still
 *   `"playing"`, contains a non-word, or continues past a winning row. The
 *   `"playing"` half is the guard that makes a client bug non-fatal: the row
 *   is write-once (ADR-0026), so a prematurely posted loss would cost the
 *   player the day permanently. It must not be relaxed.
 * - `"lost"` (→ 200, a ROW) for six guesses exhausted without a win. That is
 *   the game working, not a rejected body.
 *
 * The ladder is `POST /termo/guess`'s steps 8–11 — the same dictionary gate,
 * the same "no row follows a winning row" pre-check in front of
 * `deriveBoardStatus`, the same engine calls. The two are deliberately
 * written where they run rather than behind a shared helper: this one
 * discards the tiles and answers a completion, that one is the whole
 * response. **If either changes, change both** — `apps/api/test/completions.test.ts`
 * (T-API-S39) and `apps/api/test/termo-guess.test.ts` (T-API-S38) pin the
 * shared cases from both sides.
 *
 * `outcome` is DERIVED, never read off the body: a `won`/`lost` field would
 * be a client-asserted outcome, the same class of input as the completion
 * instant ADR-0026 rejects outright. The honest limit is that `lost` is only
 * as authoritative as the client's willingness to report it — the same class
 * as `hints_used` — and both failure directions are safe: suppression grants
 * nothing (no row = no streak day), and a fabricated win grants a streak day
 * the player could already mint from Binairo in 0.1 ms. A Termo `lost` row
 * may feed the player's own guess distribution and may never back a medal or
 * an entitlement (ADR-0031 decision 6).
 */
function judgeTermo(
  guesses: readonly string[],
  content: unknown,
): CompletionOutcome | null {
  // jsonb is untyped at the boundary: parsed, never cast. A drifted row
  // THROWS — the same deliberate 500 the guess route takes.
  const answer = termoDailyContentSchema.parse(content).normalized;

  if (!guesses.every((guess) => isValidGuess(guess))) {
    return null;
  }

  // Before `deriveBoardStatus`, which throws a RangeError on a row following
  // a winning row — reachable from a hostile body, and an uncaught RangeError
  // here is a 500. Exact rather than conservative: `evaluateGuess` writes
  // "correct" only where `guess.charAt(i) === answer.charAt(i)`, so all five
  // correct ⟺ the guess EQUALS the answer, and both operands are `^[a-z]{5}$`.
  const winAt = guesses.findIndex((guess) => guess === answer);
  if (winAt !== -1 && winAt !== guesses.length - 1) {
    return null;
  }

  const status = deriveBoardStatus(
    guesses.map((guess) => evaluateGuess(guess, answer)),
  );
  return status === "playing" ? null : status;
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
 * POST /completions — the repo's first authenticated write (ADR-0026).
 * Game-generic by construction so #23/#25/#27 attach to the same route and
 * the same request union rather than adding their own.
 *
 * Exactly-once is the (user_id, game, date) primary key plus the
 * short-circuit below, never a client-supplied idempotency key; the
 * completion instant is the DB clock at insert, never a request value, so
 * the client clock stays out of streak arithmetic (CLAUDE.md invariant).
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

  // Before the body is read (plan 017 D30): requiring a JSON content type
  // forces a CORS preflight on every cross-origin attempt, so the
  // WEB_ORIGIN grant becomes load-bearing rather than the origin guard
  // alone. Under COOKIE_DOMAIN=miolos.app a sibling subdomain sends
  // Sec-Fetch-Site: same-site, which the guard deliberately allows
  // (ADR-0022) — a text/plain simple request would otherwise reach an
  // unreopenable write.
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
  const parsed = completionRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return errorResponse(400, "invalid-body");
  }
  const body = parsed.data;

  // The idempotent short-circuit (ADR-0026), deliberately BEFORE the wall
  // read and before the judge. An honest retry must never be re-judged:
  // after a killed_at the wall read would 404 a completion the server
  // actually holds, and a replay whose grid differs (a partially restored
  // record, a second device) would 422 instead of returning the stored
  // row. 409 is wrong for the same reason — to the offline queue an
  // idempotent retry has to look like success.
  const existing = await getCompletion(db, userId, body.game, body.date);
  if (existing) {
    return completionResponse(existing, false);
  }

  // D29, enforced against the DATABASE clock (ADR-0010 single authority),
  // never new Date(). String comparison is exact for 'YYYY-MM-DD'.
  const earliestAccepted = addDays(
    await todaySaoPaulo(db),
    -ACCEPTED_DAYS_BACK,
  );
  if (body.date < earliestAccepted) {
    return errorResponse(404, "no-puzzle");
  }

  // The wall (ADR-0004/ADR-0024): a future date and a killed row are
  // rejected by the published predicate itself, not by argument checks.
  const row = await getPublishedDailyWithSolution(db, body.game, body.date);
  if (!row) {
    return errorResponse(404, "no-puzzle");
  }

  // The branch sits AFTER the wall read, which both paths need, and it is
  // what proves `body.game` narrowed before either judge is called.
  const outcome =
    body.game === "termo"
      ? judgeTermo(body.guesses, row.content)
      : judgeGrid(body, row.content);
  if (outcome === null) {
    return errorResponse(
      422,
      body.game === "termo" ? "guess-mismatch" : "grid-mismatch",
    );
  }

  const { record, recorded } = await recordCompletion(db, {
    userId,
    game: body.game,
    date: body.date,
    outcome,
    elapsedMs: body.elapsedMs,
    hintsUsed: body.hintsUsed,
    // Write-only in #27, and it cannot be deferred: the row is write-once
    // (ADR-0026 decision 1), so a Termo day recorded without its count is
    // permanently absent from the guess distribution ADR-0008 rule 3 needs.
    guesses: body.game === "termo" ? body.guesses.length : undefined,
  });
  return completionResponse(record, recorded);
}

import {
  apiErrorResponseSchema,
  binairoDailyContentSchema,
  completionRequestSchema,
  completionResponseSchema,
  isWithinCreditWindow,
  nonogramDailyContentSchema,
  onTimeAtWrite,
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
  hasCreditedPastDateToday,
  listCompletionsForStreak,
  recordCompletion,
  wasSeenOn,
  type CompletionRecord,
} from "@miolos/db/user";
import type { NextRequest } from "next/server";

import {
  corsHeaders,
  isJsonContentType,
  preflightResponse,
} from "../../src/cors";
import { getDb } from "../../src/db";
import { isLateDate, isWritableDate } from "../../src/publishing/dates";
import { SESSION_COOKIE_NAME } from "../../src/session/cookie";
import {
  isCrossSiteWrite,
  warnIfGuardDegraded,
} from "../../src/session/origin-guard";
import { requireUserId } from "../../src/session/service";
import { captureEvent, runAfterResponse } from "../../src/telemetry/capture";
import { deriveStreakBroken } from "../../src/telemetry/streak-broken";
import { judgeGuessList } from "../../src/termo/judge";

// Never statically cached: every request judges against the database.
export const dynamic = "force-dynamic";

/**
 * How many LATE completions one user may write per São Paulo day. Chosen,
 * not measured: comfortably above a plausible full-week archive session
 * and well below what an unthrottled identity could otherwise mint. See
 * ADR-0053 decision 13 — the ceiling's real product is the log line below
 * (observability), not closure; per-request cost is what actually bounds
 * abuse. The daily branch is uncapped: the composite PK already bounds it
 * at 4 rows per user per day.
 */
const ARCHIVE_WRITES_PER_DAY = 50;

/**
 * Every response carries the credentialed CORS grant, 4xx included: a
 * credentialed cross-origin fetch without those headers is unreadable to
 * JS (a TypeError, indistinguishable from being offline), and on this
 * route the STATUS is the offline queue's control flow — 404/422/400/415/403
 * are terminal, 401/429/5xx are retried (429 deliberately, since the
 * late-write ceiling is a rate refusal the record must survive; ADR-0053
 * decision 13). `/session` skips them because an unreadable error there is
 * harmless.
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

/** The three games whose completion is a grid; Termo's is a guess list and is judged by `judgeTermo` instead. */
type GridCompletionGame = Exclude<CompletionRequest["game"], "termo">;

/**
 * The stored solution for a submitted GRID game. Deliberately local to this
 * route and narrowed, never widened — Termo has no grid, so a core-level
 * "get the solution" abstraction would be wrong and a `readonly number[]`
 * return has no honest Termo meaning (see ADR-0038 decision 5). `Exclude`
 * makes TypeScript prove the route narrowed `body.game` before calling
 * this, and the switch is exhaustive over that narrowed union, so a fifth
 * grid game is a compile error here rather than a silent 500 from a
 * mismatched schema.
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
      // Row-major flatten, true -> 1: the wire contract (ADR-0032). A
      // crossed cell and an untouched cell are both 0 by construction, so
      // crossing state never reaches the server.
      return nonogramDailyContentSchema
        .parse(content)
        .reveal.solution.flatMap((row) => row.map((cell) => (cell ? 1 : 0)));
    case "sudoku":
      return sudokuDailyContentSchema.parse(content).solution;
  }
}

/**
 * Judge a submitted GRID against the stored row: `"won"`, or `null` for a
 * body that is not this puzzle — a wrong grid is a client bug or
 * tampering, not a game outcome (ADR-0008 keeps `lost` Termo-only), so the
 * caller turns `null` into a 422 that writes no row.
 */
function judgeGrid(
  body: Extract<CompletionRequest, { game: GridCompletionGame }>,
  content: unknown,
): CompletionOutcome | null {
  const solution = storedSolution(body.game, content);

  // Binairo (.length(64)) and sudoku (.length(81)) can never fail this,
  // but a nonogram grid's size varies (25/64/100/225) and only the STORED
  // row decides which — without this check, a longer grid whose prefix
  // matched the shorter solution would score zero mismatches in the loop
  // below and be recorded as a win. Kept outside the constant-work
  // comparison: comparing two lengths reveals nothing about the picture
  // (ADR-0032 consequence (c)). 422, not 400 — the body is well-formed, it
  // just is not this puzzle, and 422 is terminal client-side.
  if (body.grid.length !== solution.length) {
    return null;
  }

  // Constant-work comparison: every cell is examined even after the first
  // mismatch. Neither grid game has a secret worth a timing channel, and
  // Termo does not add one — `judgeTermo` returns its verdict in the
  // response body, so there is nothing a clock could learn that the
  // answer does not already state.
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
 * `null` (→ 422 `guess-mismatch`, no row) covers a list still `"playing"`
 * or one that continues past a winning row — the guard that keeps a
 * premature or duplicate post from burning the write-once row (ADR-0026).
 * `"lost"` (→ 200, a row) is six guesses exhausted without a win: the game
 * working, not a rejected body. Neither direction may be relaxed.
 *
 * No dictionary gate here, deliberately — the same argument that keeps
 * `POST /termo/guess` checking only the newest guess; see ADR-0038 §4(i)
 * for why gating the accumulated list would risk a permanently lost day.
 * The ladder itself lives in `src/termo/judge.ts`, shared verbatim with
 * that route, so a gate added for one cannot go missing in the other.
 *
 * `outcome` is derived here, never read off the body — a client-asserted
 * `won`/`lost` field would be the same class of input ADR-0026 rejects for
 * the completion instant. Both failure directions are safe: suppressing a
 * loss grants nothing (no row, no streak day), and forging a win grants no
 * more than a player could already mint from Binairo. A Termo `lost` row
 * may feed the guess distribution but may never back a medal or an
 * entitlement (ADR-0031 decision 6).
 */
function judgeTermo(
  guesses: readonly string[],
  content: unknown,
): CompletionOutcome | null {
  // jsonb is untyped at the boundary: parsed, never cast. A drifted row
  // THROWS — the same deliberate 500 the guess route takes.
  const answer = termoDailyContentSchema.parse(content).normalized;

  // `null` here is the "a row follows a winning row" case, which would
  // otherwise be a RangeError out of `deriveBoardStatus` and a 500.
  const judged = judgeGuessList(guesses, answer);
  if (!judged) {
    return null;
  }
  return judged.status === "playing" ? null : judged.status;
}

export function OPTIONS(): Response {
  return preflightResponse();
}

/**
 * POST /completions writes a completion row exactly once: the
 * (user_id, game, date) primary key plus the idempotent short-circuit
 * below, never a client-supplied idempotency key. The completion instant
 * is the DB clock at insert, never a request value — the client clock
 * never enters streak arithmetic.
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

  // Requiring JSON content type, before the body is read, forces a CORS
  // preflight on every cross-origin attempt — the WEB_ORIGIN grant becomes
  // load-bearing rather than the origin guard alone. Under
  // COOKIE_DOMAIN=miolos.app a sibling subdomain sends
  // Sec-Fetch-Site: same-site, which the guard deliberately allows
  // (ADR-0022); a text/plain simple request would otherwise reach an
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

  // Idempotent short-circuit (ADR-0026), deliberately before the wall read
  // and the judge: an honest retry must never be re-judged. After a
  // killed_at the wall read would 404 a completion the server still
  // holds, and a replay whose grid differs (a partially restored record, a
  // second device) would 422 instead of returning the stored row. 409 is
  // wrong for the same reason — to the offline queue an idempotent retry
  // has to look like success.
  const existing = await getCompletion(db, userId, body.game, body.date);
  if (existing) {
    return completionResponse(existing, false);
  }

  // The write window (ADR-0026 decision 6, amended by ADR-0053 decision
  // 5), enforced against the DATABASE clock (ADR-0010), never `new
  // Date()`. Read once here; `today` is reused below for the late-write
  // ceiling.
  //
  // No lower bound: forging a past win costs no more than the guess route
  // already gives away for free (ADR-0038 decision 9) and the three grid
  // solvers already give away locally (ADR-0027) — what a forged win buys
  // is bounded to `solved` totals and the volume medals that count late
  // wins by design (ADR-0052 decision 3); it reaches no streak, no time
  // statistic, no Termo bucket and no Dia Perfeito. What the removal owes
  // is a RATE ceiling — `isLateDate` + `ARCHIVE_WRITES_PER_DAY`, below.
  const today = await todaySaoPaulo(db);
  if (!isWritableDate(body.date, today)) {
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

  // The on-time decision (ADR-0066) is made once, here, and stored on the
  // row — no read path re-derives it, so the streak stays derivable from
  // completion rows alone (ADR-0009). The seen read only runs when the
  // date is inside the 1-day credit window — `isWithinCreditWindow`, the
  // one spelling of the window, shared with `onTimeAtWrite`'s credit
  // branch so the two can never disagree.
  const seen = isWithinCreditWindow(body.date, today)
    ? await wasSeenOn(db, userId, body.date)
    : false;
  const onTime = onTimeAtWrite(body.date, today, seen);

  // The multi-past-date guard (ADR-0066): before storing a CREDITED
  // past-date row, refuse if this user already credited a DIFFERENT past
  // date on the current SP writing day — dates, not games (three grid
  // games for one date are three POSTs for the SAME date, untouched
  // here). 422 is already terminal client-side. See
  // `hasCreditedPastDateToday`'s own doc for why the window conjunct
  // makes this provably inert today.
  if (onTime && isLateDate(body.date, today)) {
    if (
      await hasCreditedPastDateToday(db, userId, {
        today,
        excludingDate: body.date,
      })
    ) {
      return errorResponse(422, "multi-date-sync");
    }
  }

  const input = {
    userId,
    game: body.game,
    date: body.date,
    outcome,
    elapsedMs: body.elapsedMs,
    hintsUsed: body.hintsUsed,
    // Cannot be deferred: the row is write-once (ADR-0026 decision 1), so
    // a Termo day recorded without its guess count is permanently absent
    // from the distribution ADR-0008 rule 3 needs.
    guesses: body.game === "termo" ? body.guesses.length : undefined,
    onTime,
  };

  // The late-write ceiling (ADR-0053 decision 13) sits here, the last gate
  // before the write, so a request destined for a terminal 404/422 never
  // pays for it. The arm is chosen by the WRITE-TIME verdict, not the
  // date (ADR-0066): an `onTime === true` write never takes the guarded
  // arm, because a capped credited flush would retry after the next
  // rollover, land two days back and store `false` — a permanently lost
  // streak day on a write-once row. See `recordCompletion`'s own doc for
  // why the guard is folded into the insert and why the exemption is
  // safe.
  const written = onTime
    ? await recordCompletion(db, input)
    : await recordCompletion(db, input, {
        day: today,
        max: ARCHIVE_WRITES_PER_DAY,
      });

  if (written.capped) {
    // The ceiling's real product (ADR-0053 decision 13): the platform log
    // carries status and path but not the user, so only this structured
    // line can tell a marathon player who tripped it once from a script
    // tripping it on every minted identity. Same idiom as
    // `cron/publish/route.ts`.
    console.log(JSON.stringify({ event: "archive-cap", userId, day: today }));
    return errorResponse(429, "archive-cap");
  }

  // Telemetry seam (ADR-0069): after the write, before the response, and
  // unable to touch either — `runAfterResponse` schedules the work
  // post-response and swallows every throw, so a failed capture can never
  // change what this route answers. A replay already returned above, so
  // nothing fires twice: the write-once row is the dedup.
  if (written.recorded) {
    // Bound outside the task (not re-derived inside it) so the task reads
    // the request-scoped verdict rather than re-deriving `computeStreak`'s
    // own conjunction.
    const counted = outcome === "won" && onTime;
    runAfterResponse(async () => {
      // Started together, not chained: the capture carries a 3s abort and
      // the derivation read is independent of it (the row was committed
      // before the response went out), so sequencing them would only
      // lengthen the held invocation when PostHog is slow — exactly when
      // a truncated tail would lose the second event instead.
      const [, rows] = await Promise.all([
        captureEvent({
          distinctId: userId,
          event: "puzzle_completed",
          properties: {
            game: body.game,
            date: body.date,
            elapsed_ms: body.elapsedMs,
            outcome,
            on_time: onTime,
          },
        }),
        counted ? listCompletionsForStreak(db, userId) : Promise.resolve(null),
      ]);
      if (rows !== null) {
        const broken = deriveStreakBroken(rows, body.date);
        if (broken !== null) {
          await captureEvent({
            distinctId: userId,
            event: "streak_broken",
            properties: broken,
          });
        }
      }
    });
  }
  return completionResponse(written.record, written.recorded);
}

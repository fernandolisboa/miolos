import {
  LATE_SYNC_CREDIT_DAYS_BACK,
  apiErrorResponseSchema,
  binairoDailyContentSchema,
  completionRequestSchema,
  completionResponseSchema,
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
import {
  addDays,
  isLateDate,
  isWritableDate,
} from "../../src/publishing/dates";
import { SESSION_COOKIE_NAME } from "../../src/session/cookie";
import {
  isCrossSiteWrite,
  warnIfGuardDegraded,
} from "../../src/session/origin-guard";
import { requireUserId } from "../../src/session/service";
import { judgeGuessList } from "../../src/termo/judge";

// Never statically cached: every request judges against the database.
export const dynamic = "force-dynamic";

/**
 * How many LATE completions one user may write on one São Paulo day — the
 * late-write ceiling (#31, ADR-0053 decision 13, firing ADR-0022
 * :69-75's revisit trigger and reversing ADR-0026's Rejected entry for the
 * late branch only). It is this repo's first rate limit ON THE COMPLETION
 * WRITE PATH, not its first anywhere: `POST /attach/request` already
 * answers `429 too-many-requests` off `MAX_REQUESTS_PER_HOUR` (ADR-0050
 * decision 11), so ADR-0026's Rejected entry was already reversed once.
 *
 * LATE-write, not archive-write, and the difference is real: the branch is
 * `isLateDate`, which also admits ADR-0026 decision 7's legitimate
 * post-rollover flush — a player syncing yesterday's offline daily at
 * 00:05 is inside this ceiling by construction, at most 4 rows.
 *
 * NOT MEASURED — there is no traffic to measure, and a borrowed number
 * dressed as a measurement is worse than an honest choice. It is chosen
 * as: comfortably above the largest plausible human archive session (a
 * player clearing a full week of all four games is 28), and two orders of
 * magnitude below the 4,380 an uncapped three-year archive would allow one
 * minted identity.
 *
 * WHAT IT COSTS AN ATTACKER, on the axis that actually binds. Identities
 * are free (`POST /session` reads no body and is unthrottled), so the
 * sizing figure above is not the interesting one: rows per REQUEST goes
 * from ≈1.00 uncapped to ≈0.98 here — one extra `POST /session` per 50
 * rows, a 2% tax. The residual is accepted on ADR-0006 :51's own terms
 * and the ceiling's real product is OBSERVABILITY (the log line below),
 * not closure. ADR-0053 decision 13 says so in those words.
 *
 * The daily branch is uncapped and stays uncapped: the composite PK
 * already bounds it at 4 rows per user per day.
 */
const ARCHIVE_WRITES_PER_DAY = 50;

/**
 * Every response carries the credentialed CORS grant, 4xx included (plan
 * 017 D31). For a credentialed cross-origin fetch a response without those
 * headers is unreadable to JS — the promise rejects with a TypeError
 * indistinguishable from being offline — and on this route the STATUS is
 * the offline queue's control flow: 404/422/400/415/403 are terminal,
 * 401/429/5xx are retried — 429 deliberately so, because the late-write
 * ceiling is a per-day rate refusal and the record must survive it
 * (ADR-0053 decision 13). /session gets away without them because an
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
 *   `"playing"` or continues past a winning row. The `"playing"` half is the
 *   guard that makes a client bug non-fatal: the row is write-once
 *   (ADR-0026), so a prematurely posted loss would cost the player the day
 *   permanently. It must not be relaxed.
 * - `"lost"` (→ 200, a ROW) for six guesses exhausted without a win. That is
 *   the game working, not a rejected body.
 *
 * THE DICTIONARY GATE IS GONE FROM HERE (#27 step-7 finding A-1), and its
 * absence is deliberate rather than an omission. It gated the ACCUMULATED
 * list, which the stateless client re-posts in full: one word removed from
 * `validation.txt` after an independent `apps/web` deploy would 422 a
 * legitimate closed board — and 422 is terminal in
 * `apps/web/src/play/sync.ts`, so the record would settle `rejected` and the
 * day would be lost for the streak, permanently, on a row that can never be
 * reopened. It also bought nothing: a non-word cannot manufacture a win,
 * because the win test is `guess === answer`. `src/termo/judge.ts` carries
 * the full argument.
 *
 * The ladder itself is `src/termo/judge.ts`, shared verbatim with
 * `POST /termo/guess` — one copy, so a gate added for one route cannot go
 * missing in the other and record a write-once `lost` row for a board the
 * guess route would never have closed. This caller discards the tiles and
 * maps `"playing"` to `null`; that one returns them as the response.
 * `apps/api/test/completions.test.ts` (T-API-S39) and
 * `apps/api/test/termo-guess.test.ts` (T-API-S38) pin the shared cases from
 * both sides.
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

  // The write window (ADR-0026 decision 6 as amended by ADR-0053 decision
  // 5), enforced against the DATABASE clock (ADR-0010 single authority),
  // never new Date(). Position unchanged: AFTER the idempotent
  // short-circuit and BEFORE the wall read.
  //
  // #31 removed its LOWER bound. The reason is not that forging the past is
  // hard — it is not: the guess route is an answer oracle at the cost of one
  // authenticated request (ADR-0038 decision 9), and the three grid solvers
  // run locally on the published payload in 0.04–0.16 ms (ADR-0027). What a
  // forged past win buys is bounded and accepted on ADR-0006 :51's own
  // terms: `solved` totals and the ten volume medals that count late wins by
  // design (ADR-0052 decision 3). It reaches no streak, no time statistic,
  // no Termo bucket 1–6 and no Dia Perfeito.
  //
  // What the removal owes is a RATE ceiling, and it lives at the write
  // itself — `isLateDate` + `ARCHIVE_WRITES_PER_DAY`, at the bottom of this
  // function. `today` is read ONCE here and reused there.
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

  // THE WRITE-TIME ON-TIME DECISION (#58, ADR-0066), made once, HERE, and
  // stored on the row — no read path re-derives it (ADR-0009's constraint:
  // the streak stays derivable from completion rows alone, so the seen
  // table is consulted exactly here and nowhere downstream). `today` is
  // the one `todaySaoPaulo(db)` read above, reused as its comment promises.
  // The seen read runs only when the date is inside the 1-day credit
  // window (`addDays` — pure calendar math, no clock): an archive date
  // can never be credited, so it never costs the round trip.
  const seen =
    isLateDate(body.date, today) &&
    addDays(body.date, LATE_SYNC_CREDIT_DAYS_BACK) === today
      ? await wasSeenOn(db, userId, body.date)
      : false;
  const onTime = onTimeAtWrite(body.date, today, seen);

  // The multi-past-date guard (#58, ADR-0066): before storing a CREDITED
  // past-date row, refuse if this user already credited a DIFFERENT past
  // date on the current SP writing day — the enforceable form of the
  // decision's "refuse a sync carrying completions for more than one
  // distinct past date" (dates, not games: three grid games for one date
  // are three POSTs for the SAME date, untouched here; archive/late writes
  // claim no credit and never enter this branch). 422 is already terminal
  // in the sync client (`TERMINAL_STATUSES`) — no client change.
  //
  // A WIDENING TRIPWIRE, dead code by design under window = 1 (see
  // `hasCreditedPastDateToday`'s doc block for why no client can reach it,
  // and why read-then-act is sound until the window widens — at which
  // point ADR-0066 requires folding this guard into the insert).
  if (onTime && isLateDate(body.date, today)) {
    if (await hasCreditedPastDateToday(db, userId, today, body.date)) {
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
    // Write-only in #27, and it cannot be deferred: the row is write-once
    // (ADR-0026 decision 1), so a Termo day recorded without its count is
    // permanently absent from the guess distribution ADR-0008 rule 3 needs.
    guesses: body.game === "termo" ? body.guesses.length : undefined,
    onTime,
  };

  // The late-write ceiling (ADR-0053 decision 13), HERE and not earlier,
  // and folded INTO the write rather than run beside it. Both halves are
  // step-6 findings (F1, F2) and both matter:
  //
  // - **Here.** The ceiling is the last gate before the row. Run above the
  //   wall read it would answer a retryable 429 to requests destined for a
  //   terminal 404 or 422 — a queued record for a killed date would then
  //   be re-posted forever instead of settling — and it would spend the
  //   route's most expensive statement on an answer it throws away.
  // - **Folded.** A `count(*)` followed by an INSERT is check-then-act:
  //   `Promise.all` over N requests reads one snapshot in all N and writes
  //   N rows, so "50 per day" held only against a sequential client.
  //   `recordCompletion`'s guarded form is ONE statement (T-DB-S56a).
  //
  // The arm is decided by the WRITE-TIME VERDICT, not by the date (#58,
  // ADR-0066): an `onTime === true` write NEVER takes the guarded arm — a
  // credited flush must land even for a user AT the ceiling, because 429
  // is correctly non-terminal, so a capped credit would retry after the
  // next rollover, land two days back, and store `false`: a permanently
  // lost streak day on a write-once row, the exact outcome #58 exists to
  // prevent. The exemption is safe — the credit is server-derived and
  // unforgeable (a seen row plus the 1-day window, never client input),
  // bounded at ≤3 rows/user/day by construction. `onTime === false` here
  // implies `isLateDate` (a today-dated write is on time by construction),
  // so the guarded arm covers exactly the late writes it always did minus
  // the credited flush. The daily ritual's INSERT is byte-identical to the
  // one it always was — no extra statement, no guard subquery, no extra
  // round trip. 429 stays deliberate: `TERMINAL_STATUSES` in
  // apps/web/src/play/sync.ts does not contain it, so a refused archive
  // completion stays `pendingSync` and flushes after the next rollover —
  // the correct semantics for a per-day rate cap.
  const written = onTime
    ? await recordCompletion(db, input)
    : await recordCompletion(db, input, {
        day: today,
        max: ARCHIVE_WRITES_PER_DAY,
      });

  if (written.capped) {
    // THE CEILING'S PRINCIPAL PRODUCT (ADR-0053 decision 13): the platform
    // log carries the status and the path but neither the `archive-cap`
    // token nor the user, so it cannot make the one distinction the record
    // says this exists to make — a marathon player trips it once, a script
    // trips it on every minted identity. Same idiom as
    // `app/cron/publish/route.ts` — the repo's only other structured log
    // line. (`src/session/origin-guard.ts` was cited here and is NOT one:
    // it emits a plain-string `console.error`.)
    console.log(JSON.stringify({ event: "archive-cap", userId, day: today }));
    return errorResponse(429, "archive-cap");
  }
  return completionResponse(written.record, written.recorded);
}

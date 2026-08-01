import {
  apiErrorResponseSchema,
  binairoDailyContentSchema,
  completionRequestSchema,
  completionResponseSchema,
  sudokuDailyContentSchema,
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
import type { NextRequest } from "next/server";

import { corsHeaders, preflightResponse } from "../../src/cors";
import { getDb } from "../../src/db";
import { addDays } from "../../src/publishing/dates";
import { SESSION_COOKIE_NAME } from "../../src/session/cookie";
import {
  isCrossSiteWrite,
  warnIfGuardDegraded,
} from "../../src/session/origin-guard";
import { requireUserId } from "../../src/session/service";

// Never statically cached: every request judges against the database.
export const dynamic = "force-dynamic";

/**
 * How far back a completion may be claimed: SP-today or SP-yesterday
 * (plan 017 D29). `getPublishedDailyWithSolution` has no lower bound, so
 * without this any caller could write a `won` row for every past daily —
 * permanently, since a completion is never reopened (ADR-0026) — and a
 * stale localStorage record would flush as a day the player never played.
 * One day of slack is what keeps a post-rollover flush working (D19).
 *
 * EXTENSION POINT: #31 (archive) widens this deliberately, with its own
 * tests and its own `late` semantics (ADR-0008).
 */
const ACCEPTED_DAYS_BACK = 1;

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
 * The stored solution for a submitted game. Deliberately LOCAL to this
 * route and keyed on `CompletionRequest["game"]`, not `Game`: Termo has no
 * grid (#27), so a core-level "get the solution" abstraction would be wrong
 * within two tickets. Exhaustive over the request union's discriminator, so
 * #25/#27 get a compile error here instead of a silent fallthrough — and
 * without it a sudoku row would reach `binairoDailyContentSchema.parse`,
 * throw a ZodError and 500 the route the moment the request union widened.
 *
 * jsonb is untyped at the boundary: parsed, never cast.
 */
function storedSolution(
  game: CompletionRequest["game"],
  content: unknown,
): readonly number[] {
  switch (game) {
    case "binairo":
      return binairoDailyContentSchema.parse(content).solution;
    case "sudoku":
      return sudokuDailyContentSchema.parse(content).solution;
  }
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

  const solution = storedSolution(body.game, row.content);

  // Constant-work comparison — every cell is examined even after the first
  // mismatch. Neither grid game has a secret worth a timing channel, but
  // this route and its request union are the extension point #27 attaches to,
  // where the answer word IS the product's one secret. This repo has
  // already engineered timing-sensitive comparisons out twice
  // (cron/publish/route.ts, session/token.ts) and does not reintroduce one
  // here for a later ticket to find.
  let mismatches = 0;
  for (const [index, cell] of solution.entries()) {
    if (cell !== body.grid[index]) {
      mismatches += 1;
    }
  }
  if (mismatches > 0) {
    // No row is written: for a grid game a wrong grid is not a game outcome
    // (ADR-0008 keeps `lost` Termo-only), it is a client bug or tampering.
    return errorResponse(422, "grid-mismatch");
  }

  const { record, recorded } = await recordCompletion(db, {
    userId,
    game: body.game,
    date: body.date,
    outcome: "won",
    elapsedMs: body.elapsedMs,
    hintsUsed: body.hintsUsed,
  });
  return completionResponse(record, recorded);
}

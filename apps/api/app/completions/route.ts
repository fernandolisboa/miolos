import {
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
import { errorResponse } from "../../src/http/responses";
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

export const dynamic = "force-dynamic";

const ARCHIVE_WRITES_PER_DAY = 50;

function completionResponse(
  record: CompletionRecord,
  recorded: boolean,
): Response {
  return Response.json(
    completionResponseSchema.parse({ ...record, recorded }),
    { headers: corsHeaders({ credentials: true }) },
  );
}

type GridCompletionGame = Exclude<CompletionRequest["game"], "termo">;

function storedSolution(
  game: GridCompletionGame,
  content: unknown,
): readonly number[] {
  switch (game) {
    case "binairo":
      return binairoDailyContentSchema.parse(content).solution;
    case "nonogram":
      return nonogramDailyContentSchema
        .parse(content)
        .reveal.solution.flatMap((row) => row.map((cell) => (cell ? 1 : 0)));
    case "sudoku":
      return sudokuDailyContentSchema.parse(content).solution;
  }
}

function judgeGrid(
  body: Extract<CompletionRequest, { game: GridCompletionGame }>,
  content: unknown,
): CompletionOutcome | null {
  const solution = storedSolution(body.game, content);

  if (body.grid.length !== solution.length) {
    return null;
  }

  let mismatches = 0;
  for (const [index, cell] of solution.entries()) {
    if (cell !== body.grid[index]) {
      mismatches += 1;
    }
  }
  return mismatches > 0 ? null : "won";
}

function judgeTermo(
  guesses: readonly string[],
  content: unknown,
): CompletionOutcome | null {
  const answer = termoDailyContentSchema.parse(content).normalized;

  const judged = judgeGuessList(guesses, answer);
  if (!judged) {
    return null;
  }
  return judged.status === "playing" ? null : judged.status;
}

export function OPTIONS(): Response {
  return preflightResponse();
}

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
    return errorResponse(403, "cross-site");
  }

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

  const existing = await getCompletion(db, userId, body.game, body.date);
  if (existing) {
    return completionResponse(existing, false);
  }

  const today = await todaySaoPaulo(db);
  if (!isWritableDate(body.date, today)) {
    return errorResponse(404, "no-puzzle");
  }

  const row = await getPublishedDailyWithSolution(db, body.game, body.date);
  if (!row) {
    return errorResponse(404, "no-puzzle");
  }

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

  const seen = isWithinCreditWindow(body.date, today)
    ? await wasSeenOn(db, userId, body.date)
    : false;
  const onTime = onTimeAtWrite(body.date, today, seen);

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

    guesses: body.game === "termo" ? body.guesses.length : undefined,
    onTime,
  };

  const written = onTime
    ? await recordCompletion(db, input)
    : await recordCompletion(db, input, {
        day: today,
        max: ARCHIVE_WRITES_PER_DAY,
      });

  if (written.capped) {
    console.log(JSON.stringify({ event: "archive-cap", userId, day: today }));
    return errorResponse(429, "archive-cap");
  }

  if (written.recorded) {
    const counted = outcome === "won" && onTime;
    runAfterResponse(async () => {
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

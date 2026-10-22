import {
  binairoDailyContentSchema,
  completionRequestSchema,
  completionResponseSchema,
  crosswordDailyContentSchema,
  isWithinCreditWindow,
  minesweeperDailyContentSchema,
  nonogramDailyContentSchema,
  onTimeAtWrite,
  queensDailyContentSchema,
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

import { corsHeaders, preflightResponse } from "../../src/cors";
import { errorResponse } from "../../src/http/responses";
import { writePreamble } from "../../src/http/write-preamble";
import { isLateDate, isWritableDate } from "../../src/publishing/dates";
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

type GridCompletionGame = Exclude<
  CompletionRequest["game"],
  "termo" | "minesweeper"
>;

function storedSolution(
  game: GridCompletionGame,
  content: unknown,
): readonly (number | string | null)[] {
  switch (game) {
    case "binairo":
      return binairoDailyContentSchema.parse(content).solution;
    case "nonogram":
      return nonogramDailyContentSchema
        .parse(content)
        .reveal.solution.flatMap((row) => row.map((cell) => (cell ? 1 : 0)));
    case "sudoku":
      return sudokuDailyContentSchema.parse(content).solution;
    case "crossword":
      return crosswordDailyContentSchema.parse(content).grid.flat();
    case "queens":
      return queensDailyContentSchema.parse(content).solution;
  }
}

type Judgement =
  { readonly outcome: CompletionOutcome } | { readonly mismatch: string };

function judgeGrid(
  body: Extract<CompletionRequest, { game: GridCompletionGame }>,
  content: unknown,
): Judgement {
  const solution = storedSolution(body.game, content);
  const matches =
    body.grid.length === solution.length &&
    solution.every((cell, index) => cell === body.grid[index]);
  return matches ? { outcome: "won" } : { mismatch: "grid-mismatch" };
}

function judgeTermo(guesses: readonly string[], content: unknown): Judgement {
  const answer = termoDailyContentSchema.parse(content).normalized;

  const judged = judgeGuessList(guesses, answer);
  return judged && judged.status !== "playing"
    ? { outcome: judged.status }
    : { mismatch: "guess-mismatch" };
}

function judgeMinesweeper(hit: number | null, content: unknown): Judgement {
  if (hit === null) {
    return { outcome: "won" };
  }
  return minesweeperDailyContentSchema.parse(content).mines[hit] === 1
    ? { outcome: "lost" }
    : { mismatch: "hit-mismatch" };
}

function judge(body: CompletionRequest, content: unknown): Judgement {
  switch (body.game) {
    case "termo":
      return judgeTermo(body.guesses, content);
    case "minesweeper":
      return judgeMinesweeper(body.hit, content);
    default:
      return judgeGrid(body, content);
  }
}

export function OPTIONS(): Response {
  return preflightResponse();
}

export async function POST(request: NextRequest): Promise<Response> {
  const context = await writePreamble(request, completionRequestSchema);
  if (context.failure) {
    return context.failure;
  }
  const { db, userId, body } = context;

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

  const judgement = judge(body, row.content);
  if ("mismatch" in judgement) {
    return errorResponse(422, judgement.mismatch);
  }
  const { outcome } = judgement;

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
      const completed = captureEvent({
        db,
        distinctId: userId,
        event: "puzzle_completed",
        properties: {
          game: body.game,
          date: body.date,
          elapsed_ms: body.elapsedMs,
          outcome,
          on_time: onTime,
        },
      });
      try {
        const broken = counted
          ? deriveStreakBroken(
              await listCompletionsForStreak(db, userId),
              body.date,
            )
          : null;
        await completed;
        if (broken !== null) {
          await captureEvent({
            db,
            distinctId: userId,
            event: "streak_broken",
            properties: broken,
          });
        }
      } finally {
        await completed;
      }
    });
  }
  return completionResponse(written.record, written.recorded);
}

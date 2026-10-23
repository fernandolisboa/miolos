import {
  termoDailyContentSchema,
  termoGuessRequestSchema,
  termoGuessResponseSchema,
} from "@miolos/core";
import type { Db } from "@miolos/db";
import {
  getPublishedDailyWithSolution,
  getRemoteConfig,
  todaySaoPaulo,
} from "@miolos/db/publishing";
import { isValidGuess } from "@miolos/games/termo";
import type { NextRequest } from "next/server";

import { corsHeaders, preflightResponse } from "../../../src/cors";
import { errorResponse } from "../../../src/http/responses";
import { writePreamble } from "../../../src/http/write-preamble";
import { isWritableDate } from "../../../src/publishing/dates";
import { judgeGuessList } from "../../../src/termo/judge";

export const dynamic = "force-dynamic";

export function OPTIONS(): Response {
  return preflightResponse();
}

async function acceptsGuess(db: Db, word: string): Promise<boolean> {
  return (
    isValidGuess(word, false) ||
    (isValidGuess(word, true) &&
      (await getRemoteConfig(db)).termoAcceptsProfanity)
  );
}

export async function POST(request: NextRequest): Promise<Response> {
  const context = await writePreamble(request, termoGuessRequestSchema);
  if (context.failure) {
    return context.failure;
  }
  const { db, body } = context;

  if (!isWritableDate(body.date, await todaySaoPaulo(db))) {
    return errorResponse(404, "no-puzzle");
  }

  const row = await getPublishedDailyWithSolution(db, "termo", body.date);
  if (!row) {
    return errorResponse(404, "no-puzzle");
  }

  const content = termoDailyContentSchema.parse(row.content);

  const newest = body.guesses[body.guesses.length - 1];
  if (newest !== undefined && !(await acceptsGuess(db, newest))) {
    return errorResponse(422, "invalid-guess");
  }

  const judged = judgeGuessList(body.guesses, content.normalized);
  if (!judged) {
    return errorResponse(422, "board-closed");
  }
  const { tiles, status } = judged;

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

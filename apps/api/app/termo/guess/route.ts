import {
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
import { errorResponse } from "../../../src/http/responses";
import { getDb } from "../../../src/db";
import { isWritableDate } from "../../../src/publishing/dates";
import { SESSION_COOKIE_NAME } from "../../../src/session/cookie";
import {
  isCrossSiteWrite,
  warnIfGuardDegraded,
} from "../../../src/session/origin-guard";
import { requireUserId } from "../../../src/session/service";
import { judgeGuessList } from "../../../src/termo/judge";

export const dynamic = "force-dynamic";

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
  const parsed = termoGuessRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return errorResponse(400, "invalid-body");
  }
  const body = parsed.data;

  if (!isWritableDate(body.date, await todaySaoPaulo(db))) {
    return errorResponse(404, "no-puzzle");
  }

  const row = await getPublishedDailyWithSolution(db, "termo", body.date);
  if (!row) {
    return errorResponse(404, "no-puzzle");
  }

  const content = termoDailyContentSchema.parse(row.content);

  const newest = body.guesses[body.guesses.length - 1];
  if (newest !== undefined && !isValidGuess(newest)) {
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

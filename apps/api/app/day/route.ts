import {
  dayGamesFromRows,
  dayResponseSchema,
  dayStateFromRows,
} from "@miolos/core";
import {
  getPublishedNonogramMotifName,
  todaySaoPaulo,
} from "@miolos/db/publishing";
import { listCompletionsForDay } from "@miolos/db/user";
import type { NextRequest } from "next/server";

import { authenticatedRead } from "../../src/http/authenticated-read";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest): Promise<Response> {
  return authenticatedRead(request, async (db, userId) => {
    const today = await todaySaoPaulo(db);
    const rows = await listCompletionsForDay(db, userId, today);

    const motifName =
      dayStateFromRows(rows).nonogram === "completed"
        ? await getPublishedNonogramMotifName(db, today)
        : undefined;

    return dayResponseSchema.parse({
      date: today,
      games: dayGamesFromRows(
        rows,

        motifName ? { nonogramMotifName: motifName } : undefined,
      ),
    });
  });
}

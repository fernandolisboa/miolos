import {
  dayGamesFromRows,
  dayResponseSchema,
  dayStateFromRows,
} from "@miolos/core";
import {
  getPublishedNonogramMotif,
  todaySaoPaulo,
} from "@miolos/db/publishing";
import { motifTones } from "@miolos/games/nonogram-colors";
import { listCompletionsForDay } from "@miolos/db/user";
import type { NextRequest } from "next/server";

import { authenticatedRead } from "../../src/http/authenticated-read";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest): Promise<Response> {
  return authenticatedRead(request, async (db, userId) => {
    const today = await todaySaoPaulo(db);
    const rows = await listCompletionsForDay(db, userId, today);

    const motif =
      dayStateFromRows(rows).nonogram === "completed"
        ? await getPublishedNonogramMotif(db, today)
        : undefined;

    return dayResponseSchema.parse({
      date: today,
      games: dayGamesFromRows(rows, {
        nonogramMotifName: motif?.name,
        nonogramMotifTones: motif && motifTones(motif.motifId, motif.mirrored),
      }),
    });
  });
}

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

// Never statically cached: every request reads the caller's rows.
export const dynamic = "force-dynamic";

/**
 * GET /day — the server day-truth payload; see ADR-0060.
 *
 * SECURITY: this route takes NO parameters — the user comes from the
 * cookie, the day from the DB clock. A `?date=` would be the archive read
 * ADR-0053 decision 10 already refused, and it is the ADR-0004 surface:
 * with nothing to ask, there is no way to request tomorrow. That absence is
 * also what makes the Nonogram motif name (ADR-0070) safe to carry — it
 * only ever rides the caller's OWN completed day.
 */
export function GET(request: NextRequest): Promise<Response> {
  return authenticatedRead(request, async (db, userId) => {
    // SEQUENTIAL: the completions read is scoped by `today`, so it cannot
    // start before the clock answers (ADR-0051 decision 3).
    const today = await todaySaoPaulo(db);
    const rows = await listCompletionsForDay(db, userId, today);

    // The motif name (ADR-0070) is read CONDITIONALLY, on the same status
    // derivation the claim fold itself uses (`dayStateFromRows`), never a
    // hand-rolled "did they win the nonogram" scan that could drift from
    // it. Most callers pay no extra query: the read only runs for a user
    // whose Nonogram is already `completed`. The helper never throws — a
    // bad row degrades to no name rather than 500ing the whole payload.
    const motifName =
      dayStateFromRows(rows).nonogram === "completed"
        ? await getPublishedNonogramMotifName(db, today)
        : undefined;

    // Parse, never cast (boundary rule) — the same strict schema the web
    // client parses on arrival.
    return dayResponseSchema.parse({
      date: today,
      games: dayGamesFromRows(
        rows,
        // Truthiness, not `!== undefined`: belt-and-suspenders with the
        // wall read's own blank-name normalisation above.
        motifName ? { nonogramMotifName: motifName } : undefined,
      ),
    });
  });
}

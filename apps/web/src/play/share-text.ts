import { TERMO_MAX_GUESSES } from "@miolos/core";

import { formatElapsed, formatShortDate, messages } from "../i18n";
import type { PlayRecord } from "./play-record";

/**
 * The share text (#34, ADR-0054 decisions 2–5). PURE: a play record in, one
 * string out. No React, no DOM, no clipboard, no `@miolos/db`, no
 * `@miolos/games` — which is what lets `apps/web/test/share-text.test.ts`
 * assert the whole contract without rendering anything.
 *
 * WHAT IT MAY NOT SAY: the day's answer (it is in the record it reads,
 * `play-record.ts:341`), any guess word, the Nonogram bitmap, any board, the
 * Nonogram size, the hint count, the sync outcome, the streak, any medal, any
 * solved total, and the word "hoje" — `onTime` is parsed and DISCARDED
 * client-side (`sync.ts:485-495`), so nothing here can honestly claim when
 * the day was solved. The DATE is fine: it is the server's day, handed down
 * by the page shell.
 *
 * EACH IS GUARDED, AND BY THREE DIFFERENT MECHANISMS — which is the honest
 * statement, not "each has a test" (T-WEB-S190/S191):
 *   - fields that ARE on the record (answer, size, hintsUsed, syncOutcome,
 *     grid) → a DIFFERENTIAL: two records differing only in that field
 *     produce byte-identical output;
 *   - fields that are NOT on the record (streak, medals, solved totals, the
 *     day strip) → a module-graph scan, plus a signature assertion, because
 *     the realistic regression is a new ARGUMENT, not a new import;
 *   - fields that could BECOME on the record (the Sudoku tier is the live
 *     example) → a key-set assertion over each record member's schema.
 *
 * The URL is the CALLER's, not this module's: it stays free of `site-origin`
 * and of any route knowledge, and `T-WEB-S192` pins the absence from here
 * while `T-WEB-S192a` pins the composition at the call site.
 */
export function buildShareText(
  record: PlayRecord,
  options: { readonly url: string },
): string {
  const header = messages.share.header(
    messages.games[record.game].name,
    formatShortDate(record.date),
  );

  // The game-shaped branch lives HERE and not in the view (ADR-0029 decision
  // 2): the discriminated union narrows totally, the view calls one function
  // and renders one button.
  const lines =
    record.game === "termo"
      ? [
          header,
          record.outcome === "won"
            ? messages.share.termoWon(record.guesses.length, TERMO_MAX_GUESSES)
            : messages.share.termoLost(TERMO_MAX_GUESSES),
          "",
          // `tiles` is a 5-TUPLE, not an array
          // (`packages/core/src/contracts/termo-guess.ts:62-68`), and
          // `guesses` is `.max(TERMO_MAX_GUESSES)`, so the grid is at most
          // 6x5 by type. Every tile in it is a SERVER verdict (ADR-0038).
          ...record.guesses.map((row) =>
            row.tiles.map((tile) => messages.share.tiles[tile]).join(""),
          ),
          "",
          options.url,
        ]
      : [header, formatElapsed(record.elapsedMs), "", options.url];

  return lines.join("\n");
}

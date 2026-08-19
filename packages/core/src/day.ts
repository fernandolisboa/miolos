/**
 * The day so far, as PURE FUNCTIONS over completion rows and over the two
 * claims that can exist about a game's day (#83, ADR-0060).
 *
 * No clock, no timezone, no I/O enters this module. `dayStateFromRows` is
 * handed rows the caller already scoped to one user and one SP day off the
 * DB clock (`todaySaoPaulo(db)`, ADR-0010's single authority); the merge
 * functions are handed two projections and decide between them. A client
 * clock never reaches any of it (CLAUDE.md invariant).
 *
 * THE VOCABULARY LIVES HERE, beside the functions, and `contracts/day.ts`
 * imports it — the `COMPLETION_OUTCOMES` / `completionOutcomeSchema`
 * arrangement, one list feeding both the wire schema and the arithmetic so
 * the two can never drift into a second spelling.
 */
import { z } from "zod";

import type { CompletionOutcome } from "./completion";
import type { Game } from "./game";

/**
 * The three verbs a day state is spelled with. TWO OF THEM ARE CONTEXT.md's
 * AND THE THIRD IS NOT, and that is worth saying in the vocabulary's own
 * file rather than leaving it to be discovered:
 *
 * - `completed` is CONTEXT.md's *Conclusão* — an on-time win (ADR-0008
 *   rules 1–3), the only verb that counts for a streak, a medal or a
 *   statistic;
 * - `played` is *Jogado* — finished for the day and counting for nothing.
 *   Only Termo can land there in v1: a grid game cannot be lost;
 * - `pending` is the ABSENCE OF A COUNTED COMPLETION, and CONTEXT.md has no
 *   entry for it. Precisely: no row at all, OR the late-win row — `won` and
 *   `onTime: false` — which is a row that EXISTS and still yields no claim
 *   (`statusOfRow` below; ADR-0060 consequence (f), unreachable for a
 *   today-anchored payload). "The absence of a row" is the only case that
 *   can reach the wire and it is what the merge invariant's warrant rests
 *   on, but it is not the whole definition and is not stated as one here.
 *   The verb is the local projection's shipped spelling for an absence
 *   (`apps/web/src/play/day-state.ts`), which this module adopts rather
 *   than invents. If the glossary should gain a row for it, that is a
 *   `/domain-modeling` call and was not #83's to make.
 *
 * Because all three are the local projection's own three verbs,
 * `mergeDayStatus` below is a MERGE and not a translation.
 */
export const DAY_STATUSES = ["pending", "completed", "played"] as const;

export type DayGameStatus = (typeof DAY_STATUSES)[number];

export const dayGameStatusSchema = z.enum(DAY_STATUSES);

/**
 * One completion row as the day projection sees it. `onTime` is a FIELD OF
 * THE ROW — produced today by the SQL derivation (ADR-0026 decision 2), by
 * a stored column if #58 lands — and is never recomputed here, the same
 * contract `StreakRow` makes. No timestamp enters this module.
 */
export interface DayRow {
  readonly game: Game;
  readonly outcome: CompletionOutcome;
  readonly onTime: boolean;
}

/** A total per-game projection — every game answers, always. */
export type DayState = Readonly<Record<Game, DayGameStatus>>;

/**
 * How much a status CLAIMS. Used in exactly one place — the duplicate-row
 * fold below — and deliberately NOT used by the merge, which is decided by
 * authority (`mergeDayStatus`) and never by strength.
 */
const STATUS_CLAIM: Readonly<Record<DayGameStatus, number>> = {
  pending: 0,
  played: 1,
  completed: 2,
};

/**
 * One row's verdict. A `lost` row is *played* whether or not it was on time
 * (ADR-0008 rule 3 — it completes nothing, so lateness has nothing to
 * demote); a `won` row is *completed* only on time, and a LATE win reads
 * `pending`.
 *
 * The late arm is unreachable for a today-anchored payload — a row written
 * today for today is on time by construction — and it is defined anyway, so
 * the on-time rule has ONE spelling and the unreachable case fails SAFE
 * rather than by accident (`computeStreak`'s conjunctive guard, same
 * discipline).
 */
function statusOfRow(row: DayRow): DayGameStatus {
  if (row.outcome === "lost") {
    return "played";
  }
  return row.onTime ? "completed" : "pending";
}

/**
 * The day's four statuses from a user's rows for that day.
 *
 * Spelled out game by game rather than folded over `GAMES` so the return
 * type keeps the map TOTAL over `Game` — the same reason
 * `readDayState`'s literal is written out in `apps/web`.
 *
 * TWO ROWS FOR ONE GAME ARE IMPOSSIBLE — the composite primary key is
 * `(user_id, game, date)` (`packages/db/src/schema.ts`) — and the fold
 * below is order-independent anyway, taking the WEAKEST claim if it ever
 * saw two. That is the never-overstate direction ADR-0031 decision 2
 * permits, and it makes this function total and permutation-invariant over
 * an arbitrary row array rather than only over the arrays the schema can
 * actually produce.
 *
 * BOTH HALVES OF THAT SENTENCE ARE PINNED, and neither was until step 7:
 * `T-CORE-S96` feeds two rows for one game in both orders (so the
 * `STATUS_CLAIM` comparison is actually evaluated, and flipping `<` to `>`
 * goes red), and `T-CORE-S97` quantifies permutation-invariance over an
 * arbitrary array WITHOUT a uniqueness selector — duplicates included, which
 * is the case `T-CORE-S93`'s DB-shaped generator deliberately excludes.
 */
export function dayStateFromRows(rows: readonly DayRow[]): DayState {
  return {
    termo: statusForGame(rows, "termo"),
    sudoku: statusForGame(rows, "sudoku"),
    nonogram: statusForGame(rows, "nonogram"),
    binairo: statusForGame(rows, "binairo"),
  };
}

function statusForGame(rows: readonly DayRow[], game: Game): DayGameStatus {
  let weakest: DayGameStatus | undefined;
  for (const row of rows) {
    if (row.game !== game) {
      continue;
    }
    const status = statusOfRow(row);
    if (weakest === undefined || STATUS_CLAIM[status] < STATUS_CLAIM[weakest]) {
      weakest = status;
    }
  }
  // No row is not a denial — it is the absence of evidence, and that is
  // what `pending` means here.
  return weakest ?? "pending";
}

/**
 * THE MERGE INVARIANT (ADR-0060 decision 3), for one game.
 *
 * Two claims exist about a game's day and they are different kinds of
 * object. The DEVICE claims *"this device concluded this game today"* —
 * self-reported, an affordance and never an entitlement (ADR-0031 decision
 * 6). The SERVER claims *"a completion row exists for (user, game,
 * today)"* — the authority for the streak, the statistics and the medals
 * (ADR-0009, ADR-0026).
 *
 * > The server MAKES A CLAIM exactly when its status is not `pending`;
 * > `pending` from the server is the ABSENCE OF A COUNTED COMPLETION — no
 * > row, or the unreachable late-win row `statusOfRow` defines above — and
 * > therefore the absence of a claim, never a denial. Where the server
 * > claims, its claim is the day state; where it does not, the device's is.
 * > Absence on either side proves nothing, presence on the server is
 * > authority, presence on the device is an affordance. Nothing is blended
 * > field by field and no third value is ever synthesised.
 *
 * NOT "the stronger verb wins". Local `completed` + server `played` is
 * reachable and is Termo-only — win today's Termo on device A having lost
 * it on device B — and the server's `played` wins, because the row is
 * write-once (ADR-0026 decision 1) and the day genuinely does not count for
 * the streak. `completed` on that hub would be a lie the player can catch,
 * and `completedCount` would disagree with `/streak`'s `todayCounts`.
 */
export function mergeDayStatus(
  local: DayGameStatus,
  server: DayGameStatus,
): DayGameStatus {
  return server === "pending" ? local : server;
}

/**
 * `mergeDayStatus` over the four games, POINTWISE: game *g*'s result
 * depends on no other game's status. That is what makes the caller's
 * date-equality precondition — the payload is discarded IN FULL unless its
 * date is the rendered day — the only whole-payload rule anywhere in the
 * merge.
 *
 * The date gate lives in the caller and not here on purpose: this module
 * has no clock and no notion of "the rendered day", and a date parameter
 * would invite a per-key projection at the seam that consumes it
 * (ADR-0056's defect, one level up).
 */
export function mergeDayState(local: DayState, server: DayState): DayState {
  return {
    termo: mergeDayStatus(local.termo, server.termo),
    sudoku: mergeDayStatus(local.sudoku, server.sudoku),
    nonogram: mergeDayStatus(local.nonogram, server.nonogram),
    binairo: mergeDayStatus(local.binairo, server.binairo),
  };
}

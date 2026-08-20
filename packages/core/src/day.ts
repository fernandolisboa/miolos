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
 * One game's claim on the wire (#141, amending ADR-0060 decision 2): the
 * status, plus the completed row's duration where one is published.
 *
 * `elapsedMs` IS OPTIONAL, AND ITS ABSENCE IS MEANINGFUL, not sloppy:
 *
 * - a `pending` or `played` claim never carries one — the refinement below
 *   makes a payload that claims a time on an unfinished or lost game a PARSE
 *   FAILURE, not a value the client has to decide about;
 * - a completed TERMO carries none either, because Termo publishes no
 *   duration on any projection at all (ADR-0045 decision 4: the number
 *   includes every per-guess round trip and is meaningless for that game).
 *   The suppression lives in `dayGamesFromRows` below, so the wire never
 *   sees a value no tile would honestly render;
 * - a completed grid game always carries one in practice — the column is
 *   NOT NULL — and the field stays optional anyway, so an absent duration
 *   degrades to the chip-only done tile rather than failing the day.
 *
 * It lives HERE, beside `dayGameStatusSchema`, for the same reason that
 * schema does: one list feeding both the wire and the arithmetic, so the
 * projection and the contract cannot drift into two spellings.
 */
export const dayGameStateSchema = z
  .strictObject({
    status: dayGameStatusSchema,
    // The 24 h cap matches every completion WRITE contract
    // (`completionRequestSchema` and siblings in `contracts/completion.ts`),
    // so the read side can never accept a duration the write side would have
    // refused to store.
    elapsedMs: z.number().int().min(0).max(86_400_000).optional(),
    // `.max(1)` mirrors the write contracts for the same reason as the 24 h
    // cap above: one free hint per puzzle (plan 017 D21), so the read side
    // never accepts a count the write side would have refused. A future
    // hint-grant ticket raises both ends in one diff. Same optionality
    // discipline as `elapsedMs` (#142, ADR-0065): absent on `pending` and
    // `played` by the refinement below, and absent on a completed TERMO by
    // the producer (`dayGamesFromRows`) — Termo ships no hint, and "sem
    // dicas" is not a virtue where a hint was never possible (ADR-0045
    // decision 1).
    hintsUsed: z.number().int().min(0).max(1).optional(),
  })
  .refine(
    (game) => game.elapsedMs === undefined || game.status === "completed",
    {
      message: "elapsedMs is published only on a completed game",
    },
  )
  .refine(
    (game) => game.hintsUsed === undefined || game.status === "completed",
    {
      message: "hintsUsed is published only on a completed game",
    },
  );

export type DayGameState = z.infer<typeof dayGameStateSchema>;

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
  /**
   * The stored duration, REQUIRED because the column is `elapsed_ms
   * integer NOT NULL` (`>= 0` by check). Whether it is PUBLISHED is a
   * different question, answered per game by `dayGamesFromRows` below —
   * a row always has one, a claim does not always carry one.
   */
  readonly elapsedMs: number;
  /**
   * The stored hint count, REQUIRED for the same reason: the column is
   * `hints_used integer NOT NULL` (capped at 1 by the write contracts).
   * Published under exactly the rules `elapsedMs` follows (#142): on a
   * completed grid game's claim, never on Termo, never on `played` or
   * `pending`.
   */
  readonly hintsUsed: number;
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
 * The four per-game claims the wire carries (#141): `dayStateFromRows`'s
 * statuses, with the completed row's duration attached where one is
 * published. `dayStateFromRows` stays THE status derivation — this composes
 * it rather than re-spelling the fold.
 *
 * WHAT PUBLISHES A DURATION, exactly: a `completed` status, for every game
 * but Termo. A `played` or `pending` claim carries none (a time beside a
 * loss frames it as a result, ADR-0044 decision 4; a pending game has no
 * result at all), and a completed TERMO carries none because Termo publishes
 * no duration on any projection (ADR-0045 decision 4) — the local reader's
 * `entryFor` makes the same per-game exception, and mirroring it here is
 * what keeps a cross-device tile byte-identical to a local one.
 *
 * `hintsUsed` RIDES THE SAME RULES since #142 (ADR-0065): published on a
 * completed grid game's claim, never on Termo (no hint was ever possible
 * there — ADR-0045 decision 1 — so "sem dicas" would present as a virtue
 * something that was never a choice), never on `played` or `pending`.
 *
 * TWO ROWS FOR ONE GAME ARE IMPOSSIBLE (the composite primary key), and this
 * is total over them anyway, like the fold it composes: a `completed` status
 * means every row of that game read completed (weakest claim), and the
 * duration taken is the LARGEST — the humbler time, the same never-overstate
 * direction as the status fold, and permutation-invariant like it. The hint
 * count folds the same way: the largest, the humbler claim.
 */
export function dayGamesFromRows(
  rows: readonly DayRow[],
): Readonly<Record<Game, DayGameState>> {
  const statuses = dayStateFromRows(rows);
  return {
    termo: claimForGame(rows, "termo", statuses.termo),
    sudoku: claimForGame(rows, "sudoku", statuses.sudoku),
    nonogram: claimForGame(rows, "nonogram", statuses.nonogram),
    binairo: claimForGame(rows, "binairo", statuses.binairo),
  };
}

function claimForGame(
  rows: readonly DayRow[],
  game: Game,
  status: DayGameStatus,
): DayGameState {
  if (status !== "completed" || game === "termo") {
    return { status };
  }
  let elapsedMs: number | undefined;
  let hintsUsed: number | undefined;
  for (const row of rows) {
    if (row.game !== game || statusOfRow(row) !== "completed") {
      continue;
    }
    if (elapsedMs === undefined || row.elapsedMs > elapsedMs) {
      elapsedMs = row.elapsedMs;
    }
    // The LARGEST count, like the duration: the humbler claim, the same
    // never-overstate direction as the status fold (#142) — "sem dicas" on a
    // day any duplicate row spent a hint would overstate the solve.
    if (hintsUsed === undefined || row.hintsUsed > hintsUsed) {
      hintsUsed = row.hintsUsed;
    }
  }
  // A `completed` status guarantees a completed row exists (the fold takes
  // the weakest claim), so the undefined arms are unreachable — and defined
  // anyway, failing toward the chip-only tile rather than a fabricated 0.
  // Spread-per-field rather than a key set to `undefined`: the wire schema
  // is strict and a consumer compares claims field for field, so an absent
  // field must be ABSENT, not present-and-undefined.
  return {
    status,
    ...(elapsedMs === undefined ? {} : { elapsedMs }),
    ...(hintsUsed === undefined ? {} : { hintsUsed }),
  };
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

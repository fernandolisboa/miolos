/**
 * The statistics derivations (#29, ADR-0051): Dia Perfeito, the calendar,
 * the Termo guess distribution, times and totals — pure functions over
 * completion rows, recomputed on every read. No stored aggregate exists
 * anywhere (ADR-0009; ADR-0049 decision 6: a merge needs zero
 * stats-specific code, and this module is why it doesn't — the winner's
 * union of rows IS the statistics).
 *
 * No clock, no timezone, no I/O enters this module (the `streak.ts`
 * register). `today` and `since` are parameters the caller supplies from
 * the DB clock (`todaySaoPaulo(db)`, ADR-0010's single authority), and
 * `acceptedDaysBack` is the route-passed bound (ADR-0026 decision 6 keeps
 * it in the route layer — core takes it as a parameter, never a constant).
 *
 * Every exclusion rule lives HERE, where seam 2 tests it (plan 033 D3):
 * the db reader is deliberately unfiltered, and the two shared predicates
 * below are the rules' single spelling.
 */
import type { CompletionOutcome } from "./completion";
import { dateFromEpochDay, epochDay } from "./date";
import { GAMES, type Game } from "./game";

/**
 * One completion row as the statistics see it — the shared input #30's
 * rule-derived medals recompute over with no second reader (ADR-0049
 * decision 6 names them together). `onTime` is a FIELD OF THE ROW (the
 * `StreakRow` posture, #58-forward-compatible): produced today by the SQL
 * derivation (ADR-0026 decision 2), never recomputed here.
 */
export interface StatsRow {
  readonly game: Game;
  /** 'YYYY-MM-DD', the puzzle's own SP day. */
  readonly date: string;
  readonly outcome: CompletionOutcome;
  readonly onTime: boolean;
  /** Self-reported; display only (ADR-0027 posture). */
  readonly elapsedMs: number;
  /**
   * Self-reported; displayed by NOTHING in #29 and projected for #30's
   * row-type completeness. Per ADR-0027/ADR-0031 decision 6 it may drive a
   * display, and may NEVER back a medal or an entitlement — the constraint
   * travels with the type so #30 inherits it in writing.
   */
  readonly hintsUsed: number;
  /** 1..6 for termo rows, null otherwise (the DB CHECK's pairing). */
  readonly guesses: number | null;
}

/**
 * The games whose statistic is a duration. Termo is structurally absent:
 * its statistic is the guess distribution, and no Termo time is computed
 * anywhere (ADR-0045 decision 4, plan 033 D8).
 */
export const TIMED_GAMES = ["binairo", "sudoku", "nonogram"] as const;
export type TimedGame = (typeof TIMED_GAMES)[number];

/** F5's six buckets: <4, 4–5, 5–6, 6–7, 7–9, >9 minutes. Five bounds, upper-exclusive. */
export const TIME_BUCKET_BOUNDS_MS = [
  240_000, 300_000, 360_000, 420_000, 540_000,
] as const;

/** The 0..5 histogram bucket a duration falls in (bounds upper-exclusive). */
export function timeBucketIndex(elapsedMs: number): number {
  let index = 0;
  for (const bound of TIME_BUCKET_BOUNDS_MS) {
    if (elapsedMs >= bound) {
      index += 1;
    }
  }
  return index;
}

/**
 * counts-on-time-won (plan 033 §4): the only row shape that can feed a
 * distribution bucket, a time statistic or a Dia Perfeito.
 */
export function countsOnTimeWon(row: StatsRow): boolean {
  return row.outcome === "won" && row.onTime;
}

/**
 * counts-late-won: colours a calendar day "late" and moves `solved` —
 * nothing else (ADR-0008 rule 2's exclusion list names distributions and
 * time stats, not totals: a late solve is honestly a solve).
 */
export function countsLateWon(row: StatsRow): boolean {
  return row.outcome === "won" && !row.onTime;
}

/** A termo row's guess count iff it is the DB-legal 1..6, else null (total function). */
export function termoGuessOf(row: StatsRow): number | null {
  const { guesses } = row;
  return guesses !== null &&
    Number.isInteger(guesses) &&
    guesses >= 1 &&
    guesses <= 6
    ? guesses
    : null;
}

export interface TimedGameStats {
  /** ALL won rows, late included (plan 033 §4.4 — the deliberate population mismatch, ADR-0051 decision 6). */
  readonly solved: number;
  /** Min over won ∧ onTime, all time; null when none. */
  readonly bestMs: number | null;
  /** Rounded mean over won ∧ onTime within the last 30 days (D8's F5 window). */
  readonly averageMs: number | null;
  /** |that same 30-day population| — the closing line's gate; 0 ⇔ averageMs null. */
  readonly averageSampleCount: number;
  /** 6-bucket counts over won ∧ onTime, all time (timeBucketIndex). */
  readonly histogram: readonly [number, number, number, number, number, number];
}

export interface TermoStats {
  /** ALL won rows, late included — the same all-wins rule as the timed games. */
  readonly solved: number;
  /**
   * Index 0..5 = guesses 1..6 over won ∧ onTime; index 6 = the fail row,
   * ALL lost rows, unqualified (§4.3, ADR-0008 rule 3 exactly as written).
   */
  readonly distribution: readonly [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];
}

export interface StatsSummary {
  readonly binairo: TimedGameStats;
  readonly sudoku: TimedGameStats;
  readonly nonogram: TimedGameStats;
  readonly termo: TermoStats;
  /** |perfectDays(rows)| — one count, never a run length (D7). */
  readonly perfectDays: number;
  /** The won-today Termo row's guess count, else null (§4.5). */
  readonly todayTermoGuesses: number | null;
}

/**
 * Dia Perfeito (AC 1, plan 033 D7): a date is perfect iff all four games
 * have a row dated there with `outcome === "won" && onTime === true` —
 * under the composite PK (≤ 1 row per user-game-date) that is exactly
 * "exactly four on-time completions of the same day". A lost Termo
 * forfeits the day structurally (the lost row occupies Termo's only slot);
 * a late win never counts; a played row never counts. The output is a
 * sorted date SET: no run length, no consecutive-day arithmetic, no
 * "current perfect streak" exists anywhere — never a second streak.
 */
export function perfectDays(rows: readonly StatsRow[]): readonly string[] {
  const wonOnTimeGamesByDate = new Map<string, Set<Game>>();
  for (const row of rows) {
    if (!countsOnTimeWon(row)) {
      continue;
    }
    const games = wonOnTimeGamesByDate.get(row.date) ?? new Set<Game>();
    games.add(row.game);
    wonOnTimeGamesByDate.set(row.date, games);
  }
  const dates: string[] = [];
  for (const [date, games] of wonOnTimeGamesByDate) {
    if (games.size === GAMES.length) {
      dates.push(date);
    }
  }
  return dates.sort();
}

export type CalendarDayState = "onTime" | "late" | "missed";

export interface CalendarDay {
  readonly date: string;
  readonly state: CalendarDayState;
  /** The Dia Perfeito marker — only ever true on an "onTime" day (D7). */
  readonly perfect: boolean;
}

/**
 * The calendar (ADR-0008 rule 2, plan 033 D6): one entry per date of
 * [effectiveSince, today], per-date precedence on-time > late > missed.
 * Lost rows never colour a day — a day whose only row is a lost Termo
 * renders "missed"; the loss is visible in the fail row, not here.
 *
 * `effectiveSince` is the D6 clamp, as corrected at step 6 (the won-only
 * rule, ADR-0051 decision 2):
 *
 *   min( epochDay(since),
 *        min over { epochDay(row.date) :
 *                   row.outcome === "won"
 *                   ∧ epochDay(row.date) ≥ epochDay(since) − acceptedDaysBack } )
 *
 * (the set may be empty → epochDay(since)). The backward extension exists
 * because a completion may legitimately be dated before account creation
 * (a 00:30 account completing yesterday's puzzle, `ACCEPTED_DAYS_BACK`),
 * and such a row must appear. But only a row that actually COLOURS a day —
 * a won row — may extend the range: a lost row colours nothing (D6), so
 * letting it extend would paint "missed" over a day the account did not
 * exist for, the exact fabrication the clamp exists to prevent. And the
 * extension is BOUNDED by exactly the days a write can legitimately
 * predate account birth — a won row further back than the bound never
 * extends (the unbounded min() was rejected at plan review). Rows dated
 * before `effectiveSince` emit no day entry here and still feed every
 * `computeStats` aggregate; rows dated after `today` are inert (the
 * `computeStreak` posture). When #31 widens `ACCEPTED_DAYS_BACK` it must
 * revisit how a pre-birth late completion renders (ADR-0051 decision 2
 * records the obligation).
 */
export function computeCalendar(
  rows: readonly StatsRow[],
  since: string,
  today: string,
  acceptedDaysBack: number,
): readonly CalendarDay[] {
  const sinceDay = epochDay(since);
  const todayDay = epochDay(today);
  // A guard, not a reachable state: both values come off the same DB clock.
  if (sinceDay > todayDay) {
    return [];
  }
  const extensionFloorDay = sinceDay - acceptedDaysBack;
  let effectiveSince = sinceDay;
  const wonOnTimeDays = new Set<number>();
  const wonLateDays = new Set<number>();
  for (const row of rows) {
    const day = epochDay(row.date);
    if (countsOnTimeWon(row)) {
      wonOnTimeDays.add(day);
    } else if (countsLateWon(row)) {
      wonLateDays.add(day);
    } else {
      // A lost row colours no day (D6) — and therefore never extends the
      // range either: an extension it earned would only ever paint
      // "missed" on a pre-birth day (the step-6 correction).
      continue;
    }
    // Only a won row within the legitimate-predate bound extends the range.
    if (day >= extensionFloorDay) {
      effectiveSince = Math.min(effectiveSince, day);
    }
  }
  const perfect = new Set(perfectDays(rows).map((date) => epochDay(date)));
  const days: CalendarDay[] = [];
  for (let day = effectiveSince; day <= todayDay; day += 1) {
    days.push({
      date: dateFromEpochDay(day),
      state: wonOnTimeDays.has(day)
        ? "onTime"
        : wonLateDays.has(day)
          ? "late"
          : "missed",
      perfect: perfect.has(day),
    });
  }
  return days;
}

/** The per-timed-game aggregate block (§4.4's three populations). */
function timedGameStats(
  rows: readonly StatsRow[],
  game: TimedGame,
  windowFloorDay: number,
): TimedGameStats {
  const gameRows = rows.filter((row) => row.game === game);
  const onTimeWins = gameRows.filter(countsOnTimeWon);
  // Three rows, three deliberately different populations (ADR-0051
  // decision 6): best = all-time on-time wins, average = 30-day on-time
  // wins, solved = all wins INCLUDING late — hiding a late solve from
  // `resolvidos` would silently un-count a solve the calendar visibly
  // shows. The UI labels carry the distinction ("Sua média (30 dias)").
  const solved = gameRows.filter((row) => row.outcome === "won").length;
  const bestMs =
    onTimeWins.length === 0
      ? null
      : onTimeWins.reduce(
          (min, row) => Math.min(min, row.elapsedMs),
          Number.POSITIVE_INFINITY,
        );
  const windowRows = onTimeWins.filter(
    (row) => epochDay(row.date) > windowFloorDay,
  );
  const averageSampleCount = windowRows.length;
  const averageMs =
    averageSampleCount === 0
      ? null
      : Math.round(
          windowRows.reduce((sum, row) => sum + row.elapsedMs, 0) /
            averageSampleCount,
        );
  const histogram: [number, number, number, number, number, number] = [
    0, 0, 0, 0, 0, 0,
  ];
  for (const row of onTimeWins) {
    const bucket = timeBucketIndex(row.elapsedMs);
    histogram[bucket] = (histogram[bucket] ?? 0) + 1;
  }
  return { solved, bestMs, averageMs, averageSampleCount, histogram };
}

/** Termo's aggregate: the distribution with its fail row, never a time (D8). */
function termoStats(rows: readonly StatsRow[]): TermoStats {
  const termoRows = rows.filter((row) => row.game === "termo");
  const distribution: [number, number, number, number, number, number, number] =
    [0, 0, 0, 0, 0, 0, 0];
  for (const row of termoRows) {
    if (row.outcome === "lost") {
      // The fail row counts ALL lost rows, UNQUALIFIED — ADR-0008 rule 3
      // exactly as written ("the loss records in the Termo guess
      // distribution as the fail row") and CONTEXT.md's "and nothing
      // else". Rule 2's exclusions are scoped to late COMPLETIONS — won
      // rows — and a lost row is *played*, a different verb, so no
      // on-time conjunct exists here (plan 033 §4.3).
      distribution[6] += 1;
    } else if (countsOnTimeWon(row)) {
      const guesses = termoGuessOf(row);
      // A won on-time row with guesses null or outside 1..6 is impossible
      // under `completions_guesses_check`; ignored defensively — the
      // function is total over its type.
      if (guesses !== null) {
        const bucket = guesses - 1;
        distribution[bucket] = (distribution[bucket] ?? 0) + 1;
      }
    }
  }
  const solved = termoRows.filter((row) => row.outcome === "won").length;
  return { solved, distribution };
}

/**
 * The bounded aggregates `GET /stats` serves (plan 033 §4): per-game
 * blocks, the Dias Perfeitos count, and today's Termo result for the hub
 * tile and the conclusion highlight.
 */
export function computeStats(
  rows: readonly StatsRow[],
  today: string,
): StatsSummary {
  // F5's "Sua média (30 dias)": rows dated within the last 30 SP days,
  // today included — epochDay(date) > epochDay(today) − 30.
  const windowFloorDay = epochDay(today) - 30;
  // A won row dated today is on time by the derivation's construction —
  // `completed_at` is the DB clock at insert, so a row whose `date` equals
  // the DB clock's today derives on-time by definition. No `onTime`
  // conjunct, on purpose: adding one would be a second, redundant spelling
  // of that construction (plan 033 §4.5). The MINIMUM over qualifying rows
  // — not `find` — keeps the function total AND order-independent over its
  // type: the composite PK makes duplicate (game, date) rows unreachable
  // in production, but a permutation of a duplicate-carrying input must
  // still answer identically (T-CORE-S62's property).
  let todayTermoGuesses: number | null = null;
  for (const row of rows) {
    if (row.game !== "termo" || row.date !== today || row.outcome !== "won") {
      continue;
    }
    const guesses = termoGuessOf(row);
    if (
      guesses !== null &&
      (todayTermoGuesses === null || guesses < todayTermoGuesses)
    ) {
      todayTermoGuesses = guesses;
    }
  }
  const timed = timedGameBlocks(rows, windowFloorDay);
  return {
    binairo: timed.binairo,
    sudoku: timed.sudoku,
    nonogram: timed.nonogram,
    termo: termoStats(rows),
    perfectDays: perfectDays(rows).length,
    todayTermoGuesses,
  };
}

/**
 * One aggregate block per timed game — `TIMED_GAMES` is the single
 * spelling of the iteration (step-6 F8: the constant's own in-module
 * consumer, so the wire order can never drift from the type). The
 * empty-literal assertion is made true by the loop directly under it:
 * every member of `TIMED_GAMES` — whose union IS `TimedGame` — is
 * assigned exactly once before the return. Not a boundary cast: nothing
 * crosses a wire here, and the route still parses the assembled summary
 * through the strict schema.
 */
function timedGameBlocks(
  rows: readonly StatsRow[],
  windowFloorDay: number,
): Record<TimedGame, TimedGameStats> {
  const blocks = {} as Record<TimedGame, TimedGameStats>;
  for (const game of TIMED_GAMES) {
    blocks[game] = timedGameStats(rows, game, windowFloorDay);
  }
  return blocks;
}

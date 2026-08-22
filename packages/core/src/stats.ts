/**
 * Read-time statistics derivations (ADR-0051): no stored aggregate exists,
 * so every number here is recomputed on every read. No clock or I/O enters
 * this module — `today`/`since` are the caller's DB-clock values, and
 * `rolloverSlackDays` is a route-supplied parameter, never a constant here
 * (see ADR-0053).
 */
import type { CompletionOutcome } from "./completion";
import { dateFromEpochDay, epochDay } from "./date";
import { GAMES, type Game } from "./game";

/** One completion row as the statistics see it. */
export interface StatsRow {
  readonly game: Game;
  /** 'YYYY-MM-DD', the puzzle's own SP day. */
  readonly date: string;
  readonly outcome: CompletionOutcome;
  readonly onTime: boolean;
  /** Self-reported; display only. */
  readonly elapsedMs: number;
  /** Self-reported; display only. */
  readonly hintsUsed: number;
  /** 1..6 for termo rows, null otherwise. */
  readonly guesses: number | null;
}

/** The games whose statistic is a duration; Termo's is the guess distribution instead. */
export const TIMED_GAMES = ["binairo", "sudoku", "nonogram"] as const;
export type TimedGame = (typeof TIMED_GAMES)[number];

/** Six buckets, in ms, upper-exclusive: <4, 4–5, 5–6, 6–7, 7–9, >9 minutes. */
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

/** The only row shape that feeds a distribution bucket, a time statistic or a Dia Perfeito. */
export function countsOnTimeWon(row: StatsRow): boolean {
  return row.outcome === "won" && row.onTime;
}

/** A late win colours the calendar "late" and counts toward `solved` — never
 *  a distribution or time stat. */
export function countsLateWon(row: StatsRow): boolean {
  return row.outcome === "won" && !row.onTime;
}

/** A termo row's guess count when it's 1..6, else null. */
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
  /** All won rows, late included. */
  readonly solved: number;
  /** Min over won ∧ onTime, all time; null when none. */
  readonly bestMs: number | null;
  /** Rounded mean over won ∧ onTime within the last 30 days. */
  readonly averageMs: number | null;
  /** |that same 30-day population|; 0 ⇔ averageMs null. */
  readonly averageSampleCount: number;
  /** 6-bucket counts over won ∧ onTime, all time (timeBucketIndex). */
  readonly histogram: readonly [number, number, number, number, number, number];
}

export interface TermoStats {
  /** All won rows, late included — the same all-wins rule as the timed games. */
  readonly solved: number;
  /** Index 0..5 = guesses 1..6 over won ∧ onTime; index 6 = the fail row, all lost rows, unqualified. */
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
  /** |perfectDays(rows)| — one count, never a run length. */
  readonly perfectDays: number;
  /** The won-today Termo row's guess count, else null. */
  readonly todayTermoGuesses: number | null;
}

/**
 * Dia Perfeito: a date is perfect iff all four games have a row dated
 * there with `outcome === "won" && onTime === true`. A lost Termo forfeits
 * the day structurally — the lost row occupies Termo's only slot under the
 * composite PK. The output is a sorted date SET: no run length, no
 * "current perfect streak" exists anywhere.
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
  /** The Dia Perfeito marker — only ever true on an "onTime" day. */
  readonly perfect: boolean;
}

/**
 * One calendar entry per date in [effectiveSince, today], per-date
 * precedence on-time > late > missed. Lost rows never colour a day.
 *
 * `effectiveSince` extends `since` backward only through won rows dated
 * within `rolloverSlackDays` of it — never through lost rows, which would
 * paint a fabricated "missed" day before the account existed. The bound
 * exists because a completion may legitimately predate account creation by
 * that much (a 00:30 account flushing yesterday's puzzle). `rolloverSlackDays`
 * is that rollover slack, not the write window — the two must never be
 * merged (ADR-0053).
 *
 * A row dated before `effectiveSince` emits no day entry here and still
 * feeds every `computeStats` aggregate; a row dated after `today` is inert.
 */
export function computeCalendar(
  rows: readonly StatsRow[],
  since: string,
  today: string,
  rolloverSlackDays: number,
): readonly CalendarDay[] {
  const sinceDay = epochDay(since);
  const todayDay = epochDay(today);
  // Defensive: not reachable in practice — both values come off the same
  // DB clock.
  if (sinceDay > todayDay) {
    return [];
  }
  const extensionFloorDay = sinceDay - rolloverSlackDays;
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
      continue;
    }
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

function timedGameStats(
  rows: readonly StatsRow[],
  game: TimedGame,
  windowFloorDay: number,
): TimedGameStats {
  const gameRows = rows.filter((row) => row.game === game);
  const onTimeWins = gameRows.filter(countsOnTimeWon);
  // best/average require on-time wins; solved counts all wins, late
  // included — hiding a late solve from `solved` would silently undercount
  // a win the calendar still shows as "late", not "missed".
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

function termoStats(rows: readonly StatsRow[]): TermoStats {
  const termoRows = rows.filter((row) => row.game === "termo");
  const distribution: [number, number, number, number, number, number, number] =
    [0, 0, 0, 0, 0, 0, 0];
  for (const row of termoRows) {
    if (row.outcome === "lost") {
      distribution[6] += 1;
    } else if (countsOnTimeWon(row)) {
      const guesses = termoGuessOf(row);
      if (guesses !== null) {
        const bucket = guesses - 1;
        distribution[bucket] = (distribution[bucket] ?? 0) + 1;
      }
    }
  }
  const solved = termoRows.filter((row) => row.outcome === "won").length;
  return { solved, distribution };
}

export function computeStats(
  rows: readonly StatsRow[],
  today: string,
): StatsSummary {
  const windowFloorDay = epochDay(today) - 30;
  // No `onTime` check: a won row dated today is on-time by the write
  // rule's construction (ADR-0066). Minimum over qualifying rows, not
  // `find`, keeps the loop order-independent.
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
 * `TIMED_GAMES` is the single spelling of the iteration, so the wire order
 * can never drift from the type. The cast below is made safe by the loop
 * directly under it — every member of `TIMED_GAMES` is assigned exactly
 * once before the return.
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

import type { CompletionOutcome } from "./completion";
import { dateFromEpochDay, epochDay } from "./date";
import { GAMES, type Game } from "./game";

export interface StatsRow {
  readonly game: Game;

  readonly date: string;
  readonly outcome: CompletionOutcome;
  readonly onTime: boolean;

  readonly elapsedMs: number;

  readonly hintsUsed: number;

  readonly guesses: number | null;
}

export const TIMED_GAMES = ["binairo", "sudoku", "nonogram"] as const;
export type TimedGame = (typeof TIMED_GAMES)[number];

export const TIME_BUCKET_BOUNDS_MS = [
  240_000, 300_000, 360_000, 420_000, 540_000,
] as const;

export function timeBucketIndex(elapsedMs: number): number {
  let index = 0;
  for (const bound of TIME_BUCKET_BOUNDS_MS) {
    if (elapsedMs >= bound) {
      index += 1;
    }
  }
  return index;
}

export function countsOnTimeWon(row: StatsRow): boolean {
  return row.outcome === "won" && row.onTime;
}

export function countsLateWon(row: StatsRow): boolean {
  return row.outcome === "won" && !row.onTime;
}

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
  readonly solved: number;

  readonly bestMs: number | null;

  readonly averageMs: number | null;

  readonly averageSampleCount: number;

  readonly histogram: readonly [number, number, number, number, number, number];
}

export interface TermoStats {
  readonly solved: number;

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

  readonly perfectDays: number;

  readonly todayTermoGuesses: number | null;
}

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

  readonly perfect: boolean;
}

export function computeCalendar(
  rows: readonly StatsRow[],
  since: string,
  today: string,
  rolloverSlackDays: number,
): readonly CalendarDay[] {
  const sinceDay = epochDay(since);
  const todayDay = epochDay(today);

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

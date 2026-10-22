import type { CompletionOutcome } from "./completion";
import { dateFromEpochDay, epochDay } from "./date";
import { recordFor, type Game } from "./game";

export interface StatsRow {
  readonly game: Game;

  readonly date: string;
  readonly outcome: CompletionOutcome;
  readonly onTime: boolean;

  readonly elapsedMs: number;

  readonly hintsUsed: number;

  readonly guesses: number | null;
}

export interface PublishedDaily {
  readonly date: string;
  readonly game: Game;
}

export const TIMED_GAMES = [
  "binairo",
  "sudoku",
  "nonogram",
  "crossword",
  "queens",
  "minesweeper",
] as const satisfies readonly Game[];
export type TimedGame = (typeof TIMED_GAMES)[number];

export const TIME_BUCKET_BOUNDS_MS: Readonly<
  Record<TimedGame, readonly [number, number, number, number, number]>
> = {
  binairo: [120_000, 180_000, 240_000, 360_000, 480_000],
  sudoku: [240_000, 360_000, 480_000, 720_000, 960_000],
  nonogram: [120_000, 240_000, 360_000, 600_000, 900_000],
  crossword: [240_000, 360_000, 480_000, 720_000, 960_000],
  queens: [60_000, 120_000, 180_000, 240_000, 360_000],
  minesweeper: [120_000, 180_000, 240_000, 360_000, 480_000],
};

export function timeBucketIndex(game: TimedGame, elapsedMs: number): number {
  let index = 0;
  for (const bound of TIME_BUCKET_BOUNDS_MS[game]) {
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

export interface StatsSummary extends Readonly<
  Record<TimedGame, TimedGameStats>
> {
  readonly termo: TermoStats;

  readonly perfectDays: number;

  readonly todayTermoGuesses: number | null;
}

function gamesByDate(
  dailies: readonly PublishedDaily[],
): ReadonlyMap<string, ReadonlySet<Game>> {
  const byDate = new Map<string, Set<Game>>();
  for (const { date, game } of dailies) {
    const games = byDate.get(date) ?? new Set<Game>();
    games.add(game);
    byDate.set(date, games);
  }
  return byDate;
}

// see ADR-0129
const FULL_DAY_GAMES = 3;

export const DAY_MARKS = ["full", "perfect"] as const;
export type DayMark = (typeof DAY_MARKS)[number];

export function dayMarkOf(
  won: ReadonlySet<Game>,
  lineup: ReadonlySet<Game>,
): DayMark | undefined {
  if (lineup.size > 0 && [...lineup].every((game) => won.has(game))) {
    return "perfect";
  }
  const needed =
    lineup.size === 0 ? FULL_DAY_GAMES : Math.min(FULL_DAY_GAMES, lineup.size);
  return won.size >= needed ? "full" : undefined;
}

const NO_GAMES: ReadonlySet<Game> = new Set();

export function dayMarks(
  rows: readonly StatsRow[],
  published: readonly PublishedDaily[],
): ReadonlyMap<string, DayMark> {
  const lineupByDate = gamesByDate(published);
  const marks = new Map<string, DayMark>();
  for (const [date, won] of gamesByDate(rows.filter(countsOnTimeWon))) {
    const mark = dayMarkOf(won, lineupByDate.get(date) ?? NO_GAMES);
    if (mark !== undefined) {
      marks.set(date, mark);
    }
  }
  return marks;
}

export function perfectDays(
  rows: readonly StatsRow[],
  published: readonly PublishedDaily[],
): readonly string[] {
  return [...dayMarks(rows, published)]
    .filter(([, mark]) => mark === "perfect")
    .map(([date]) => date)
    .sort();
}

export function fullDays(
  rows: readonly StatsRow[],
  published: readonly PublishedDaily[],
): readonly string[] {
  return [...dayMarks(rows, published).keys()].sort();
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
  published: readonly PublishedDaily[],
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
  const perfect = new Set(
    perfectDays(rows, published).map((date) => epochDay(date)),
  );
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
    const bucket = timeBucketIndex(game, row.elapsedMs);
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
  published: readonly PublishedDaily[],
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
  return {
    ...recordFor(TIMED_GAMES, (game) =>
      timedGameStats(rows, game, windowFloorDay),
    ),
    termo: termoStats(rows),
    perfectDays: perfectDays(rows, published).length,
    todayTermoGuesses,
  };
}

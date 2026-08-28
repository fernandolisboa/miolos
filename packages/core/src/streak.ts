import type { CompletionOutcome } from "./completion";
import { epochDay } from "./date";

export interface StreakRow {
  readonly date: string;
  readonly outcome: CompletionOutcome;
  readonly onTime: boolean;
}

export interface StreakStatus {
  readonly streak: number;

  readonly todayCounts: boolean;
}

export function computeStreak(
  rows: readonly StreakRow[],
  today: string,
): StreakStatus {
  const todayDay = epochDay(today);
  const countedDays = new Set<number>();
  for (const row of rows) {
    if (row.outcome === "won" && row.onTime) {
      const day = epochDay(row.date);
      if (day <= todayDay) {
        countedDays.add(day);
      }
    }
  }
  const todayCounts = countedDays.has(todayDay);
  let cursor = todayCounts ? todayDay : todayDay - 1;
  let streak = 0;
  while (countedDays.has(cursor)) {
    streak += 1;
    cursor -= 1;
  }
  return { streak, todayCounts };
}

import {
  computeStreak,
  epochDay,
  type StreakRow,
  type TelemetryEventProperties,
} from "@miolos/core";

export function deriveStreakBroken(
  rows: readonly StreakRow[],
  insertedDate: string,
): TelemetryEventProperties["streak_broken"] | null {
  const insertedDay = epochDay(insertedDate);
  let prev: { date: string; day: number } | undefined;
  let countedOnInsertedDate = 0;
  for (const row of rows) {
    if (row.outcome !== "won" || !row.onTime) {
      continue;
    }
    const day = epochDay(row.date);
    if (day > insertedDay) {
      return null;
    }
    if (day === insertedDay) {
      countedOnInsertedDate += 1;
      continue;
    }
    if (prev === undefined || day > prev.day) {
      prev = { date: row.date, day };
    }
  }

  if (countedOnInsertedDate !== 1) {
    return null;
  }

  if (prev === undefined) {
    return null;
  }

  if (prev.day >= insertedDay - 1) {
    return null;
  }
  return {
    previous_streak: computeStreak(rows, prev.date).streak,
    broken_after_date: prev.date,
    gap_days: insertedDay - prev.day - 1,
  };
}

import type { Game } from "@miolos/core";
import type { ArchivedDay } from "@miolos/db";

export interface ArchiveDayGroup {
  readonly date: string;
  readonly games: readonly Game[];
}

export function groupArchivedDays(
  days: readonly ArchivedDay[],
): readonly ArchiveDayGroup[] {
  const groups: { date: string; games: Game[] }[] = [];
  for (const day of days) {
    const last = groups.at(-1);
    if (last?.date === day.date) {
      last.games.push(day.game);
    } else {
      groups.push({ date: day.date, games: [day.game] });
    }
  }
  return groups;
}

import type { Game } from "@miolos/core";
import type { ArchivedDay } from "@miolos/db";

/**
 * A date and the games it actually holds (#31, ADR-0053 decision 3). The
 * archive's floor is ragged and that is the SHIPPED shape rather than an
 * edge case: the cron gained its four games on four different days with no
 * backfill, so the oldest dates hold one, two or three games — and a
 * `killed_at` takedown produces exactly the same shape, which matters
 * because the kill switch is the whole reason these pages are uncached.
 */
export interface ArchiveDayGroup {
  readonly date: string;
  readonly games: readonly Game[];
}

/**
 * Group the reader's `(date, game)` pairs into day rows, preserving the
 * reader's own order (`date DESC, game ASC`) rather than re-sorting: the
 * order is a property of the SQL, and a second sort here would be a second
 * place for it to be decided.
 */
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

/**
 * The index's "seven most recent days", from an OVER-FETCHED row window.
 *
 * The over-fetch is the fix for the ragged floor, and the arithmetic is the
 * reason it exists: `limit: 28` yields "the seven most recent days" only if
 * every date holds all four games, and with a gap 28 rows span eight dates
 * and the last one is silently truncated. So the reader is asked for
 * `limit` rows, and **if exactly `limit` came back the trailing date group
 * is discarded** — it may be cut mid-date — before the first `count` groups
 * are taken.
 *
 * When fewer than `limit` rows came back the window reached the archive's
 * own floor, so no group can be truncated and none is dropped.
 */
export function recentDayGroups(
  days: readonly ArchivedDay[],
  options: { readonly limit: number; readonly count: number },
): readonly ArchiveDayGroup[] {
  const groups = groupArchivedDays(days);
  const complete = days.length === options.limit ? groups.slice(0, -1) : groups;
  return complete.slice(0, options.count);
}

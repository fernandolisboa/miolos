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
 * Group the reader's `(date, game)` pairs into per-day groups (the day
 * page's cards; the sitemap's day entries), preserving the reader's own
 * order (`date DESC, game ASC`) rather than re-sorting: the order is a
 * property of the SQL, and a second sort here would be a second place for
 * it to be decided.
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

// `recentDayGroups` — the index's "seven most recent days" over-fetch —
// went with the day rows it fed (#163, plan 065 D2): the index derives its
// newest-month calendar from the row window directly, in
// `app/arquivo/page.tsx`, and no consumer of a truncation-safe recent
// window remains.

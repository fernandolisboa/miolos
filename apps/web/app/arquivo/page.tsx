import {
  listArchivedDays,
  listArchivedMonths,
  type ArchivedDay,
} from "@miolos/db";
import type { Metadata } from "next";

import { monthOf } from "../../src/archive/parse-params";
import { getDb } from "../../src/db";
import { messages, routes } from "../../src/i18n";
import { ArchiveIndexView } from "./index-view";

// No caching of any kind on this segment (ADR-0053 decision 2). The daily's
// reason does not transfer — an archived day's CONTENT is immutable — and
// pretending it does would be dishonest. The real reason is the kill switch:
// `killed_at` is the operator's takedown, it is a database write with no
// deploy and no invalidation hook, and a cached archive page outlives it for
// the whole TTL. No `revalidate`, no `generateStaticParams` (ADR-0028
// decision 6, obeyed), no `fetch` on this path at all.
export const dynamic = "force-dynamic";

/**
 * How many ROWS the index over-fetches for the newest month's calendar:
 * 31 days × 4 games — the maximum rows one month can hold — so the window
 * always covers the whole newest month and stays a constant, bounded by
 * construction (ADR-0053 decision 4; #163 widened it from 32).
 */
const NEWEST_MONTH_ROW_WINDOW = 124;

export function generateMetadata(): Metadata {
  return {
    title: messages.archive.meta.indexTitle,
    description: messages.archive.meta.indexDescription,
    alternates: { canonical: routes.archive },
  };
}

/**
 * The newest archived month and its published days, from the window
 * ITSELF: the month is `monthOf` the newest row, and the day set is the
 * window's matching rows — never a second read and never a clock, so the
 * grid and its data cannot straddle midnight disagreeing with each other.
 * An empty window is an empty archive: no grid at all, never a skeleton.
 */
function newestMonthCalendar(
  days: readonly ArchivedDay[],
): { month: string; dates: readonly string[] } | undefined {
  const first = days[0];
  if (first === undefined) {
    return undefined;
  }
  const month = monthOf(first.date);
  const dates = [
    ...new Set(
      days.filter((day) => monthOf(day.date) === month).map((day) => day.date),
    ),
  ];
  return { month, dates };
}

/**
 * The archive index (#31 AC 1, AC 5; the calendar since #163). Both reads
 * in one round-trip window: the row window the newest month's grid is cut
 * from, and the month list — whose LAST element is the archive's floor, so
 * nothing else records where the archive starts (ADR-0053 decision 3).
 * The month list feeds only the chips; the grid's month comes from the
 * row window's own newest row.
 *
 * Thin on purpose: two reader calls and a derivation. All composition
 * lives in the synchronous view, which tests render directly.
 */
export default async function ArchivePage() {
  const db = getDb();
  const [days, months] = await Promise.all([
    listArchivedDays(db, { limit: NEWEST_MONTH_ROW_WINDOW }),
    listArchivedMonths(db),
  ]);

  return (
    <ArchiveIndexView calendar={newestMonthCalendar(days)} months={months} />
  );
}

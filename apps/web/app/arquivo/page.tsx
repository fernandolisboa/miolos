import { listArchivedDays, listArchivedMonths } from "@miolos/db";
import type { Metadata } from "next";

import { recentDayGroups } from "../../src/archive/group-days";
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

/** How many ROWS the index over-fetches, and how many DAYS it renders. */
const ROW_WINDOW = 32;
const RECENT_DAYS = 7;

export function generateMetadata(): Metadata {
  return {
    title: messages.archive.meta.indexTitle,
    description: messages.archive.meta.indexDescription,
    alternates: { canonical: routes.archive },
  };
}

/**
 * The archive index (#31 AC 1, AC 5). Both reads in one round-trip window:
 * the row window the recent-days section is cut from, and the month list —
 * whose LAST element is the archive's floor, so nothing else records where
 * the archive starts (ADR-0053 decision 3).
 *
 * Thin on purpose: two reader calls and a branch. All composition lives in
 * the synchronous view, which tests render directly.
 */
export default async function ArchivePage() {
  const db = getDb();
  const [days, months] = await Promise.all([
    listArchivedDays(db, { limit: ROW_WINDOW }),
    listArchivedMonths(db),
  ]);

  return (
    <ArchiveIndexView
      recent={recentDayGroups(days, {
        limit: ROW_WINDOW,
        count: RECENT_DAYS,
      })}
      months={months}
    />
  );
}

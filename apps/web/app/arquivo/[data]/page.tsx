import { archiveDateClass, listArchivedDays } from "@miolos/db";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { groupArchivedDays } from "../../../src/archive/group-days";
import { parseArchiveDate } from "../../../src/archive/parse-params";
import { getDb } from "../../../src/db";
import {
  archiveDayRoute,
  formatLongDate,
  messages,
  routes,
} from "../../../src/i18n";
import { ArchiveDayView } from "../day-view";

// ADR-0053 decision 2 — see `app/arquivo/page.tsx` for the kill-switch
// argument. No `revalidate`, no `generateStaticParams`, no `fetch`.
export const dynamic = "force-dynamic";

/** Hand-written props — see `app/arquivo/mes/[mes]/page.tsx` for why. */
interface DayPageProps {
  readonly params: Promise<{ readonly data: string }>;
}

/**
 * The SAME parser the page body calls (plan 037 D6a) — see the month page's
 * `generateMetadata` for why that ordering is a real hole and not a shape
 * quibble. The segment is validated with `calendarDateString`, never a
 * hand-rolled regex: it is the repo's one calendar-day validator and it
 * rejects `2026-02-30`, which a shape regex accepts.
 */
export async function generateMetadata({
  params,
}: DayPageProps): Promise<Metadata> {
  const date = parseArchiveDate((await params).data);
  if (date === undefined) {
    return { robots: { index: false } };
  }
  const longDate = formatLongDate(date);
  return {
    title: messages.archive.meta.dayTitle(longDate),
    description: messages.archive.meta.dayDescription(longDate),
    alternates: { canonical: archiveDayRoute(date) },
  };
}

/**
 * One archived day (#31 AC 1). **Read first, classify only on empty**, and
 * the order is a decision rather than an implementation detail (ADR-0053
 * decision 1): a row in hand IS the proof that the date is past, so no clock
 * comparison can contradict it, and the archived path costs exactly one
 * round trip and never consults the classifier at all.
 *
 * Classify-then-read and `Promise.all` both admit a midnight straddle that
 * can 404 a date whose row was already returnable. This ordering's only
 * straddle is a `"past"` classification after an empty read — it answers 404,
 * a reload resolves it, and it can never reach a sitemap-advertised URL,
 * because the sitemap is built from this same reader under the same clock.
 *
 * The redirect is TEMPORARY. The rule's truth value changes at midnight, and
 * a permanent redirect is cacheable against the URL forever — it would
 * silently break the shared link days later, only for the people who followed
 * it once. `redirect()` from `next/navigation` issues a 307.
 */
export default async function ArchiveDayPage({ params }: DayPageProps) {
  const date = parseArchiveDate((await params).data);
  if (date === undefined) {
    notFound();
  }

  const db = getDb();
  const days = await listArchivedDays(db, { from: date, to: date });
  if (days.length === 0) {
    const dateClass = await archiveDateClass(db, date);
    if (dateClass === "today") {
      redirect(routes.home);
    }
    notFound();
  }

  const group = groupArchivedDays(days)[0];
  return <ArchiveDayView date={date} games={group?.games ?? []} />;
}

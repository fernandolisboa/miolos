import { archiveDateClass, listArchivedDays } from "@miolos/db";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { groupArchivedDays } from "../../../src/archive/group-days";
import { parseArchiveDate } from "../../../src/archive/parse-params";
import { getDb } from "../../../src/db";
import {
  archiveDayCardRoute,
  archiveDayRoute,
  formatLongDate,
  messages,
  routes,
} from "../../../src/i18n";
import { ogCopy } from "../../../src/og/copy";
import { OG_DEFAULTS } from "../../../src/og/defaults";
import { cardImage } from "../../../src/og/images";
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
 *
 * **A WELL-FORMED date the wall refuses still gets a canonical and a title,
 * and that asymmetry is deliberate** (step-6 F23). Metadata and the page
 * resolve independently in the App Router, so a `notFound()` below cannot
 * un-compose a `<head>` this function has already produced: `/arquivo/1999-
 * 01-01` answers **404** with a self-referential canonical and a title
 * naming puzzles that do not exist. The blast radius is exactly one 404
 * response — the status is what crawlers act on, the URL is never in the
 * sitemap because the sitemap is built from the reader, and the alternative
 * (a second reader call inside `generateMetadata`) doubles the query count
 * on every archive page view to tidy the head of a page nobody indexes. The
 * malformed case is different and is handled: it yields `robots.index:
 * false` with **no** `alternates`, because there the segment is attacker
 * text and a canonical composed from it is the poisoning hazard.
 *
 * **The `openGraph` block below is what attaches the card for this page**
 * (#104, ADR-0071), and it has two rules it must not break. `OG_DEFAULTS`
 * MUST be spread: a leaf `openGraph` REPLACES the root layout declaration
 * rather than merging into it, so without the spread this route loses
 * `og:type`, `og:locale` and `og:site_name`. And `images` MUST be present:
 * `mergeStaticMetadata` re-adds a file-convention image only when the level
 * declares no `images` of its own, so an `openGraph` without one here would
 * delete the card silently. The card is a route handler at `/cartao/<data>`
 * rather than a metadata module in this segment, because a metadata module
 * would re-inflate the traced payload of this page from 2.7 MB to ~23 MB
 * (ADR-0054 decision 9). `twitter:image` needs nothing: it auto-fills from
 * `openGraph.images`, measured on a real build.
 *
 * The malformed branch above composes NO `openGraph`, and MEASURED on a real
 * production build that changes nothing about what such a segment advertises:
 * it answers 404 through `notFound()` below, and Next then renders the
 * not-found metadata rather than this function result — so the head carries
 * the ROOT card, the root title and no canonical, exactly as it did before
 * #104. Two facts behind that, both measured rather than reasoned. First, a
 * `notFound()` DISCARDS the route composed metadata in Next 16.2.12. Second,
 * an `opengraph-image` file is inherited by descendant segments only from a
 * segment that owns a `layout.tsx`, and `app/arquivo/` owns none — the only
 * layout in the app is the root — so `app/arquivo/opengraph-image.png` serves
 * `/arquivo` and nothing under it. Plan 068 claimed the opposite in three
 * places; the measurement is in the step-5 evidence and the records were
 * corrected against it.
 *
 * NOTE for whoever edits the prose from here down: `T-WEB-S173` slices this
 * file from the first occurrence of the word above to the first line that is
 * a bare closing brace, and rejects any quoted run of two characters or more
 * inside it — which a pair of apostrophes in ordinary English is. Write
 * around it; the scan is not the thing to weaken.
 */
export async function generateMetadata({
  params,
}: DayPageProps): Promise<Metadata> {
  const date = parseArchiveDate((await params).data);
  if (date === undefined) {
    return { robots: { index: false } };
  }
  const longDate = formatLongDate(date);
  const title = messages.archive.meta.dayTitle(longDate);
  const description = messages.archive.meta.dayDescription(longDate);
  return {
    title,
    description,
    alternates: { canonical: archiveDayRoute(date) },
    openGraph: {
      ...OG_DEFAULTS,
      title,
      description,
      images: [
        cardImage(archiveDayCardRoute(date), ogCopy.altArchiveDay(longDate)),
      ],
    },
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

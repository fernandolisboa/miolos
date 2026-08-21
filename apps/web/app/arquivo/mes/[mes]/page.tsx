import { listArchivedDays, listArchivedMonths } from "@miolos/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  monthDayBounds,
  parseArchiveMonth,
} from "../../../../src/archive/parse-params";
import { getDb } from "../../../../src/db";
import { archiveMonthRoute, formatMonth, messages } from "../../../../src/i18n";
import { ArchiveMonthView } from "../../month-view";

// ADR-0053 decision 2 — see `app/arquivo/page.tsx` for the kill-switch
// argument. No `revalidate`, no `generateStaticParams`, no `fetch`.
export const dynamic = "force-dynamic";

/**
 * Hand-written props, deliberately NOT Next's generated `PageProps`.
 * `PageProps` exists only inside `.next/types`, `turbo.json`'s `typecheck`
 * task has no dependency on `build`, and the repo's own gate order wipes
 * `.next` before typechecking — so a `PageProps` reference makes
 * `pnpm typecheck` fail with `TS2304` on a clean tree. Hand-written props
 * survive the wipe.
 */
interface MonthPageProps {
  readonly params: Promise<{ readonly mes: string }>;
}

/**
 * The SAME parser the page body calls (ADR-0053 decision 1 / plan 037 D6a).
 * In the App Router `generateMetadata` and the page resolve INDEPENDENTLY, so
 * a `notFound()` in the page does not stop this function from having already
 * composed a canonical out of the raw segment — and a segment beginning `//`
 * or `https://` resolves against `metadataBase` to an off-site absolute URL.
 * On failure: no `alternates` at all, and `index: false`.
 */
export async function generateMetadata({
  params,
}: MonthPageProps): Promise<Metadata> {
  const month = parseArchiveMonth((await params).mes);
  if (month === undefined) {
    return { robots: { index: false } };
  }
  const name = formatMonth(`${month}-01`);
  return {
    title: messages.archive.meta.monthTitle(name),
    description: messages.archive.meta.monthDescription(name),
    alternates: { canonical: archiveMonthRoute(month) },
  };
}

export default async function ArchiveMonthPage({ params }: MonthPageProps) {
  const month = parseArchiveMonth((await params).mes);
  if (month === undefined) {
    notFound();
  }

  const db = getDb();
  const bounds = monthDayBounds(month);
  const [days, months] = await Promise.all([
    listArchivedDays(db, bounds),
    listArchivedMonths(db),
  ]);

  // A month with no archived day is a real 404 — there is no such resource,
  // and rendering an empty month would advertise one.
  if (days.length === 0) {
    notFound();
  }

  // `months` is newest-first, so the NEXT month is the neighbour before this
  // one in the list and the PREVIOUS is the one after it. Each is absent when
  // there is no such month, which is what makes the pair honest at both ends
  // of the archive.
  const index = months.indexOf(month);
  return (
    <ArchiveMonthView
      month={month}
      // The reader answers `(date, game)` pairs; the calendar wants days,
      // so the dates are deduplicated here — a Set keyed by the reader's
      // own strings, no re-derivation of what exists.
      dates={[...new Set(days.map((day) => day.date))]}
      previous={index === -1 ? undefined : months[index + 1]}
      next={index <= 0 ? undefined : months[index - 1]}
    />
  );
}

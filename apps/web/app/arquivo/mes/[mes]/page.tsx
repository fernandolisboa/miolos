import { listArchivedDays, listArchivedMonths } from "@miolos/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { archivedDates } from "../../../../src/archive/calendar";
import {
  monthDayBounds,
  parseArchiveMonth,
} from "../../../../src/archive/parse-params";
import { getDb } from "../../../../src/db";
import {
  archiveMonthCardRoute,
  archiveMonthRoute,
  formatMonth,
  messages,
} from "../../../../src/i18n";
import { ogCopy } from "../../../../src/og/copy";
import { OG_DEFAULTS } from "../../../../src/og/defaults";
import { cardImage } from "../../../../src/og/images";
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
 * On failure: no `alternates` at all, and `index: false` — because a segment
 * beginning `//` or `https://` resolves against `metadataBase` to an off-site
 * absolute URL, and a canonical composed from attacker text must not exist
 * even in a value nothing reads.
 *
 * **It is that last clause that carries the rule, not a race.** The comment
 * here used to say that `generateMetadata` and the page resolve
 * INDEPENDENTLY, so a `notFound()` in the page cannot stop this function from
 * having already composed a canonical. That is not what Next 16.2.12 does:
 * `collectMetadata` reads the LAYOUT's metadata export, never the page's,
 * whenever an error convention is in play, so the page's result is discarded
 * rather than raced. The refusal above is still right — it is right because
 * this function should not build a URL out of hostile input at all, which is
 * a rule about this code and not about the framework's timing. See
 * `app/arquivo/[data]/page.tsx` for the source citation.
 *
 * The `openGraph` block mirrors the day page, with the month builders — see
 * `app/arquivo/[data]/page.tsx` for why `OG_DEFAULTS` must be spread and why
 * `images` must be present.
 */
export async function generateMetadata({
  params,
}: MonthPageProps): Promise<Metadata> {
  const month = parseArchiveMonth((await params).mes);
  if (month === undefined) {
    return { robots: { index: false } };
  }
  const name = formatMonth(`${month}-01`);
  const title = messages.archive.meta.monthTitle(name);
  const description = messages.archive.meta.monthDescription(name);
  return {
    title,
    description,
    alternates: { canonical: archiveMonthRoute(month) },
    openGraph: {
      ...OG_DEFAULTS,
      title,
      description,
      images: [
        cardImage({
          url: archiveMonthCardRoute(month),
          alt: ogCopy.altArchiveMonth(name),
        }),
      ],
    },
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
      // The reader answers `(date, game)` pairs; the calendar wants days.
      // ONE spelling of that dedup, shared with the index (step-6 quality
      // N4): a Set keyed by the reader's own strings, and it reaches the
      // grid as a Set, with no array round trip on the way (correctness
      // N5, performance 3).
      dates={archivedDates(days)}
      previous={index === -1 ? undefined : months[index + 1]}
      next={index <= 0 ? undefined : months[index - 1]}
    />
  );
}

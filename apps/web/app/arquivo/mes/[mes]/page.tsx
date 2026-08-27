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

export const dynamic = "force-dynamic";

interface MonthPageProps {
  readonly params: Promise<{ readonly mes: string }>;
}

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

  if (days.length === 0) {
    notFound();
  }

  const index = months.indexOf(month);
  return (
    <ArchiveMonthView
      month={month}

      dates={archivedDates(days)}
      previous={index === -1 ? undefined : months[index + 1]}
      next={index <= 0 ? undefined : months[index - 1]}
    />
  );
}

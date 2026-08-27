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

export const dynamic = "force-dynamic";

interface DayPageProps {
  readonly params: Promise<{ readonly data: string }>;
}

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
        cardImage({
          url: archiveDayCardRoute(date),
          alt: ogCopy.altArchiveDay(longDate),
        }),
      ],
    },
  };
}

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

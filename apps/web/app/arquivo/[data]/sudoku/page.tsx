import { archiveDateClass, getArchivedDaily } from "@miolos/db";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { parseArchiveDate } from "../../../../src/archive/parse-params";
import { ArchiveSudokuScreen } from "../../../../src/archive/sudoku-screen";
import { getDb } from "../../../../src/db";
import {
  archiveGameRoute,
  formatLongDate,
  messages,
  routes,
} from "../../../../src/i18n";
import { OG_DEFAULTS } from "../../../../src/og/defaults";

export const dynamic = "force-dynamic";

interface PlayPageProps {
  readonly params: Promise<{ readonly data: string }>;
}

export async function generateMetadata({
  params,
}: PlayPageProps): Promise<Metadata> {
  const date = parseArchiveDate((await params).data);
  if (date === undefined) {
    return { robots: { index: false } };
  }
  const longDate = formatLongDate(date);
  const title = messages.archive.meta.gameTitle(
    messages.games.sudoku.name,
    longDate,
  );
  const description = messages.archive.meta.gameDescription(
    messages.games.sudoku.name,
    longDate,
  );
  return {
    title,
    description,
    alternates: { canonical: archiveGameRoute(date, "sudoku") },
    openGraph: { ...OG_DEFAULTS, title, description },
  };
}

export default async function ArchiveSudokuPage({ params }: PlayPageProps) {
  const date = parseArchiveDate((await params).data);
  if (date === undefined) {
    notFound();
  }

  const db = getDb();
  const daily = await getArchivedDaily(db, "sudoku", date);
  if (daily === undefined) {
    const dateClass = await archiveDateClass(db, date);
    if (dateClass === "today") {
      redirect(routes.sudoku);
    }
    notFound();
  }

  return <ArchiveSudokuScreen daily={daily} />;
}

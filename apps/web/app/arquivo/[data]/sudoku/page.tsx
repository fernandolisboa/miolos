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

// ADR-0053 decision 2 — see `app/arquivo/page.tsx` for the kill-switch
// argument. No `revalidate`, no `generateStaticParams`, no `fetch`.
export const dynamic = "force-dynamic";

/** Hand-written props — see `app/arquivo/mes/[mes]/page.tsx` for why. */
interface PlayPageProps {
  readonly params: Promise<{ readonly data: string }>;
}

/** The SAME parser the page body calls (plan 037 D6a). */
export async function generateMetadata({
  params,
}: PlayPageProps): Promise<Metadata> {
  const date = parseArchiveDate((await params).data);
  if (date === undefined) {
    return { robots: { index: false } };
  }
  const longDate = formatLongDate(date);
  return {
    title: messages.archive.meta.gameTitle(
      messages.games.sudoku.name,
      longDate,
    ),
    description: messages.archive.meta.gameDescription(
      messages.games.sudoku.name,
      longDate,
    ),
    alternates: { canonical: archiveGameRoute(date, "sudoku") },
  };
}

/**
 * The archived Sudoku for one past day (#31 AC 1).
 *
 * **Read first, classify only on empty** (ADR-0053 decision 1): a row in hand
 * IS the proof that the date is past, so the archived path costs exactly one
 * round trip and never consults the classifier. Today's date redirects to the
 * daily route — TEMPORARILY, because the rule's truth value changes at
 * midnight and a permanent redirect is cacheable against the URL forever.
 *
 * A literal game segment rather than a `[jogo]` one, exactly as the daily and
 * free-play routes do it: the route boundary is what carries the per-game
 * code-splitting, and the 404 for a fifth game is by absence.
 *
 * Thin on purpose: a reader call and a branch. All composition lives in the
 * client screen, which tests render directly.
 */
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

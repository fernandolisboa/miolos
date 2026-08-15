import { archiveDateClass, getArchivedDaily } from "@miolos/db";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { parseArchiveDate } from "../../../../src/archive/parse-params";
import { ArchiveTermoScreen } from "../../../../src/archive/termo-screen";
import { getDb } from "../../../../src/db";
import {
  archiveGameRoute,
  formatLongDate,
  messages,
  routes,
} from "../../../../src/i18n";
import { OG_DEFAULTS } from "../../../../src/og/defaults";

// ADR-0053 decision 2 — see `app/arquivo/page.tsx` for the kill-switch
// argument. No `revalidate`, no `generateStaticParams`, no `fetch`.
export const dynamic = "force-dynamic";

/** Hand-written props — see `app/arquivo/mes/[mes]/page.tsx` for why. */
interface PlayPageProps {
  readonly params: Promise<{ readonly data: string }>;
}

/**
 * The SAME parser the page body calls (plan 037 D6a).
 *
 * The share card reuses the page's own two strings verbatim (#34 AC 4,
 * ADR-0054 decision 10), so the archive half of the OG surface adds no copy
 * at all — and the spread is what keeps the three root-level members, because
 * a leaf `openGraph` replaces the root's rather than merging into it
 * (`src/og/defaults.ts`). The canonical is unchanged.
 */
export async function generateMetadata({
  params,
}: PlayPageProps): Promise<Metadata> {
  const date = parseArchiveDate((await params).data);
  if (date === undefined) {
    return { robots: { index: false } };
  }
  const longDate = formatLongDate(date);
  const title = messages.archive.meta.gameTitle(
    messages.games.termo.name,
    longDate,
  );
  const description = messages.archive.meta.gameDescription(
    messages.games.termo.name,
    longDate,
  );
  return {
    title,
    description,
    alternates: { canonical: archiveGameRoute(date, "termo") },
    openGraph: { ...OG_DEFAULTS, title, description },
  };
}

/**
 * The archived Termo for one past day (#31 AC 1).
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
export default async function ArchiveTermoPage({ params }: PlayPageProps) {
  const date = parseArchiveDate((await params).data);
  if (date === undefined) {
    notFound();
  }

  const db = getDb();
  const daily = await getArchivedDaily(db, "termo", date);
  if (daily === undefined) {
    const dateClass = await archiveDateClass(db, date);
    if (dateClass === "today") {
      redirect(routes.termo);
    }
    notFound();
  }

  return <ArchiveTermoScreen daily={daily} />;
}

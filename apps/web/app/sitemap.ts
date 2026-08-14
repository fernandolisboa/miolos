import { listArchivedDays } from "@miolos/db";
import type { MetadataRoute } from "next";

import { groupArchivedDays } from "../src/archive/group-days";
import { monthOf } from "../src/archive/parse-params";
import { getDb } from "../src/db";
import {
  archiveDayRoute,
  archiveGameRoute,
  archiveMonthRoute,
  routes,
} from "../src/i18n";
import { absoluteUrl } from "../src/site-origin";

// Request-time, never build-time (ADR-0053 decision 2). A build-time sitemap
// would be a snapshot of the archive at deploy, and it would keep advertising
// a killed day for the whole TTL — the same kill-switch argument the archive
// pages carry. ADR-0028 decision 6 is untouched: a request-time `sitemap.ts`
// is not a build-time params array, and `generateStaticParams` appears
// nowhere in this diff.
export const dynamic = "force-dynamic";

/**
 * The sitemap (#31 AC 1, ADR-0005 `:13` — the archive is an organic-search
 * asset).
 *
 * **ADR-0004 compliance here is STRUCTURAL, not procedural.** The only source
 * of a date-bearing URL is `listArchivedDays()`, which carries the
 * publication wall AND `date < the DB clock's São Paulo day` in SQL. A
 * future-dated URL is not filtered out of this list — it is never produced.
 *
 * **Excluded, each for its own reason:** `/vincular` (already `noindex`, and
 * `robots.ts` disallows it), `/estatisticas` (personal, and its aggregates
 * arrive client-side behind a session), and the four daily play routes with
 * their `concluido` siblings — ADR-0028 `:28-30` states outright that they
 * are not an SEO surface. Absence from a sitemap is NOT `noindex`, and
 * `robots.ts` says what the crawl posture actually is.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const days = await listArchivedDays(getDb());
  // `monthOf`, never a second `slice(0, 7)`: its own doc block declares
  // itself the one place a month is sliced out of a date, and two other
  // modules already import it (step-6 F22).
  const months = [...new Set(days.map((day) => monthOf(day.date)))];

  // Next requires ABSOLUTE urls in a sitemap entry and does not resolve one
  // against `metadataBase`, so every path goes through the app's one origin
  // (`src/site-origin.ts`) — never a literal apex (ADR-0013 :36).
  const paths = [
    routes.home,
    routes.freePlay,
    routes.freePlayBinairo,
    routes.freePlaySudoku,
    routes.freePlayNonogram,
    routes.privacy,
    routes.archive,
    ...months.map((month) => archiveMonthRoute(month)),
    ...groupArchivedDays(days).flatMap((group) => [
      archiveDayRoute(group.date),
      ...group.games.map((game) => archiveGameRoute(group.date, game)),
    ]),
  ];
  return paths.map((path) => ({ url: absoluteUrl(path) }));
}

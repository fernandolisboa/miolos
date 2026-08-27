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

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const days = await listArchivedDays(getDb());

  const months = [...new Set(days.map((day) => monthOf(day.date)))];

  const paths = [
    routes.home,
    routes.freePlay,
    routes.freePlayBinairo,
    routes.freePlaySudoku,
    routes.freePlayNonogram,
    routes.privacy,
    routes.terms,
    routes.archive,
    ...months.map((month) => archiveMonthRoute(month)),
    ...groupArchivedDays(days).flatMap((group) => [
      archiveDayRoute(group.date),
      ...group.games.map((game) => archiveGameRoute(group.date, game)),
    ]),
  ];
  return paths.map((path) => ({ url: absoluteUrl(path) }));
}

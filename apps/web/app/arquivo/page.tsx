import { listArchivedDays, listArchivedMonths } from "@miolos/db";
import type { Metadata } from "next";

import {
  newestMonthCalendar,
  NEWEST_MONTH_ROW_WINDOW,
} from "../../src/archive/calendar";
import { getDb } from "../../src/db";
import { messages, routes } from "../../src/i18n";
import { ArchiveIndexView } from "./index-view";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  return {
    title: messages.archive.meta.indexTitle,
    description: messages.archive.meta.indexDescription,
    alternates: { canonical: routes.archive },
  };
}

export default async function ArchivePage() {
  const db = getDb();
  const [days, months] = await Promise.all([
    listArchivedDays(db, { limit: NEWEST_MONTH_ROW_WINDOW }),
    listArchivedMonths(db),
  ]);

  return (
    <ArchiveIndexView calendar={newestMonthCalendar(days)} months={months} />
  );
}

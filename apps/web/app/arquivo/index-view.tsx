import type { ArchiveIndexCalendar } from "../../src/archive/calendar";
import { messages } from "../../src/i18n";
import { PageTopBar } from "../../src/components/page-top-bar";
import styles from "./arquivo.module.css";
import { ArchiveBody } from "./archive-body";

export function ArchiveIndexView({
  calendar,
  months,
}: {
  readonly calendar: ArchiveIndexCalendar | undefined;
  readonly months: readonly string[];
}) {
  const copy = messages.archive;

  return (
    <main className={styles.page} data-page="arquivo">
      <PageTopBar kicker={copy.title} />

      {calendar === undefined ? (
        <>
          <div className={styles.titleBlock}>
            <h1 className={styles.title}>{copy.title}</h1>
          </div>
          <p className={styles.empty}>{copy.empty}</p>
        </>
      ) : (
        <ArchiveBody
          month={calendar.month}
          dates={calendar.dates}
          months={months}
        />
      )}
    </main>
  );
}

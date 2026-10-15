import { messages, routes } from "../../src/i18n";
import { PageTopBar } from "../../src/components/page-top-bar";
import styles from "./arquivo.module.css";
import { ArchiveBody } from "./archive-body";

export function ArchiveMonthView({
  month,
  dates,
  months,
}: {
  readonly month: string;
  readonly dates: ReadonlySet<string>;
  readonly months: readonly string[];
}) {
  const copy = messages.archive;

  return (
    <main className={styles.page} data-page="arquivo-mes">
      <PageTopBar
        back={{
          href: routes.archive,
          label: copy.backToIndex,
          ariaLabel: copy.backToIndexAria,
        }}
        kicker={copy.title}
      />

      <ArchiveBody month={month} dates={dates} months={months} />
    </main>
  );
}

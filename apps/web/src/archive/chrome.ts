import { archiveDayRoute, formatLongDate, messages } from "../i18n";
import type { ArchivePlayChrome } from "../play/types";
import styles from "./play-note.module.css";

export function archiveChrome(date: string): ArchivePlayChrome {
  const longDate = formatLongDate(date);
  return {
    back: {
      href: archiveDayRoute(date),
      label: messages.archive.backToDay(longDate),
      ariaLabel: messages.archive.backToDayAria(longDate),
    },
    note: {
      text: messages.archive.play.note,
      className: styles.note ?? "",
    },
  };
}

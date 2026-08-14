import { archiveDayRoute, formatLongDate, messages } from "../i18n";
import type { ArchivePlayChrome } from "../play/types";
import styles from "./play-note.module.css";

/**
 * The archive's play chrome for one archived date — one spelling, four
 * shells. The destination is the DAY page and never Hoje: the repo already
 * wrote down why a shared `"← Hoje"` would lie about the destination when
 * free play hit the same problem (`messages.ts`'s `freePlay.back` comment),
 * and the archive's own one-level-up destination is its day page.
 *
 * The `ArchivePlayChrome` type itself lives in `src/play/types.ts` — four
 * DAILY views consume it, and a daily module importing a type out of
 * `src/archive/` is the dependency arrow backwards (step-6 F22). What lives
 * here is the archive's own: the strings, and the class from the archive's
 * own note stylesheet.
 */
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

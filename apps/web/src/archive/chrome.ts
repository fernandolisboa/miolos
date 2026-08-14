import { archiveDayRoute, formatLongDate, messages } from "../i18n";

/**
 * The ONE optional prop the four shared per-game `PlayView`/`PlaySkeleton`
 * components gain for the archive (#31, ADR-0053 decision 9). Absent — every
 * daily route — the render is byte-identical to what shipped, and T-WEB-S185
 * pins that in both directions.
 *
 * **The prop budget is closed at one optional member per view**, stated here
 * the way ADR-0043 consequence (a) closes `ConclusionView`'s at two.
 *
 * **There is no mode chip, and its absence is a decision.** A sixth child of
 * `screen.topBar` would need a new class in `apps/web/src/play/screen.module.
 * css`, and #31 edits exactly one file under `src/play/`. It would also be
 * redundant: three things already say "you are in the archive" — the back
 * link reads `← <the day>` and leaves for the day page, the top bar renders
 * the archived long date, and the note states the semantics in a full
 * sentence, which is the one thing a chip saying "Arquivo" could never say.
 */
export interface ArchivePlayChrome {
  readonly back: {
    readonly href: string;
    readonly label: string;
    readonly ariaLabel: string;
  };
  readonly note: string;
}

/**
 * The archive's play chrome for one archived date — one spelling, four
 * shells. The destination is the DAY page and never Hoje: the repo already
 * wrote down why a shared `"← Hoje"` would lie about the destination when
 * free play hit the same problem (`messages.ts`'s `freePlay.back` comment),
 * and the archive's own one-level-up destination is its day page.
 */
export function archiveChrome(date: string): ArchivePlayChrome {
  const longDate = formatLongDate(date);
  return {
    back: {
      href: archiveDayRoute(date),
      label: messages.archive.backToDay(longDate),
      ariaLabel: messages.archive.backToDayAria(longDate),
    },
    note: messages.archive.play.note,
  };
}

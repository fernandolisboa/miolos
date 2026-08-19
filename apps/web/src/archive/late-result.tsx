"use client";

import type { Game } from "@miolos/core";
import Link from "next/link";

import {
  archiveDayRoute,
  archiveMonthRoute,
  formatDayNumber,
  formatLongDate,
  formatMonth,
  messages,
} from "../i18n";
import { accentVars } from "../play/accent";
import { ShareButton } from "../play/share-button";
import {
  useRecordSnapshot,
  type RecordSnapshot,
} from "../play/use-record-snapshot";
import styles from "./late-result.module.css";
import { monthOf } from "./parse-params";

/**
 * The panel's one sentence, chosen from the states the DEVICE can actually
 * distinguish (#31 step-6 findings F3/F5/F16). Four record states plus the
 * pre-hydration/no-store case, in refusal order:
 *
 * 1. **not read yet, or no record at all.** On a concluded panel the second
 *    means `localStorage` is unusable and the completion lives only in
 *    `sync.ts`'s `memoryQueue` — the panel can see neither a success nor a
 *    failure, so it claims neither. The old three-arm branch fell through to
 *    "registrada" here, which was a claim about a record it could not read.
 * 2. **`pendingSync`** — queued, not yet acknowledged.
 * 3. **`syncOutcome: "rejected"`** — the server REFUSED it (`sync.ts`'s
 *    `TERMINAL_STATUSES`; the 404 arm is the kill switch). This arm did not
 *    exist and its absence was the sharp end of the finding: an operator
 *    withdrew the puzzle mid-board and the panel said it was registered.
 * 4. **`alreadyConcluded`** — this device held a concluded record for the day
 *    before the page mounted, so nothing was registered on this visit.
 * 5. **settled `recorded`** — the row is on the server. It says exactly that
 *    and not when it was written, because the same 200 covers a fresh late
 *    write and the idempotent short-circuit over a row that was already there.
 *
 * `rejected` is refused BEFORE `alreadyConcluded` on purpose: a device that
 * held a concluded record whose last sync was refused has a server holding
 * nothing, and "the server refused it" is the sharper true statement.
 */
function note(snapshot: RecordSnapshot, alreadyConcluded: boolean): string {
  const copy = messages.archive.result;
  if (!snapshot.hydrated || snapshot.record === undefined) {
    return copy.notStored;
  }
  if (snapshot.record.pendingSync) {
    return copy.pending;
  }
  if (snapshot.record.syncOutcome === "rejected") {
    return copy.rejected;
  }
  return alreadyConcluded ? copy.already : copy.late;
}

/**
 * The archive's late result, rendered IN PLACE on the archive play URL
 * (#31, ADR-0053 decision 9). There is no `/arquivo/<data>/<jogo>/concluido`
 * and the archive never renders `ConclusionView`.
 *
 * `ConclusionView` is a today-machine and could not be reused: its streak
 * card is a bare streak read whose copy reads *"— mantida por hoje"*, its
 * next-puzzle affordance chains to TODAY's routes, and its day chips would
 * read as four unplayed dailies for an archived date. Fixing that needs
 * either a third optional prop — ADR-0043 consequence (a) closes that budget
 * at two — or date gates inside a component this ticket does not touch.
 *
 * **What is deliberately absent:** no time, no streak, no day chips, no
 * chaining CTA, no statistics, and no link to today's dailies. The archive's
 * job is to keep you in the archive, and the hub is one back-link away
 * through the chrome anyway. **#103 ADDED A SHARE BUTTON AND REOPENED NONE OF
 * THEM** — `ShareButton` takes `game`, `date` and the record this panel
 * already subscribes to, so the panel gained no prop, and in particular it
 * still holds no `ConclusionResult` and therefore no elapsed time. The one
 * consequence is recorded where it bites, in `shareSubject`'s doc block: with
 * no `stamp` to fall back on, a store-less browser gets no button on any of
 * the four games rather than on Termo alone. Narrower in what it SHARES —
 * and, on the one axis where it is wider, `ShareButton`'s doc block says so
 * rather than letting "narrower, never wider" cover both (#103 step-6 m3).
 */
export function LateResult({
  game,
  date,
  outcome,
  alreadyConcluded,
}: {
  readonly game: Game;
  readonly date: string;
  /**
   * THIS SESSION'S board, judged locally — never the server's stored row
   * (#31 step-6 finding F5). `sync.ts`'s `acceptResponse` parses and discards
   * `completionResponseSchema.outcome` exactly as it discards `onTime`, so no
   * server outcome is available to any client surface without a versioned
   * change to the local record schema. The reachable divergence is Termo's:
   * win an archived day on device A, lose it on device B, and the completion
   * POST short-circuits to the stored `won` row while this panel prints the
   * loss the player just played. ADR-0053 decision 10 layer 3 used to claim
   * the opposite and now says this; plan 037 §14 I42 registers the deviation.
   */
  readonly outcome: "won" | "lost";
  /**
   * This device already held a concluded record for `(game, date)` when the
   * archive page mounted, so the result on screen is one the player had
   * before — never a late completion this visit produced. The panel says so
   * rather than claiming a conclusion that did not happen.
   */
  readonly alreadyConcluded: boolean;
}) {
  const copy = messages.archive;
  // The sync state, LIVE (ADR-0053 decision 13). `sync.ts` settles the
  // record from outside React, so this subscribes to the record store rather
  // than copying it once — the same reader the conclusions use, which is the
  // one place a settled sync reaches a view without a notifier `sync.ts` does
  // not have. Its cache is a `Map` keyed `(game, date)`, swept by staleness, so a second
  // reader of another key on the same page reads its own entry instead of
  // evicting this one (#96, ADR-0056 decision 1).
  const snapshot = useRecordSnapshot(game, date);
  const record = snapshot.hydrated ? snapshot.record : undefined;
  // Present IFF the record is a CONCLUDED termo (the schema's own
  // `superRefine` makes that lockstep a parse-time invariant), so no branch
  // here can print a word for a board still in play.
  const answer = record?.game === "termo" ? record.answer : undefined;
  // WHAT THIS DEVICE MAY HONESTLY SHARE (#103, ADR-0054 decision 3).
  //
  // The `concluded === true` gate is the daily's own — `ConclusionView`'s
  // `stored`, cited by SYMBOL because line numbers in that file have already
  // moved once in this very commit — and it is LOAD-BEARING RATHER THAN
  // DEFENSIVE. The window is real and was traced rather than assumed at
  // #103's step-6 correctness review: `use-play-lifecycle.ts` persists an
  // IN-PROGRESS record on every entry change, and the archive screens swap
  // this panel in from REDUCER state during render while the closing write is
  // an effect — so on `LateResult`'s first commit the stored record for this
  // key exists and is NOT concluded. Without the gate `shareSubject` hands it
  // straight to `buildShareText`, which reads `subject.outcome`; the termo
  // record's `superRefine` writes `outcome` and `answer` exactly when
  // `concluded` flips, so an unconcluded Termo has none and the composer
  // falls into the `termoLost` arm. **A player who had just WON would share a
  // loss.** `T-WEB-S231`'s fourth `it` is the mutation test that keeps this
  // line honest: deleting the gate turns it red.
  const stored = record?.concluded === true ? record : undefined;
  const longDate = formatLongDate(date);
  const month = monthOf(date);
  const monthName = formatMonth(`${month}-01`);

  return (
    <main
      className={styles.panel}
      style={accentVars(game)}
      data-play-state="concluded"
    >
      {/* The outcome, in words, in `--ink`, at display scale — and FIRST in
          the panel, which is what keeps impeccable's `kicker-above-heading`
          and `hero-eyebrow-chip` down without a structural wrapper (both
          anchor on h1–h4 and read `previousElementSibling`). It shipped as a
          24px span inside the stamp, which left the sheet at a 1.7:1 type
          spread and `flat-type-hierarchy` red at both viewports (step-6
          F7). */}
      <h1 className={styles.title}>
        {outcome === "won" ? copy.result.wonTitle : copy.result.lostTitle}
      </h1>

      {/* The postmark. Decoration that restates the date the two links below
          already name, so it announces nothing — `aria-hidden` on the whole
          mark rather than a composed label duplicating them. The accent is
          on the RING only, and ADR-0041 decision 5's decorative exemption
          applies precisely because the outcome is carried in ink above it. */}
      <div aria-hidden className={styles.stamp}>
        <span className={styles.stampLabel}>{copy.result.stampLabel}</span>
        <span className={styles.stampDay}>{formatDayNumber(date)}</span>
        <span className={styles.stampMonth}>{monthName}</span>
      </div>

      <p className={styles.note}>{note(snapshot, alreadyConcluded)}</p>

      {/* The archived Termo's word, on BOTH outcomes (step-6 F23). It comes
          off the local record, which already holds `answer` on the closing
          write, so this costs no request and no server-side computation —
          and it must stay that way: a server-computed word on an archive
          route would be a spoiler channel for anyone who has not played that
          day (ADR-0004, ADR-0043 decision 7).

          `.word` MAY NEVER BECOME A HEADING and may never take
          `role="heading"`, exactly as the daily's own `.dayWord` may not: an
          11px tracked-uppercase line immediately above a large word is
          textbook `kicker-above-heading` shape, and the pair is legal ONLY
          because that rule and `hero-eyebrow-chip` anchor exclusively on
          `h1`–`h4` and `[role="heading"]`. */}
      {answer === undefined ? null : (
        <div className={styles.wordRow}>
          <p className={styles.wordLead}>{copy.result.wordLead}</p>
          <p className={styles.word}>{answer}</p>
        </div>
      )}

      {/* THE SHARE (#103, ADR-0054's own Rejected entry, taken up). It is
          the SAME component the four daily conclusions render, and that is
          the whole decision this ticket owns: a late share says exactly what
          an on-time share says. `buildShareText` reads the record and the
          record alone, so the panel's five-state honesty machinery above —
          queued, refused, already held here, settled, not stored — reaches
          the NOTE and never the text on the clipboard. It could not reach
          it: none of those states is on the record's shared fields, and
          `onTime` is parsed and discarded by `sync.ts`, so no client surface
          in this app can claim WHEN a day was solved (ADR-0054 decision 3).
          The date in the header is the PUZZLE's date, handed down by the
          page shell — decision 3's own "the date is in; the word is out".

          `stamp` is `undefined` and stays that way: see the component's doc
          block and this file's absences above. */}
      <ShareButton game={game} date={date} stored={stored} stamp={undefined} />

      <nav className={styles.links}>
        <Link
          className={styles.link}
          href={archiveDayRoute(date)}
          prefetch={false}
          aria-label={copy.backToDayAria(longDate)}
        >
          {copy.backToDay(longDate)}
        </Link>
        <Link
          className={styles.link}
          href={archiveMonthRoute(month)}
          prefetch={false}
          aria-label={copy.backToMonthAria(monthName)}
        >
          {copy.backToMonth(monthName)}
        </Link>
      </nav>
    </main>
  );
}

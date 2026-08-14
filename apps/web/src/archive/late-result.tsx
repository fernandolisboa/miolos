"use client";

import type { Game } from "@miolos/core";
import Link from "next/link";

import {
  archiveDayRoute,
  archiveMonthRoute,
  formatLongDate,
  formatMonth,
  messages,
} from "../i18n";
import { accentVars } from "../play/accent";
import { useRecordSnapshot } from "../play/use-record-snapshot";
import styles from "./late-result.module.css";
import { monthOf } from "./parse-params";

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
 * through the chrome anyway.
 */
export function LateResult({
  game,
  date,
  outcome,
  alreadyConcluded,
}: {
  readonly game: Game;
  readonly date: string;
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
  // The pending state, LIVE (ADR-0053 decision 13). `sync.ts` settles the
  // record from outside React, so this subscribes to the record store rather
  // than copying it once — the same reader the conclusions use, which is the
  // one place a settled sync reaches a view without a notifier `sync.ts` does
  // not have. Two archive dates cannot coexist (one page renders at a time),
  // so its single-slot cache is a miss at worst and never a wrong answer.
  const snapshot = useRecordSnapshot(game, date);
  const pending = snapshot.hydrated && snapshot.record?.pendingSync === true;
  const longDate = formatLongDate(date);
  const month = monthOf(date);
  const monthName = formatMonth(`${month}-01`);

  return (
    <main
      className={styles.panel}
      style={accentVars(game)}
      data-play-state="concluded"
    >
      {/* The outcome, in words, in `--ink`. The accent is on the RING only
          (ADR-0041 decision 5's decorative exemption applies precisely
          because the outcome is already carried in ink beside it). */}
      <p className={styles.stamp}>
        <span className={styles.stampLabel}>
          {outcome === "won" ? copy.result.wonTitle : copy.result.lostTitle}
        </span>
      </p>

      <p className={styles.note}>
        {pending
          ? copy.result.pending
          : alreadyConcluded
            ? copy.result.already
            : copy.result.late}
      </p>

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

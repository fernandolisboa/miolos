"use client";

/**
 * One archived day card, and the only client component the archive ships
 * (#96, ADR-0056).
 *
 * WHY THE BOUNDARY IS THE WHOLE CARD AND NOT THE CHIP. An anchor's
 * `aria-label` REPLACES its content as the accessible name, so an
 * `aria-hidden` chip announces nothing and a non-hidden one is swallowed. A
 * chip island inside a server-rendered `<Link>` would therefore leave the done
 * state invisible to every screen-reader user, because the only channel that
 * can carry it is the label — which lives on the anchor. Label and chip have
 * to move together, so the component that owns one owns both. That is the
 * hub's shape exactly (`app/hub-day-state.tsx`).
 *
 * IT LIVES BESIDE `page.tsx` RATHER THAN UNDER `src/` for the mechanical
 * reason `hub-day-state.tsx:9-13` gives: CSS Modules hash class names per
 * file, so a component painting with `arquivo.module.css` must import that
 * exact module, and `day-view.tsx` cannot carry `"use client"`.
 *
 * EVERY PROP IS PLAIN DATA. The three accessible names and the two chip words
 * are composed WHOLE on the server (ADR-0018) and cross as finished strings;
 * no composer and no function ever crosses, which is why this module imports
 * nothing from `src/i18n` — the barrel re-exports `messages`, and pulling it
 * onto the client graph would put the whole copy module on this route. The
 * guard on that is the props interface below plus `pnpm typecheck`, and NOT
 * `T-WEB-S56`: its walker recurses into the returned element's props, and the
 * page returns `<ArchiveDayView>` unrendered, so these props never exist
 * during that assertion (measured).
 *
 * WHAT IT RENDERS IS DEVICE STATE (ADR-0031). Absence reads pending — the
 * cold-profile answer, what a second device sees, and what a device sees once
 * `prunePlayRecords` has dropped the record. Hydration only ever ADDS the
 * chip; the one path that removes it is a cross-tab prune, accepted without a
 * latch (ADR-0056 consequence (b)).
 */
import type { Game } from "@miolos/core";
import Link from "next/link";

import { archiveCardStatus } from "../../src/archive/card-status";
import { accentVars } from "../../src/play/accent";
import { useRecordSnapshot } from "../../src/play/use-record-snapshot";
import styles from "./arquivo.module.css";

interface ArchiveDayCardProps {
  readonly game: Game;
  readonly date: string;
  readonly index: number;
  readonly name: string;
  readonly kicker: string;
  readonly href: string;
  readonly cardAria: string;
  readonly cardAriaDone: string;
  readonly cardAriaPlayed: string;
  readonly done: string;
  readonly played: string;
}

export function ArchiveDayCard({
  game,
  date,
  index,
  name,
  kicker,
  href,
  cardAria,
  cardAriaDone,
  cardAriaPlayed,
  done,
  played,
}: ArchiveDayCardProps) {
  const snapshot = useRecordSnapshot(game, date);
  // Before hydration the snapshot says "not read yet", so the server markup
  // and the first client paint agree on the pending card and neither can
  // flash a chip.
  const status = snapshot.hydrated
    ? archiveCardStatus(snapshot.record)
    : "pending";

  const chip =
    status === "completed" ? done : status === "played" ? played : undefined;
  const label =
    status === "completed"
      ? cardAriaDone
      : status === "played"
        ? cardAriaPlayed
        : cardAria;

  return (
    <Link
      className={`${styles.card} ${
        index % 2 === 0 ? styles.cardOdd : styles.cardEven
      }`}
      style={accentVars(game)}
      href={href}
      prefetch={false}
      aria-label={label}
    >
      {/* Decoration with nothing to announce. */}
      <span aria-hidden className={styles.tape} />
      <div className={styles.cardTop}>
        <p className={styles.cardKicker}>{kicker}</p>
        {chip !== undefined && (
          // `aria-hidden` because the anchor's label already carries the
          // state, and a chip that were not hidden would be discarded by that
          // label anyway. The two are written together for that reason.
          <span aria-hidden className={styles.doneChip}>
            {chip}
          </span>
        )}
      </div>
      <p className={styles.cardTitle}>{name}</p>
    </Link>
  );
}

"use client";

/**
 * The two live fragments of the Hoje hub (plan 018 §11.3): the "X de 4" meta
 * line and each card's action area. Everything else on the hub is static
 * server markup, so these are the only two components that subscribe to
 * anything.
 *
 * They live beside `page.tsx` rather than under `src/` for one mechanical
 * reason: CSS Modules hash class names per file, so a component that paints
 * with `page.module.css` has to import that exact module, and the page itself
 * cannot carry `"use client"` — it is the server component that resolves the
 * day (`date` below is the SERVER's São Paulo day, never the browser's clock).
 *
 * What they render is DEVICE state, not user state (ADR-0031): a local
 * concluded record proves this device solved that game today; absence proves
 * nothing and renders pending. That is also the cold-profile answer, also
 * what `impeccable detect` always scans, and also what a second device sees.
 * A false pending is invisible; a false done would not be. The streak stays
 * server-computed and is not read here at all (#19).
 */
import type { Game } from "@miolos/core";
import Link from "next/link";

import { formatElapsed, messages, playRoutes } from "../src/i18n";
import { doneCount, useDayState } from "../src/play/day-state";
import styles from "./page.module.css";

/** "X de 4 concluídos" — X being what this device has finished today. */
export function HubProgress({
  date,
  total,
}: {
  readonly date: string;
  readonly total: number;
}) {
  const done = doneCount(useDayState(date));
  return (
    <p className={`${styles.metaLine} tabular-nums`}>
      {messages.hoje.completedOfTotal(done, total)}
    </p>
  );
}

/**
 * One card's action area: the solid accent button while the game is pending,
 * the outlined "Feito" stamp plus its tabular result once this device has
 * finished it (DESIGN.md, "Game card").
 *
 * The done tile is a LINK, where F1:35-37 draws an inert `<span>` (plan 018
 * deviation 12): the archive is #31 and the statistics link is deliberately
 * href-less, so an inert card would leave a player who just solved a game no
 * in-app route back to the conclusion they earned — while `/<jogo>` restores
 * straight into it.
 */
export function HubCardAction({
  game,
  date,
}: {
  readonly game: Game;
  readonly date: string;
}) {
  const entry = useDayState(date)[game];
  const route = playRoutes[game];
  // Narrowed through the value rather than through `concluded`, so no
  // non-null assertion is needed and an entry that somehow lost its duration
  // degrades to the pending button instead of rendering "undefined"
  // (`DayEntry.elapsedMs` is optional by type, §11.2).
  const elapsedMs = entry.concluded ? entry.elapsedMs : undefined;

  if (route === undefined) {
    // No play route yet — termo alone reaches this branch today, and #27
    // clears it by adding a key to `playRoutes`, never a branch here. The
    // anchor keeps the card's shape without an href, because a dead href
    // would be fake navigation.
    return (
      <a className={styles.cta}>
        <PlayLabel />
      </a>
    );
  }

  if (elapsedMs === undefined) {
    return (
      <Link className={styles.cta} href={route}>
        <PlayLabel />
      </Link>
    );
  }

  const elapsed = formatElapsed(elapsedMs);
  return (
    <Link
      className={styles.done}
      href={route}
      // Composed in the messages module, never joined here (ADR-0018): the
      // chip and the duration are one sentence for a screen reader, not two
      // fragments.
      aria-label={messages.hoje.doneAria(messages.games[game].name, elapsed)}
    >
      <span aria-hidden className={styles.doneChip}>
        {messages.hoje.done}
      </span>
      {/* Two result strings, one hidden per viewport — a distinct mobile
          string, never a runtime truncation (F1:64 "em 07:12", F2:63
          "07:12"), matching the day card's nonogram precedent. */}
      <span aria-hidden className={`${styles.doneResult} tabular-nums`}>
        <span className={styles.doneResultLong}>
          {messages.hoje.doneResultLong(elapsed)}
        </span>
        <span className={styles.doneResultShort}>
          {messages.hoje.doneResultShort(elapsed)}
        </span>
      </span>
    </Link>
  );
}

/** The pending button's two labels, one hidden per viewport. */
function PlayLabel() {
  return (
    <>
      <span className={styles.ctaLong}>{messages.hoje.playCta}</span>
      <span className={styles.ctaShort}>{messages.hoje.playCtaShort}</span>
    </>
  );
}

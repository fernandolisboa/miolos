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
 * What they render is THE USER's day as this device and the server together
 * know it (ADR-0031 as amended by ADR-0060). A local concluded record proves
 * this device solved that game today; a completion row the server holds
 * proves the USER did, on whatever device. Absence on the device no longer
 * implies pending — that is the whole of #83 — while absence on BOTH still
 * does, which is the cold-profile answer and what `impeccable detect` always
 * scans (no session, so `/day` answers 401 and the pending composition is
 * what the gate sees). A false done would still be visible, and neither
 * input produces one in normal operation — the device's own tampering case
 * is ADR-0044 consequence (f), recorded in `src/play/day-state.ts`: a
 * hand-edited `{concluded: true, outcome: "won"}` record on a six-loss board
 * reads `completed` on that device. It is self-inflicted, device-local and
 * never reaches the wire, which is why it is acceptable — but "cannot" would
 * be the stronger claim, and it is false. The streak stays server-computed
 * and is not read here at all — #19 gave it its own island, `hub-streak.tsx`
 * (ADR-0048).
 *
 * THERE ARE NOW TWO SERVER READS ON THIS SURFACE, and they do different
 * jobs. `GET /day` decides a tile's SHAPE, through `useDayState` — new at
 * #83, and the one place a fetched value is load-bearing for what the tile
 * IS. #29's `GET /stats` still only ever CAPTIONS an already-completed Termo
 * (`TermoDoneLink` below). Both are fetched from client islands, in effects,
 * never during render.
 */
import type { Game } from "@miolos/core";
import Link from "next/link";

import { formatElapsed, messages, playRoutes } from "../src/i18n";
import { completedCount, useDayState } from "../src/play/day-state";
import { useStats } from "../src/stats/use-stats";
import styles from "./page.module.css";

/** A non-breaking space: holds a line box open with nothing in it — the
 *  `PlaySkeleton` blank-values idiom (conclusion-view.tsx). */
const BLANK_VALUE = " ";

/**
 * "X de 4 concluídos" — X being what THE USER has COMPLETED today as far as
 * this device and the server together know (ADR-0060), never what has merely
 * been played. A lost Termo does not enter the count (ADR-0008 decision 4,
 * ADR-0044 decision 5), and since #83 the count can go DOWN once after
 * hydration in exactly one case: a Termo won here and lost on another
 * device, which is a correction rather than an understatement.
 */
export function HubProgress({
  date,
  total,
}: {
  readonly date: string;
  readonly total: number;
}) {
  const done = completedCount(useDayState(date));
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
 * deviation 12): an inert card would leave a player who just solved a game
 * no in-app route back to the conclusion they earned — while `/<jogo>`
 * restores straight into it. (The rationale used to lean on the archive
 * being unreachable; `/arquivo` is live since #31, and the reason above is
 * the one that was always doing the work — a *finished* day's conclusion is
 * not something the archive links to at all.)
 *
 * THE CAVEAT #83 OWES IT, decided rather than discovered (ADR-0060 decision
 * 8): "restores straight into it" is true only where THIS DEVICE holds the
 * record. A tile that is done because the SERVER says so links to a route
 * that renders a fresh, PLAYABLE board — the screen roots swap to
 * `ConclusionView` via `isClosedAndFrozen(play.state)`, i.e. off the local
 * record, and cross-device there is none. That is ADR-0053 decision 10 layer
 * 3's "honest gap", reached from the daily hub for the first time; the
 * replay writes nothing (layer 1). `T-WEB-S244` pins it.
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
  // THE GUARD IS SPLIT since #27 (plan 022 §15.3), and it branches on the
  // STATUS, never on the duration. The shipped form selected the done tile
  // with `elapsedMs !== undefined`, so a completed entry that publishes no
  // duration — a won Termo, whose elapsed time includes every per-guess
  // round trip and is therefore never rendered (ADR-0045 decision 4) — fell
  // through to the "Jogar hoje" button on a game it had already finished.
  // A PLAYED entry must not reach that button either: a game that can no
  // longer be played today never offers a play CTA (ADR-0044 decision 5).
  //
  // The duration is still narrowed through the VALUE rather than through the
  // status, so no non-null assertion is needed and an entry that somehow lost
  // its duration renders the done tile without a result span instead of
  // rendering "undefined" (`DayEntry.elapsedMs` is optional by type).
  const elapsedMs = entry.status === "completed" ? entry.elapsedMs : undefined;

  if (entry.status === "pending") {
    return (
      <Link className={styles.cta} href={route}>
        <PlayLabel />
      </Link>
    );
  }

  // A COMPLETED Termo's done anchor is `TermoDoneLink`'s whole (#29, plan
  // 033 D5): its result is the server-fetched guess count, not a duration,
  // and the component that fetches must be the component that renders the
  // anchor (the accessible name is the ANCHOR's aria-label). A played
  // (lost) Termo stays on the generic path below — playedAria, no fetch —
  // and the three grid games' tiles are byte-identical to before.
  if (game === "termo" && entry.status === "completed") {
    return <TermoDoneLink date={date} />;
  }

  const name = messages.games[game].name;
  const elapsed =
    elapsedMs === undefined ? undefined : formatElapsed(elapsedMs);
  return (
    <Link
      className={styles.done}
      href={route}
      // Composed in the messages module, never joined here (ADR-0018): the
      // chip and the duration are one sentence for a screen reader, not two
      // fragments. THREE composers rather than one, because the sentence is
      // genuinely different in each case — `doneAria` needs a duration a
      // played entry does not have, and `playedAria` says *jogado* about a
      // game a duration-less winner actually won.
      aria-label={
        entry.status === "played"
          ? messages.hoje.playedAria(name)
          : elapsed === undefined
            ? messages.hoje.completedAria(name)
            : messages.hoje.doneAria(name, elapsed)
      }
    >
      <span aria-hidden className={styles.doneChip}>
        {entry.status === "played" ? messages.hoje.played : messages.hoje.done}
      </span>
      {/* Two result strings, one hidden per viewport — a distinct mobile
          string, never a runtime truncation (F1:64 "em 07:12", F2:63
          "07:12"), matching the day card's nonogram precedent.
          Emitted ONLY when there is a real duration: neither shipped
          composer is ever called with a fabricated value, and a played
          tile simply renders its chip. A COMPLETED Termo — the one
          duration-less completed shape — never reaches this branch at all:
          `TermoDoneLink` above owns that anchor and captions it `em 4/6`
          from the server's answer (#29). */}
      {elapsed !== undefined && (
        <span aria-hidden className={`${styles.doneResult} tabular-nums`}>
          <span className={styles.doneResultLong}>
            {messages.hoje.doneResultLong(elapsed)}
          </span>
          <span className={styles.doneResultShort}>
            {messages.hoje.doneResultShort(elapsed)}
          </span>
        </span>
      )}
    </Link>
  );
}

/**
 * The done anchor of a COMPLETED Termo (#29, plan 033 D5): the tile whose
 * result is `em 4/6` — the server-held guess count, never a duration
 * (ADR-0045 decision 4). It owns the WHOLE anchor — Link, aria-label, chip
 * and both result spans — because the accessible name is the ANCHOR's
 * `aria-label` and the result spans are aria-hidden, so a child span could
 * never feed the parent's label. The hook lives inside this
 * conditionally-mounted component (the `use-streak.ts` gate idiom: hooks
 * are never conditional, consumers mount the consuming component
 * conditionally), so at most one /stats fetch fires per hub view, and only
 * on a hub whose Termo is already completed.
 *
 * The accessible-name ladder, each rung an honest claim:
 *
 * - unsettled, settled-`null`, or `stats.date !== date` (the tile's
 *   server-resolved day — the DB clock and the web server's SP day can
 *   disagree across midnight): `completedAria`, today's shipped won-Termo
 *   name (T-WEB-S80 stays green untouched). While unsettled the result
 *   line box is held open with `BLANK_VALUE`, so the value landing shifts
 *   nothing (#37's CLS≈0); once settled without a usable value the box
 *   collapses to the chip-only form — the shipped honest state.
 * - value landed and dates match: `doneGuessesAria` with the count, and
 *   the two aria-hidden result spans carry `em 4/6` / `4/6`.
 *
 * Server state decorating THE MERGED day state (ADR-0031 as amended by
 * ADR-0060). Since #83 the DEVICE record no longer decides this tile is
 * done on its own: the merge does, so a Termo completed on another device
 * now mounts this component where it previously did not (ADR-0060
 * consequence (a)). What has NOT changed is the direction of the
 * decoration — `GET /stats`'s `todayTermoGuesses` only ever CAPTIONS an
 * already-done tile, never makes one, and `DayEntry` still gains nothing.
 */
function TermoDoneLink({ date }: { readonly date: string }) {
  const stats = useStats();
  const name = messages.games.termo.name;
  // `todayTermoGuesses` can be null even when the dates match — the server
  // not yet holding the win this device recorded — and that renders the
  // chip-only form too: no count is claimed that the server does not hold.
  const guesses =
    stats !== undefined && stats !== null && stats.date === date
      ? stats.todayTermoGuesses
      : null;
  return (
    <Link
      className={styles.done}
      href={playRoutes.termo}
      aria-label={
        guesses === null
          ? messages.hoje.completedAria(name)
          : messages.hoje.doneGuessesAria(name, guesses)
      }
    >
      <span aria-hidden className={styles.doneChip}>
        {messages.hoje.done}
      </span>
      {guesses !== null ? (
        <span aria-hidden className={`${styles.doneResult} tabular-nums`}>
          <span className={styles.doneResultLong}>
            {messages.hoje.doneResultLong(`${guesses}/6`)}
          </span>
          <span className={styles.doneResultShort}>
            {messages.hoje.doneResultShort(`${guesses}/6`)}
          </span>
        </span>
      ) : (
        stats === undefined && (
          <span aria-hidden className={`${styles.doneResult} tabular-nums`}>
            <span className={styles.doneResultLong}>{BLANK_VALUE}</span>
            <span className={styles.doneResultShort}>{BLANK_VALUE}</span>
          </span>
        )
      )}
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

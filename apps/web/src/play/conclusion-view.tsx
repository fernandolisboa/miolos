"use client";

import type { Game } from "@miolos/core";
import Link from "next/link";
import { useEffect } from "react";

import {
  formatElapsed,
  formatLongDate,
  formatShortDate,
  messages,
  playRoutes,
  routes,
  type Route,
} from "../i18n";
import { accentVar } from "./accent";
import styles from "./conclusion-view.module.css";
import { useDayState, type DayEntry } from "./day-state";
import { startCompletionSync } from "./sync";
import type { ConclusionCopy, ConclusionPicture } from "./types";
import { useRecordSnapshot } from "./use-record-snapshot";

/** The four dailies, in the order Hoje lists them. */
const DAY_GAMES = ["termo", "sudoku", "nonogram", "binairo"] as const;

/**
 * What the stamp shows when the conclusion renders in place, straight from
 * the live play state (plan 017 D26). It exists because the swap happens in
 * the same commit that closes the grid, and React runs a child's mount
 * effect BEFORE its parent's — so the record this view would otherwise read
 * has not been written yet. Passing the values down also keeps the in-place
 * conclusion working where `localStorage` throws (Safari private mode),
 * which is exactly the offline case AC 3 is about.
 */
export interface ConclusionResult {
  readonly elapsedMs: number;
  readonly hintsUsed: number;
}

/**
 * The conclusion composition (plan 017 §12.3), recreated from
 * f5-conclusao-desktop and f6-conclusao-mobile, and SHARED by every game
 * (ADR-0029). One component, two mount points per game: swapped in place on
 * `/<jogo>` when the grid closes, and rendered under its own server segment
 * at `/<jogo>/concluido` for a bookmark, a reload and `impeccable detect`
 * (D26/D27).
 *
 * `game` selects the record to read and the accent to paint; `copy` is the
 * game's own conclusion bundle. Everything else it renders comes from
 * `messages.conclusion`, which is shared chrome (plan 018 S19).
 *
 * `date` is the SERVER's day, resolved from the wall by the page shell — the
 * client clock never selects which record is read (CONTEXT.md "Rollover").
 *
 * Four frame elements are deliberately absent, because rendering empty stat
 * rows and a zero streak would be fake data: the streak card (#19/#20,
 * server-computed), best/average/solved and the histogram (#29), the closing
 * italic line (#29, it compares against an average that does not exist) and
 * the share button (#34 — a dead share button is a broken promise, unlike a
 * dead link). §12.3 carries the full table.
 *
 * `picture` is the first per-game payoff payload (ADR-0034 decision 3): plain
 * data, optional, and supplied only by a client component that owns the local
 * play record. A game with no payoff passes nothing and renders exactly what
 * it rendered before the prop existed.
 */
export function ConclusionView({
  game,
  date,
  copy,
  result,
  picture,
}: {
  readonly game: Game;
  readonly date: string;
  readonly copy: ConclusionCopy;
  readonly result?: ConclusionResult;
  readonly picture?: ConclusionPicture;
}) {
  const snapshot = useRecordSnapshot(game, date);
  const hydrated = snapshot.hydrated;
  const record = snapshot.hydrated ? snapshot.record : undefined;
  // What THIS DEVICE knows about the rest of the day (ADR-0031). It can only
  // understate — a game solved on another device reads `falta` here, which
  // is stated in the plan rather than hidden, and is the same answer a cold
  // profile gets.
  const dayState = useDayState(date);

  useEffect(() => {
    // "On mount of either route" (§9.2). On `/<jogo>` the play hook has
    // already registered the same set; sync.ts's module-level guards make
    // the overlap free — and they only can because there is exactly ONE
    // sync module for every game (ADR-0029, plan 018 S1).
    return startCompletionSync();
  }, [date]);

  // Set on every branch's root, because the shared stylesheet reads
  // `var(--accent)` throughout (plan 018 §5.2 edit 1).
  const accent = { "--accent": accentVar(game) };

  const stored = record?.concluded === true ? record : undefined;
  // The record wins when it has one: on `recorded: false` the flush writes
  // the server's authoritative values back into it, and the conclusion must
  // never show a time the server does not hold (§9.2).
  const stamp: ConclusionResult | undefined = stored ?? result;
  // Read from the CONCLUDED record only, and `undefined` says nothing at
  // all. On the in-place swap the record still in storage is the last
  // PLAYING one — written with `syncOutcome: "pending"` before this
  // completion existed — so defaulting to "pending" told a perfectly online
  // player, on the one celebration screen the product has, that their
  // result was stranded on their device (findings
  // `pending-sync-line-on-the-happy-path` / `sync-pending-line-on-happy-path`).
  // Offline the line still arrives, one poll tick later, which is strictly
  // better than a false claim on every successful solve.
  const syncOutcome = stored?.syncOutcome;

  if (!hydrated) {
    // A beat of nothing, never the "ainda não concluído" card: flashing it
    // and then swapping to a completed stamp is worse than a blank card
    // (D28).
    return (
      <main
        className={`${styles.page} ${styles.pageEmpty}`}
        style={accent}
        data-conclusion-state="skeleton"
      >
        <ConclusionTopBar date={date} kicker={copy.kicker} />
        <div className={styles.emptyBody}>
          <div aria-hidden className={styles.skeletonCard} />
        </div>
      </main>
    );
  }

  if (stamp === undefined) {
    return (
      <main
        className={`${styles.page} ${styles.pageEmpty}`}
        style={accent}
        data-conclusion-state="empty"
      >
        <ConclusionTopBar date={date} kicker={copy.kicker} />
        <div className={styles.emptyBody}>
          <article className={styles.emptyCard}>
            <div aria-hidden className={styles.tape} />
            {/* h1 first element child of its wrapper — see the note in
                play-view.tsx; the same two impeccable rules anchor on
                `h1.previousElementSibling` here. */}
            <div className={styles.titleRow}>
              <h1 className={styles.emptyTitle}>{copy.notYet.title}</h1>
            </div>
            <p className={styles.emptyBodyText}>
              {messages.conclusion.notYet.body}
            </p>
            <Link
              className={styles.emptyCta}
              href={playRoutes[game] ?? routes.home}
            >
              {copy.notYet.cta}
            </Link>
          </article>
        </div>
      </main>
    );
  }

  const elapsed = formatElapsed(stamp.elapsedMs);

  // The game being celebrated is proved done by the stamp itself, which is
  // exactly what the record may not say yet: on the in-place swap the record
  // still in storage is the last PLAYING one (plan 017 D26), and where
  // `localStorage` throws there will never be another. Reading this off the
  // records alone would print `falta` next to a "Concluído" stamp AND chain
  // the CTA straight back into the grid the player just closed. Monotone
  // safety is unaffected — this can only mark a game done, and on live proof
  // (ADR-0031).
  const dayEntry = (dayGame: Game): DayEntry =>
    dayGame === game
      ? { concluded: true, elapsedMs: stamp.elapsedMs }
      : dayState[dayGame];
  const next = nextPendingDaily(dayEntry);

  return (
    <main
      className={`${styles.page} ${styles.pageResult}`}
      style={accent}
      data-conclusion-state="result"
    >
      <ConclusionTopBar date={date} kicker={copy.kicker} />

      <article className={styles.resultCard}>
        <div aria-hidden className={styles.tape} />
        <p className={styles.cardKicker}>{copy.kicker}</p>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>{copy.title}</h1>
        </div>
        <div className={styles.stampRow}>
          {/* One composite announcement rather than three fragments: ARIA
              does not name a generic element, and "Concluído 06:47 sem
              dicas" read as three unrelated strings is not the sentence the
              copy module already composes. */}
          <div
            className={styles.stamp}
            role="img"
            aria-label={messages.conclusion.stampAria(
              copy.title,
              elapsed,
              stamp.hintsUsed,
            )}
          >
            <span aria-hidden className={styles.stampLabel}>
              {messages.conclusion.stampLabel}
            </span>
            <span aria-hidden className={styles.stampTime}>
              {elapsed}
            </span>
            <span aria-hidden className={styles.stampHints}>
              {messages.conclusion.hints(stamp.hintsUsed)}
            </span>
          </div>
        </div>
        {picture !== undefined && (
          /* The payoff, inside the card the stamp already lives in — never a
             modal, never a full-screen takeover, never confetti (PRODUCT.md:33,
             DESIGN.md:44). One `<svg>` and one `<path>`: a 15×15 daily carries
             48–143 filled cells, and one node keeps every DOM-walking
             impeccable rule O(1) here. SVG rather than a grid of divs, per
             CLAUDE.md's "inside the app: SVG, Skia, or code". */
          <div className={styles.pictureRow}>
            <svg
              className={styles.picture}
              role="img"
              aria-label={picture.label}
              viewBox={`0 0 ${String(picture.size)} ${String(picture.size)}`}
              shapeRendering="crispEdges"
            >
              <path d={picturePath(picture)} />
            </svg>
          </div>
        )}
        {syncOutcome === "pending" && (
          <p className={styles.sync}>{messages.conclusion.sync.pending}</p>
        )}
        {syncOutcome === "rejected" && (
          // Not cosmetic: without it the stamp would stand while the server
          // holds no completion, making the client's own verdict the
          // user-visible authority on the day (ADR-0004, §9.2).
          <p className={styles.sync}>{messages.conclusion.sync.rejected}</p>
        )}
      </article>

      <aside className={styles.side}>
        <section className={styles.dayCard}>
          <p className={styles.dayCardTitle}>
            {messages.conclusion.dayCard.title}
          </p>
          <div className={styles.chips}>
            {DAY_GAMES.map((dayGame) => (
              <DayChip key={dayGame} game={dayGame} entry={dayEntry(dayGame)} />
            ))}
          </div>
        </section>
        {next === undefined ? (
          /* Solid ink, not a game accent: in this system a per-game accent IS
             that game's identity (DESIGN.md), and this CTA goes to Hoje.
             F5's own non-game button treatment. */
          <Link className={styles.cta} href={routes.home}>
            {messages.conclusion.ctaHome}
          </Link>
        ) : (
          /* …and by the same rule, a CTA that goes to a game wears THAT
             game's accent — F5:66's own treatment for this exact button
             (plan 018 S21, deviation 11). `--accent` is set on the element
             rather than the root so the rest of the screen keeps the accent
             of the game being celebrated. */
          <Link
            className={`${styles.cta} ${styles.ctaNext}`}
            style={{ "--accent": accentVar(next.game) }}
            href={next.route}
          >
            {messages.conclusion.ctaNext(messages.games[next.game].name)}
          </Link>
        )}
        {/* href-less, matching Hoje's shipped secondary links: the stats
            screen arrives with #29 and a dead href would be fake
            navigation. */}
        <a className={styles.secondaryLink}>{messages.conclusion.stats}</a>
      </aside>
    </main>
  );
}

/**
 * The bitmap as ONE `<path>`'s `d`: a unit square per filled cell, in
 * row-major order, inside a `size × size` viewBox.
 *
 * `M{col} {row}h1v1h-1z` — an absolute move to the cell's top-left corner and
 * a closed unit square, so every subpath is independent and the fill rule
 * never has to reconcile overlapping ones. Pure and module-scope, so it is
 * testable without React and cannot close over a render.
 */
function picturePath(picture: ConclusionPicture): string {
  let path = "";
  for (const [index, cell] of picture.cells.entries()) {
    if (cell === 1) {
      const row = Math.floor(index / picture.size);
      const column = index % picture.size;
      path += `M${String(column)} ${String(row)}h1v1h-1z`;
    }
  }
  return path;
}

/**
 * The first daily this device can still play today, in the day's order — AC
 * 3's "the conclusion chains to the next pending daily" (plan 018 S21).
 *
 * Written as a loop rather than a `find` because the route has to come out
 * NARROWED: `playRoutes` is partial until #25/#27 land, and Next's typed
 * `Link href` refuses a possibly-undefined value. A game with no play route
 * is skipped rather than offered — chaining to a route that does not exist
 * would be a 404 at the end of the one celebration screen the product has.
 *
 * Understating is safe here for the same reason it is on the hub: the worst
 * a stale `pending` does is offer a game the player already solved on another
 * device, and `/<jogo>` restores straight into its conclusion (ADR-0031).
 */
function nextPendingDaily(
  entryOf: (game: Game) => DayEntry,
): { readonly game: Game; readonly route: Route } | undefined {
  for (const candidate of DAY_GAMES) {
    const route = playRoutes[candidate];
    if (route !== undefined && !entryOf(candidate).concluded) {
      return { game: candidate, route };
    }
  }
  return undefined;
}

function ConclusionTopBar({
  date,
  kicker,
}: {
  readonly date: string;
  readonly kicker: string;
}) {
  return (
    <header className={styles.topBar}>
      <Link
        className={styles.back}
        href={routes.home}
        aria-label={messages.conclusion.backAria}
      >
        {messages.conclusion.back}
      </Link>
      {/* Two nodes per viewport, one hidden by a media query: F5 centres the
          italic wordmark and puts the kicker inside the card, F6 centres the
          kicker in the bar and its card has none (§12.3). */}
      <span className={styles.wordmark}>{messages.brand.wordmark}</span>
      <span className={styles.barKicker}>{kicker}</span>
      <span className={styles.topDateLong}>{formatLongDate(date)}</span>
      <span className={styles.topDateShort}>{formatShortDate(date)}</span>
    </header>
  );
}

/**
 * One "O dia até agora" chip, read from THIS DEVICE's day state (ADR-0031,
 * plan 018 §11.4). A game with no local concluded record is honestly
 * `falta` rather than a fake result — and together with the CTA the chips
 * are the AC's "points to the next pending daily" (plan 017 §12.3).
 */
function DayChip({
  game,
  entry,
}: {
  readonly game: (typeof DAY_GAMES)[number];
  readonly entry: DayEntry;
}) {
  // Narrowed through the value rather than through `concluded`, so no
  // non-null assertion is needed and a `{concluded: true}` entry that
  // somehow lost its duration degrades to `falta` instead of rendering
  // "undefined" (`DayEntry.elapsedMs` is optional by type, §11.2).
  const elapsedMs = entry.concluded ? entry.elapsedMs : undefined;
  const done = elapsedMs !== undefined;
  return (
    <div
      className={`${styles.chip} ${done ? styles.chipDone : styles.chipMissing}`}
    >
      {game === "nonogram" ? (
        <>
          {/* A distinct mobile string, never a runtime truncation. */}
          <span className={`${styles.chipName} ${styles.chipNameLong}`}>
            {messages.conclusion.dayCard.games.nonogram}
          </span>
          <span className={`${styles.chipName} ${styles.chipNameShort}`}>
            {messages.conclusion.dayCard.games.nonogramShort}
          </span>
        </>
      ) : (
        <span className={styles.chipName}>
          {messages.conclusion.dayCard.games[game]}
        </span>
      )}
      <span className={styles.chipValue}>
        {done ? formatElapsed(elapsedMs) : messages.conclusion.dayCard.missing}
      </span>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useSyncExternalStore } from "react";

import {
  formatElapsed,
  formatLongDate,
  formatShortDate,
  messages,
  routes,
} from "../i18n";
import styles from "./conclusion-view.module.css";
import { readPlayRecord, type PlayRecord } from "./play-record";
import { startCompletionSync } from "./sync";

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
 * f5-conclusao-desktop and f6-conclusao-mobile. One component, two mount
 * points: swapped in place on `/binairo` when the grid closes, and rendered
 * under its own server segment at `/binairo/concluido` for a bookmark, a
 * reload and `impeccable detect` (D26/D27).
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
 */
export function ConclusionView({
  date,
  result,
}: {
  readonly date: string;
  readonly result?: ConclusionResult;
}) {
  const snapshot = useSyncExternalStore(
    subscribeToRecord,
    useCallback(() => readSnapshot(date), [date]),
    serverSnapshot,
  );
  const hydrated = snapshot.hydrated;
  const record = snapshot.hydrated ? snapshot.record : undefined;

  useEffect(() => {
    // "On mount of either route" (§9.2). On `/binairo` the play hook has
    // already registered the same set; sync.ts's module-level guards make
    // the overlap free.
    return startCompletionSync();
  }, [date]);

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
        data-conclusion-state="skeleton"
      >
        <ConclusionTopBar date={date} />
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
        data-conclusion-state="empty"
      >
        <ConclusionTopBar date={date} />
        <div className={styles.emptyBody}>
          <article className={styles.emptyCard}>
            <div aria-hidden className={styles.tape} />
            {/* h1 first element child of its wrapper — see the note in
                play-view.tsx; the same two impeccable rules anchor on
                `h1.previousElementSibling` here. */}
            <div className={styles.titleRow}>
              <h1 className={styles.emptyTitle}>
                {messages.conclusao.notYet.title}
              </h1>
            </div>
            <p className={styles.emptyBodyText}>
              {messages.conclusao.notYet.body}
            </p>
            <Link className={styles.emptyCta} href={routes.binairo}>
              {messages.conclusao.notYet.cta}
            </Link>
          </article>
        </div>
      </main>
    );
  }

  const elapsed = formatElapsed(stamp.elapsedMs);

  return (
    <main
      className={`${styles.page} ${styles.pageResult}`}
      data-conclusion-state="result"
    >
      <ConclusionTopBar date={date} />

      <article className={styles.resultCard}>
        <div aria-hidden className={styles.tape} />
        <p className={styles.cardKicker}>{messages.conclusao.kicker}</p>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>{messages.conclusao.title}</h1>
        </div>
        <div className={styles.stampRow}>
          {/* One composite announcement rather than three fragments: ARIA
              does not name a generic element, and "Concluído 06:47 sem
              dicas" read as three unrelated strings is not the sentence the
              copy module already composes. */}
          <div
            className={styles.stamp}
            role="img"
            aria-label={messages.conclusao.stampAria(elapsed, stamp.hintsUsed)}
          >
            <span aria-hidden className={styles.stampLabel}>
              {messages.conclusao.stampLabel}
            </span>
            <span aria-hidden className={styles.stampTime}>
              {elapsed}
            </span>
            <span aria-hidden className={styles.stampHints}>
              {messages.conclusao.hints(stamp.hintsUsed)}
            </span>
          </div>
        </div>
        {syncOutcome === "pending" && (
          <p className={styles.sync}>{messages.conclusao.sync.pending}</p>
        )}
        {syncOutcome === "rejected" && (
          // Not cosmetic: without it the stamp would stand while the server
          // holds no completion, making the client's own verdict the
          // user-visible authority on the day (ADR-0004, §9.2).
          <p className={styles.sync}>{messages.conclusao.sync.rejected}</p>
        )}
      </article>

      <aside className={styles.side}>
        <section className={styles.dayCard}>
          <p className={styles.dayCardTitle}>
            {messages.conclusao.dayCard.title}
          </p>
          <div className={styles.chips}>
            {DAY_GAMES.map((game) => (
              <DayChip key={game} game={game} elapsed={elapsed} />
            ))}
          </div>
        </section>
        {/* Solid ink, not a game accent: in this system a per-game accent IS
            that game's identity (DESIGN.md), and this CTA goes to Hoje.
            F5's own non-game button treatment; --accent-nonogram is reserved
            for when #25 makes it point at Nonogram (deviation 9). */}
        <Link className={styles.cta} href={routes.home}>
          {messages.conclusao.cta}
        </Link>
        {/* href-less, matching Hoje's shipped secondary links: the stats
            screen arrives with #29 and a dead href would be fake
            navigation. */}
        <a className={styles.secondaryLink}>{messages.conclusao.stats}</a>
      </aside>
    </main>
  );
}

function ConclusionTopBar({ date }: { readonly date: string }) {
  return (
    <header className={styles.topBar}>
      <Link
        className={styles.back}
        href={routes.home}
        aria-label={messages.conclusao.backAria}
      >
        {messages.conclusao.back}
      </Link>
      {/* Two nodes per viewport, one hidden by a media query: F5 centres the
          italic wordmark and puts the kicker inside the card, F6 centres the
          kicker in the bar and its card has none (§12.3). */}
      <span className={styles.wordmark}>{messages.brand.wordmark}</span>
      <span className={styles.barKicker}>{messages.conclusao.kicker}</span>
      <span className={styles.topDateLong}>{formatLongDate(date)}</span>
      <span className={styles.topDateShort}>{formatShortDate(date)}</span>
    </header>
  );
}

/**
 * One "O dia até agora" chip. Binairo is the only game with a play route in
 * this ticket, so the other three are honestly `falta` rather than fake
 * results — and together with the CTA they are the AC's "points to the next
 * pending daily" (§12.3).
 */
function DayChip({
  game,
  elapsed,
}: {
  readonly game: (typeof DAY_GAMES)[number];
  readonly elapsed: string;
}) {
  const done = game === "binairo";
  return (
    <div
      className={`${styles.chip} ${done ? styles.chipDone : styles.chipMissing}`}
    >
      {game === "nonogram" ? (
        <>
          {/* A distinct mobile string, never a runtime truncation. */}
          <span className={`${styles.chipName} ${styles.chipNameLong}`}>
            {messages.conclusao.dayCard.games.nonogram}
          </span>
          <span className={`${styles.chipName} ${styles.chipNameShort}`}>
            {messages.conclusao.dayCard.games.nonogramShort}
          </span>
        </>
      ) : (
        <span className={styles.chipName}>
          {messages.conclusao.dayCard.games[game]}
        </span>
      )}
      <span className={styles.chipValue}>
        {done ? elapsed : messages.conclusao.dayCard.missing}
      </span>
    </div>
  );
}

/**
 * `localStorage` is an external store, and sync.ts settles the record from
 * outside React — so the view subscribes to it rather than copying it into
 * component state in a mount effect. Three things fall out of that:
 *
 * - the pre-hydration paint is free and exact (D28): the server snapshot is
 *   a constant that says "not read yet", so the server markup and the first
 *   client paint agree on the skeleton and neither can flash the
 *   "ainda não concluído" card;
 * - a settled sync reaches the card without a notifier sync.ts does not
 *   have;
 * - nothing re-renders while nothing the card shows has changed, because
 *   `readSnapshot` hands back the cached object in that case.
 */
type RecordSnapshot =
  | { readonly hydrated: false }
  | { readonly hydrated: true; readonly record: PlayRecord | undefined };

const SERVER_SNAPSHOT: RecordSnapshot = { hydrated: false };

const serverSnapshot = (): RecordSnapshot => SERVER_SNAPSHOT;

/**
 * The snapshot cache the store contract requires: `getSnapshot` has to
 * return a referentially stable value or `useSyncExternalStore` loops
 * forever, and a fresh `JSON.parse` never is. Module-level because the
 * store it caches is — one browser has one `localStorage`.
 */
let cachedSnapshot:
  { readonly date: string; readonly snapshot: RecordSnapshot } | undefined;

function readSnapshot(date: string): RecordSnapshot {
  const next = readPlayRecord(date);
  const cached = cachedSnapshot;
  if (
    cached?.date === date &&
    cached.snapshot.hydrated &&
    sameToTheReader(cached.snapshot.record, next)
  ) {
    return cached.snapshot;
  }
  const snapshot: RecordSnapshot = { hydrated: true, record: next };
  cachedSnapshot = { date, snapshot };
  return snapshot;
}

/**
 * A 1 s poll, because sync.ts exposes no notifier and `storage` fires only
 * in OTHER tabs. It costs one read and one parse per second and, thanks to
 * the cache above, zero re-renders while the record stands still.
 */
function subscribeToRecord(onStoreChange: () => void): () => void {
  const interval = setInterval(onStoreChange, 1000);
  window.addEventListener("storage", onStoreChange);
  return () => {
    clearInterval(interval);
    window.removeEventListener("storage", onStoreChange);
  };
}

/** Everything the conclusion actually renders from a record. */
function sameToTheReader(
  previous: PlayRecord | undefined,
  next: PlayRecord | undefined,
): boolean {
  return (
    previous?.concluded === next?.concluded &&
    previous?.pendingSync === next?.pendingSync &&
    previous?.syncOutcome === next?.syncOutcome &&
    previous?.elapsedMs === next?.elapsedMs &&
    previous?.hintsUsed === next?.hintsUsed
  );
}

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
import { useStreak } from "../streak/use-streak";
import { accentVars } from "./accent";
import styles from "./conclusion-view.module.css";
import { useDayState, type DayEntry } from "./day-state";
import { picturePath } from "./picture-path";
import { startCompletionSync } from "./sync";
import type {
  ConclusionAnswer,
  ConclusionCopy,
  ConclusionOutcome,
  ConclusionPicture,
} from "./types";
import { useRecordSnapshot } from "./use-record-snapshot";

/** The four dailies, in the order Hoje lists them. */
const DAY_GAMES = ["termo", "sudoku", "nonogram", "binairo"] as const;

/** A non-breaking space: holds a line box open with nothing in it — the
 *  `PlaySkeleton` blank-values idiom (binairo/play-view.tsx). */
const BLANK_VALUE = " ";

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
 * Three frame elements are deliberately absent, because rendering empty stat
 * rows would be fake data: best/average/solved and the histogram (#29), the
 * closing italic line (#29, it compares against an average that does not
 * exist) and the share button (#34 — a dead share button is a broken
 * promise, unlike a dead link). §12.3 carried the full table; #19 filled the
 * fourth gap — the streak card is live below, server-computed and gated on
 * the day being on the server (ADR-0048), so every unfetched state stays
 * exactly as honest as the old absence.
 *
 * `picture` is the first per-game payoff payload (ADR-0034 decision 3): plain
 * data, optional, and supplied only by a client component that owns the local
 * play record. A game with no payoff passes nothing and renders exactly what
 * it rendered before the prop existed.
 *
 * `outcome` is the second and `answer` the third, on the same rule (#27,
 * ADR-0043). TWO members for one game is one more than ADR-0034 consequence
 * (c) budgets, and the deviation is stated rather than smuggled: the two are
 * orthogonal — `outcome` serves the win stamp and the loss stamp both and is
 * what a game with TWO terminal states owes, while `answer` is the day's word
 * and renders on both outcomes. Collapsing them would put a nullable word
 * inside an outcome object and make the win branch carry a field it does not
 * gate on. Three games pass neither and are byte-identical.
 */
export function ConclusionView({
  game,
  date,
  copy,
  result,
  picture,
  outcome,
  answer,
}: {
  readonly game: Game;
  readonly date: string;
  readonly copy: ConclusionCopy;
  readonly result?: ConclusionResult;
  readonly picture?: ConclusionPicture;
  readonly outcome?: ConclusionOutcome;
  readonly answer?: ConclusionAnswer;
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
  // `var(--accent)` and `var(--ink-on-accent, …)` throughout (plan 018 §5.2
  // edit 1). The pair travels together — see `accent.ts`.
  const accent = accentVars(game);

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

  // THE BRANCH ORDER IS LOAD-BEARING (ADR-0043 decision 2): `!hydrated →
  // skeleton`, `outcome?.state === "lost" → lost`, `stamp === undefined →
  // empty`, otherwise `result`. Placed AFTER the stamp check, a lost Termo —
  // which IS a locally-concluded record — would fall into `result` and paint
  // a "Concluído" stamp over a loss. Checking it here also decouples the loss
  // from `ConclusionResult`, from `record.concluded` and from `elapsedMs`
  // entirely.
  //
  // AND THE GATE IS `outcome?.state === "lost"`, NEVER `outcome !==
  // undefined`: a won Termo passes the prop too, so gating on presence would
  // render every Termo win as a loss.
  const lost = outcome?.state === "lost";

  if (!lost && stamp === undefined) {
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
            <Link className={styles.emptyCta} href={playRoutes[game]}>
              {copy.notYet.cta}
            </Link>
          </article>
        </div>
      </main>
    );
  }

  // The game being celebrated is proved done by the stamp itself, which is
  // exactly what the record may not say yet: on the in-place swap the record
  // still in storage is the last PLAYING one (plan 017 D26), and where
  // `localStorage` throws there will never be another. Reading this off the
  // records alone would print `falta` next to a "Concluído" stamp AND chain
  // the CTA straight back into the grid the player just closed. Monotone
  // safety is unaffected — this can only mark a game done, and on live proof
  // (ADR-0031).
  //
  // OUTCOME-AWARE since #27, and both simplifications break (plan 022 §15.3).
  // An unconditional `{status: "completed", elapsedMs: stamp.elapsedMs}` puts
  // a duration next to "jogado" on a loss — a time on a game nobody won, the
  // lie `day-state.ts` already refuses for a part-played board. Dropping the
  // override on the loss branch makes this game read `pending`, and termo is
  // FIRST in `DAY_GAMES`, so the conclusion of the game just spent would
  // offer it as the default next daily. `outcome` is the same one prop that
  // drives the stamp, so nothing here re-derives a verdict.
  //
  // THE PRESENCE OF `outcome` IS ALSO WHAT SUPPRESSES THE DURATION ON A WIN,
  // and that is game-blind rather than a termo branch: a game supplies this
  // prop precisely because the shared label/TIME/hints triple is not an
  // honest stamp for it, so its elapsed time is not the day's result either.
  // Without this, /termo's own conclusion would print `em 03:08` in the chip
  // that `entryFor` — and therefore the hub, and every other game's
  // conclusion — renders as `feito` (ADR-0045 decision 4, plan 022 §15.3).
  // A game that passes no `outcome` renders exactly what it rendered before
  // this prop existed.
  const dayEntry = (dayGame: Game): DayEntry =>
    dayGame === game
      ? outcome === undefined
        ? // `stamp` is defined on every path that reaches here with no
          // `outcome` — the guard above returned otherwise — and the optional
          // chain is TypeScript's acknowledgement of that rather than a
          // second possibility: it cannot narrow through `lost`, and an
          // assertion here would be exactly the `as` this repo refuses.
          { status: "completed", elapsedMs: stamp?.elapsedMs }
        : outcome.state === "lost"
          ? { status: "played", elapsedMs: undefined }
          : { status: "completed", elapsedMs: undefined }
      : dayState[dayGame];
  const next = nextPendingDaily(dayEntry);

  return (
    <main
      className={`${styles.page} ${styles.pageResult}`}
      style={accent}
      // The BOARD verb, deliberately, and the day verb is not used here: this
      // attribute's existing values are `skeleton`, `empty` and `result` —
      // none of them a CONTEXT.md day verb either — and it mirrors
      // `ConclusionOutcome.state`, which mirrors `TermoBoardStatus`.
      // CONTEXT.md's *Played / Jogado* is the DAY's verb and lives where it
      // belongs: `DayEntry.status`, the `jogado` chip, and the stamp's label.
      data-conclusion-state={lost ? "lost" : "result"}
    >
      <ConclusionTopBar date={date} kicker={copy.kicker} />

      <article className={styles.resultCard}>
        <div aria-hidden className={styles.tape} />
        <p className={styles.cardKicker}>{copy.kicker}</p>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>{copy.title}</h1>
        </div>
        <div className={styles.stampRow}>
          {outcome === undefined ? (
            // The `null` arm is unreachable: the guard above returns `empty`
            // when there is no outcome and no stamp. It is a branch rather
            // than a non-null assertion for the same reason as `dayEntry`.
            stamp === undefined ? null : (
              <ShippedStamp title={copy.title} stamp={stamp} />
            )
          ) : (
            <OutcomeStamp outcome={outcome} />
          )}
        </div>
        {outcome !== undefined && (
          /* ADR-0043 decision 10, and it is an obligation rather than a
             nicety: this component shipped with NO live region and no focus
             management at all, so on the in-place swap the play view unmounts,
             focus falls to <body>, and a blind player gets nothing at the
             product's payoff moment. The gap is inherited from three shipped
             games; #27 closes it because ADR-0042 decision 10 already promises
             that "the conclusion owns the terminal sentence".

             The string is ALREADY COMPOSED (types.ts's plain-data rule —
             nothing is composed here), games that pass no `outcome` render no
             region and are byte-identical, and focus still never moves
             programmatically: a role="status" announces without stealing the
             caret, which is the mechanism PRODUCT.md's "nothing nags" points
             at. That a live region MOUNTING with content is spoken is an AT
             behaviour jsdom cannot prove; it rides the one real
             VoiceOver/NVDA pass ADR-0042 consequence (e) already owes. */
          <p role="status" className={styles.announcer}>
            {outcome.aria}
          </p>
        )}
        {answer !== undefined && (
          /* The day's word (#27 AC 2, ADR-0043 decision 6), in `.pictureRow`'s
             slot and on BOTH outcomes. UNANIMATED, deliberately: a third
             settle would make the card busy on a win and would be the ONLY
             motion on the screen on a loss, which reads as celebrating one.

             `.dayWord` MAY NEVER BECOME A HEADING and may never take
             `role="heading"`. `.dayWordLead` is an 11px tracked-uppercase line
             sitting immediately above it — textbook `kicker-above-heading`
             shape — and the two lines are legal ONLY because both that rule
             and `hero-eyebrow-chip` anchor exclusively on `h1`–`h4` and
             `[role="heading"]` (checks.mjs:2492). Promoting it to an `<h2>` —
             the obvious "semantic improvement" — lights the rule up at both
             viewports on the one card no URL-mode scan reaches. */
          <div className={styles.dayWordRow}>
            <p className={styles.dayWordResult}>{answer.result}</p>
            <p className={styles.dayWordLead}>{answer.lead}</p>
            <p className={styles.dayWord}>{answer.canonical}</p>
          </div>
        )}
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
        {/* Gated on the day being ON THE SERVER (plan 027 D8): a conclusion
            reached offline has syncOutcome "pending", and a card claiming a
            streak the server has not counted would be the client clock
            backing a streak — the forbidden direction. Because the gate only
            opens after the server holds the day, the fetched number includes
            today by construction. Unfetched and offline states render the
            shipped absence, which is today's state and therefore honest. */}
        {syncOutcome === "recorded" && <StreakCard />}
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
             (plan 018 S21, deviation 11). The pair is set on the element
             rather than the root so the rest of the screen keeps the accent
             of the game being celebrated — and so the LABEL follows the fill
             it is painted on rather than the page it sits on, which is what
             makes this button legible when it chains to Nonogram from the
             shipped binairo and sudoku conclusions (step-6 finding ISS-A2). */
          <Link
            className={`${styles.cta} ${styles.ctaNext}`}
            style={accentVars(next.game)}
            href={next.route}
          >
            {messages.conclusion.ctaNext(messages.games[next.game].name)}
          </Link>
        )}
        {/* Live since #29: /estatisticas is a real route, so the link
            carries it — the same rule that kept it href-less while a dead
            href would have been fake navigation. */}
        <Link className={styles.secondaryLink} href={routes.stats}>
          {messages.conclusion.stats}
        </Link>
      </aside>
    </main>
  );
}

/**
 * The streak card (#19, ADR-0048) — F5:54-56's sealing-wax card, first in
 * the side column. The CALLER gates it on `syncOutcome === "recorded"`, so
 * this component's own machine has three states:
 *
 * - fetch in flight → the card at final dimensions with the values blanked
 *   (the `PlaySkeleton` discipline: reserve the boxes, blank the values —
 *   `BLANK_VALUE`'s U+00A0 keeps each line box open).
 * - fetch settled without a value (`null`) → unmount back to the shipped
 *   absence, which is today's state and therefore honest.
 * - fetch resolved → the numeral and its line — INCLUDING a fetched zero
 *   (a late win or a lost-only day with no prior history): that zero is
 *   real server data, not the fake zero the pre-#19 conclusion refused to
 *   invent. The italic tail renders only when `todayCounts` says today
 *   itself maintained the streak (ADR-0048 decision 2, ADR-0008 rules 1–3).
 *
 * `--accent-app`, never the game accent: the streak is app identity (the
 * hub stamp's rule, DESIGN.md), and both accent-text declarations are
 * ADR-0041 decision 1 exceptions measured at 6.2980:1 on `--paper-card`
 * (`ink-on-accent.test.ts` names them one by one).
 */
function StreakCard() {
  const streak = useStreak();
  if (streak === null) {
    return null;
  }
  const loaded = streak !== undefined;
  return (
    <section
      className={styles.streakCard}
      aria-label={
        loaded ? messages.conclusion.streak.aria(streak.streak) : undefined
      }
      aria-hidden={loaded ? undefined : true}
      data-streak-state={loaded ? "value" : "skeleton"}
    >
      <span aria-hidden className={styles.streakCardNumeral}>
        {loaded ? streak.streak : BLANK_VALUE}
      </span>
      <span aria-hidden className={styles.streakCardLabel}>
        {loaded ? messages.conclusion.streak.value(streak.streak) : BLANK_VALUE}
        {loaded && streak.todayCounts && (
          <>
            <br />
            <em className={styles.streakCardTail}>
              {messages.conclusion.streak.maintained}
            </em>
          </>
        )}
      </span>
    </section>
  );
}

/**
 * The stamp three games have shipped since #18: a label, a duration and a
 * hints line, announced as ONE composite sentence rather than three
 * fragments — ARIA does not name a generic element, and "Concluído 06:47 sem
 * dicas" read as three unrelated strings is not the sentence the copy module
 * already composes.
 */
function ShippedStamp({
  title,
  stamp,
}: {
  readonly title: string;
  readonly stamp: ConclusionResult;
}) {
  const elapsed = formatElapsed(stamp.elapsedMs);

  return (
    <div
      className={styles.stamp}
      role="img"
      aria-label={messages.conclusion.stampAria(
        title,
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
  );
}

/**
 * The stamp a game with TWO terminal states supplies for itself (#27,
 * ADR-0043 decisions 3 and 5). TWO slots, not three: `label` and `detail`.
 *
 * On a WIN the big slot is the guess count where a grid game shows a time,
 * and there is no hints line, because neither is honest for Termo — the clock
 * is never rendered and "sem dicas" would present as a virtue something that
 * was never possible (ADR-0045 decisions 3 and 4).
 *
 * On a LOSS the win's stamp is stepped down three ways at once and the third
 * is the loudest: a 1.5px ring instead of 3px, `--ink-2` instead of the
 * accent (5.3003:1 on `--paper-card`), and NO settle animation. There is no
 * consolation flourish, no second stamp design, no mascot and no emoji — the
 * loss equivalent of the celebration is the celebration's absence, and saying
 * so here is what stops the next contributor from inventing one. No
 * `.stampTime`, no hints line and no `elapsedMs` reach this component at all:
 * a time on a game nobody won is the same lie `day-state.ts` already refuses
 * for a part-played board.
 *
 * `.stampStill` is DERIVED from `state` rather than read off a second field.
 * A `settle: boolean` on the prop was speculative generality — every caller
 * and every test paired it exactly with `state`, so its two other
 * combinations were unreachable and untestable (finding B-11). One fact, one
 * field.
 */
function OutcomeStamp({ outcome }: { readonly outcome: ConclusionOutcome }) {
  const lost = outcome.state === "lost";
  const chrome = [
    styles.stamp,
    lost ? styles.stampLost : "",
    lost ? styles.stampStill : "",
  ]
    .filter((name) => name !== "")
    .join(" ");

  return (
    <div className={chrome} role="img" aria-label={outcome.aria}>
      <span aria-hidden className={styles.stampLabel}>
        {outcome.label}
      </span>
      <span aria-hidden className={styles.stampGuesses}>
        {outcome.detail}
      </span>
    </div>
  );
}

/**
 * The first daily this device can still play today, in the day's order — AC
 * 3's "the conclusion chains to the next pending daily" (plan 018 S21).
 *
 * Understating is safe here for the same reason it is on the hub: the worst
 * a stale `pending` does is offer a game the player already solved on another
 * device, and `/<jogo>` restores straight into its conclusion (ADR-0031).
 *
 * The chain is on `"pending"` ALONE, never on "not completed" (#27, ADR-0044
 * decision 5). A lost Termo is *played*: its six guesses are spent and the
 * CTA's own contract is "the first daily this device can still play today",
 * so re-offering it would send the player to a board with no turns left.
 */
function nextPendingDaily(
  entryOf: (game: Game) => DayEntry,
): { readonly game: Game; readonly route: Route } | undefined {
  const game = DAY_GAMES.find(
    (candidate) => entryOf(candidate).status === "pending",
  );
  return game === undefined ? undefined : { game, route: playRoutes[game] };
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
  // THE GUARD IS SPLIT, and the split is what #27 needed (plan 022 §15.3).
  // The shipped form was `const elapsedMs = entry.concluded ? entry.elapsedMs
  // : undefined; const done = elapsedMs !== undefined;` — one guard doing two
  // jobs, so a COMPLETED entry with no duration fell straight through to
  // `falta`. A won Termo is exactly that entry: it publishes no duration
  // (ADR-0045 decision 4), so the single guard would have printed `falta`
  // next to a game the player had just won.
  //
  // `done` is now the STATUS, and the duration's presence only chooses which
  // done string to print. Narrowing through the value rather than through the
  // status is still what keeps a non-null assertion out and stops an entry
  // that somehow lost its duration from rendering "undefined".
  const done = entry.status === "completed";
  const value =
    done && entry.elapsedMs !== undefined
      ? formatElapsed(entry.elapsedMs)
      : done
        ? messages.conclusion.dayCard.done
        : entry.status === "played"
          ? messages.conclusion.dayCard.played
          : messages.conclusion.dayCard.missing;
  return (
    <div
      className={`${styles.chip} ${
        done
          ? styles.chipDone
          : entry.status === "played"
            ? styles.chipPlayed
            : styles.chipMissing
      }`}
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
      <span className={styles.chipValue}>{value}</span>
    </div>
  );
}

"use client";

import {
  TERMO_MAX_GUESSES,
  timeBucketIndex,
  type DayGameState,
  type Game,
  type StatsResponse,
} from "@miolos/core";
import Link from "next/link";
import { useEffect, type ReactNode } from "react";

import {
  formatElapsed,
  formatLongDate,
  formatShortDate,
  messages,
  playRoutes,
  routes,
  type Route,
} from "../i18n";
import { useStats } from "../stats/use-stats";
import { useStreak } from "../streak/use-streak";
import { accentVars } from "./accent";
import styles from "./conclusion-view.module.css";
import { useDayState, useServerDayClaim, type DayEntry } from "./day-state";
import { picturePath } from "./picture-path";
import { BLANK_VALUE, ShareButton } from "./share-button";
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
 * The frame's three deliberate absences are all filled now. #29 took two:
 * the stat rows with their histogram and the closing italic line are live
 * below (`ConclusionStats`), server-computed and gated on the day being on
 * the server exactly like the streak card (ADR-0048 decision 4, plan 033
 * D13), so every unfetched state stays exactly as honest as the old absence.
 * #34 took the third: `ShareButton` composes a spoiler-free text — game,
 * date, result, and for Termo the grid of server verdicts — and hands it to
 * the share sheet or the clipboard. The rule that kept it out is DISCHARGED
 * rather than abandoned: ADR-0045 `:186-191` rejects a share button that
 * promises an action the product does not have, and this one performs it.
 * *(**Amended at #103** — it was "at the foot of this file" until the
 * archive's late-result panel needed the same control. It lives in
 * `play/share-button.tsx` now, imported here and by `archive/late-result.tsx`,
 * and nothing about what it says or how it delivers it changed. It could not
 * simply be imported FROM here: `T-WEB-S183` bans this module from every
 * `app/arquivo/**` graph, because `useDayState(date)` below fires
 * `GET /streak` and chains to TODAY's routes.)*
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
  // What THE USER's day looks like as this device and the server together
  // know it (ADR-0031 as amended by ADR-0060). Since #83 a game solved on
  // another device no longer reads `falta` here: this surface carries the
  // merged answer too, because `useDayState` is the ONE seam and there is no
  // second spelling of it. A cold profile still reads everything pending —
  // `/day` answers 401 with no session — and the local reader is the whole
  // answer whenever the fetch does not land, which is what lets this screen
  // finish offline.
  const dayState = useDayState(date);
  // The server's claim about THIS game (#142, ADR-0065) — hoisted here by
  // the rules of hooks, consumed only by the empty branch below, where a
  // day decided on another device renders the remote conclusion instead of
  // the "ainda não concluiu" card. Every branch that reads a LOCAL proof
  // (the skeleton, the loss, the result) stays ahead of it untouched.
  const claim = useServerDayClaim(date, game);

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
    // No local proof — and, since #142, the server may hold one anyway: a
    // claim here means the day was decided on another device, so the honest
    // answer is the remote conclusion, never a "Jogar" card into a board
    // whose day is already written (ADR-0065, amending ADR-0060 decision 8).
    if (claim !== undefined) {
      return (
        <RemoteConclusionView
          game={game}
          date={date}
          copy={copy}
          claim={claim}
        />
      );
    }
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
  // A game that passes no `outcome` gets exactly the day entry it got before
  // this prop existed. Scoped to the day entry deliberately (#34): the claim
  // used to be about the whole render, and the share block — which reads
  // neither `outcome` nor the day state — makes that version false.
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
        <ConclusionCardHead copy={copy} />
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
             nothing is composed here), and focus still never moves
             programmatically: a role="status" announces without stealing the
             caret, which is the mechanism PRODUCT.md's "nothing nags" points
             at. That a live region MOUNTING with content is spoken is an AT
             behaviour jsdom cannot prove; it rides the one real
             VoiceOver/NVDA pass ADR-0042 consequence (e) already owes.

             #34 FALSIFIED ONE CLAUSE THAT USED TO STAND HERE, and it is
             deleted rather than softened: "games that pass no `outcome`
             render no region and are byte-identical". The share button's
             own role="status" region renders on the result and lost
             branches of ALL FOUR games, gated on neither `outcome` nor
             game, so three conclusions gained a live region. ADR-0043
             decision 10 carries the same repair, and ADR-0054 decision 4
             carries the DISJOINT-WRITERS rule ADR-0042 decision 10 requires
             of any screen with two of these: this region's text is a prop
             composed before mount and no transition here ever writes it,
             while the share region's text is written only by the click
             handler and its own timeout. Only one of the two can mutate at
             all after mount. */
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
        {/* The StreakCard's gate, on the stat block too (ADR-0048 decision
            4, plan 033 D13). The REAL invariant it buys (stated exactly —
            step-6 F4): `recorded` guarantees the just-finished game's ROW
            is on the server, so every aggregate the block renders includes
            it. It does NOT guarantee the server still holds the record's
            day AS today — a retry landing after the SP midnight records
            the solve as a LATE win, excluded from histogram/best/average.
            The today-decorations (bucket highlight, closing line) therefore
            additionally require `stats.date === date` inside the block.
            Offline/pending/rejected states render the shipped absence,
            which is honest. */}
        {syncOutcome === "recorded" && (
          <ConclusionStats game={game} date={date} result={stamp} lost={lost} />
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

      <ConclusionAside
        // Gated on the day being ON THE SERVER (plan 027 D8): a conclusion
        // reached offline has syncOutcome "pending", and a card claiming a
        // streak the server has not counted would be the client clock
        // backing a streak — the forbidden direction. Because the gate only
        // opens after the server holds the day, the fetched number includes
        // today by construction. Unfetched and offline states render the
        // shipped absence, which is today's state and therefore honest.
        streak={syncOutcome === "recorded"}
        entryOf={dayEntry}
        next={next}
        share={
          <ShareButton game={game} date={date} stored={stored} stamp={stamp} />
        }
      />
    </main>
  );
}

/**
 * The cross-device completed view (#142, ADR-0065): the day was decided on
 * ANOTHER device — `claim` is the server's own claim for this game, never
 * `pending` (the `useServerDayClaim` seam) — and this device holds no
 * record, so the play route renders the conclusion the server can honestly
 * back instead of a fresh playable board.
 *
 * CO-LOCATED in this file, not a sibling module. The naive TWO-file split
 * really would import in both directions — this view composes
 * `ConclusionView`'s own internals (`ConclusionTopBar`, `ConclusionCardHead`,
 * `ConclusionAside`, `ShippedStamp`, `OutcomeStamp`, `ConclusionStatsBody`)
 * while `ConclusionView`'s empty branch renders IT (plan 060 §3) — but that
 * is not the only alternative: the shared leaves have no back-reference into
 * either view, so a THREE-file split (`conclusion-parts.tsx` holding the
 * leaves, both views importing DOWN into it, `conclusion-view.tsx` importing
 * `remote-conclusion-view.tsx` one way) has no cycle. Co-location stands as
 * the smaller change at this file's current weight; the leaf-module split is
 * the recorded, viable follow-up refactor if the file keeps growing (#142
 * step-6 quality M3).
 *
 * WHAT IT RENDERS is bounded by what the server stores (plan 060 §1):
 *
 * - a completed GRID game: the real stamp from the claim — the server-held
 *   time and hint count, PER LINE (a deploy-skew claim carries the time and
 *   no hint count; the stamp renders the line it has and never fabricates a
 *   "sem dicas") — the stat block, the streak card, the day card and the
 *   next-pending CTA. No picture: Nonogram's bitmap is the solution, which
 *   is puzzle content and never on this wire (ADR-0004, ADR-0060 decision 2).
 * - a completed TERMO: the win stamp with `em X/6` from the ONE `GET /stats`
 *   this view fetches (date-gated, the `TermoDoneLink` rule; label-only
 *   when the count has not landed or describes another day), and the guess
 *   distribution. No guess grid and no answer word: neither is stored — the
 *   guess route is stateless and the word has no read channel — and syncing
 *   them would be its own ticket if ever wanted (ADR-0065), none is filed.
 * - a PLAYED Termo: the loss stamp shape, no celebration (ADR-0043's loss
 *   discipline), no time, no word.
 *
 * THE `game === "termo"` BRANCH BELOW CROSSES ADR-0029 DECISION 2 — the
 * shared conclusion is game-blind; per-game JSX composes in per-game
 * modules, and `termo-conclusion.tsx` states that rule with this exception
 * annotated. The crossing is forced, not chosen: `ConclusionCopy` is plain
 * data across the RSC boundary (types.ts — a function member there is an
 * SSR 500), so `wonDetail(guesses, max)` cannot arrive pre-composed, and
 * this stamp's detail exists only after a CLIENT fetch (`GET /stats`)
 * resolves. This is the ONLY per-game JSX branch permitted in this module;
 * a fifth game adds a claim field, never an arm.
 *
 * NO SHARE BUTTON (`share-text.ts` composes from the local record, which
 * does not exist here), NO REPLAY (no link into a playable board renders
 * anywhere on this view), and THE CLAIM NEVER BECOMES A PLAY RECORD: no
 * CONCLUDED record is ever synthesised from it (ADR-0060 decision 4
 * verbatim). On `/<jogo>` the play lifecycle behind this view keeps
 * writing its own PLAYING record exactly as it did before #142, and an
 * in-progress record survives the swap untouched — this view is a
 * projection of the claim, and it dies with the evidence for it: the date
 * gate retires the payload at the SP rollover and the playable board
 * returns, which is the understating direction the hub already ships.
 *
 * STATS AND STREAK GATE ON THE CLAIM ITSELF, not on `syncOutcome ===
 * "recorded"`: a server claim is strictly stronger evidence than
 * `recorded` — the row IS on the server, which is all `recorded` ever
 * proved. `useStats()` is called ONCE, here, and handed down as a prop
 * (`ConclusionStatsBody`); `StreakCard` keeps its own `useStreak`.
 */
export function RemoteConclusionView({
  game,
  date,
  copy,
  claim,
}: {
  readonly game: Game;
  readonly date: string;
  readonly copy: ConclusionCopy;
  readonly claim: DayGameState;
}) {
  const dayState = useDayState(date);
  // The ONE stats fetch (plan 060 §3): the Termo stamp's `em X/6` and the
  // distribution both read this value; a second hook call site would be a
  // second credentialed GET.
  const stats = useStats();
  const accent = accentVars(game);
  const played = claim.status === "played";
  const remote = messages.conclusion.remote;

  // The merged day state already carries this game's server claim (the
  // local side is pending — this view only mounts where no local record
  // closed the day), so the chips and the chain read the same one seam
  // every other conclusion reads.
  const next = nextPendingDaily((dayGame) => dayState[dayGame]);

  return (
    <main
      className={`${styles.page} ${styles.pageResult}`}
      style={accent}
      data-conclusion-state={played ? "lost" : "result"}
      data-conclusion-remote=""
    >
      <ConclusionTopBar date={date} kicker={copy.kicker} />

      <article className={styles.resultCard}>
        <ConclusionCardHead copy={copy} />
        <div className={styles.stampRow}>
          {game === "termo" ? (
            <RemoteTermoStamp
              title={copy.title}
              played={played}
              guesses={remoteTermoGuesses(stats, date)}
            />
          ) : (
            <RemoteShippedStamp title={copy.title} claim={claim} />
          )}
        </div>
        {/* ADR-0043 decision 10's live region, mirroring `ConclusionView`'s
            own announcer: decision 6 of ADR-0065 makes the in-place swap
            REAL for this view — a poll tick can replace an active board
            mid-solve — and on an in-place swap focus falls to <body>, so
            without a role="status" a blind player gets no account of why
            the board vanished. The text is the card's own explanatory
            sentence, externalised above; it is composed before mount and no
            transition ever rewrites it, and this view renders no share
            region, so ADR-0054 decision 4's disjoint-writers rule holds
            trivially. */}
        <p role="status" className={styles.announcer}>
          {played ? remote.playedBody : remote.completedBody}
        </p>
        <p className={styles.remoteNote}>
          {played ? remote.playedNote : remote.completedNote}
        </p>
        <p className={styles.remoteBody}>
          {played ? remote.playedBody : remote.completedBody}
        </p>
        {/* Gated on the CLAIM, which this whole view already is — see the
            header. `null` (the fetch settled without a value) unmounts to
            the shipped absence, exactly like the local path. */}
        {stats !== null && (
          <ConclusionStatsBody
            game={game}
            date={date}
            stats={stats}
            elapsedMs={claim.elapsedMs}
            // The DAY verb in, the BOARD verb out — deliberately, the same
            // crossing `data-conclusion-state` above performs and the note
            // on `ConclusionView`'s own root explains: `played` is
            // CONTEXT.md's day verb (the claim's status), while `lost` is
            // the board verb this presentational body's fail-row highlight
            // is named for. Only Termo can be `played`, and a played Termo
            // IS a lost board.
            lost={played}
          />
        )}
      </article>

      <ConclusionAside
        // The claim replaces `syncOutcome === "recorded"` as the streak
        // card's gate: the row is on the server — that is what a claim IS —
        // so the fetched number includes this day by the same construction
        // the local gate buys.
        streak
        entryOf={(dayGame) => dayState[dayGame]}
        next={next}
      />
    </main>
  );
}

/**
 * The Termo guess count the remote stamp may honestly caption — the
 * `TermoDoneLink` rule verbatim: the server's own today value, only when
 * the server's day IS the rendered day (`stats.date === date`), and
 * `todayTermoGuesses` can be null even then (the value describes
 * `stats.date`, not this screen). Anything else answers `undefined` and
 * the stamp renders label-only, which claims nothing false.
 */
function remoteTermoGuesses(
  stats: StatsResponse | null | undefined,
  date: string,
): number | undefined {
  return stats !== null &&
    stats !== undefined &&
    stats.date === date &&
    stats.todayTermoGuesses !== null
    ? stats.todayTermoGuesses
    : undefined;
}

/**
 * The remote grid stamp, composed PER LINE from the claim (plan 060 §3):
 *
 * - time AND hint count → the local `ShippedStamp` itself, so the remote
 *   stamp is byte-identical to a local one by construction (`T-WEB-S257`'s
 *   discipline, pinned at `T-WEB-S275`);
 * - time alone — the deploy-skew claim an old server publishes to a new
 *   client — → the label and the time line, the hints line OMITTED. Never
 *   a fabricated `hintsUsed: 0`: "sem dicas" is a claim about the solve,
 *   and this device holds no evidence for it;
 * - neither → the label alone. (A hint count without a time is unreachable
 *   through the shipped producer — both come off the same NOT NULL row —
 *   and falls to the label-only arm, which understates and never lies.)
 */
function RemoteShippedStamp({
  title,
  claim,
}: {
  readonly title: string;
  readonly claim: DayGameState;
}) {
  if (claim.elapsedMs !== undefined && claim.hintsUsed !== undefined) {
    return (
      <ShippedStamp
        title={title}
        stamp={{ elapsedMs: claim.elapsedMs, hintsUsed: claim.hintsUsed }}
      />
    );
  }
  if (claim.elapsedMs === undefined) {
    return (
      <div
        className={styles.stamp}
        role="img"
        aria-label={messages.conclusion.remote.stampBareAria(title)}
      >
        <span aria-hidden className={styles.stampLabel}>
          {messages.conclusion.stampLabel}
        </span>
      </div>
    );
  }
  const elapsed = formatElapsed(claim.elapsedMs);
  return (
    <div
      className={styles.stamp}
      role="img"
      aria-label={messages.conclusion.remote.stampTimeAria(title, elapsed)}
    >
      <span aria-hidden className={styles.stampLabel}>
        {messages.conclusion.stampLabel}
      </span>
      <span aria-hidden className={styles.stampTime}>
        {elapsed}
      </span>
    </div>
  );
}

/**
 * The remote Termo stamp: the same `OutcomeStamp` the local conclusion
 * renders, with its slots composed from what the SERVER holds. On a win the
 * detail is `X/6` from `GET /stats` (the `remoteTermoGuesses` gate above);
 * where the count has not landed the stamp is label-only rather than a
 * fabricated fraction. On a loss it is the loss shape whole — stepped-down
 * chrome, no settle, no time, no consolation flourish (ADR-0043).
 */
function RemoteTermoStamp({
  title,
  played,
  guesses,
}: {
  readonly title: string;
  readonly played: boolean;
  readonly guesses: number | undefined;
}) {
  const copy = messages.games.termo.outcome;
  if (played) {
    return (
      <OutcomeStamp
        outcome={{
          state: "lost",
          label: copy.lostLabel,
          detail: copy.lostDetail(TERMO_MAX_GUESSES),
          aria: copy.lostAria(TERMO_MAX_GUESSES),
        }}
      />
    );
  }
  if (guesses === undefined) {
    return (
      <div
        className={styles.stamp}
        role="img"
        aria-label={messages.conclusion.remote.stampBareAria(title)}
      >
        <span aria-hidden className={styles.stampLabel}>
          {copy.wonLabel}
        </span>
      </div>
    );
  }
  return (
    <OutcomeStamp
      outcome={{
        state: "result",
        label: copy.wonLabel,
        detail: copy.wonDetail(guesses, TERMO_MAX_GUESSES),
        aria: copy.wonAria(guesses, TERMO_MAX_GUESSES),
      }}
    />
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
 * The stat block (#29, plan 033 §6.4/D13) — F5's main-card composition:
 * the three stat rows, the 6-bucket histogram with TODAY's bucket
 * highlighted, and the closing italic line for the timed games; the 7-row
 * guess distribution with today's row highlighted for Termo, on both
 * outcomes (ADR-0043's loss state included). No Termo time exists anywhere
 * (ADR-0045 decision 4).
 *
 * The CALLER gates it on `syncOutcome === "recorded"` (the StreakCard's
 * mechanism), so this component's own machine has the same three states:
 * fetch in flight → the block at final dimensions with values blanked
 * (`BLANK_VALUE`); settled without a value → unmount back to the shipped
 * absence; resolved → the numbers, which include today's game — as a row —
 * by the gate's construction.
 *
 * `recorded` proves the ROW is on the server; it does NOT prove the server
 * still holds `date` as its today (a retry across the SP midnight records
 * a LATE win, absent from histogram/best/average). So the
 * today-decorations — the bucket highlight and the closing line — require
 * `stats.date === date` on top (the `TermoDoneLink` day-match rule,
 * step-6 F4), and a bucket is only ever highlighted when its own count is
 * nonzero: no claim the server doesn't hold.
 *
 * Today's bucket comes from the LOCAL duration (`result`), today's Termo
 * row from `todayTermoGuesses` on a win (its second call site) and the
 * fail row from the local outcome on a loss. The markup is a per-sheet
 * sibling of the stats screen's own (`app/estatisticas/stats-view.tsx`),
 * not a shared component — CSS Modules hash per file, the
 * `hub-day-state.tsx` reason.
 */
function ConclusionStats({
  game,
  date,
  result,
  lost,
}: {
  readonly game: Game;
  readonly date: string;
  readonly result: ConclusionResult | undefined;
  readonly lost: boolean;
}) {
  const stats = useStats();
  if (stats === null) {
    return null;
  }
  return (
    <ConclusionStatsBody
      game={game}
      date={date}
      stats={stats}
      elapsedMs={result?.elapsedMs}
      lost={lost}
    />
  );
}

/**
 * The stat block's PRESENTATIONAL body, split from `ConclusionStats` at
 * #142 so the remote view can feed it the ONE `useStats()` answer it
 * already fetched for the Termo stamp's `em X/6` — two hook call sites
 * would be two credentialed GETs (plan 060 §3). The local path above keeps
 * its own hook and renders this same body: zero change there.
 *
 * `stats` still has the three-state contract `useStats` defines, minus the
 * `null` arm both callers unmount on. `elapsedMs` replaced the
 * `ConclusionResult` prop because it is the only field this body ever read
 * — and the remote claim may carry a time WITHOUT a hint count (deploy
 * skew), which `ConclusionResult` cannot spell without fabricating a 0.
 */
function ConclusionStatsBody({
  game,
  date,
  stats,
  elapsedMs,
  lost,
}: {
  readonly game: Game;
  readonly date: string;
  readonly stats: StatsResponse | undefined;
  readonly elapsedMs: number | undefined;
  readonly lost: boolean;
}) {
  const loaded = stats !== undefined;
  // The server holds the record's day AS its today: string equality on
  // the contract's own `date`, the TermoDoneLink rule.
  const dayMatches = loaded && stats.date === date;
  if (game === "termo") {
    const counts = loaded
      ? stats.termo.distribution
      : ([0, 0, 0, 0, 0, 0, 0] as const);
    const max = Math.max(...counts, 1);
    // On a loss the fail row is today's — a lost row is in the fail row
    // UNQUALIFIED (ADR-0008 rule 3), so the highlight is honest on any
    // day the server holds. On a win, the server's own today value —
    // never the local guess count — and only when the server's day IS the
    // record's day: `todayTermoGuesses` describes `stats.date`, not this
    // screen (otherwise nothing is highlighted, honestly).
    const todayRow = lost
      ? 6
      : loaded && dayMatches && stats.todayTermoGuesses !== null
        ? stats.todayTermoGuesses - 1
        : undefined;
    return (
      <div
        className={styles.statsBlock}
        aria-hidden={loaded ? undefined : true}
        data-stats-state={loaded ? "value" : "skeleton"}
      >
        <div className={styles.distribution}>
          {counts.map((count, index) => {
            const fail = index === 6;
            return (
              <div
                key={fail ? messages.stats.termo.fail : index + 1}
                role="img"
                aria-label={
                  fail
                    ? messages.stats.termo.failAria(count)
                    : messages.stats.termo.rowAria(index + 1, count)
                }
                className={styles.distRow}
                data-today={todayRow === index ? "" : undefined}
              >
                <span
                  aria-hidden
                  className={`${styles.distLabel} tabular-nums`}
                >
                  {fail ? messages.stats.termo.fail : index + 1}
                </span>
                <div aria-hidden className={styles.distTrack}>
                  <div
                    className={styles.distBar}
                    style={{ width: `${String((count / max) * 100)}%` }}
                  />
                </div>
                <span
                  aria-hidden
                  className={`${styles.distCount} tabular-nums`}
                >
                  {loaded ? count : BLANK_VALUE}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  const block = loaded ? stats[game] : undefined;
  const counts = block?.histogram ?? ([0, 0, 0, 0, 0, 0] as const);
  const max = Math.max(...counts, 1);
  // The CALLER's duration — the local record's on the local path, the
  // server claim's on the remote one (#142); either way it is the number
  // the stamp on the same card already shows, so this bucket is "where
  // today's solve landed". No duration → no bucket highlighted; and no
  // highlight either unless the server holds the day AS today — a late
  // win is absent from the histogram, so its bucket may hold a count the
  // solve is not in (possibly zero). The render additionally marks only a
  // bucket whose own count is nonzero: the highlight claims "your solve
  // is in this bar", and an empty bar holds nothing to claim (step-6 F4).
  const todayBucket =
    elapsedMs === undefined || !dayMatches
      ? undefined
      : timeBucketIndex(elapsedMs);
  const name = messages.games[game].name;
  return (
    <div
      className={styles.statsBlock}
      aria-hidden={loaded ? undefined : true}
      data-stats-state={loaded ? "value" : "skeleton"}
    >
      <div className={styles.statRows}>
        <StatRow
          label={messages.stats.rows.best}
          value={
            block === undefined
              ? BLANK_VALUE
              : block.bestMs === null
                ? messages.stats.emptyValue
                : formatElapsed(block.bestMs)
          }
        />
        <StatRow
          label={messages.stats.rows.average}
          value={
            block === undefined
              ? BLANK_VALUE
              : block.averageMs === null
                ? messages.stats.emptyValue
                : formatElapsed(block.averageMs)
          }
        />
        <StatRow
          label={messages.stats.rows.solved(name)}
          value={block === undefined ? BLANK_VALUE : String(block.solved)}
        />
      </div>
      <div className={styles.histogram}>
        {counts.map((count, index) => (
          <div
            key={messages.stats.histogram.labels[index]}
            role="img"
            aria-label={messages.stats.histogram.aria(
              messages.stats.histogram.bucketNames[index] ?? "",
              count,
            )}
            className={styles.bucket}
            data-today={todayBucket === index && count > 0 ? "" : undefined}
          >
            <div aria-hidden className={styles.bucketTrack}>
              <div
                className={styles.bucketBar}
                style={{ height: `${String((count / max) * 100)}%` }}
              />
            </div>
            <span aria-hidden className={`${styles.bucketLabel} tabular-nums`}>
              {messages.stats.histogram.labels[index]}
            </span>
          </div>
        ))}
      </div>
      {/* F5:50's closing line, gated on the day-match AND the AVERAGE'S
          OWN sample population: `dayMatches` is what makes "today's row
          is in the 30-day sample" true — recorded alone proves only the
          ROW, and a late win is outside the average's population, where
          `>= 2` would lose its "today plus one other" meaning (step-6
          F4). With both, `>= 2` is today plus at least one other on-time
          win — the line never compares a value against a mean of itself
          alone. The comparison is against the INCLUSIVE average, which is
          honest because its direction always agrees with the exclusive
          one — x < mean(S ∪ {x}) ⇔ x < mean(S) for nonempty S — so F5's
          sentence stays true under either reading. Equal renders neither
          line. */}
      {loaded &&
        dayMatches &&
        elapsedMs !== undefined &&
        block !== undefined &&
        block.averageSampleCount >= 2 &&
        block.averageMs !== null &&
        elapsedMs !== block.averageMs && (
          <p className={styles.closingLine}>
            {elapsedMs < block.averageMs
              ? messages.conclusion.closingFaster
              : messages.conclusion.closingSlower}
          </p>
        )}
    </div>
  );
}

/** One F5 stat row: label in `--ink-2`, value tabular in `--ink`. */
function StatRow({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className={styles.statRow}>
      <span className={styles.statLabel}>{label}</span>
      <span className={`${styles.statValue} tabular-nums`}>{value}</span>
    </div>
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
 * The first daily THE USER can still play today, in the day's order — AC 3's
 * "the conclusion chains to the next pending daily" (plan 018 S21).
 *
 * SINCE #83 IT CHAINS ON THE MERGED STATE, not on this device's (ADR-0031 as
 * amended by ADR-0060). `entryOf` reads the merged `dayState`, so a game
 * solved on another device is no longer `pending` and is no longer offered
 * at all — the understatement this paragraph used to rest on is gone, and
 * with it the old claim that `/<jogo>` "restores straight into its
 * conclusion". That sentence is the exact one ADR-0060 decision 8 exists to
 * correct: the screen roots swap to `ConclusionView` off the LOCAL record
 * (`isClosedAndFrozen(play.state)`), so cross-device `/<jogo>` renders a
 * fresh, PLAYABLE board — ADR-0053 decision 10 layer 3's "honest gap", and
 * the replay writes nothing (layer 1).
 *
 * The chain is on `"pending"` ALONE, never on "not completed" (#27, ADR-0044
 * decision 5). A lost Termo is *played*: its six guesses are spent and the
 * CTA's own contract is "the first daily still playable today", so
 * re-offering it would send the player to a board with no turns left.
 */
function nextPendingDaily(
  entryOf: (game: Game) => DayEntry,
): { readonly game: Game; readonly route: Route } | undefined {
  const game = DAY_GAMES.find(
    (candidate) => entryOf(candidate).status === "pending",
  );
  return game === undefined ? undefined : { game, route: playRoutes[game] };
}

/**
 * The result card's head — tape, kicker, title — extracted at #142 step 7 so
 * the local and remote conclusions compose ONE head instead of two verbatim
 * copies (step-6 quality M2). The empty card keeps its own head: its title
 * class and copy differ, so folding it in would trade real variation for a
 * prop.
 */
function ConclusionCardHead({ copy }: { readonly copy: ConclusionCopy }) {
  return (
    <>
      <div aria-hidden className={styles.tape} />
      <p className={styles.cardKicker}>{copy.kicker}</p>
      <div className={styles.titleRow}>
        <h1 className={styles.title}>{copy.title}</h1>
      </div>
    </>
  );
}

/**
 * The conclusion's side column — streak card, "O dia até agora", the
 * next-pending CTA and the stats link — extracted at #142 step 7 so the
 * local and remote conclusions compose ONE aside instead of two drifting
 * copies (step-6 quality M2). The callers keep their own gates: `streak` is
 * the local path's `syncOutcome === "recorded"` and the remote path's
 * claim-backed `true`, each argued at its call site; `share` is the
 * `ShareButton` only where a local record exists to compose from, and the
 * remote view passes nothing. #145's push opt-in card, when it lands, is a
 * decision about THIS component's props — one place to reason about, not a
 * second <aside> to remember (ADR-0065 decision 8 assigns that ticket the
 * test arm).
 */
function ConclusionAside({
  streak,
  entryOf,
  next,
  share,
}: {
  readonly streak: boolean;
  readonly entryOf: (game: Game) => DayEntry;
  readonly next: { readonly game: Game; readonly route: Route } | undefined;
  readonly share?: ReactNode;
}) {
  return (
    <aside className={styles.side}>
      {streak && <StreakCard />}
      <section className={styles.dayCard}>
        <p className={styles.dayCardTitle}>
          {messages.conclusion.dayCard.title}
        </p>
        <div className={styles.chips}>
          {DAY_GAMES.map((dayGame) => (
            <DayChip key={dayGame} game={dayGame} entry={entryOf(dayGame)} />
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
      {share}
      {/* Live since #29: /estatisticas is a real route, so the link
          carries it — the same rule that kept it href-less while a dead
          href would have been fake navigation. */}
      <Link className={styles.secondaryLink} href={routes.stats}>
        {messages.conclusion.stats}
      </Link>
    </aside>
  );
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
 * One "O dia até agora" chip, read from the MERGED day state (ADR-0031 as
 * amended by ADR-0060, plan 018 §11.4). A game NEITHER this device nor the
 * server holds is honestly `falta` rather than a fake result; since #83 a
 * game with no local record but a completion row on the server reads done
 * here instead of `falta` — and together with the CTA the chips are the AC's
 * "points to the next pending daily" (plan 017 §12.3).
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

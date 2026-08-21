/**
 * Everything a play screen does that is not gameplay (ADR-0029, plan 018
 * §5.4), moved verbatim out of `use-binairo-play.ts`: the mount restore, the
 * timer's five effects and three listeners, both clobber guards, and the
 * single completion write handed to the queue.
 *
 * Two rules hold throughout, and both are load-bearing:
 * - **Nothing here runs during render** (plan 017 D28). `localStorage` is
 *   read once, in the mount effect; `Date.now()` appears only inside effects
 *   and event handlers, never in a value the first paint depends on. That is
 *   what makes the server snapshot and the first client paint identical.
 * - **The record is written by exactly one function**, the caller's
 *   `buildRecord`, so the queue's shape cannot drift between the "still
 *   playing" write and the closing one (§9.1).
 *
 * The terminal predicate is `status !== "playing"` everywhere — "the game is
 * CLOSED", never "the grid is solved". For Binairo the two coincide, which
 * is what keeps this extraction behaviour-free; Termo's loss (#27) is the
 * case that makes the distinction real.
 */
import type { Game } from "@miolos/core";
import { useEffect, useRef } from "react";

import { postPuzzleStarted } from "../telemetry/client";
import {
  prunePlayRecords,
  readPlayRecord,
  writePlayRecord,
  type PlayRecord,
} from "./play-record";
import { flushPendingCompletions, startCompletionSync } from "./sync";
import type { LifecycleAction, PlayCore } from "./types";

/**
 * **The close-detection predicate, and the one spelling of it** (#31 step-6
 * finding F15). The grid is CLOSED and the clock is FROZEN, in that order and
 * both terms required: gating on `status` alone renders the conclusion with a
 * time the `pause` dispatch below is about to correct by up to one tick, and
 * gating on the timer alone is true of a board that was merely paused.
 *
 * It lives here because this hook is where the fact is produced. Eight screens
 * consume it — the four daily roots and the four archive shells — and before
 * this export each of them re-typed the two conjuncts by hand, in three
 * different spellings, with the archive's own TSDoc saying *"exactly as
 * `use-play-lifecycle.ts` computes it"*: the seam noticed and stepped over.
 * That is the same move ADR-0053 decision 4 and `packages/db/src/published.ts`
 * refuse one package over, and it is refused here for the same reason —
 * ADR-0004-class guarantees may not have two enforcement points.
 *
 * A screen that wants the narrower "closed AND WON" writes
 * `isClosedAndFrozen(state) && state.status === "solved"`, so the extra
 * condition is visible as an extra condition instead of hiding inside a
 * re-typed conjunct.
 */
export function isClosedAndFrozen(state: PlayCore): boolean {
  return state.status !== "playing" && state.timer.runningSince === null;
}

export interface PlayLifecycle<S extends PlayCore> {
  readonly game: Game;
  readonly state: S;
  /**
   * The game's own reducer. The `pagehide` path computes the paused snapshot
   * locally AND dispatches the same action; purity is what makes the two
   * agree, so the hook must use the real reducer, never a private copy.
   */
  readonly reduce: (state: S, action: LifecycleAction) => S;
  readonly dispatch: (action: LifecycleAction) => void;
  /**
   * Build the record for `state` at `now`. The ONE place a record is built.
   * `closed` is the terminal flag, not `solved`: a Termo loss is a closed
   * game that writes a completion with `outcome: "lost"`.
   */
  readonly buildRecord: (state: S, now: number, closed: boolean) => PlayRecord;
  /**
   * The game-specific slice whose change means "the record's CONTENT
   * changed" — `[givens, entries, hintsUsed]` for Binairo,
   * `[givens, entries, hint.used]` for Sudoku.
   *
   * This exists because the persist-on-change effect's dependency array is
   * game-specific AND deliberately EXCLUDES `state.now`: the `tick` reducer
   * returns a NEW state object every second while `timer`, `entries` and
   * `hintsUsed` keep their identities. A hook that only sees `S extends
   * PlayCore` cannot reproduce that on its own — depending on `[state]`
   * would fire a readPlayRecord + Zod parse + JSON.stringify + setItem
   * EVERY SECOND for every game, and depending only on
   * `[state.hydrated, state.status, state.date, state.timer]` would never
   * fire on an entry change, so a tab crash would lose the board.
   * `buildRecord` cannot rescue it either: it takes `state` as an argument,
   * so the caller memoizes it on `[]` and the effect would never re-run.
   *
   * INVARIANT, and the reason this is a named input rather than a comment:
   * `state.now` must NEVER enter `persistDeps`. T-WEB-S33 pins it — ten
   * `tick` dispatches must produce zero `setItem` calls.
   */
  readonly persistDeps: readonly unknown[];
  /**
   * The SERVER already claims this game on this day (#33, ADR-0069) — the
   * cross-device case ADR-0065 renders as the remote completed view.
   *
   * It is an INPUT rather than a read, and that is an architectural
   * constraint rather than a preference. The claim lives in
   * `play/day-state.ts`, which reaches `src/day/**`, and the ARCHIVE's play
   * shells mount this hook: `archive-day.test.tsx` asserts that no archive
   * page's module graph contains either, because a user-specific read on a
   * public crawler-facing route is what ADR-0053 decision 9 forbids. So the
   * four DAILY screen roots — which already hold the claim for their own
   * render-time swap — pass it in, and the archive shells pass nothing,
   * where an archived date's claim is `undefined` by the payload's own date
   * gate anyway.
   *
   * Its ONLY effect is to suppress the `puzzle_started` report below: the
   * remote view is a finished day being looked at, not an attempt being
   * started, and counting it would inflate the start count of exactly the
   * multi-device population the event is measured over. Nothing else in
   * this hook reads it — the record write, the timer and the queue are all
   * unchanged, which is what keeps the swap render-time only.
   */
  readonly remotelyClaimed?: boolean;
}

export function usePlayLifecycle<S extends PlayCore>({
  game,
  state,
  reduce,
  dispatch,
  buildRecord,
  persistDeps,
  remotelyClaimed = false,
}: PlayLifecycle<S>): void {
  /**
   * CAPTURED AT THE FIRST RENDER AND NEVER UPDATED, deliberately. The
   * question the `puzzle_started` gate asks is "was this day already claimed
   * when this board mounted", and the mount effect below runs once — putting
   * the live value in that effect's dependency array would re-run the
   * restore, the prune and the sync registration every time a `GET /day`
   * lands behind the board.
   *
   * The honest consequence, recorded in ADR-0069: on a COLD direct load the
   * payload has not arrived at first render, so the report fires before the
   * remote view swaps in. The case the gate really covers is the warm one —
   * a client-side navigation from the hub, whose done tile links to the
   * BOARD route — where the store's retained payload is already there.
   */
  const claimedAtMount = useRef(remotelyClaimed);
  // Event handlers need the CURRENT state without re-registering listeners on
  // every keystroke; a ref synced each commit is the cheapest honest way.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  // The `pagehide` handler and the completion effect both need the caller's
  // latest closures without being torn down and rebuilt on every commit.
  const buildRef = useRef(buildRecord);
  const reduceRef = useRef(reduce);
  useEffect(() => {
    buildRef.current = buildRecord;
    reduceRef.current = reduce;
  });

  // A day that was already finished before this mount must never re-post:
  // the row is write-once server-side (D15), and re-queueing it would
  // resurrect a `pendingSync` the flush already settled (§12.3 re-entry).
  const restoredConcluded = useRef(false);
  const queued = useRef(false);

  const { date, timer, status, hydrated } = state;

  // The grid is CLOSED and the clock is frozen — through the exported
  // predicate, so this hook and the eight screens that gate on the same fact
  // read ONE definition of it (step-6 F15).
  const closedAndFrozen = isClosedAndFrozen(state);

  useEffect(() => {
    const record = readPlayRecord(game, date);
    restoredConcluded.current = record?.concluded === true;
    dispatch({ type: "restore", record, now: Date.now() });
    // The SERVER's date is the pruning boundary (ADR-0010): pruning against
    // a wrong client clock would delete a queue that was about to flush.
    prunePlayRecords(date);

    // "On mount of either route" is one of the five sync triggers (§9.2);
    // `online` and `visibilitychange` come with it. The conclusion registers
    // the same set for the bookmarked route — the module-level guards in
    // sync.ts make the overlap free.
    const stopSync = startCompletionSync();

    // THE `puzzle_started` SEAM (#33, ADR-0069 decision 2). The one
    // game-generic moment a fresh attempt begins, so all four games and the
    // archive are covered by one call and free play — which never mounts
    // this hook — by none. `record === undefined` is the whole freshness
    // test: a restored in-progress board and a concluded day both carry one,
    // and neither is a start.
    //
    // THE SECOND CONDITION IS THE CROSS-DEVICE ONE (#142, ADR-0065). A day
    // finished elsewhere opens the REMOTE COMPLETED VIEW on this device,
    // where no local record exists — the screen root's swap is render-time
    // only, so this hook mounts and this effect runs behind it. Reporting a
    // start there would count a completed day as a new attempt. The daily
    // roots pass the claim IN (`remotelyClaimed`; the interface says why it
    // may not be read here), and the archive passes nothing — an archived
    // date's claim is `undefined` by the payload's own date gate anyway.
    // T-WEB-S321 pins the gate.
    //
    // Fire-and-forget and never awaited: `postPuzzleStarted` returns `void`
    // synchronously and swallows every failure, so nothing on the play path
    // waits on telemetry (T-WEB-S316).
    if (record === undefined && !claimedAtMount.current) {
      postPuzzleStarted(game, date);
    }

    if (record?.concluded === true) {
      // A finished day never restarts its clock, and never invites a replay.
      return stopSync;
    }

    const pause = () => dispatch({ type: "pause", now: Date.now() });
    const resume = () => dispatch({ type: "resume", now: Date.now() });
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        resume();
      } else {
        pause();
      }
    };
    const onHide = () => {
      // Persist here rather than waiting for the effect below: a real
      // navigation away may never run another effect, and the record is the
      // only copy of the session. The reducer is pure, so computing the
      // paused snapshot and dispatching the same action cannot diverge.
      const now = Date.now();
      const paused = reduceRef.current(stateRef.current, {
        type: "pause",
        now,
      });
      stateRef.current = paused;
      dispatch({ type: "pause", now });
      if (paused.hydrated && paused.status === "playing") {
        persistUnlessConcluded(
          buildRef.current(paused, now, paused.status !== "playing"),
        );
      }
    };
    // `pageshow` without a paired `visibilitychange` is the bfcache case: on
    // the common iOS back-navigation an unpaired timer would stay paused for
    // the rest of the session and under-report the whole remaining play time.
    // Gated exactly like the initial resume below, for the same reason: a
    // document that LOADS hidden (a Cmd/middle-click from Hoje) gets a
    // `pageshow` with no `visibilitychange` behind it, and an ungated
    // handler would count every minute until the player opens the tab —
    // permanently, because `completions` is write-once (ADR-0026, finding
    // `pageshow-resumes-timer-in-a-hidden-tab`). A bfcache restore is
    // visible by definition, so the case this listener exists for is
    // untouched.
    const onShow = () => {
      if (
        document.visibilityState === "visible" &&
        stateRef.current.status === "playing"
      ) {
        resume();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onHide);
    window.addEventListener("pageshow", onShow);
    // Derived, not assumed: resuming a tab the player cannot see would count
    // time they never spent.
    if (document.visibilityState === "visible") {
      resume();
    }

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("pageshow", onShow);
      stopSync();
    };
  }, [game, date, dispatch]);

  // `tick` only nudges a re-render — the displayed value always comes from
  // `elapsedMs(timer, now)` — so a throttled background tab cannot drift it.
  // It stops the moment the grid closes: a frozen clock has nothing to say.
  useEffect(() => {
    if (!hydrated || status !== "playing") {
      return;
    }
    const interval = setInterval(
      () => dispatch({ type: "tick", now: Date.now() }),
      1000,
    );
    return () => clearInterval(interval);
  }, [hydrated, status, dispatch]);

  // Freeze the clock on the transition. The reducer cannot do it itself:
  // an entry action carries no `now`, and a reducer may never read one.
  useEffect(() => {
    if (status !== "playing" && timer.runningSince !== null) {
      dispatch({ type: "pause", now: Date.now() });
    }
  }, [status, timer, dispatch]);

  // Persist on every entry change, on pause and on resume (§9.1). Closed
  // states are excluded on purpose: the write below is their single,
  // final one, and re-running this effect afterwards would resurrect a
  // `pendingSync` that the flush had already settled.
  //
  // `state.now` is deliberately absent from these deps — see `persistDeps`.
  useEffect(() => {
    if (!hydrated || status !== "playing") {
      return;
    }
    persistUnlessConcluded(buildRef.current(state, Date.now(), false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `state` is depended on THROUGH `persistDeps`, never directly: `tick` returns a new state object every second while `timer` and the caller's slice keep their identities, so `[state]` would write a readPlayRecord + Zod parse + JSON.stringify + setItem cycle once a second, forever (plan 018 §5.4, landmine 21; T-WEB-S33). The spread is that contract, and it is the reason `persistDeps` is a named input rather than a comment.
  }, [game, hydrated, status, date, timer, ...persistDeps]);

  // The completion, written once and handed to the queue (§9.2). The record
  // carries the closing result, so the flush needs neither the givens nor a
  // mounted board — which is what makes "syncs on reconnect" true.
  useEffect(() => {
    if (!closedAndFrozen || restoredConcluded.current || queued.current) {
      return;
    }
    queued.current = true;
    const completion = buildRef.current(state, Date.now(), true);
    writePlayRecord(completion);
    // Handed to the flush directly, not left for it to find: where
    // `localStorage` is unavailable (DOM storage off in an Android WebView,
    // site data blocked) `writePlayRecord` is a no-op and the queue reads
    // back empty, so the completion would never be posted at all — the day
    // lost for the streak while the conclusion claimed it was saved
    // (finding `completion-lost-when-localstorage-is-unavailable`).
    void flushPendingCompletions(completion);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- same contract as the persist effect above, and `queued` masks a re-fire either way.
  }, [game, closedAndFrozen, date, ...persistDeps]);
}

/**
 * Persist, unless the stored record for that day is already a completion.
 * BOTH writers go through here, because both write the same key and neither
 * is rarer than the other: a second mounted play screen is still `playing`,
 * so its next entry change AND the `pagehide` its own "voltar" link fires
 * would each overwrite the record another tab has queued — clearing
 * `pendingSync` and dropping the solved `grid`, i.e. the only copy of a
 * completion the server has not acknowledged yet (findings
 * `in-progress-write-clobbers-a-queued-completion` and
 * `pagehide-write-still-clobbers-a-queued-completion`).
 */
function persistUnlessConcluded(record: PlayRecord): void {
  if (readPlayRecord(record.game, record.date)?.concluded === true) {
    return;
  }
  writePlayRecord(record);
}

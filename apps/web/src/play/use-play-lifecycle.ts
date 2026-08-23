/**
 * Nothing here runs during render: `localStorage` is read once, in the
 * mount effect; `Date.now()` appears only inside effects and event
 * handlers, never in a value the first paint depends on. That is what makes
 * the server snapshot and the first client paint identical.
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
 * CLOSED and FROZEN, both terms required: gating on `status` alone renders
 * the conclusion with a time the `pause` dispatch below is about to correct
 * by up to one tick, and gating on the timer alone is true of a board that
 * was merely paused.
 *
 * Eight screens consume it — the four daily roots and the four archive
 * shells — so it has exactly one definition. See ADR-0053 decision 4.
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
   * `closed` is the terminal flag, not `solved`: a Termo loss is a closed
   * game that writes a completion with `outcome: "lost"`.
   */
  readonly buildRecord: (state: S, now: number, closed: boolean) => PlayRecord;
  /**
   * The game-specific slice whose change means "the record's CONTENT
   * changed".
   *
   * INVARIANT: `state.now` must NEVER enter `persistDeps`. T-WEB-S33 pins it
   * — ten `tick` dispatches must produce zero `setItem` calls.
   */
  readonly persistDeps: readonly unknown[];
  /**
   * The SERVER already claims this game on this day (ADR-0069) — the
   * cross-device case ADR-0065 renders as the remote completed view.
   *
   * It is an INPUT rather than a read, and that is an architectural
   * constraint rather than a preference. The claim lives in
   * `play/day-state.ts`, which reaches `src/day/**`, and the ARCHIVE's play
   * shells mount this hook: `archive-day.test.tsx` asserts that no archive
   * page's module graph contains either. See ADR-0053 decision 10.
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
   * The question the `puzzle_started` gate asks is "was this day already
   * claimed when this board mounted", and the mount effect below runs once:
   * the live value in that effect's dependency array would re-run the
   * restore, the prune and the sync registration every time a `GET /day`
   * lands behind the board.
   */
  const claimedAtMount = useRef(remotelyClaimed);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  const buildRef = useRef(buildRecord);
  const reduceRef = useRef(reduce);
  useEffect(() => {
    buildRef.current = buildRecord;
    reduceRef.current = reduce;
  });

  const restoredConcluded = useRef(false);
  const queued = useRef(false);

  const { date, timer, status, hydrated } = state;

  const closedAndFrozen = isClosedAndFrozen(state);

  useEffect(() => {
    const record = readPlayRecord(game, date);
    restoredConcluded.current = record?.concluded === true;
    dispatch({ type: "restore", record, now: Date.now() });
    // The SERVER's date is the pruning boundary (ADR-0010): pruning against
    // a wrong client clock would delete a queue that was about to flush.
    prunePlayRecords(date);

    const stopSync = startCompletionSync();

    // The `puzzle_started` seam: ADR-0069 decision 2, pinned by T-WEB-S319,
    // T-WEB-S320 and T-WEB-S321.
    if (record === undefined && !claimedAtMount.current) {
      postPuzzleStarted(game, date);
    }

    if (record?.concluded === true) {
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
      // only copy of the session.
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

  useEffect(() => {
    if (!hydrated || status !== "playing") {
      return;
    }
    persistUnlessConcluded(buildRef.current(state, Date.now(), false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `state` is depended on THROUGH `persistDeps`, never directly: `tick` returns a new state object every second while `timer` and the caller's slice keep their identities, so `[state]` would write a readPlayRecord + Zod parse + JSON.stringify + setItem cycle once a second, forever (plan 018 §5.4, landmine 21; T-WEB-S33). The spread is that contract, and it is the reason `persistDeps` is a named input rather than a comment.
  }, [game, hydrated, status, date, timer, ...persistDeps]);

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

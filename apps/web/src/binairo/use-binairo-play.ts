/**
 * The React seam over the pure reducer (plan 017 §8.3, §9): timer
 * lifecycle, persistence and the sync triggers. Everything decidable
 * without React already lives in `state.ts`, `hint.ts`, `play-record.ts`
 * and `sync.ts` — this file only wires them to mount, to the document's
 * visibility and to the player's pointer.
 *
 * Two rules hold throughout, and both are load-bearing:
 * - **Nothing here runs during render** (D28). `localStorage` is read once,
 *   in the mount effect; `Date.now()` appears only inside effects and event
 *   handlers, never in a value the first paint depends on. That is what
 *   makes the server snapshot and the first client paint identical.
 * - **The record is written by exactly one function**, `buildRecord`, so
 *   the queue's shape cannot drift between the "still playing" write and
 *   the "solved" one (§9.1).
 */
import type { DailyPuzzleResponse } from "@miolos/core";
import { solveBinairo, type BinairoGrid } from "@miolos/games/binairo";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";

import type { BinairoHint } from "./hint";
import { nextHint } from "./hint";
import {
  prunePlayRecords,
  readPlayRecord,
  writePlayRecord,
  type PlayRecord,
} from "./play-record";
import {
  elapsedMs,
  initPlayState,
  isSolvedGrid,
  playReducer,
  type CellValue,
  type PaintMode,
  type PlayState,
  type TimerState,
} from "./state";
import { flushPendingCompletions, startCompletionSync } from "./sync";

/** Everything the play composition needs, and nothing it does not. */
export interface BinairoPlay {
  readonly state: PlayState;
  /** Milliseconds the readouts render; derived, never accumulated (D10). */
  readonly elapsed: number;
  /** Cells carrying a value, givens included — the frames' `{filled} de 64`. */
  readonly filled: number;
  /** False once the free hint is spent, the grid is closed, or nothing is left to reveal. */
  readonly hintReady: boolean;
  /** Which case the last hint fired, for the one-line explanation (§10.2). */
  readonly hintKind: BinairoHint["kind"] | null;
  readonly tapCell: (index: number) => void;
  readonly paintOver: (index: number) => void;
  /** Pressing the active mode's button returns to cycle mode (D8). */
  readonly toggleMode: (mode: PaintMode) => void;
  readonly revealHint: () => void;
}

export function useBinairoPlay(daily: DailyPuzzleResponse): BinairoPlay {
  const [state, dispatch] = useReducer(playReducer, daily, initPlayState);
  const [hintKind, setHintKind] = useState<BinairoHint["kind"] | null>(null);

  // Event handlers need the CURRENT state without re-registering listeners on
  // every keystroke; a ref synced each commit is the cheapest honest way.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  // A day that was already finished before this mount must never re-post:
  // the row is write-once server-side (D15), and re-queueing it would
  // resurrect a `pendingSync` the flush already settled (§12.3 re-entry).
  const restoredConcluded = useRef(false);
  const queued = useRef(false);

  const { date, givens, entries, timer, status, hydrated } = state;
  const hintsUsed = state.hint.used;
  const elapsed = elapsedMs(timer, state.now);
  const filled = countFilled(givens, entries);

  // ~0.1 ms for a published daily, memoized once per page (§10.1). `null`
  // is unreachable for a uniquely-solvable board but defined rather than
  // assumed away: it simply means no hint is available.
  const solution = useMemo(() => solveBinairo(givens), [givens]);

  // The grid is closed AND the clock is frozen. Gating the conclusion on
  // both is what keeps the stamp from rendering a time that the pause
  // dispatch below is about to correct by up to one tick.
  const solvedAndFrozen = status === "solved" && timer.runningSince === null;

  useEffect(() => {
    const record = readPlayRecord(date);
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
      // only copy of the session. `playReducer` is pure, so computing the
      // paused snapshot and dispatching the same action cannot diverge.
      const now = Date.now();
      const paused = playReducer(stateRef.current, { type: "pause", now });
      stateRef.current = paused;
      dispatch({ type: "pause", now });
      if (paused.hydrated && paused.status === "playing") {
        writePlayRecord(toRecord(paused, now));
      }
    };
    // `pageshow` without a paired `visibilitychange` is the bfcache case: on
    // the common iOS back-navigation an unpaired timer would stay paused for
    // the rest of the session and under-report the whole remaining play time.
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onHide);
    window.addEventListener("pageshow", resume);
    // Derived, not assumed: resuming a tab the player cannot see would count
    // time they never spent.
    if (document.visibilityState === "visible") {
      resume();
    }

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("pageshow", resume);
      stopSync();
    };
  }, [date]);

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
  }, [hydrated, status]);

  // Freeze the clock on the transition. The reducer cannot do it itself:
  // `tap` carries no `now`, and a reducer may never read one (§8.1).
  useEffect(() => {
    if (status === "solved" && timer.runningSince !== null) {
      dispatch({ type: "pause", now: Date.now() });
    }
  }, [status, timer]);

  // Persist on every entry change, on pause and on resume (§9.1). Solved
  // states are excluded on purpose: the write below is their single,
  // final one, and re-running this effect afterwards would resurrect a
  // `pendingSync` that the flush had already settled.
  useEffect(() => {
    if (!hydrated || status !== "playing") {
      return;
    }
    writePlayRecord(
      buildRecord({
        date,
        givens,
        entries,
        timer,
        hintsUsed,
        solved: false,
        now: Date.now(),
      }),
    );
  }, [hydrated, status, date, givens, entries, timer, hintsUsed]);

  // The completion, written once and handed to the queue (§9.2). The record
  // carries the solved MERGED grid, so the flush needs neither the givens
  // nor a mounted board — which is what makes "syncs on reconnect" true.
  useEffect(() => {
    if (!solvedAndFrozen || restoredConcluded.current || queued.current) {
      return;
    }
    queued.current = true;
    writePlayRecord(
      buildRecord({
        date,
        givens,
        entries,
        timer,
        hintsUsed,
        solved: true,
        now: Date.now(),
      }),
    );
    void flushPendingCompletions();
  }, [solvedAndFrozen, date, givens, entries, timer, hintsUsed]);

  const tapCell = useCallback((index: number) => {
    dispatch({ type: "tap", index });
  }, []);

  const paintOver = useCallback((index: number) => {
    dispatch({ type: "paint-over", index });
  }, []);

  const toggleMode = useCallback((mode: PaintMode) => {
    dispatch({
      type: "set-mode",
      mode: sameMode(stateRef.current.paint, mode) ? { kind: "cycle" } : mode,
    });
  }, []);

  const revealHint = useCallback(() => {
    if (solution === null) {
      return;
    }
    const current = stateRef.current;
    if (current.hint.used >= current.hint.free || current.status === "solved") {
      return;
    }
    // `nextHint` is deterministic (hint.ts), so selecting here and letting
    // the reducer select again cannot disagree. Reading the kind matters:
    // once the cell is revealed, a correction and a fill are indistinguishable.
    const hint = nextHint(solution, current.givens, current.entries);
    if (hint === null) {
      return;
    }
    setHintKind(hint.kind);
    dispatch({ type: "use-hint", solution });
  }, [solution]);

  return {
    state,
    elapsed,
    filled,
    hintReady:
      solution !== null && hintsUsed < state.hint.free && status === "playing",
    hintKind,
    tapCell,
    paintOver,
    toggleMode,
    revealHint,
  };
}

function countFilled(
  givens: BinairoGrid,
  entries: readonly CellValue[],
): number {
  let filled = 0;
  for (const [index, given] of givens.entries()) {
    if ((given ?? entries[index] ?? null) !== null) {
      filled += 1;
    }
  }
  return filled;
}

function sameMode(current: PaintMode, next: PaintMode): boolean {
  if (current.kind !== next.kind) {
    return false;
  }
  return current.kind === "paint" && next.kind === "paint"
    ? current.value === next.value
    : true;
}

/** `buildRecord` from a whole state — the `pagehide` path's shorthand. */
function toRecord(state: PlayState, now: number): PlayRecord {
  return buildRecord({
    date: state.date,
    givens: state.givens,
    entries: state.entries,
    timer: state.timer,
    hintsUsed: state.hint.used,
    solved: state.status === "solved",
    now,
  });
}

/**
 * The one place a `PlayRecord` is constructed (§9.1). `grid` is written
 * only for a solved board, because that is the only shape the completion
 * POST accepts and the only one the flush can rebuild a body from.
 * `elapsedMs` is clamped by `writePlayRecord`, never rejected — a rejecting
 * cap would discard a player's grid rather than a suspicious number.
 */
function buildRecord(input: {
  readonly date: string;
  readonly givens: BinairoGrid;
  readonly entries: readonly CellValue[];
  readonly timer: TimerState;
  readonly hintsUsed: number;
  readonly solved: boolean;
  readonly now: number;
}): PlayRecord {
  const merged: BinairoGrid = input.givens.map(
    (given, index) => given ?? input.entries[index] ?? null,
  );
  return {
    v: 1,
    game: "binairo",
    date: input.date,
    entries: [...input.entries],
    grid: input.solved && isSolvedGrid(merged) ? [...merged] : undefined,
    elapsedMs: elapsedMs(input.timer, input.now),
    hintsUsed: input.hintsUsed,
    concluded: input.solved,
    pendingSync: input.solved,
    syncOutcome: "pending",
  };
}

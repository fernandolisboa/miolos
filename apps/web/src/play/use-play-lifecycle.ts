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

export function isClosedAndFrozen(state: PlayCore): boolean {
  return state.status !== "playing" && state.timer.runningSince === null;
}

export interface PlayLifecycle<S extends PlayCore> {
  readonly game: Game;
  readonly state: S;

  readonly reduce: (state: S, action: LifecycleAction) => S;
  readonly dispatch: (action: LifecycleAction) => void;

  readonly buildRecord: (state: S, now: number, closed: boolean) => PlayRecord;

  readonly persistDeps: readonly unknown[];

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

    prunePlayRecords(date);

    const stopSync = startCompletionSync();

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `state` is depended on THROUGH `persistDeps`, never directly: `tick` returns a new state object every second while `timer` and the caller's slice keep their identities, so `[state]` would write a readPlayRecord + Zod parse + JSON.stringify + setItem cycle once a second, forever (T-WEB-S33). The spread is that contract, and it is the reason `persistDeps` is a named input rather than a comment.
  }, [game, hydrated, status, date, timer, ...persistDeps]);

  useEffect(() => {
    if (!closedAndFrozen || restoredConcluded.current || queued.current) {
      return;
    }
    queued.current = true;
    const completion = buildRef.current(state, Date.now(), true);
    writePlayRecord(completion);

    void flushPendingCompletions(completion);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- same contract as the persist effect above, and `queued` masks a re-fire either way.
  }, [game, closedAndFrozen, date, ...persistDeps]);
}

function persistUnlessConcluded(record: PlayRecord): void {
  if (readPlayRecord(record.game, record.date)?.concluded === true) {
    return;
  }
  writePlayRecord(record);
}

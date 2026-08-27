"use client";

import type { DayResponse } from "@miolos/core";
import { useSyncExternalStore } from "react";

import { ensureSession } from "../session/bootstrap";
import { fetchDayTruth } from "./day-client";

let payload: DayResponse | undefined;

const listeners = new Set<() => void>();

let inFlight = false;

let mintRepairSpent = false;

function getSnapshot(): DayResponse | undefined {
  return payload;
}

function getServerSnapshot(): DayResponse | undefined {
  return undefined;
}

function sameGame(
  previous: DayResponse["games"]["termo"],
  next: DayResponse["games"]["termo"],
): boolean {
  return (
    previous.status === next.status &&
    previous.elapsedMs === next.elapsedMs &&
    previous.hintsUsed === next.hintsUsed &&
    previous.motifName === next.motifName
  );
}

function samePayload(previous: DayResponse, next: DayResponse): boolean {
  return (
    previous.date === next.date &&
    sameGame(previous.games.termo, next.games.termo) &&
    sameGame(previous.games.sudoku, next.games.sudoku) &&
    sameGame(previous.games.nonogram, next.games.nonogram) &&
    sameGame(previous.games.binairo, next.games.binairo)
  );
}

function refresh(): void {
  if (inFlight) {
    return;
  }
  inFlight = true;
  let noTruthYet = false;
  void fetchDayTruth()
    .then((next) => {
      if (next === undefined) {
        noTruthYet = payload === undefined;
        return;
      }
      if (payload !== undefined && samePayload(payload, next)) {
        return;
      }
      payload = next;
      for (const listener of listeners) {
        listener();
      }
    })
    .catch(() => {})
    .finally(() => {
      inFlight = false;
      if (noTruthYet && !mintRepairSpent) {
        mintRepairSpent = true;
        void ensureSession().then(
          () => {
            refresh();
          },
          () => {},
        );
      }
    });
}

const POLL_INTERVAL_MS = 60_000;

let pollTimer: ReturnType<typeof setInterval> | undefined;

function startPoll(): void {
  if (pollTimer !== undefined) {
    return;
  }
  pollTimer = setInterval(refresh, POLL_INTERVAL_MS);
}

function stopPoll(): void {
  if (pollTimer === undefined) {
    return;
  }
  clearInterval(pollTimer);
  pollTimer = undefined;
}

function onVisibilityChange(): void {
  if (document.visibilityState === "visible") {
    startPoll();
    refresh();
  } else {
    stopPoll();
  }
}

function subscribe(onStoreChange: () => void): () => void {
  const wasEmpty = listeners.size === 0;
  listeners.add(onStoreChange);
  if (wasEmpty) {
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    if (document.visibilityState === "visible") {
      startPoll();
    }
    refresh();
  }
  return () => {
    listeners.delete(onStoreChange);
    if (listeners.size === 0) {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      stopPoll();
    }
  };
}

export function useDayTruth(): DayResponse | undefined {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function refreshDayTruth(): void {
  refresh();
}

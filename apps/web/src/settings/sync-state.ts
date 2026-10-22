import { useSyncExternalStore } from "react";

import { safely } from "../safely";

const STORAGE_KEY = "miolos-settings-sync";

export interface SyncState {
  readonly on: boolean;
  readonly pending: boolean;
}

const OFF: SyncState = { on: false, pending: false };

let cache: { readonly raw: string | null; readonly state: SyncState } | null =
  null;

function stateFrom(raw: string | null): SyncState {
  const value = safely<unknown>(() => JSON.parse(raw ?? "null"), null);
  if (typeof value !== "object" || value === null) {
    return OFF;
  }
  return {
    on: "on" in value && value.on === true,
    pending: "pending" in value && value.pending === true,
  };
}

export function readSyncState(): SyncState {
  const raw = safely(() => localStorage.getItem(STORAGE_KEY), null);
  if (cache?.raw !== raw) {
    cache = { raw, state: stateFrom(raw) };
  }
  return cache.state;
}

const listeners = new Set<() => void>();

export function writeSyncState(next: SyncState): void {
  safely(() => {
    if (next.on || next.pending) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, undefined);
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useSyncState(): SyncState {
  return useSyncExternalStore(subscribe, readSyncState, () => OFF);
}

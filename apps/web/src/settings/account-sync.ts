import { gameSettingsStateResponseSchema } from "@miolos/core";

import { apiGet, apiPostRaw } from "../api/client";
import {
  hasStoredSettings,
  readSettings,
  settingsFrom,
  subscribeInTab,
  writeSettings,
} from "./settings";
import { readSyncState, writeSyncState } from "./sync-state";

const PUSH_DELAY_MS = 800;
const ABSENCE = "settings sync skipped, this device keeps its own copy";

let running: {
  readonly ready: Promise<void>;
  readonly stop: () => void;
} | null = null;
let lastSynced: string | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;

const current = (): string => JSON.stringify(readSettings());

function markPending(pending: boolean): void {
  const state = readSyncState();
  if (state.on && state.pending !== pending) {
    writeSyncState({ on: true, pending });
  }
}

async function push(): Promise<void> {
  if (!readSyncState().on) {
    return;
  }
  const sent = current();
  const response = await apiPostRaw(
    "/account/game-settings",
    { settings: readSettings() },
    ABSENCE,
  );
  if (response === undefined || response.status >= 500) {
    markPending(true);
    return;
  }
  if (response.ok) {
    lastSynced = sent;
  }
  markPending(current() !== sent);
}

function onLocalChange(): void {
  if (current() === lastSynced) {
    return;
  }
  markPending(true);
  clearTimeout(timer);
  timer = setTimeout(() => {
    void push();
  }, PUSH_DELAY_MS);
}

async function reconcile(baseline: string): Promise<void> {
  if (readSyncState().pending) {
    await push();
    return;
  }
  const remote = await apiGet(
    "/account/game-settings/state",
    gameSettingsStateResponseSchema,
    ABSENCE,
  );
  if (remote === undefined || !readSyncState().on || current() !== baseline) {
    return;
  }
  if (remote.settings === null) {
    if (hasStoredSettings()) {
      await push();
    }
    return;
  }
  const settings = settingsFrom(remote.settings);
  lastSynced = JSON.stringify(settings);
  writeSettings(settings);
}

export function startSettingsSync(): Promise<void> {
  if (running) {
    return running.ready;
  }
  const leave = subscribeInTab(onLocalChange);
  const baseline = current();
  lastSynced = baseline;
  running = {
    ready: reconcile(baseline),
    stop: () => {
      leave();
      clearTimeout(timer);
      running = null;
    },
  };
  return running.ready;
}

export function turnSyncOn(): Promise<void> {
  writeSyncState({ on: true, pending: false });
  return startSettingsSync();
}

export function turnSyncOff(): void {
  running?.stop();
  writeSyncState({ on: false, pending: false });
}

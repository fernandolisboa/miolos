"use client";

import { useEffect } from "react";

import { ensureSession } from "../session/bootstrap";
import { readSyncState } from "../settings/sync-state";

export function SessionBootstrap() {
  useEffect(() => {
    void ensureSession()
      .then(async () => {
        if (readSyncState().on) {
          const sync = await import("../settings/account-sync");
          await sync.startSettingsSync();
        }
      })
      .catch(() => undefined);
  }, []);
  return null;
}

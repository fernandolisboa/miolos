"use client";

import { useEffect } from "react";

import { ensureSession } from "../session/bootstrap";
import { readSyncState } from "../settings/sync-state";

export function SessionBootstrap() {
  useEffect(() => {
    void ensureSession().catch(() => undefined);
    if (readSyncState().on) {
      void import("../settings/account-sync")
        .then((sync) => sync.startSettingsSync())
        .catch(() => undefined);
    }
  }, []);
  return null;
}

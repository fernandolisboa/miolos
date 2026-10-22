"use client";

import { messages } from "../../src/i18n";
import { turnSyncOff, turnSyncOn } from "../../src/settings/account-sync";
import { SettingSwitch } from "../../src/settings/game-settings";
import { useSyncState } from "../../src/settings/sync-state";

export function SyncToggle() {
  const { on } = useSyncState();
  return (
    <SettingSwitch
      text={messages.settings.games.sync}
      checked={on}
      onChange={(next) => {
        if (next) {
          void turnSyncOn();
        } else {
          turnSyncOff();
        }
      }}
    />
  );
}

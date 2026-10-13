"use client";

import { useId } from "react";

import switchStyles from "../components/switch.module.css";
import { messages } from "../i18n";
import styles from "./game-settings.module.css";
import {
  readSettings,
  useSettings,
  writeSettings,
  type SettingsGame,
} from "./settings";

const copy = messages.settings.games;

const FLAGS: Readonly<Record<string, { label: string; hint: string }>> =
  copy.flags;

function SettingSwitch({
  flag,
  checked,
  onChange,
}: {
  readonly flag: string;
  readonly checked: boolean;
  readonly onChange: (value: boolean) => void;
}) {
  const id = useId();
  const text = FLAGS[flag];
  if (text === undefined) {
    return null;
  }
  return (
    <div className={switchStyles.switchRow}>
      <span className={switchStyles.switchText}>
        <span id={`${id}-label`}>{text.label}</span>
        <span id={`${id}-hint`} className={switchStyles.switchHint}>
          {text.hint}
        </span>
      </span>
      <button
        type="button"
        role="switch"
        className={switchStyles.switch}
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-hint`}
        aria-checked={checked}
        onClick={() => {
          onChange(!checked);
        }}
      >
        {checked ? copy.on : copy.off}
      </button>
    </div>
  );
}

function setGameFlag(game: SettingsGame, flag: string, value: boolean): void {
  const current = readSettings();
  writeSettings({
    ...current,
    games: {
      ...current.games,
      [game]: { ...current.games[game], [flag]: value },
    },
  });
}

export function GameSettings({
  games,
  general,
}: {
  readonly games: readonly SettingsGame[];
  readonly general: boolean;
}) {
  const settings = useSettings();
  return (
    <div className={styles.groups}>
      {general ? (
        <fieldset className={styles.group}>
          <legend className={styles.legend}>{copy.general}</legend>
          <SettingSwitch
            flag="showClock"
            checked={settings.showClock}
            onChange={(value) => {
              writeSettings({ ...readSettings(), showClock: value });
            }}
          />
        </fieldset>
      ) : null}
      {games.map((game) => (
        <fieldset key={game} className={styles.group}>
          <legend className={styles.legend}>{messages.games[game].name}</legend>
          {Object.entries(settings.games[game]).map(([flag, checked]) => (
            <SettingSwitch
              key={flag}
              flag={flag}
              checked={checked}
              onChange={(value) => {
                setGameFlag(game, flag, value);
              }}
            />
          ))}
        </fieldset>
      ))}
    </div>
  );
}

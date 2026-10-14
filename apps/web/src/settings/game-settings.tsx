"use client";

import { useId } from "react";

import choiceStyles from "../components/choice.module.css";
import switchStyles from "../components/switch.module.css";
import { messages } from "../i18n";
import styles from "./game-settings.module.css";
import {
  BINAIRO_FIRST_VALUES,
  readSettings,
  useSettings,
  writeSettings,
  type Settings,
  type SettingsGame,
} from "./settings";

const copy = messages.settings.games;

type GameSetting = {
  [G in SettingsGame]: keyof Settings["games"][G];
}[SettingsGame];
type Setting = GameSetting | "showClock";
type FirstValue = (typeof BINAIRO_FIRST_VALUES)[number];

function SettingText({
  id,
  setting,
}: {
  readonly id: string;
  readonly setting: Setting;
}) {
  const text = copy.flags[setting];
  return (
    <span className={switchStyles.switchText}>
      <span id={`${id}-label`}>{text.label}</span>
      <span id={`${id}-hint`} className={switchStyles.switchHint}>
        {text.hint}
      </span>
    </span>
  );
}

function SettingSwitch({
  flag,
  checked,
  onChange,
}: {
  readonly flag: Setting;
  readonly checked: boolean;
  readonly onChange: (value: boolean) => void;
}) {
  const id = useId();
  return (
    <div className={switchStyles.switchRow}>
      <SettingText id={id} setting={flag} />
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

function FirstValueChoice({
  value,
  onChange,
}: {
  readonly value: FirstValue;
  readonly onChange: (value: FirstValue) => void;
}) {
  const id = useId();
  return (
    <div className={switchStyles.switchRow}>
      <SettingText id={id} setting="firstValue" />
      <div
        role="radiogroup"
        className={choiceStyles.choices}
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-hint`}
      >
        {BINAIRO_FIRST_VALUES.map((option) => (
          <label key={option} className={choiceStyles.choice}>
            <input
              type="radio"
              name={id}
              value={option}
              checked={value === option}
              onChange={() => {
                onChange(option);
              }}
            />
            {option}
          </label>
        ))}
      </div>
    </div>
  );
}

function setGameSetting(
  game: SettingsGame,
  setting: GameSetting,
  value: boolean | FirstValue,
): void {
  const current = readSettings();
  writeSettings({
    ...current,
    games: {
      ...current.games,
      [game]: { ...current.games[game], [setting]: value },
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
          {(
            Object.entries(settings.games[game]) as [
              GameSetting,
              boolean | FirstValue,
            ][]
          ).map(([setting, current]) =>
            typeof current === "boolean" ? (
              <SettingSwitch
                key={setting}
                flag={setting}
                checked={current}
                onChange={(value) => {
                  setGameSetting(game, setting, value);
                }}
              />
            ) : (
              <FirstValueChoice
                key={setting}
                value={current}
                onChange={(value) => {
                  setGameSetting(game, setting, value);
                }}
              />
            ),
          )}
        </fieldset>
      ))}
    </div>
  );
}

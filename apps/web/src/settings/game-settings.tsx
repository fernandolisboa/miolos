"use client";

import { useId } from "react";

import choiceStyles from "../components/choice.module.css";
import switchStyles from "../components/switch.module.css";
import { messages } from "../i18n";
import styles from "./game-settings.module.css";
import {
  BINAIRO_FIRST_VALUES,
  NONOGRAM_LINE_CROSSES,
  readSettings,
  useSettings,
  writeSettings,
  type LineCross,
  type Settings,
  type SettingsGame,
} from "./settings";

const copy = messages.settings.games;

type GameSetting = {
  [G in SettingsGame]: keyof Settings["games"][G];
}[SettingsGame];
type ChoiceValue = (typeof BINAIRO_FIRST_VALUES)[number] | LineCross;

interface ChoiceOption {
  readonly value: ChoiceValue;
  readonly label: string;
}

interface Choice {
  readonly options: readonly ChoiceOption[];
  readonly stacked: boolean;
}

const CHOICES = {
  firstValue: {
    options: BINAIRO_FIRST_VALUES.map((value) => ({
      value,
      label: String(value),
    })),
    stacked: false,
  },
  lineCross: {
    options: NONOGRAM_LINE_CROSSES.map((value) => ({
      value,
      label: copy.lineCross[value],
    })),
    stacked: true,
  },
} satisfies Partial<Record<GameSetting, Choice>>;

function isChoice(setting: GameSetting): setting is keyof typeof CHOICES {
  return setting in CHOICES;
}

interface SettingCopy {
  readonly label: string;
  readonly hint: string;
}

function SettingText({
  id,
  text,
}: {
  readonly id: string;
  readonly text: SettingCopy;
}) {
  return (
    <span className={switchStyles.switchText}>
      <span id={`${id}-label`}>{text.label}</span>
      <span id={`${id}-hint`} className={switchStyles.switchHint}>
        {text.hint}
      </span>
    </span>
  );
}

export function SettingSwitch({
  text,
  checked,
  onChange,
}: {
  readonly text: SettingCopy;
  readonly checked: boolean;
  readonly onChange: (value: boolean) => void;
}) {
  const id = useId();
  return (
    <div className={switchStyles.switchRow}>
      <SettingText id={id} text={text} />
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

function SettingChoice({
  setting,
  choice,
  value,
  onChange,
}: {
  readonly setting: GameSetting;
  readonly choice: Choice;
  readonly value: ChoiceValue;
  readonly onChange: (value: ChoiceValue) => void;
}) {
  const id = useId();
  return (
    <div
      className={
        choice.stacked
          ? `${switchStyles.switchRow} ${choiceStyles.stacked}`
          : switchStyles.switchRow
      }
    >
      <SettingText id={id} text={copy.flags[setting]} />
      <div
        role="radiogroup"
        className={choiceStyles.choices}
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-hint`}
      >
        {choice.options.map((option) => (
          <label key={option.value} className={choiceStyles.choice}>
            <input
              type="radio"
              name={id}
              value={option.value}
              checked={value === option.value}
              onChange={() => {
                onChange(option.value);
              }}
            />
            {option.label}
          </label>
        ))}
      </div>
    </div>
  );
}

function setGameSetting(
  game: SettingsGame,
  setting: GameSetting,
  value: boolean | ChoiceValue,
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
  clock,
}: {
  readonly games: readonly SettingsGame[];
  readonly clock: boolean;
}) {
  const settings = useSettings();
  return (
    <div className={styles.frame}>
      <div className={styles.groups}>
        <fieldset className={styles.group}>
          <legend className={styles.legend}>{copy.general}</legend>
          {clock ? (
            <SettingSwitch
              text={copy.flags.showClock}
              checked={settings.showClock}
              onChange={(value) => {
                writeSettings({ ...readSettings(), showClock: value });
              }}
            />
          ) : null}
          <SettingSwitch
            text={copy.flags.endAnimation}
            checked={settings.endAnimation}
            onChange={(value) => {
              writeSettings({ ...readSettings(), endAnimation: value });
            }}
          />
          {games.some((game) => game !== "minesweeper") ? (
            <SettingSwitch
              text={copy.flags.mistakeLimit}
              checked={settings.mistakeLimit}
              onChange={(value) => {
                writeSettings({ ...readSettings(), mistakeLimit: value });
              }}
            />
          ) : null}
        </fieldset>
        {games.map((game) => (
          <fieldset key={game} className={styles.group}>
            <legend className={styles.legend}>
              {messages.games[game].name}
            </legend>
            {(
              Object.entries(settings.games[game]) as [
                GameSetting,
                boolean | ChoiceValue,
              ][]
            ).map(([setting, current]) =>
              typeof current === "boolean" ? (
                <SettingSwitch
                  key={setting}
                  text={copy.flags[setting]}
                  checked={current}
                  onChange={(value) => {
                    setGameSetting(game, setting, value);
                  }}
                />
              ) : isChoice(setting) ? (
                <SettingChoice
                  key={setting}
                  setting={setting}
                  choice={CHOICES[setting]}
                  value={current}
                  onChange={(value) => {
                    setGameSetting(game, setting, value);
                  }}
                />
              ) : null,
            )}
          </fieldset>
        ))}
      </div>
    </div>
  );
}

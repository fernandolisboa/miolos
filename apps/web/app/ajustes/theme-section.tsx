"use client";

import { useState, useSyncExternalStore } from "react";

import { messages } from "../../src/i18n";
import {
  applyThemeChoice,
  readThemeChoice,
  THEME_CHOICES,
  type ThemeChoice,
} from "../../src/theme/theme";
import styles from "./page.module.css";

const neverChanges = () => () => undefined;
const serverChoice = (): ThemeChoice => "system";

export function ThemeSection() {
  const copy = messages.settings.theme;
  const stored = useSyncExternalStore(
    neverChanges,
    readThemeChoice,
    serverChoice,
  );
  const [picked, setPicked] = useState<ThemeChoice | null>(null);
  const choice = picked ?? stored;

  function pick(next: ThemeChoice): void {
    applyThemeChoice(next);
    setPicked(next);
  }

  return (
    <section className={styles.card} aria-labelledby="settings-theme-heading">
      <h2 id="settings-theme-heading" className={styles.heading}>
        {copy.heading}
      </h2>
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>{copy.legend}</legend>
        <div className={styles.choices}>
          {THEME_CHOICES.map((option) => (
            <label key={option} className={styles.choice}>
              <input
                type="radio"
                name="theme"
                value={option}
                checked={choice === option}
                onChange={() => {
                  pick(option);
                }}
              />
              {copy[option]}
            </label>
          ))}
        </div>
      </fieldset>
    </section>
  );
}

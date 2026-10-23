"use client";

import { useId, useState, type KeyboardEvent } from "react";

import { messages } from "../../src/i18n";
import { ACCENTS } from "../../src/play/accent";
import { GameGroup, GeneralSettings } from "../../src/settings/game-settings";
import { settingsGames, type SettingsGame } from "../../src/settings/settings";
import styles from "./game-tabs.module.css";

type Tab = "general" | SettingsGame;

const copy = messages.settings.games;
const GAMES = settingsGames();
const TABS: readonly Tab[] = ["general", ...GAMES];

const STEPS: Readonly<Record<string, (index: number) => number>> = {
  ArrowRight: (index) => index + 1,
  ArrowDown: (index) => index + 1,
  ArrowLeft: (index) => index - 1,
  ArrowUp: (index) => index - 1,
  Home: () => 0,
  End: () => TABS.length - 1,
};

export function GameTabs() {
  const [active, setActive] = useState<Tab>("general");
  const id = useId();

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = STEPS[event.key];
    if (step === undefined || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    event.preventDefault();
    const index = step(TABS.indexOf(active));
    const next = TABS[(index + TABS.length) % TABS.length] ?? "general";
    setActive(next);
    document.getElementById(`${id}-${next}-tab`)?.focus();
  }

  return (
    <div className={styles.tabs}>
      <div className={styles.layout}>
        <div
          role="tablist"
          aria-label={copy.tabs.label}
          className={styles.list}
          onKeyDown={onKeyDown}
        >
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              id={`${id}-${tab}-tab`}
              aria-controls={`${id}-${tab}-panel`}
              aria-selected={tab === active}
              tabIndex={tab === active ? 0 : -1}
              className={styles.tab}
              style={
                tab === "general" ? undefined : { "--accent": ACCENTS[tab] }
              }
              onClick={() => {
                setActive(tab);
              }}
            >
              {tab === "general" ? copy.tabs.general : messages.games[tab].name}
            </button>
          ))}
        </div>
        {TABS.map((tab) => (
          <div
            key={tab}
            role="tabpanel"
            id={`${id}-${tab}-panel`}
            aria-labelledby={`${id}-${tab}-tab`}
            hidden={tab !== active}
            className={styles.panel}
          >
            {tab === "general" ? (
              <GeneralSettings games={GAMES} clock hideLegend />
            ) : (
              <GameGroup game={tab} hideLegend />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

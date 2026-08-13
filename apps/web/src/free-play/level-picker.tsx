"use client";

/**
 * The three-chip difficulty picker (#28, ADR-0046 decision 2): Leve /
 * Médio / Difícil over the weekday ramp's endpoints and middle. A
 * radiogroup with roving tabindex — arrow keys move AND select, the
 * standard radio pattern — and the active chip is carried by geometry and
 * ink, never by accent-as-text (ADR-0041).
 *
 * Switching levels regenerates immediately: the screens key their board on
 * `{seed, level}`, so the change is React's own remount, not a reset
 * action. No level ever reaches a URL or storage (ADR-0046 decisions 2/4).
 */
import { useRef } from "react";

import { messages } from "../i18n";
import { FREE_PLAY_LEVELS, type FreePlayLevel } from "./catalog";
import styles from "./free-play.module.css";

export function LevelPicker({
  level,
  onChange,
}: {
  readonly level: FreePlayLevel;
  readonly onChange: (level: FreePlayLevel) => void;
}) {
  const chipsRef = useRef<Map<FreePlayLevel, HTMLButtonElement>>(new Map());

  const moveBy = (offset: number) => {
    const at = FREE_PLAY_LEVELS.indexOf(level);
    const next =
      FREE_PLAY_LEVELS[
        (at + offset + FREE_PLAY_LEVELS.length) % FREE_PLAY_LEVELS.length
      ];
    if (next !== undefined && next !== level) {
      onChange(next);
      chipsRef.current.get(next)?.focus();
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label={messages.freePlay.level.label}
      className={styles.levelPicker}
    >
      {FREE_PLAY_LEVELS.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={option === level}
          aria-label={messages.freePlay.level.aria(
            messages.freePlay.level[option],
          )}
          tabIndex={option === level ? 0 : -1}
          className={`${styles.levelChip}${
            option === level ? ` ${styles.levelChipActive}` : ""
          }`}
          ref={(element) => {
            if (element === null) {
              chipsRef.current.delete(option);
            } else {
              chipsRef.current.set(option, element);
            }
          }}
          onClick={() => {
            onChange(option);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight" || event.key === "ArrowDown") {
              event.preventDefault();
              moveBy(1);
            } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
              event.preventDefault();
              moveBy(-1);
            }
          }}
        >
          {messages.freePlay.level[option]}
        </button>
      ))}
    </div>
  );
}

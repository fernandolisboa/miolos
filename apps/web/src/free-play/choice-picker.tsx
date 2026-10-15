"use client";

import { useRef } from "react";

import { messages } from "../i18n";
import { FREE_PLAY_LEVELS, type FreePlayLevel } from "./catalog";
import styles from "./free-play.module.css";

export interface FreePlayChoice<T extends string | number> {
  readonly label: string;
  readonly options: readonly T[];
  readonly value: T;
  readonly optionLabel: (option: T) => string;
  readonly optionAria: (option: T) => string;
  readonly onChange: (option: T) => void;
}

export type FreePlayChoices<
  A extends string | number,
  B extends string | number = never,
> = readonly [FreePlayChoice<A>, FreePlayChoice<B>?];

export function choiceLabel<T extends string | number>(
  choice: FreePlayChoice<T>,
): string {
  return choice.optionLabel(choice.value);
}

export function levelChoice(
  level: FreePlayLevel,
  onChange: (level: FreePlayLevel) => void,
): FreePlayChoice<FreePlayLevel> {
  return {
    label: messages.freePlay.level.label,
    options: FREE_PLAY_LEVELS,
    value: level,
    optionLabel: (option) => messages.freePlay.level[option],
    optionAria: (option) =>
      messages.freePlay.level.aria(messages.freePlay.level[option]),
    onChange,
  };
}

export function ChoicePicker<T extends string | number>({
  label,
  options,
  value,
  optionLabel,
  optionAria,
  onChange,
}: FreePlayChoice<T>) {
  const chipsRef = useRef<Map<T, HTMLButtonElement>>(new Map());

  const moveBy = (offset: number) => {
    const at = options.indexOf(value);
    const next = options[(at + offset + options.length) % options.length];
    if (next !== undefined && next !== value) {
      onChange(next);
      chipsRef.current.get(next)?.focus();
    }
  };

  return (
    <div role="radiogroup" aria-label={label} className={styles.choicePicker}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={option === value}
          aria-label={optionAria(option)}
          tabIndex={option === value ? 0 : -1}
          className={`${styles.choiceChip}${
            option === value ? ` ${styles.choiceChipActive}` : ""
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
          {optionLabel(option)}
        </button>
      ))}
    </div>
  );
}

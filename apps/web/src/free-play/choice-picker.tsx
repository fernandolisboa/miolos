"use client";

import { useLayoutEffect, useRef } from "react";

import { messages } from "../i18n";
import { FREE_PLAY_LEVELS, type FreePlayLevel } from "./catalog";
import { choice, type Choice } from "./choice";
import styles from "./free-play.module.css";

export function levelChoice(
  level: FreePlayLevel,
  onSelect: (level: FreePlayLevel) => void,
): Choice {
  const copy = messages.freePlay.level;
  return choice({
    label: copy.label,
    options: FREE_PLAY_LEVELS,
    selected: level,
    optionLabel: (option) => copy[option],
    optionAria: (option) => copy.aria(copy[option]),
    onSelect,
  });
}

export function variantChoice<V extends string>(
  options: readonly V[],
  names: Readonly<Record<V, string>>,
  variant: V,
  onSelect: (variant: V) => void,
): Choice {
  const copy = messages.freePlay.variant;
  return choice({
    label: copy.label,
    options,
    selected: variant,
    optionLabel: (option) => names[option],
    optionAria: (option) => copy.aria(names[option]),
    onSelect,
  });
}

export function ChoicePicker({ label, options, selected, onSelect }: Choice) {
  const chipsRef = useRef<Map<string, HTMLButtonElement>>(new Map());

  const moveBy = (offset: number) => {
    const at = options.findIndex((option) => option.key === selected);
    const next = options[(at + offset + options.length) % options.length];
    if (next !== undefined && next.key !== selected) {
      onSelect(next.key);
      chipsRef.current.get(next.key)?.focus();
    }
  };

  return (
    <div role="radiogroup" aria-label={label} className={styles.choicePicker}>
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          role="radio"
          aria-checked={option.key === selected}
          aria-label={option.aria}
          tabIndex={option.key === selected ? 0 : -1}
          className={`${styles.choiceChip}${
            option.key === selected ? ` ${styles.choiceChipActive}` : ""
          }`}
          ref={(element) => {
            if (element === null) {
              chipsRef.current.delete(option.key);
            } else {
              chipsRef.current.set(option.key, element);
            }
          }}
          onClick={() => {
            onSelect(option.key);
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
          {option.label}
        </button>
      ))}
    </div>
  );
}

const refocusOnMount = new Set<string>();

export function ChoiceToggle({
  label,
  options,
  selected,
  onSelect,
  toggle,
}: Choice & { readonly toggle: NonNullable<Choice["toggle"]> }) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { on, off } = toggle;
  useLayoutEffect(() => {
    const button = buttonRef.current;
    if (
      refocusOnMount.delete(label) &&
      document.activeElement === document.body
    ) {
      button?.focus();
    }
    return () => {
      if (button !== null && document.activeElement === button) {
        refocusOnMount.add(label);
        queueMicrotask(() => refocusOnMount.delete(label));
      }
    };
  }, [label]);

  const option = options.find((candidate) => candidate.key === on);
  const pressed = selected === on;
  return (
    <button
      ref={buttonRef}
      type="button"
      aria-pressed={pressed}
      aria-label={option?.aria}
      title={option?.label}
      className={styles.choiceToggle}
      onClick={() => {
        onSelect(pressed ? off : on);
      }}
    >
      {toggle.icon}
    </button>
  );
}

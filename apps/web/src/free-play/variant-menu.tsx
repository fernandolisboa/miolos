"use client";

import { useRef } from "react";

import { messages } from "../i18n";
import { ChoicePicker, type FreePlayChoice } from "./choice-picker";
import styles from "./variant-menu.module.css";

export function variantChoice<T extends string>(
  options: readonly T[],
  names: Readonly<Record<T, string>>,
  value: T,
  onChange: (variant: T) => void,
): FreePlayChoice<T> {
  return {
    label: messages.freePlay.variant.label,
    options,
    value,
    optionLabel: (option) => names[option],
    optionAria: (option) => messages.freePlay.variant.aria(names[option]),
    onChange,
  };
}

export function VariantMenu<T extends string>({
  id,
  choice,
  rules,
}: {
  readonly id: string;
  readonly choice: FreePlayChoice<T>;
  readonly rules: string;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={menuRef}
      id={id}
      popover="auto"
      className={styles.menu}
      onClick={(event) => {
        if (
          event.target instanceof Element &&
          event.target.closest('[role="radio"]') !== null
        ) {
          menuRef.current?.hidePopover();
        }
      }}
    >
      <p className={styles.menuTitle}>{messages.freePlay.variant.label}</p>
      <ChoicePicker {...choice} />
      <p className={styles.menuLine}>{rules}</p>
    </div>
  );
}

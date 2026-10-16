"use client";

import { useRef } from "react";

import { messages } from "../i18n";
import type { Choice } from "./choice";
import { ChoicePicker } from "./choice-picker";
import styles from "./variant-menu.module.css";

export function VariantMenu({
  id,
  choice,
  rules,
}: {
  readonly id: string;
  readonly choice: Choice;
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

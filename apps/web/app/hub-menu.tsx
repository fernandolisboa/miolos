"use client";

import Link from "next/link";
import {
  useId,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
} from "react";

import { messages, routes } from "../src/i18n";
import { useDismiss } from "../src/play/use-dismiss";
import styles from "./hub-menu.module.css";

function isEscape(event: globalThis.KeyboardEvent): boolean {
  return event.key === "Escape";
}

export function HubMenu() {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useDismiss(open, rootRef, setOpen, isEscape);

  const onKeyDown = (event: KeyboardEvent) => {
    if (open && event.key === "Escape") buttonRef.current?.focus();
  };

  const onBlur = (event: FocusEvent) => {
    if (!rootRef.current?.contains(event.relatedTarget)) setOpen(false);
  };

  return (
    <nav
      ref={rootRef}
      className={styles.root}
      aria-label={messages.hoje.menu.label}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
    >
      <button
        ref={buttonRef}
        type="button"
        className={styles.button}
        aria-expanded={open}
        aria-controls={panelId}
        onMouseDown={(event) => {
          event.preventDefault();
        }}
        onClick={() => {
          setOpen((was) => !was);
        }}
      >
        <svg aria-hidden viewBox="0 0 20 20" className={styles.icon}>
          <path d="M3 5.5h14M3 10h14M3 14.5h14" />
        </svg>
        <span className={styles.label}>{messages.hoje.menu.label}</span>
      </button>
      <ul id={panelId} hidden={!open} className={styles.panel}>
        <li>
          <Link className={styles.link} href={routes.stats}>
            {messages.hoje.menu.stats}
          </Link>
        </li>
        <li>
          <Link className={styles.link} href={routes.settings}>
            {messages.hoje.menu.settings}
          </Link>
        </li>
      </ul>
    </nav>
  );
}

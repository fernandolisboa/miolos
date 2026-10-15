"use client";

import { useEffect, useRef } from "react";

import { messages } from "../i18n";
import styles from "./undo-control.module.css";

const label = messages.play.undo;

export function UndoControl({
  onUndo,
}: {
  readonly onUndo: (() => void) | null;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (onUndo === null) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        !event.shiftKey &&
        !event.altKey &&
        event.key.toLowerCase() === "z" &&
        !isBusy(event.target, buttonRef.current)
      ) {
        event.preventDefault();
        onUndo();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onUndo]);

  return (
    <button
      ref={buttonRef}
      type="button"
      className={styles.control}
      aria-label={label}
      aria-disabled={onUndo === null}
      onClick={onUndo ?? undefined}
    >
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M8.5 5 4 9.5 8.5 14M4.5 9.5h9.75a5.25 5.25 0 0 1 0 10.5H10" />
      </svg>
    </button>
  );
}

export function UndoPlaceholder() {
  return <div aria-hidden className={styles.control} />;
}

function isBusy(target: EventTarget | null, button: HTMLElement | null) {
  return (
    (target instanceof Element && target.closest("input, textarea") !== null) ||
    document.querySelector("dialog[open]") !== null ||
    button?.parentElement?.querySelector('[role="group"]') != null
  );
}

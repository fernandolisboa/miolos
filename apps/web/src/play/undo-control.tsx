"use client";

import { useEffect, useRef } from "react";

import { messages } from "../i18n";
import styles from "./undo-control.module.css";

type Command = (() => void) | null;

const UNDO_ARROW = "M8.5 5 4 9.5 8.5 14M4.5 9.5h9.75a5.25 5.25 0 0 1 0 10.5H10";
const REDO_ARROW =
  "M15.5 5 20 9.5 15.5 14M19.5 9.5H9.75a5.25 5.25 0 0 0 0 10.5H14";

export function UndoControl({
  onUndo,
  onRedo,
}: {
  readonly onUndo: Command;
  readonly onRedo: Command;
}) {
  const pairRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (onUndo === null && onRedo === null) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      const command = commandOf(event);
      const run =
        command === "undo" ? onUndo : command === "redo" ? onRedo : null;
      if (run !== null && !isBusy(event.target, pairRef.current)) {
        event.preventDefault();
        run();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onUndo, onRedo]);

  return (
    <div ref={pairRef} className={styles.pair}>
      <Tile label={messages.play.undo} arrow={UNDO_ARROW} onPress={onUndo} />
      <Tile label={messages.play.redo} arrow={REDO_ARROW} onPress={onRedo} />
    </div>
  );
}

function Tile({
  label,
  arrow,
  onPress,
}: {
  readonly label: string;
  readonly arrow: string;
  readonly onPress: Command;
}) {
  return (
    <button
      type="button"
      className={styles.control}
      aria-label={label}
      aria-disabled={onPress === null}
      onClick={onPress ?? undefined}
    >
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d={arrow} />
      </svg>
    </button>
  );
}

export function UndoPlaceholder() {
  return (
    <div aria-hidden className={styles.pair}>
      <div className={styles.control} />
      <div className={styles.control} />
    </div>
  );
}

function commandOf(event: KeyboardEvent): "undo" | "redo" | null {
  if (event.altKey || !(event.ctrlKey || event.metaKey)) {
    return null;
  }
  const key = event.key.toLowerCase();
  if (key === "z") {
    return event.shiftKey ? "redo" : "undo";
  }
  return key === "y" && event.ctrlKey && !event.shiftKey ? "redo" : null;
}

function isBusy(target: EventTarget | null, pair: HTMLElement | null) {
  return (
    (target instanceof Element && target.closest("input, textarea") !== null) ||
    document.querySelector("dialog[open]") !== null ||
    pair?.parentElement?.querySelector('[role="group"]') != null
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

import { messages } from "../i18n";
import { GameSettings } from "./game-settings";
import styles from "./settings-dialog.module.css";
import type { SettingsGame } from "./settings";

const copy = messages.settings.games.dialog;

export function GameSettingsButton({
  game,
  general,
}: {
  readonly game: SettingsGame;
  readonly general: boolean;
}) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open) {
      dialogRef.current?.showModal();
    }
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        onClick={() => {
          setOpen(true);
        }}
      >
        {copy.trigger}
      </button>
      <dialog
        ref={dialogRef}
        className={styles.dialog}
        aria-label={copy.title}
        onClose={() => {
          setOpen(false);
          triggerRef.current?.focus();
        }}
      >
        <h2 className={styles.title}>{copy.title}</h2>
        <p className={styles.note}>{copy.note}</p>
        {open ? <GameSettings games={[game]} general={general} /> : null}
        <button
          type="button"
          className={styles.close}
          onClick={() => dialogRef.current?.close()}
        >
          {copy.close}
        </button>
      </dialog>
    </>
  );
}

export function GameSettingsPlaceholder() {
  return (
    <span aria-hidden className={styles.placeholder}>
      {"\u00a0"}
    </span>
  );
}

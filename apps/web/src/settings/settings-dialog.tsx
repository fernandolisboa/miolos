"use client";

import { useEffect, useRef, useState } from "react";

import { lazyChunk } from "../components/lazy-chunk";
import { messages } from "../i18n";
import styles from "./settings-dialog.module.css";
import type { SettingsGame } from "./settings";

const copy = messages.settings.games.dialog;

// see ADR-0123; the dialog opens once the panel is here, so showModal focuses its first switch.
let GameSettings: typeof import("./game-settings").GameSettings | null = null;
const useGameSettingsLoaded = lazyChunk(() =>
  import("./game-settings").then((module) => {
    GameSettings = module.GameSettings;
  }),
);

export function GameSettingsButton({
  game,
  clock,
}: {
  readonly game: SettingsGame;
  readonly clock: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [asks, setAsks] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const ready = useGameSettingsLoaded(asks) && open;
  useEffect(() => {
    if (ready) {
      dialogRef.current?.showModal();
    }
  }, [ready]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        onClick={() => {
          setOpen(true);
          setAsks((n) => n + 1);
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
        {ready && GameSettings !== null ? (
          <GameSettings games={[game]} clock={clock} />
        ) : null}
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

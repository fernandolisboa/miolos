"use client";

import { useEffect, useId, useRef, useState } from "react";

import { messages } from "../i18n";
import styles from "./reset-control.module.css";

const copy = messages.play.reset;

export function ResetControl({
  onReset,
}: {
  readonly onReset: (() => void) | null;
}) {
  const [confirming, setConfirming] = useState(false);
  const questionId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const refocus = useRef(false);

  if (onReset === null && confirming) {
    setConfirming(false);
  }

  useEffect(() => {
    if (confirming) {
      cancelRef.current?.focus();
    } else if (refocus.current) {
      refocus.current = false;
      triggerRef.current?.focus();
    }
  }, [confirming]);

  const close = () => {
    refocus.current = true;
    setConfirming(false);
  };

  return (
    <div className={styles.control}>
      {confirming ? (
        <div role="group" aria-labelledby={questionId} className={styles.ask}>
          <p id={questionId} className={styles.question}>
            {copy.question}
          </p>
          <div className={styles.actions}>
            <button
              ref={cancelRef}
              type="button"
              className={styles.cancel}
              onClick={close}
            >
              {copy.cancel}
            </button>
            <button
              type="button"
              className={styles.confirm}
              onClick={() => {
                close();
                onReset?.();
              }}
            >
              {copy.label}
            </button>
          </div>
        </div>
      ) : (
        <button
          ref={triggerRef}
          type="button"
          className={onReset === null ? styles.idle : styles.cancel}
          aria-disabled={onReset === null}
          onClick={() => {
            setConfirming(onReset !== null);
          }}
        >
          {copy.label}
        </button>
      )}
    </div>
  );
}

export function ResetPlaceholder() {
  return <div aria-hidden className={styles.control} />;
}

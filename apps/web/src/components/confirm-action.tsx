"use client";

import { useState } from "react";

import styles from "./confirm-action.module.css";

export type ConfirmActionLabels = {
  readonly start: string;
  readonly confirmTitle: string;
  readonly confirmBody: string;
  readonly confirm: string;
  readonly cancel: string;
  readonly busy: string;
  readonly error: string;
};

type Phase = "idle" | "confirming" | "running" | "error";

export function ConfirmAction({
  labels,
  run,
  onDone,
}: {
  labels: ConfirmActionLabels;
  run: () => Promise<boolean>;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");

  async function runAction(): Promise<void> {
    setPhase("running");
    if (await run()) {
      onDone();
    } else {
      setPhase("error");
    }
  }

  if (phase === "idle") {
    return (
      <button
        type="button"
        className={styles.start}
        onClick={() => {
          setPhase("confirming");
        }}
      >
        {labels.start}
      </button>
    );
  }

  if (phase === "error") {
    return (
      <div>
        <p className={styles.error} role="status">
          {labels.error}
        </p>
        <button
          type="button"
          className={styles.start}
          onClick={() => {
            void runAction();
          }}
        >
          {labels.confirm}
        </button>
      </div>
    );
  }

  const running = phase === "running";
  return (
    <div className={styles.confirm}>
      <p className={styles.title}>{labels.confirmTitle}</p>
      <p className={styles.body}>{labels.confirmBody}</p>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.confirmButton}
          disabled={running}
          onClick={() => {
            void runAction();
          }}
        >
          {running ? labels.busy : labels.confirm}
        </button>
        <button
          type="button"
          className={styles.cancel}
          disabled={running}
          onClick={() => {
            setPhase("idle");
          }}
        >
          {labels.cancel}
        </button>
      </div>
    </div>
  );
}

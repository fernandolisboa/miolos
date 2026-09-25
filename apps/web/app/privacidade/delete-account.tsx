"use client";

import { useState } from "react";

import { deleteAccount } from "../../src/attach/attach-client";
import { deleteAccountAnchor, messages } from "../../src/i18n";
import styles from "./page.module.css";

type DeleteState = "idle" | "confirming" | "deleting" | "done" | "error";

export function DeleteAccount() {
  const [state, setState] = useState<DeleteState>("idle");

  async function runDelete(): Promise<void> {
    setState("deleting");
    const deleted = await deleteAccount();
    setState(deleted ? "done" : "error");
  }

  return (
    <section
      id={deleteAccountAnchor}
      className={styles.deleteSection}
      data-delete-state={state}
    >
      <h2 className={styles.heading}>{messages.deleteAccount.heading}</h2>
      <p className={styles.body}>{messages.deleteAccount.explain}</p>

      {state === "idle" && (
        <button
          type="button"
          className={styles.deleteStart}
          onClick={() => {
            setState("confirming");
          }}
        >
          {messages.deleteAccount.start}
        </button>
      )}

      {(state === "confirming" || state === "deleting") && (
        <div className={styles.deleteConfirm}>
          <p className={styles.deleteConfirmTitle}>
            {messages.deleteAccount.confirmTitle}
          </p>
          <p className={styles.body}>{messages.deleteAccount.confirmBody}</p>
          <div className={styles.deleteActions}>
            <button
              type="button"
              className={styles.deleteConfirmButton}
              disabled={state === "deleting"}
              onClick={() => {
                void runDelete();
              }}
            >
              {state === "deleting"
                ? messages.deleteAccount.deleting
                : messages.deleteAccount.confirm}
            </button>
            <button
              type="button"
              className={styles.deleteCancel}
              disabled={state === "deleting"}
              onClick={() => {
                setState("idle");
              }}
            >
              {messages.deleteAccount.cancel}
            </button>
          </div>
        </div>
      )}

      {state === "done" && (
        <div>
          <p className={styles.deleteDone}>{messages.deleteAccount.done}</p>
          <p className={styles.body}>{messages.deleteAccount.doneNote}</p>
        </div>
      )}

      {state === "error" && (
        <div>
          <p className={styles.deleteError} role="status">
            {messages.deleteAccount.error}
          </p>
          <button
            type="button"
            className={styles.deleteStart}
            onClick={() => {
              void runDelete();
            }}
          >
            {messages.deleteAccount.confirm}
          </button>
        </div>
      )}
    </section>
  );
}

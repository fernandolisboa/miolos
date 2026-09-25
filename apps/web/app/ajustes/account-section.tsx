"use client";

import { useState } from "react";

import {
  detachAccountEmail,
  fetchAccountState,
  setReminderConsent,
} from "../../src/account/account-client";
import { useMountFetch } from "../../src/api/use-mount-fetch";
import { messages } from "../../src/i18n";
import styles from "./page.module.css";

const copy = messages.settings.account;

function ReminderConsent({ initial }: { initial: boolean }) {
  const [checked, setChecked] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function change(granted: boolean): Promise<void> {
    setBusy(true);
    const answer = await setReminderConsent(granted);
    setBusy(false);
    setFailed(answer === undefined);
    if (answer !== undefined) {
      setChecked(answer);
    }
  }

  return (
    <>
      <label className={styles.consent} htmlFor="settings-email-reminder">
        <input
          id="settings-email-reminder"
          className={styles.checkbox}
          type="checkbox"
          checked={checked}
          disabled={busy}
          onChange={(event) => {
            void change(event.target.checked);
          }}
        />
        <span>{messages.attach.reminderLabel}</span>
      </label>
      {failed && (
        <p className={styles.note} role="status">
          {copy.reminderError}
        </p>
      )}
    </>
  );
}

type DetachState = "idle" | "confirming" | "removing" | "error";

function DetachEmail({ onDetached }: { onDetached: () => void }) {
  const [state, setState] = useState<DetachState>("idle");

  async function runDetach(): Promise<void> {
    setState("removing");
    if (await detachAccountEmail()) {
      onDetached();
    } else {
      setState("error");
    }
  }

  if (state === "idle") {
    return (
      <button
        type="button"
        className={styles.action}
        onClick={() => {
          setState("confirming");
        }}
      >
        {copy.detach.start}
      </button>
    );
  }

  return (
    <div className={styles.confirm} data-detach-state={state}>
      <p className={styles.confirmTitle}>{copy.detach.confirmTitle}</p>
      <p className={styles.body}>{copy.detach.confirmBody}</p>
      {state === "error" && (
        <p className={styles.body} role="status">
          {copy.detach.error}
        </p>
      )}
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.confirmButton}
          disabled={state === "removing"}
          onClick={() => {
            void runDetach();
          }}
        >
          {state === "removing" ? copy.detach.removing : copy.detach.confirm}
        </button>
        <button
          type="button"
          className={styles.cancel}
          disabled={state === "removing"}
          onClick={() => {
            setState("idle");
          }}
        >
          {copy.detach.cancel}
        </button>
      </div>
    </div>
  );
}

function AccountBody() {
  const account = useMountFetch(fetchAccountState);
  const [detached, setDetached] = useState(false);

  if (account === undefined) {
    return null;
  }
  if (account === null) {
    return <p className={styles.body}>{copy.unavailable}</p>;
  }
  if (detached) {
    return (
      <>
        <p className={styles.body} role="status">
          {copy.detach.done}
        </p>
        <p className={styles.body}>{copy.none}</p>
      </>
    );
  }
  if (account.email === null) {
    return <p className={styles.body}>{copy.none}</p>;
  }
  return (
    <>
      <p className={styles.body}>
        {copy.attached}{" "}
        <strong className={styles.email}>{account.email}</strong>
      </p>
      <ReminderConsent initial={account.reminderConsent} />
      <DetachEmail
        onDetached={() => {
          setDetached(true);
        }}
      />
    </>
  );
}

export function AccountSection() {
  return (
    <section className={styles.card} aria-labelledby="settings-account-heading">
      <h2 id="settings-account-heading" className={styles.heading}>
        {copy.heading}
      </h2>
      <AccountBody />
    </section>
  );
}

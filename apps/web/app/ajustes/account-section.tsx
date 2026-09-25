"use client";

import type { AccountStateResponse } from "@miolos/core";
import { useState } from "react";

import {
  detachAccountEmail,
  fetchAccountState,
  setReminderConsent,
} from "../../src/account/account-client";
import { useMountFetch } from "../../src/api/use-mount-fetch";
import { AttachForm, ConsentCheckbox } from "../../src/attach/attach-form";
import { ConfirmAction } from "../../src/components/confirm-action";
import { messages } from "../../src/i18n";
import styles from "./page.module.css";

const copy = messages.settings.account;

function ReminderConsent({
  checked,
  onAnswer,
  onFailure,
}: {
  checked: boolean;
  onAnswer: (granted: boolean) => void;
  onFailure: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function change(granted: boolean): Promise<void> {
    setBusy(true);
    const answer = await setReminderConsent(granted);
    setFailed(answer === undefined);
    if (answer === undefined) {
      await onFailure();
    } else {
      onAnswer(answer);
    }
    setBusy(false);
  }

  return (
    <>
      <ConsentCheckbox
        id="settings-email-reminder"
        label={messages.attach.reminderLabel}
        checked={checked}
        disabled={busy}
        onChange={(granted) => {
          void change(granted);
        }}
      />
      {failed && (
        <p className={styles.note} role="status">
          {copy.reminderError}
        </p>
      )}
    </>
  );
}

function AccountBody() {
  const fetched = useMountFetch(fetchAccountState);
  const [current, setCurrent] = useState<AccountStateResponse>();
  const [detached, setDetached] = useState(false);
  const account = current ?? fetched;

  async function refresh(): Promise<void> {
    const fresh = await fetchAccountState();
    if (fresh) {
      setCurrent(fresh);
    }
  }

  if (account === undefined) {
    return null;
  }
  if (account === null) {
    return <p className={styles.body}>{copy.unavailable}</p>;
  }
  if (account.email === null) {
    return (
      <>
        {detached && (
          <p className={styles.body} role="status">
            {copy.detach.done}
          </p>
        )}
        <p className={styles.body}>{copy.none}</p>
        <AttachForm />
      </>
    );
  }
  return (
    <>
      <p className={styles.body}>
        {copy.attached}{" "}
        <strong className={styles.email}>{account.email}</strong>
      </p>
      <ReminderConsent
        checked={account.reminderConsent}
        onAnswer={(reminderConsent) => {
          setCurrent((prev) => {
            const base = prev ?? account;
            return base.email === null ? base : { ...base, reminderConsent };
          });
        }}
        onFailure={refresh}
      />
      <ConfirmAction
        labels={copy.detach}
        run={async () => {
          const done = await detachAccountEmail();
          if (!done) {
            await refresh();
          }
          return done;
        }}
        onDone={() => {
          setDetached(true);
          setCurrent({ email: null, reminderConsent: false });
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

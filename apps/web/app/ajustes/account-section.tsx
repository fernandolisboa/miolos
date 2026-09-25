"use client";

import { fetchAccountState } from "../../src/account/account-client";
import { useMountFetch } from "../../src/api/use-mount-fetch";
import { messages } from "../../src/i18n";
import styles from "./page.module.css";

function AccountBody() {
  const copy = messages.settings.account;
  const account = useMountFetch(fetchAccountState);

  if (account === undefined) {
    return null;
  }
  if (account === null) {
    return <p className={styles.body}>{copy.unavailable}</p>;
  }
  if (account.email === null) {
    return <p className={styles.body}>{copy.none}</p>;
  }
  return (
    <p className={styles.body}>
      {copy.attached} <strong className={styles.email}>{account.email}</strong>
    </p>
  );
}

export function AccountSection() {
  return (
    <section className={styles.card} aria-labelledby="settings-account-heading">
      <h2 id="settings-account-heading" className={styles.heading}>
        {messages.settings.account.heading}
      </h2>
      <AccountBody />
    </section>
  );
}

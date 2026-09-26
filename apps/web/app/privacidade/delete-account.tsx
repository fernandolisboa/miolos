"use client";

import { useState } from "react";

import { deleteAccount } from "../../src/attach/attach-client";
import { ConfirmAction } from "../../src/components/confirm-action";
import { deleteAccountAnchor, messages } from "../../src/i18n";
import styles from "./page.module.css";

export function DeleteAccount() {
  const [done, setDone] = useState(false);
  const copy = messages.deleteAccount;

  return (
    <section id={deleteAccountAnchor} className={styles.deleteSection}>
      <h2 className={styles.heading}>{copy.heading}</h2>
      <p className={styles.body}>{copy.explain}</p>

      {done ? (
        <div>
          <p className={styles.deleteDone}>{copy.done}</p>
          <p className={styles.body}>{copy.doneNote}</p>
        </div>
      ) : (
        <ConfirmAction
          labels={copy}
          run={deleteAccount}
          onDone={() => {
            setDone(true);
          }}
        />
      )}
    </section>
  );
}

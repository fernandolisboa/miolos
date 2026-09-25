"use client";

import { useState } from "react";

import { dismissAttachPrompt } from "../src/attach/attach-client";
import { AttachForm } from "../src/attach/attach-form";
import { useAttachState } from "../src/attach/use-attach-state";
import { messages } from "../src/i18n";
import styles from "./hub-attach.module.css";

export function HubAttach() {
  const state = useAttachState();
  const [dismissed, setDismissed] = useState(false);

  if (state?.eligible !== true || dismissed) {
    return null;
  }

  return (
    <aside className={styles.card}>
      <div aria-hidden className={styles.tape} />
      <p className={styles.invitation}>{messages.attach.invitation}</p>
      <AttachForm
        onDismiss={() => {
          setDismissed(true);
          void dismissAttachPrompt();
        }}
      />
    </aside>
  );
}

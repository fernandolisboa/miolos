"use client";

/**
 * The confirm island (#21, D3): one explicit button whose POST is the only
 * consumer of the token. States: missing token → explainer; ready → the
 * button; posting → settle; success → result copy per `{merged}`; a dead
 * link (410) or a conflict (409) → the re-request explainer linking home.
 * A settled network failure returns to the button with an inline line —
 * the token may still be alive, so nothing tells the player to burn it.
 */
import Link from "next/link";
import { useState } from "react";

import { confirmAttach } from "../../src/attach/attach-client";
import { messages, routes } from "../../src/i18n";
import styles from "./page.module.css";

type Phase =
  "ready" | "posting" | "attached" | "merged" | "invalid" | "conflict";

export function AttachConfirm({ token }: { readonly token: string }) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [failed, setFailed] = useState(false);

  if (token === "") {
    return (
      <section className={styles.card} data-confirm-state="missing">
        <h2 className={styles.stateTitle}>
          {messages.confirm.missingToken.title}
        </h2>
        <p className={styles.stateBody}>{messages.confirm.missingToken.body}</p>
        <Link className={styles.homeLink} href={routes.home}>
          {messages.confirm.backHome}
        </Link>
      </section>
    );
  }

  async function confirm(): Promise<void> {
    setPhase("posting");
    setFailed(false);
    const result = await confirmAttach(token);
    if (result === "invalid-or-expired") {
      setPhase("invalid");
      return;
    }
    if (result === "conflict") {
      setPhase("conflict");
      return;
    }
    if (result === undefined) {
      setFailed(true);
      setPhase("ready");
      return;
    }
    setPhase(result.merged ? "merged" : "attached");
  }

  if (phase === "attached" || phase === "merged") {
    const copy =
      phase === "merged" ? messages.confirm.merged : messages.confirm.attached;
    return (
      <section className={styles.card} data-confirm-state={phase}>
        <h2 className={styles.stateTitle}>{copy.title}</h2>
        <p className={styles.stateBody}>{copy.body}</p>
        <Link className={styles.homeLink} href={routes.home}>
          {messages.confirm.backHome}
        </Link>
      </section>
    );
  }

  if (phase === "invalid" || phase === "conflict") {
    const copy =
      phase === "invalid"
        ? messages.confirm.invalid
        : messages.confirm.conflict;
    return (
      <section className={styles.card} data-confirm-state={phase}>
        <h2 className={styles.stateTitle}>{copy.title}</h2>
        <p className={styles.stateBody}>{copy.body}</p>
        <Link className={styles.homeLink} href={routes.home}>
          {messages.confirm.backHome}
        </Link>
      </section>
    );
  }

  return (
    <section className={styles.card} data-confirm-state={phase}>
      <p className={styles.stateBody}>{messages.confirm.ready.lead}</p>
      {failed && (
        <p className={styles.failedLine} role="status">
          {messages.confirm.failed}
        </p>
      )}
      <button
        type="button"
        className={styles.confirmButton}
        disabled={phase === "posting"}
        onClick={() => {
          void confirm();
        }}
      >
        {phase === "posting"
          ? messages.confirm.posting
          : messages.confirm.ready.cta}
      </button>
    </section>
  );
}

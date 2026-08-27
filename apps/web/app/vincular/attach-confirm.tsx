"use client";

import Link from "next/link";
import { useState } from "react";

import { confirmAttach } from "../../src/attach/attach-client";
import { messages, routes } from "../../src/i18n";
import { useStreak } from "../../src/streak/use-streak";
import styles from "./page.module.css";

type Phase =
  "ready" | "posting" | "attached" | "merged" | "invalid" | "conflict";

const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;

export function AttachConfirm({ token }: { readonly token: string }) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [failed, setFailed] = useState(false);
  const [switchAck, setSwitchAck] = useState(false);

  const streak = useStreak();

  if (!TOKEN_SHAPE.test(token)) {
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

  const hasHistory =
    streak !== undefined &&
    streak !== null &&
    (streak.streak > 0 || streak.todayCounts);

  return (
    <section className={styles.card} data-confirm-state={phase}>
      <p className={styles.stateBody}>{messages.confirm.ready.lead}</p>
      <p className={styles.warnLine}>{messages.confirm.ready.warn}</p>
      {hasHistory && (
        <div className={styles.switchGate} data-switch-gate>
          <p className={styles.stateBody}>
            {messages.confirm.switchAccount.lead}
          </p>
          <label className={styles.consent} htmlFor="attach-switch-ack">
            <input
              id="attach-switch-ack"
              className={styles.checkbox}
              type="checkbox"
              checked={switchAck}
              onChange={(event) => {
                setSwitchAck(event.target.checked);
              }}
            />
            <span>{messages.confirm.switchAccount.label}</span>
          </label>
        </div>
      )}
      {failed && (
        <p className={styles.failedLine} role="status">
          {messages.confirm.failed}
        </p>
      )}
      <button
        type="button"
        className={styles.confirmButton}
        disabled={
          phase === "posting" ||
          streak === undefined ||
          (hasHistory && !switchAck)
        }
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

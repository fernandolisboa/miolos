"use client";

/**
 * The confirm island (#21, D3): one explicit button whose POST is the only
 * consumer of the token. States: missing or malformed token → explainer;
 * ready → the button; posting → settle; success → result copy per
 * `{merged}`; a dead link (410) or a conflict (409) → the re-request
 * explainer linking home. A settled network failure returns to the button
 * with an inline line — the token may still be alive, so nothing tells the
 * player to burn it.
 *
 * Two guards ride the ready state (step-7 findings A and D):
 * - the copy warns that only the person who JUST requested the link should
 *   confirm it — a magic link can be requested by anyone who knows the
 *   address, and the honest words are part of the defense;
 * - when THIS browser already carries a played account (the streak surface
 *   is the existing signal: streak > 0 or a counted today), the POST is
 *   gated behind an explicit switch-account acknowledgement — confirming
 *   replaces this device's session with the linked account's, and a
 *   bystander clicking a forwarded link must not lose their own streak to
 *   a silent cookie swap. Cookieless and zero-history browsers (the
 *   recovery user) see no extra step.
 */
import Link from "next/link";
import { useState } from "react";

import { confirmAttach } from "../../src/attach/attach-client";
import { messages, routes } from "../../src/i18n";
import { useStreak } from "../../src/streak/use-streak";
import styles from "./page.module.css";

type Phase =
  "ready" | "posting" | "attached" | "merged" | "invalid" | "conflict";

/**
 * The raw token's one legal shape — `generateSessionToken`'s 32 Web-Crypto
 * bytes as 43 base64url chars (pinned by T-API-S62). Anything else can
 * never claim, so it renders the incomplete-link explainer instead of
 * POSTing a body the api would 400 (step-7 finding K: a truncated link
 * must read as broken, never as retryable).
 */
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;

export function AttachConfirm({ token }: { readonly token: string }) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [failed, setFailed] = useState(false);
  const [switchAck, setSwitchAck] = useState(false);
  // The bystander signal (step-7 finding D): the existing streak surface,
  // no new endpoint. `undefined` = unsettled (the button waits — a gate
  // that arrives after the click is no gate); `null` = settled without a
  // value (cookieless, offline, 401 — the recovery user's shape).
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

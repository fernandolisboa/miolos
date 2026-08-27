"use client";

import { attachRequestSchema } from "@miolos/core";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import {
  dismissAttachPrompt,
  requestAttachLink,
} from "../src/attach/attach-client";
import { useAttachState } from "../src/attach/use-attach-state";
import { messages, routes } from "../src/i18n";
import styles from "./hub-attach.module.css";

type Phase = "form" | "sending" | "sent";
type AttachError =
  "generic" | "invalidEmail" | "rateLimited" | "alreadyAttached";

export function HubAttach() {
  const state = useAttachState();
  const [dismissed, setDismissed] = useState(false);
  const [phase, setPhase] = useState<Phase>("form");
  const [sentTo, setSentTo] = useState("");
  const [email, setEmail] = useState("");
  const [recovery, setRecovery] = useState(false);
  const [reminder, setReminder] = useState(false);
  const [error, setError] = useState<AttachError | null>(null);

  if (state?.eligible !== true || dismissed) {
    return null;
  }

  function dismiss(): void {
    setDismissed(true);
    void dismissAttachPrompt();
  }

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();

    const parsed = attachRequestSchema.safeParse({
      email,
      recoveryConsent: recovery,
      reminderConsent: reminder,
    });
    if (!parsed.success) {
      setError("invalidEmail");
      return;
    }
    setPhase("sending");
    setError(null);
    const result = await requestAttachLink(parsed.data);
    if (result === "sent") {
      setSentTo(parsed.data.email);
      setPhase("sent");
      return;
    }
    setPhase("form");
    setError(
      result === "rate-limited"
        ? "rateLimited"
        : result === "already-attached"
          ? "alreadyAttached"
          : "generic",
    );
  }

  return (
    <aside className={styles.card} data-attach-state={phase}>
      <div aria-hidden className={styles.tape} />
      <p className={styles.invitation}>{messages.attach.invitation}</p>

      {phase === "sent" ? (
        <div className={styles.sent}>
          <p className={styles.sentLine}>{messages.attach.sent(sentTo)}</p>
          <p className={styles.sentNote}>{messages.attach.sentNote}</p>
        </div>
      ) : (
        <>
          <p className={styles.lead}>{messages.attach.lead}</p>
          <form
            className={styles.form}
            onSubmit={(event) => {
              void submit(event);
            }}
          >
            <label className={styles.emailLabel} htmlFor="attach-email">
              {messages.attach.emailLabel}
            </label>
            <input
              id="attach-email"
              className={styles.emailInput}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
              }}
            />

            <label className={styles.consent} htmlFor="attach-recovery">
              <input
                id="attach-recovery"
                className={styles.checkbox}
                type="checkbox"
                checked={recovery}
                onChange={(event) => {
                  setRecovery(event.target.checked);
                }}
              />
              <span>{messages.attach.recoveryLabel}</span>
            </label>

            <label className={styles.consent} htmlFor="attach-reminder">
              <input
                id="attach-reminder"
                className={styles.checkbox}
                type="checkbox"
                checked={reminder}
                onChange={(event) => {
                  setReminder(event.target.checked);
                }}
              />
              <span>{messages.attach.reminderLabel}</span>
            </label>

            <p className={styles.privacyLine}>
              {messages.attach.privacyLinkLead}{" "}
              <Link className={styles.privacyLink} href={routes.privacy}>
                {messages.attach.privacyLinkLabel}
              </Link>
              {" · "}
              <Link className={styles.privacyLink} href={routes.terms}>
                {messages.attach.termsLinkLabel}
              </Link>
            </p>

            {error !== null && (
              <p className={styles.error} role="status">
                <span aria-hidden className={styles.errorChip} />
                {messages.attach.errors[error]}
              </p>
            )}

            <div className={styles.actions}>
              <button
                type="submit"
                className={styles.submit}
                disabled={!recovery || phase === "sending"}
              >
                {phase === "sending"
                  ? messages.attach.sending
                  : messages.attach.submit}
              </button>
              <button
                type="button"
                className={styles.dismiss}
                onClick={dismiss}
              >
                {messages.attach.dismiss}
              </button>
            </div>
          </form>
        </>
      )}
    </aside>
  );
}

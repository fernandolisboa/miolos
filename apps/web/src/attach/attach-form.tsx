"use client";

import { attachRequestSchema } from "@miolos/core";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { messages, routes } from "../i18n";
import { requestAttachLink } from "./attach-client";
import styles from "./attach-form.module.css";

type Phase = "form" | "sending" | "sent";
type AttachError =
  "generic" | "invalidEmail" | "rateLimited" | "alreadyAttached";

export function ConsentCheckbox({
  id,
  label,
  checked,
  disabled = false,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={styles.consent} htmlFor={id}>
      <input
        id={id}
        className={styles.checkbox}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
      />
      <span>{label}</span>
    </label>
  );
}

export function AttachForm({ onDismiss }: { onDismiss?: () => void }) {
  const [phase, setPhase] = useState<Phase>("form");
  const [sentTo, setSentTo] = useState("");
  const [email, setEmail] = useState("");
  const [recovery, setRecovery] = useState(false);
  const [reminder, setReminder] = useState(false);
  const [error, setError] = useState<AttachError | null>(null);

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

  if (phase === "sent") {
    return (
      <div className={styles.sent} data-attach-state={phase}>
        <p className={styles.sentLine}>{messages.attach.sent(sentTo)}</p>
        <p className={styles.sentNote}>{messages.attach.sentNote}</p>
      </div>
    );
  }

  return (
    <div data-attach-state={phase}>
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

        <ConsentCheckbox
          id="attach-recovery"
          label={messages.attach.recoveryLabel}
          checked={recovery}
          onChange={setRecovery}
        />
        <ConsentCheckbox
          id="attach-reminder"
          label={messages.attach.reminderLabel}
          checked={reminder}
          onChange={setReminder}
        />

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
          {onDismiss && (
            <button
              type="button"
              className={styles.dismiss}
              onClick={onDismiss}
            >
              {messages.attach.dismiss}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

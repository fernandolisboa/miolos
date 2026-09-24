"use client";

import { useEffect, useRef, useState } from "react";

import { messages } from "../i18n";
import { dismissPushPrompt } from "../push/push-client";
import {
  browserSupportsPush,
  currentPushSubscription,
  subscribeAndStore,
} from "../push/subscribe";
import { usePushState } from "../push/use-push-state";
import styles from "./push-prompt-card.module.css";

function askableHere(): boolean {
  return browserSupportsPush() && Notification.permission === "default";
}

function moveFocusPastCard(card: HTMLElement | null): void {
  const aside = card?.closest("aside");
  if (!card || !aside) {
    return;
  }
  const controls = [
    ...aside.querySelectorAll<HTMLElement>("a[href], button"),
  ].filter((control) => !card.contains(control));
  const following = controls.find(
    (control) =>
      (card.compareDocumentPosition(control) &
        Node.DOCUMENT_POSITION_FOLLOWING) !==
      0,
  );

  (following ?? controls.at(-1))?.focus();
}

export function PushPromptCard() {
  const state = usePushState(askableHere);
  const [browserGate, setBrowserGate] = useState(false);
  const [gone, setGone] = useState(false);

  const [inFlight, setInFlight] = useState(false);
  const cardRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!browserSupportsPush()) {
      return;
    }
    if (Notification.permission !== "default") {
      return;
    }
    currentPushSubscription()
      .then((subscription) => {
        if (!cancelled && subscription === null) {
          setBrowserGate(true);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (
    state?.eligible !== true ||
    state.vapidPublicKey === null ||
    !browserGate ||
    gone
  ) {
    return null;
  }
  const vapidPublicKey = state.vapidPublicKey;

  function accept(): void {
    setInFlight(true);
    void subscribeAndStore(vapidPublicKey).then((outcome) => {
      if (outcome === "retriable") {
        setInFlight(false);
        return;
      }
      if (outcome === "denied") {
        void dismissPushPrompt();
      }
      moveFocusPastCard(cardRef.current);
      setGone(true);
    });
  }

  function decline(): void {
    moveFocusPastCard(cardRef.current);
    setGone(true);
    void dismissPushPrompt();
  }

  return (
    <section
      ref={cardRef}
      className={styles.prompt}
      aria-labelledby="push-prompt-title"
    >
      <div aria-hidden className={styles.promptTape} />
      <h2 id="push-prompt-title" className={styles.promptTitle}>
        {messages.push.title}
      </h2>
      <p className={styles.promptBody}>{messages.push.body}</p>
      <div className={styles.promptActions}>
        <button
          type="button"
          className={styles.promptAccept}
          onClick={accept}
          disabled={inFlight}
        >
          {messages.push.accept}
        </button>
        <button
          type="button"
          className={styles.promptDecline}
          onClick={decline}
          disabled={inFlight}
        >
          {messages.push.decline}
        </button>
      </div>
    </section>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

import { messages } from "../i18n";
import {
  applicationServerKeyBytes,
  dismissPushPrompt,
  postPushSubscription,
} from "../push/push-client";
import { usePushState } from "../push/use-push-state";
import styles from "./push-prompt-card.module.css";

function browserSupportsPush(): boolean {
  return (
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

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

type SubscribeOutcome = "stored" | "denied" | "retriable";

async function subscribeAndStore(
  vapidPublicKey: string,
): Promise<SubscribeOutcome> {
  let subscription: PushSubscription;
  try {
    await navigator.serviceWorker.register("/sw.js");
    const registration = await navigator.serviceWorker.ready;
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKeyBytes(vapidPublicKey),
    });
  } catch {
    if (Notification.permission === "denied") {
      void dismissPushPrompt();
      return "denied";
    }
    return "retriable";
  }
  const json = subscription.toJSON();
  const p256dh = json.keys?.["p256dh"];
  const auth = json.keys?.["auth"];

  const stored =
    p256dh !== undefined && auth !== undefined && p256dh !== "" && auth !== ""
      ? await postPushSubscription({
          endpoint: subscription.endpoint,
          keys: { p256dh, auth },
        })
      : false;
  if (!stored) {
    try {
      await subscription.unsubscribe();
    } catch {
      // The server has no record of it either way.
    }
    return "retriable";
  }
  return "stored";
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
    navigator.serviceWorker
      .getRegistration()
      .then(
        (registration) => registration?.pushManager.getSubscription() ?? null,
      )
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

"use client";

import { useEffect, useState } from "react";

import { messages } from "../../src/i18n";
import {
  browserSupportsPush,
  currentPushSubscription,
  subscribeAndStore,
  unsubscribeAndForget,
} from "../../src/push/subscribe";
import { usePushState } from "../../src/push/use-push-state";
import styles from "./page.module.css";

type BrowserPush = "loading" | "unsupported" | "blocked" | "off" | "on";

async function readBrowserPush(): Promise<BrowserPush> {
  if (!browserSupportsPush()) {
    return "unsupported";
  }
  if (Notification.permission === "denied") {
    return "blocked";
  }
  return (await currentPushSubscription()) === null ? "off" : "on";
}

function viewOf(
  browser: BrowserPush,
  serverPending: boolean,
  vapidPublicKey: string | null,
): BrowserPush {
  if (browser !== "off" || vapidPublicKey !== null) {
    return browser;
  }
  return serverPending ? "loading" : "unsupported";
}

export function PushSection() {
  const copy = messages.settings.push;
  const server = usePushState(browserSupportsPush);
  const [browser, setBrowser] = useState<BrowserPush>("loading");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void readBrowserPush()
      .catch((): BrowserPush => "unsupported")
      .then((read) => {
        if (!cancelled) {
          setBrowser(read);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const vapidPublicKey = server?.vapidPublicKey ?? null;
  const view = viewOf(browser, server === undefined, vapidPublicKey);

  async function turnOn(key: string): Promise<void> {
    const outcome = await subscribeAndStore(key);
    setBrowser(
      outcome === "stored" ? "on" : outcome === "denied" ? "blocked" : "off",
    );
    setFailed(outcome === "retriable");
  }

  async function turnOff(): Promise<void> {
    const subscription = await currentPushSubscription().catch(() => null);
    const outcome =
      subscription === null
        ? "forgotten"
        : await unsubscribeAndForget(subscription);
    setBrowser(outcome === "kept" ? "on" : "off");
    setFailed(outcome !== "forgotten");
  }

  function toggle(): void {
    let change: Promise<void>;
    if (view === "on") {
      change = turnOff();
    } else if (vapidPublicKey !== null) {
      change = turnOn(vapidPublicKey);
    } else {
      return;
    }
    setBusy(true);
    setFailed(false);
    void change.finally(() => {
      setBusy(false);
    });
  }

  const switchable = view === "on" || view === "off";

  return (
    <section
      className={styles.card}
      aria-labelledby="settings-push-heading"
      data-push-state={busy ? "busy" : view}
    >
      <h2 id="settings-push-heading" className={styles.heading}>
        {copy.heading}
      </h2>
      <p className={styles.body}>{copy.lead}</p>

      {view === "unsupported" ? (
        <>
          <p className={styles.note}>{copy.unsupported}</p>
          <p className={styles.note}>{copy.installHint}</p>
        </>
      ) : view === "blocked" ? (
        <p className={styles.note}>{copy.blocked}</p>
      ) : (
        <div className={styles.switchRow}>
          <span id="settings-push-toggle">{copy.toggle}</span>
          <button
            type="button"
            role="switch"
            className={styles.switch}
            aria-labelledby="settings-push-toggle"
            aria-checked={view === "on"}
            disabled={!switchable || busy}
            onClick={toggle}
          >
            {busy || (view !== "on" && view !== "off") ? copy.busy : copy[view]}
          </button>
        </div>
      )}

      {failed ? (
        <p className={styles.note} role="status">
          {copy.error}
        </p>
      ) : null}
    </section>
  );
}

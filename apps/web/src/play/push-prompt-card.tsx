"use client";

/**
 * The push pre-prompt card (#145, ADR-0064; plan 058 §5) — the soft ask on
 * the conclusion surface, which IS the habitual play moment by construction
 * (the #32 shape §1: no derivation times the ask; placement does). Quiet
 * in-flow paper card in `ConclusionView`'s side column, directly below the
 * `StreakCard` slot — the streak number sits above the card that asks to
 * protect it — and above the day card. Never a modal, never floating,
 * never blocking (PRODUCT.md principle 4). `--accent-app`, never the game
 * accent: the streak is app identity (the StreakCard's own rule).
 *
 * Coordination with #142: its cross-device completed view is a second
 * conclusion-like surface; whether this card renders there is decided by
 * #142's plan (default: it does not — the card belongs to the genuine
 * post-solve conclusion only). This component is mounted by
 * `ConclusionView` alone.
 *
 * It renders `null` until EVERY gate says yes, so server markup, first
 * paint and `impeccable detect`'s clean profile are unchanged (the
 * hub-onboarding precedent). The gates, all required (plan 058 §5):
 *
 * - the TRIPLE feature detect — `"Notification" in window`,
 *   `"serviceWorker" in navigator`, `"PushManager" in window` — checked
 *   before touching ANY of the three APIs: iOS Safari without home-screen
 *   install lacks `Notification` and `PushManager`; `navigator.serviceWorker`
 *   is undefined in non-secure contexts and some private windows; older
 *   Safari/WebViews have `Notification` without Web Push. Any missing leg
 *   → the card never renders and never throws — no nagging on any of them
 *   (the email hedge is slice C's job).
 * - server `eligible === true` with a non-null key (streak >= the remote
 *   threshold, undismissed, VAPID configured — all server-owned).
 * - `Notification.permission === "default"` — never re-ask a granted or
 *   denied browser.
 * - this browser holds no subscription (`getRegistration()` →
 *   `pushManager.getSubscription()` resolves null/undefined).
 *
 * A `<section aria-labelledby>` with a plain `<h2>` (the hub-onboarding
 * a11y shape): the accessible name comes from the rendered title, so it
 * cannot drift from the copy. No uppercase body text (`all-caps-body`),
 * no kicker above the heading (`kicker-above-heading`).
 */
import { useEffect, useRef, useState } from "react";

import { messages } from "../i18n";
import {
  applicationServerKeyBytes,
  dismissPushPrompt,
  postPushSubscription,
} from "../push/push-client";
import { usePushState } from "../push/use-push-state";
import styles from "./push-prompt-card.module.css";

/** The triple feature detect — checked before touching any of the three. */
function browserSupportsPush(): boolean {
  return (
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

/**
 * On accept or decline the card leaves the DOM, so focus must be placed
 * deliberately or it falls to `<body>` (the #67 class of focus-order
 * failure — the hub-onboarding `moveFocusToFirstGame` lesson). It goes to
 * the side column's next control after the card — the CTA in the shipped
 * layout — found structurally rather than by class (CSS-Modules names are
 * hashed) or by href (the CTA's target varies with the day's state).
 * Called BEFORE the card unmounts, while `closest` still works; absent an
 * enclosing `<aside>` — a test rendering the card alone — nothing happens.
 * Programmatic focus after a pointer click does not match
 * `:focus-visible`, so a touch player sees no ring.
 */
function moveFocusPastCard(card: HTMLElement | null): void {
  const aside = card?.closest("aside");
  if (!card || !aside) {
    return;
  }
  for (const control of aside.querySelectorAll<HTMLElement>(
    "a[href], button",
  )) {
    if (!card.contains(control)) {
      control.focus();
      return;
    }
  }
}

/**
 * The accept flow, in the order that works (plan 058 §2): `register()`
 * resolves while the worker is still installing, and the Push API rejects
 * `subscribe()` with `InvalidStateError` when the registration has no
 * active worker — so the `ready` wait between them is load-bearing;
 * without it the first click ever fails silently. All inside the user
 * gesture: transient activation is time-based and survives the awaits (the
 * sw is tiny and activates in milliseconds).
 *
 * Failure semantics (plan 058 §5): a rejection with the permission now
 * `"denied"` stamps the permanent dismissal — the browser remembers the
 * denial anyway; our stamp keeps every other surface honest. A TRANSIENT
 * failure (permission still `"default"`/`"granted"`) stamps nothing — the
 * card simply went for this visit and may return on the next.
 */
async function subscribeAndStore(vapidPublicKey: string): Promise<void> {
  try {
    await navigator.serviceWorker.register("/sw.js");
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKeyBytes(vapidPublicKey),
    });
    const json = subscription.toJSON();
    const p256dh = json.keys?.["p256dh"];
    const auth = json.keys?.["auth"];
    if (!p256dh || !auth) {
      // A subscription without its keys is a row the dispatcher could
      // never send to — the strict contract would 400 it anyway.
      return;
    }
    await postPushSubscription({
      endpoint: subscription.endpoint,
      keys: { p256dh, auth },
    });
  } catch {
    if (Notification.permission === "denied") {
      void dismissPushPrompt();
    }
  }
}

export function PushPromptCard() {
  const state = usePushState();
  const [browserGate, setBrowserGate] = useState(false);
  const [gone, setGone] = useState(false);
  const cardRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // The browser-side gates, settled once per mount. The detect guards
    // every API touch below it; the effect-scoped flag makes strict-mode
    // double effects and out-of-order resolutions harmless.
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
      // A throwing registration read is an absent card, never an error.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // Absent until every gate says yes, and gone forever on either terminal
  // act — decline stamps server-side; accept subscribes this browser.
  if (
    state?.eligible !== true ||
    state.vapidPublicKey === null ||
    !browserGate ||
    gone
  ) {
    return null;
  }
  const vapidPublicKey = state.vapidPublicKey;

  // Both handlers remove the card on the click, before the network
  // answers (the hub-onboarding dismiss shape): a failed call costs one
  // more sighting on a later visit — never a spinner between a player and
  // a button whose purpose is to get out of the way. Focus moves first,
  // while the card is still in the DOM.
  function accept(): void {
    moveFocusPastCard(cardRef.current);
    setGone(true);
    void subscribeAndStore(vapidPublicKey);
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
      {/* Prompt-scoped class names throughout (the hub-onboarding
          .intro/.introTape rule): CSS Modules hash per file, but the visual
          gate for this surface is a NON-SCOPED fixture emission that links
          this sheet beside conclusion-view.module.css, which already owns
          .title and .tape. */}
      <div aria-hidden className={styles.promptTape} />
      <h2 id="push-prompt-title" className={styles.promptTitle}>
        {messages.push.title}
      </h2>
      <p className={styles.promptBody}>{messages.push.body}</p>
      <div className={styles.promptActions}>
        <button type="button" className={styles.promptAccept} onClick={accept}>
          {messages.push.accept}
        </button>
        <button
          type="button"
          className={styles.promptDecline}
          onClick={decline}
        >
          {messages.push.decline}
        </button>
      </div>
    </section>
  );
}

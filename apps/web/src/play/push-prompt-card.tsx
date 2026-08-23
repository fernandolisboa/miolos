"use client";

/**
 * The push pre-prompt card — the soft ask on the conclusion surface, which
 * IS the habitual play moment by construction. Quiet in-flow paper card
 * LAST in `ConclusionView`'s side column (the `ConclusionAside` `prompt`
 * slot): the card mounts hundreds of ms after paint, so the last position
 * is what makes the insertion shift nothing. Never a modal, never
 * floating, never blocking (PRODUCT.md principle 4). `--accent-app`, never
 * the game accent: the streak is app identity (the StreakCard's own rule).
 *
 * Its cross-device completed view (`RemoteConclusionView`) is a second
 * conclusion-like surface and the card NEVER renders there — the remote
 * view leaves `ConclusionAside`'s `prompt` slot empty, per ADR-0065
 * decision 8. This component is mounted by the local `ConclusionView`
 * alone.
 *
 * It renders `null` until EVERY gate says yes, so server markup, first
 * paint and `impeccable detect`'s clean profile are unchanged (the
 * hub-onboarding precedent). The two synchronous gates below additionally
 * SUPPRESS THE STATE FETCH: each one conclusively proves the card can
 * never render here, so a browser that fails them fires no credentialed
 * GET at all — `usePushState(enabled)` carries the switch. The gates, all
 * required:
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
 * The two FREE synchronous gates as `usePushState`'s fetch switch: each
 * one conclusively proves the card can never render here, so a browser
 * that fails either fires NO credentialed GET — which runs the account's
 * whole streak read server-side — on any conclusion, ever. Module-level
 * so its identity is stable and the hook's effect runs once; evaluated
 * inside that effect, never during render, so the server markup and the
 * pre-hydration paint stay byte-for-byte identical.
 */
function askableHere(): boolean {
  return browserSupportsPush() && Notification.permission === "default";
}

/**
 * On accept or decline the card leaves the DOM, so focus must be placed
 * deliberately or it falls to `<body>`. It goes to the side column's
 * first control AFTER the card — POSITIONALLY, via
 * `compareDocumentPosition`: the old first-non-card-match walk was only
 * correct by accident of the layout, and a control gaining a link above
 * the card would have silently sent focus backwards. In the shipped
 * layout the card is the aside's LAST child, so no following control
 * exists and focus falls back to the nearest PRECEDING control (the
 * stats link) — the element adjacent to where the card just was, which is
 * where a sighted keyboard user expects to land. Found structurally
 * rather than by class (CSS-Modules names are hashed) or by href (the
 * CTA's target varies with the day's state). Called BEFORE the card
 * unmounts, while `closest` still works; absent an enclosing `<aside>` —
 * a test rendering the card alone — nothing happens. Programmatic focus
 * after a pointer click does not match `:focus-visible`, so a touch
 * player sees no ring.
 */
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
  // querySelectorAll is document order, so when nothing follows the card
  // the last remaining control is the nearest preceding one.
  (following ?? controls.at(-1))?.focus();
}

/**
 * The accept flow's outcome, decided for the card: `"stored"` ends the
 * card, `"denied"` ends it with the permanent stamp, `"retriable"` keeps
 * it on screen with its buttons live again.
 */
type SubscribeOutcome = "stored" | "denied" | "retriable";

/**
 * The accept flow, in the order that works: `register()` resolves while
 * the worker is still installing, and the Push API rejects `subscribe()`
 * with `InvalidStateError` when the registration has no active worker —
 * so the `ready` wait between them is load-bearing; without it the first
 * click ever fails silently. All inside the user gesture: transient
 * activation is time-based and survives the awaits (the sw is tiny and
 * activates in milliseconds).
 *
 * Failure semantics: a `subscribe()` rejection with the permission now
 * `"denied"` stamps the permanent dismissal — the browser remembers the
 * denial anyway; our stamp keeps every other surface honest. A TRANSIENT
 * subscribe failure (permission still `"default"`/`"granted"`) stamps
 * nothing. And when the browser subscription EXISTS but the server never
 * stored it — a keyless subscription, or a failed POST — the subscription
 * is UNWOUND with `unsubscribe()`, best-effort, so the browser and the
 * server can never permanently disagree.
 */
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
  // A subscription without its keys is a row the dispatcher could never
  // send to — the strict contract would 400 it anyway — so it is unwound
  // like a failed POST rather than stored or abandoned.
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
      // Best-effort: an unsubscribe that itself fails leaves the browser
      // subscribed with no server row, but there is nothing further to do
      // from here.
    }
    return "retriable";
  }
  return "stored";
}

export function PushPromptCard() {
  const state = usePushState(askableHere);
  const [browserGate, setBrowserGate] = useState(false);
  const [gone, setGone] = useState(false);
  // The accept flow in flight: the card STAYS on screen with its buttons
  // disabled until the permission dialog and the store settle — the
  // card's copy is the browser prompt's only on-screen framing, so
  // unmounting it synchronously would leave a bare permission dialog with
  // no context.
  const [inFlight, setInFlight] = useState(false);
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

  // The two handlers deliberately differ: DECLINE removes the card on the
  // click, before the network answers (the hub-onboarding dismiss shape)
  // — a failed stamp costs one more sighting on a later visit, because the
  // permission is untouched. ACCEPT cannot make that promise: it changes
  // the browser's permission, so the card stays (disabled) until the flow
  // settles, leaves only on a terminal outcome, and re-arms on a transient
  // one so the player can retry in place. Focus moves while the card is
  // still in the DOM.
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

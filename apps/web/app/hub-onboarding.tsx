"use client";

/**
 * The first-visit introduction card (#35, ADR-0061) — the hub's fifth
 * client fragment, beside `hub-day-state.tsx`'s two, `hub-streak.tsx` and
 * `hub-attach.tsx`, and for the same mechanical reason (CSS Modules hash
 * per file). Quiet, in-flow paper after the game cards: never a modal
 * takeover, never floating, never blocking (PRODUCT.md principle 4;
 * "nothing nags"). One card, ~40 words, one action — onboarding sells the
 * ritual, not the rules; per-game rules live on the play screens.
 *
 * It renders `null` until the server says `show: true`, so the server
 * render and first paint are unchanged (T-WEB-S127's no-fetch-at-render
 * contract intact) and `impeccable detect`'s clean profile sees the hub
 * without it — the hub-attach precedent. The "seen" fact is server-owned
 * end to end (GET /onboarding/state, POST /onboarding/seen): no device
 * storage anywhere in this feature (T-WEB-S136 greps these sources for
 * the browser storage API by name — which is why this comment does not
 * spell it), because the acceptance's "per identity, surviving
 * attach/merge" is a thing a per-device store cannot do.
 *
 * A `<section aria-labelledby>`, not a second unnamed `<aside>`: for the
 * one visitor who ever sees it this is the screen's primary content, the
 * accessible name comes from the rendered heading so it cannot drift from
 * the copy, and the `<h2>` joins the outline after the four game-card
 * `<h2>`s, skipping nothing (plan 057 D6a).
 */
import { useState } from "react";

import { messages, playRoutes } from "../src/i18n";
import { markOnboardingSeen } from "../src/onboarding/onboarding-client";
import { useOnboardingState } from "../src/onboarding/use-onboarding-state";
import styles from "./hub-onboarding.module.css";

/**
 * On dismiss the button leaves the DOM, so focus must be placed
 * deliberately or it falls to `<body>` and the next Tab restarts at the
 * masthead — the #67 class of focus-order failure. It goes to the first
 * game card's action, which is also the product intent: get out of the way
 * and let them play.
 *
 * Selected by href, never by class: the CTA's class is a CSS-Modules hash.
 * A comma-joined selector returns the FIRST match in document order, so
 * this follows page.tsx's `gameOrder` without importing it (that const is
 * module-local to a server component) and survives a reorder. Absent — a
 * test rendering the island alone — nothing happens. Programmatic focus
 * after a pointer click does not match `:focus-visible`, so a touch player
 * sees no ring; a keyboard player lands on the first game.
 */
function moveFocusToFirstGame(): void {
  const firstGameLink = Object.values(playRoutes)
    .map((route) => `a[href="${route}"]`)
    .join(",");
  document.querySelector<HTMLAnchorElement>(firstGameLink)?.focus();
}

export function HubOnboarding() {
  const state = useOnboardingState();
  const [seen, setSeen] = useState(false);

  // Absent until the server says otherwise, and gone forever on the one
  // terminal act — the server stamps the acknowledgement.
  if (state?.show !== true || seen) {
    return null;
  }

  // The card disappears on the click, before the network answers (the
  // hub-attach dismiss shape): a failed POST costs one more sighting on a
  // later visit — annoying once, never blocking. The alternative (await,
  // spinner, error state) would put a round trip between a player and a
  // button whose whole purpose is to get out of the way.
  function dismiss(): void {
    setSeen(true);
    moveFocusToFirstGame();
    void markOnboardingSeen();
  }

  return (
    <section className={styles.intro} aria-labelledby="onboarding-title">
      <div aria-hidden className={styles.introTape} />
      <h2 id="onboarding-title" className={styles.invitation}>
        {messages.onboarding.invitation}
      </h2>
      <p className={styles.body}>{messages.onboarding.lead}</p>
      <p className={styles.body}>{messages.onboarding.rollover}</p>
      <p className={styles.body}>{messages.onboarding.noAccount}</p>
      <button type="button" className={styles.dismiss} onClick={dismiss}>
        {messages.onboarding.dismiss}
      </button>
    </section>
  );
}

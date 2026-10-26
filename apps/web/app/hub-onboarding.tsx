"use client";

import { useState } from "react";

import { HUB_CARDS_ID, HUB_DONE_ID } from "../src/hub/tuck";
import { messages, playRoutes } from "../src/i18n";
import { markOnboardingSeen } from "../src/onboarding/onboarding-client";
import { useOnboardingState } from "../src/onboarding/use-onboarding-state";
import styles from "./hub-onboarding.module.css";

const SHOWN = [
  `#${HUB_CARDS_ID} > :not([hidden])`,
  `#${HUB_DONE_ID} li:not([hidden])`,
];

function moveFocusToFirstGame(): void {
  const firstGameLink = SHOWN.flatMap((scope) =>
    Object.values(playRoutes).map((route) => `${scope} a[href="${route}"]`),
  ).join(",");
  document.querySelector<HTMLAnchorElement>(firstGameLink)?.focus();
}

export function HubOnboarding() {
  const state = useOnboardingState();
  const [seen, setSeen] = useState(false);

  if (state?.show !== true || seen) {
    return null;
  }

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

"use client";

import {
  googleSignInOutcomeSchema,
  type AccountGoogleResponse,
  type GoogleSignInOutcome,
} from "@miolos/core";
import { useEffect, useState } from "react";

import {
  fetchGoogleState,
  googleStartUrl,
  unlinkGoogle,
} from "../../src/account/google-client";
import { useMountFetch } from "../../src/api/use-mount-fetch";
import { ConfirmAction } from "../../src/components/confirm-action";
import { messages } from "../../src/i18n";
import styles from "./page.module.css";

const copy = messages.settings.google;

function readCallbackOutcome(): GoogleSignInOutcome | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  const parsed = googleSignInOutcomeSchema.safeParse(
    new URL(window.location.href).searchParams.get("google"),
  );
  return parsed.success ? parsed.data : undefined;
}

function useCallbackOutcome(): GoogleSignInOutcome | undefined {
  const [outcome] = useState(readCallbackOutcome);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has("google")) {
      url.searchParams.delete("google");
      window.history.replaceState(window.history.state, "", url);
    }
  }, []);
  return outcome;
}

export function GoogleSection() {
  const fetched = useMountFetch(fetchGoogleState);
  const outcome = useCallbackOutcome();
  const [afterUnlink, setAfterUnlink] = useState<
    AccountGoogleResponse["google"] | null
  >();
  const unlinked = afterUnlink !== undefined;
  const state = unlinked ? "unlinked" : fetched;
  const startUrl =
    state === "unlinked" && (!unlinked || afterUnlink === "unlinked")
      ? googleStartUrl()
      : undefined;

  if (state !== "linked" && state !== "unlinked" && !outcome) {
    return null;
  }
  return (
    <section className={styles.card} aria-labelledby="settings-google-heading">
      <h2 id="settings-google-heading" className={styles.heading}>
        {copy.heading}
      </h2>
      {outcome && !unlinked && (
        <p className={styles.body} role="status">
          {copy.outcome[outcome]}
        </p>
      )}
      {unlinked && (
        <p className={styles.body} role="status">
          {copy.unlink.done}
        </p>
      )}
      {state === "linked" && (
        <>
          <p className={styles.body}>{copy.linked}</p>
          <ConfirmAction
            labels={copy.unlink}
            run={unlinkGoogle}
            onDone={() => {
              setAfterUnlink(null);
              void fetchGoogleState().then((next) => {
                setAfterUnlink(next ?? null);
              });
            }}
          />
        </>
      )}
      {state === "unlinked" && (
        <>
          <p className={styles.body}>{copy.lead}</p>
          <p className={styles.note}>{copy.mergeNote}</p>
          {startUrl !== undefined && (
            <a className={styles.primaryLink} href={startUrl}>
              {copy.start}
            </a>
          )}
        </>
      )}
    </section>
  );
}

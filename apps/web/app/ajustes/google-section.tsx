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

type Card = {
  state: AccountGoogleResponse["google"] | null;
  outcome: GoogleSignInOutcome | undefined;
};

function readCallbackOutcome(): GoogleSignInOutcome | undefined {
  const parsed = googleSignInOutcomeSchema.safeParse(
    new URL(window.location.href).searchParams.get("google"),
  );
  return parsed.success ? parsed.data : undefined;
}

function stripCallbackOutcome(): void {
  const url = new URL(window.location.href);
  if (url.searchParams.has("google")) {
    url.searchParams.delete("google");
    window.history.replaceState(window.history.state, "", url);
  }
}

async function readCard(): Promise<Card> {
  const outcome = readCallbackOutcome();
  return { state: (await fetchGoogleState()) ?? null, outcome };
}

export function GoogleSection() {
  const card = useMountFetch(readCard);
  useEffect(() => {
    if (card !== undefined) {
      stripCallbackOutcome();
    }
  }, [card]);
  const [didUnlink, setDidUnlink] = useState(false);
  const [reread, setReread] = useState<
    AccountGoogleResponse["google"] | null
  >();
  const state = didUnlink ? reread : card?.state;
  const outcome = didUnlink ? undefined : card?.outcome;
  const done = didUnlink && state !== "linked";

  if (state !== "linked" && state !== "unlinked" && !outcome && !done) {
    return null;
  }
  const startUrl = state === "unlinked" ? googleStartUrl() : undefined;
  return (
    <section className={styles.card} aria-labelledby="settings-google-heading">
      <h2 id="settings-google-heading" className={styles.heading}>
        {copy.heading}
      </h2>
      {outcome && (
        <p className={styles.body} role="status">
          {copy.outcome[outcome]}
        </p>
      )}
      {done && (
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
              setDidUnlink(true);
              void fetchGoogleState().then((next) => {
                setReread(next ?? null);
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

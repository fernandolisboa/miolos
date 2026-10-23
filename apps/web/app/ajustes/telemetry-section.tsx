"use client";

import Link from "next/link";
import { useState } from "react";

import {
  fetchTelemetrySending,
  setTelemetrySending,
} from "../../src/account/telemetry-client";
import { useMountFetch } from "../../src/api/use-mount-fetch";
import { Switch } from "../../src/components/switch";
import switchStyles from "../../src/components/switch.module.css";
import { messages, routes } from "../../src/i18n";
import styles from "./page.module.css";

const copy = messages.settings.telemetry;

function TelemetrySwitch() {
  const fetched = useMountFetch(fetchTelemetrySending);
  const [current, setCurrent] = useState<boolean>();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const sending = current ?? fetched;

  if (sending === undefined) {
    return null;
  }
  if (sending === null) {
    return <p className={styles.note}>{copy.unavailable}</p>;
  }

  async function toggle(next: boolean): Promise<void> {
    setBusy(true);
    setFailed(false);
    const answer = await setTelemetrySending(next);
    setFailed(answer === undefined);
    const settled = answer ?? (await fetchTelemetrySending());
    if (settled !== undefined) {
      setCurrent(settled);
    }
    setBusy(false);
  }

  return (
    <>
      <div className={switchStyles.switchRow}>
        <span id="settings-telemetry-toggle">{copy.toggle}</span>
        <Switch
          labelledBy="settings-telemetry-toggle"
          checked={sending}
          disabled={busy}
          onToggle={(next) => {
            void toggle(next);
          }}
        >
          {busy ? copy.busy : sending ? copy.on : copy.off}
        </Switch>
      </div>
      {failed && (
        <p className={styles.note} role="status">
          {copy.error}
        </p>
      )}
    </>
  );
}

export function TelemetrySection() {
  return (
    <section
      className={styles.card}
      aria-labelledby="settings-telemetry-heading"
    >
      <h2 id="settings-telemetry-heading" className={styles.heading}>
        {copy.heading}
      </h2>
      <p className={styles.body}>{copy.lead}</p>
      <TelemetrySwitch />
      <Link className={styles.textLink} href={routes.privacy}>
        {copy.privacyLink}
      </Link>
    </section>
  );
}

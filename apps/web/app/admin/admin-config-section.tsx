"use client";

import {
  defaultRemoteConfig,
  remoteConfigField,
  remoteConfigKeySchema,
  type AdminStateResponse,
  type RemoteConfigKey,
} from "@miolos/core";
import { useState } from "react";

import {
  fetchAdminState,
  saveRemoteConfigValue,
} from "../../src/admin/admin-client";
import { useMountFetch } from "../../src/api/use-mount-fetch";
import { messages } from "../../src/i18n";
import settings from "../ajustes/page.module.css";
import styles from "./admin.module.css";

const copy = messages.admin;

function ConfigRow({
  configKey,
  value,
  busy,
  setBusy,
  onSaved,
}: {
  configKey: RemoteConfigKey;
  value: number;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  onSaved: (state: AdminStateResponse) => void;
}) {
  const field = remoteConfigField(configKey);
  const min = field.minValue ?? undefined;
  const max = field.maxValue ?? undefined;
  const [draft, setDraft] = useState<string>();
  const [outcome, setOutcome] = useState<"saved" | "failed">();
  const shown = draft ?? String(value);
  const parsed = field.safeParse(shown === "" ? Number.NaN : Number(shown));
  const id = `admin-${configKey}`;

  async function save(next: number): Promise<void> {
    setBusy(true);
    const state = await saveRemoteConfigValue(configKey, next);
    setBusy(false);
    setOutcome(state ? "saved" : "failed");
    if (state) {
      setDraft(undefined);
      onSaved(state);
    }
  }

  return (
    <div className={styles.row}>
      <label className={styles.label} htmlFor={id}>
        {copy.keys[configKey].label}
      </label>
      <p className={settings.note}>{copy.keys[configKey].hint}</p>
      <div className={styles.controls}>
        <input
          id={id}
          className={styles.input}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={1}
          value={shown}
          disabled={busy}
          onChange={(event) => {
            setDraft(event.target.value);
            setOutcome(undefined);
          }}
        />
        <span className={styles.range}>
          {copy.config.range(min, max, defaultRemoteConfig[configKey])}
        </span>
        <button
          type="button"
          className={styles.save}
          aria-label={copy.config.saveAria(copy.keys[configKey].label)}
          disabled={busy || !parsed.success || parsed.data === value}
          onClick={() => {
            if (parsed.success) {
              void save(parsed.data);
            }
          }}
        >
          {copy.config.save}
        </button>
      </div>
      {outcome && (
        <p className={settings.note} role="status">
          {copy.config[outcome]}
        </p>
      )}
    </div>
  );
}

function AdminBody() {
  const fetched = useMountFetch(fetchAdminState);
  const [current, setCurrent] = useState<AdminStateResponse>();
  const [saving, setSaving] = useState(false);
  const state = current ?? fetched;

  if (state === undefined) {
    return null;
  }
  if (state === null) {
    return <p className={settings.body}>{copy.config.unavailable}</p>;
  }
  const { config } = state;
  if (config === null) {
    return (
      <>
        <p className={settings.body}>{copy.config.notAdmin}</p>
        <p className={settings.note}>
          {copy.config.userIdLabel}{" "}
          <code className={styles.userId}>{state.userId}</code>
        </p>
      </>
    );
  }
  return (
    <>
      {remoteConfigKeySchema.options.map((key) => (
        <ConfigRow
          key={key}
          configKey={key}
          value={config[key]}
          busy={saving}
          setBusy={setSaving}
          onSaved={setCurrent}
        />
      ))}
    </>
  );
}

export function AdminConfigSection() {
  return (
    <section className={settings.card} aria-labelledby="admin-config-heading">
      <h2 id="admin-config-heading" className={settings.heading}>
        {copy.config.heading}
      </h2>
      <AdminBody />
    </section>
  );
}

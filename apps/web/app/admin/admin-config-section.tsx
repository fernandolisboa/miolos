"use client";

import {
  defaultRemoteConfig,
  remoteConfigField,
  remoteConfigKeySchema,
  type AdminStateResponse,
  type RemoteConfigKey,
} from "@miolos/core";
import Link from "next/link";
import { useState } from "react";

import {
  fetchAdminState,
  saveRemoteConfigValue,
} from "../../src/admin/admin-client";
import {
  useAdminWrite,
  type AdminWriteProps,
} from "../../src/admin/use-admin-write";
import { useMountFetch } from "../../src/api/use-mount-fetch";
import { messages, routes } from "../../src/i18n";
import settings from "../ajustes/page.module.css";
import styles from "./admin.module.css";
import { AdminMembersCard } from "./admin-members-section";

const copy = messages.admin;

function ConfigRow({
  configKey,
  value,
  ...writeProps
}: AdminWriteProps & { configKey: RemoteConfigKey; value: number }) {
  const field = remoteConfigField(configKey);
  const min = field.minValue ?? undefined;
  const max = field.maxValue ?? undefined;
  const [draft, setDraft] = useState<string>();
  const { outcome, clearOutcome, write } = useAdminWrite(writeProps);
  const { busy } = writeProps;
  const shown = draft ?? String(value);
  const parsed = field.safeParse(shown === "" ? Number.NaN : Number(shown));
  const id = `admin-${configKey}`;

  async function save(next: number): Promise<void> {
    if (await write(() => saveRemoteConfigValue(configKey, next))) {
      setDraft(undefined);
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
            clearOutcome();
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

function NotAdmin({ email }: { email: string | null }) {
  return (
    <>
      <p className={settings.body}>{copy.config.notAdmin}</p>
      {email === null ? (
        <>
          <p className={settings.note}>{copy.config.noEmail}</p>
          <Link className={settings.textLink} href={routes.settings}>
            {messages.settings.title}
          </Link>
        </>
      ) : (
        <p className={settings.note}>
          {copy.config.emailLabel} <code className={styles.email}>{email}</code>
        </p>
      )}
    </>
  );
}

function ConfigBody({
  state,
  ...writeProps
}: AdminWriteProps & { state: AdminStateResponse | null | undefined }) {
  if (state === undefined) {
    return null;
  }
  if (state === null) {
    return <p className={settings.body}>{copy.config.unavailable}</p>;
  }
  if (state.role === "none") {
    return <NotAdmin email={state.email} />;
  }
  const { config } = state;
  return (
    <>
      {remoteConfigKeySchema.options.map((key) => (
        <ConfigRow
          key={key}
          configKey={key}
          value={config[key]}
          {...writeProps}
        />
      ))}
    </>
  );
}

export function AdminConfigSection() {
  const fetched = useMountFetch(fetchAdminState);
  const [current, setCurrent] = useState<AdminStateResponse>();
  const [saving, setSaving] = useState(false);
  const state = current ?? fetched;
  const writeProps = { busy: saving, setBusy: setSaving, onSaved: setCurrent };

  return (
    <>
      <section className={settings.card} aria-labelledby="admin-config-heading">
        <h2 id="admin-config-heading" className={settings.heading}>
          {copy.config.heading}
        </h2>
        <ConfigBody state={state} {...writeProps} />
      </section>
      {state?.role === "superuser" && (
        <AdminMembersCard members={state.members} {...writeProps} />
      )}
    </>
  );
}

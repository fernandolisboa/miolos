"use client";

import {
  ADMIN_MEMBER_ROLES,
  adminMemberRoleSchema,
  attachEmailSchema,
  type AdminMember,
  type AdminMemberRole,
} from "@miolos/core";
import { useState } from "react";

import {
  removeAdminMember,
  saveAdminMember,
} from "../../src/admin/admin-client";
import {
  useAdminWrite,
  type AdminWriteProps,
} from "../../src/admin/use-admin-write";
import { messages } from "../../src/i18n";
import settings from "../ajustes/page.module.css";
import styles from "./admin.module.css";

const copy = messages.admin.members;

function parseRole(value: string): AdminMemberRole | undefined {
  const role = adminMemberRoleSchema.safeParse(value);
  return role.success ? role.data : undefined;
}

function RoleOptions() {
  return ADMIN_MEMBER_ROLES.map((role) => (
    <option key={role} value={role}>
      {copy.roles[role]}
    </option>
  ));
}

export function AdminMembersCard({
  members,
  ...writeProps
}: AdminWriteProps & { members: AdminMember[] }) {
  const { busy } = writeProps;
  const { outcome, clearOutcome, write } = useAdminWrite(writeProps);
  const [draft, setDraft] = useState("");
  const [draftRole, setDraftRole] = useState<AdminMemberRole>("admin");
  const parsed = attachEmailSchema.safeParse(draft);
  const superusers = members.filter(
    (member) => member.role === "superuser",
  ).length;

  async function add(email: string): Promise<void> {
    if (await write(() => saveAdminMember(email, draftRole))) {
      setDraft("");
      setDraftRole("admin");
    }
  }

  return (
    <section className={settings.card} aria-labelledby="admin-members-heading">
      <h2 id="admin-members-heading" className={settings.heading}>
        {copy.heading}
      </h2>
      <p className={settings.body}>{copy.lead}</p>
      <ul className={styles.members}>
        {members.map((member) => {
          const locked = member.role === "superuser" && superusers === 1;
          return (
            <li key={member.email} className={styles.row}>
              <span className={styles.email}>{member.email}</span>
              <div className={styles.controls}>
                <select
                  className={styles.select}
                  aria-label={copy.roleAria(member.email)}
                  value={member.role}
                  disabled={busy || locked}
                  onChange={(event) => {
                    const role = parseRole(event.target.value);
                    if (role) {
                      void write(() => saveAdminMember(member.email, role));
                    }
                  }}
                >
                  <RoleOptions />
                </select>
                <button
                  type="button"
                  className={styles.save}
                  aria-label={copy.removeAria(member.email)}
                  disabled={busy || locked}
                  onClick={() => {
                    void write(() => removeAdminMember(member.email));
                  }}
                >
                  {copy.remove}
                </button>
              </div>
              {locked && <p className={settings.note}>{copy.lastSuperuser}</p>}
            </li>
          );
        })}
      </ul>
      <div className={styles.addRow}>
        <div className={styles.fieldGrow}>
          <label className={styles.label} htmlFor="admin-member-email">
            {copy.emailLabel}
          </label>
          <input
            id="admin-member-email"
            className={styles.emailInput}
            type="email"
            autoComplete="off"
            spellCheck={false}
            value={draft}
            disabled={busy}
            onChange={(event) => {
              setDraft(event.target.value);
              clearOutcome();
            }}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="admin-member-role">
            {copy.roleLabel}
          </label>
          <select
            id="admin-member-role"
            className={styles.select}
            value={draftRole}
            disabled={busy}
            onChange={(event) => {
              const role = parseRole(event.target.value);
              if (role) {
                setDraftRole(role);
              }
            }}
          >
            <RoleOptions />
          </select>
        </div>
        <button
          type="button"
          className={styles.save}
          disabled={busy || !parsed.success}
          onClick={() => {
            if (parsed.success) {
              void add(parsed.data);
            }
          }}
        >
          {copy.add}
        </button>
      </div>
      {outcome && (
        <p className={settings.note} role="status">
          {messages.admin.config[outcome]}
        </p>
      )}
    </section>
  );
}

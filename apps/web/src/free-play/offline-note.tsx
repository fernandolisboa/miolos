"use client";

import { useSyncExternalStore } from "react";

import { messages } from "../i18n";
import styles from "./offline-note.module.css";

export const OFFLINE_LANDING_PARAM = "sem-conexao";

function forgetLanding(): void {
  const url = new URL(location.href);
  if (!url.searchParams.has(OFFLINE_LANDING_PARAM)) return;
  url.searchParams.delete(OFFLINE_LANDING_PARAM);
  history.replaceState(history.state, "", url);
}

function subscribe(onChange: () => void): () => void {
  const online = () => {
    forgetLanding();
    onChange();
  };
  window.addEventListener("online", online);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", online);
    window.removeEventListener("offline", onChange);
  };
}

export function OfflineNote() {
  const offline = useSyncExternalStore(
    subscribe,
    () =>
      !navigator.onLine ||
      new URLSearchParams(location.search).has(OFFLINE_LANDING_PARAM),
    () => false,
  );
  return offline ? (
    <p className={styles.note} role="status">
      {messages.freePlay.offline}
    </p>
  ) : null;
}

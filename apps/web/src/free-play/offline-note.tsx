"use client";

import { useSyncExternalStore } from "react";

import { messages } from "../i18n";
import styles from "./offline-note.module.css";

export const OFFLINE_LANDING_PARAM = "sem-conexao";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
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

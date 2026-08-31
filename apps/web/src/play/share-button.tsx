"use client";

import type { Game } from "@miolos/core";
import { useEffect, useState } from "react";

import { archiveGameRoute, messages } from "../i18n";
import { absoluteUrl } from "../site-origin";
import { playRecordsWritable, type PlayRecord } from "./play-record";
import styles from "./share-button.module.css";
import { buildShareText, type ShareSubject } from "./share-text";

export interface ShareStamp {
  readonly elapsedMs: number;
}

export const BLANK_VALUE = "\u00a0";

const SHARE_STATUS_MS = 5000;

type ShareStatus = "idle" | "copied" | "failed";

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  );
}

async function deliverShare(text: string): Promise<ShareStatus> {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ text });
      return "idle";
    } catch (error) {
      if (isAbortError(error)) {
        return "idle";
      }
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}

function shareSubject(
  game: Game,
  date: string,
  stored: PlayRecord | undefined,
  stamp: ShareStamp | undefined,
): ShareSubject | undefined {
  if (stored !== undefined) {
    return stored;
  }
  if (game === "termo" || stamp === undefined) {
    return undefined;
  }
  return { game, date, elapsedMs: stamp.elapsedMs };
}

export function ShareButton({
  game,
  date,
  stored,
  stamp,
}: {
  readonly game: Game;
  readonly date: string;
  readonly stored: PlayRecord | undefined;
  readonly stamp: ShareStamp | undefined;
}) {
  const [status, setStatus] = useState<ShareStatus>("idle");

  useEffect(() => {
    if (status === "idle") {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      setStatus("idle");
    }, SHARE_STATUS_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [status]);

  const subject = shareSubject(game, date, stored, stamp);
  if (subject === undefined && !playRecordsWritable()) {
    return null;
  }

  return (
    <div className={styles.shareBlock}>
      <button
        type="button"
        className={styles.share}
        disabled={subject === undefined}
        onClick={() => {
          if (subject === undefined) {
            return;
          }

          setStatus("idle");
          void deliverShare(
            buildShareText(subject, {
              url: absoluteUrl(archiveGameRoute(date, game)),
            }),
          ).then(setStatus, () => {
            setStatus("failed");
          });
        }}
      >
        {messages.share.label}
      </button>

      <p role="status" aria-live="polite" className={styles.shareStatus}>
        {status === "copied"
          ? messages.share.copied
          : status === "failed"
            ? messages.share.failed
            : BLANK_VALUE}
      </p>
    </div>
  );
}

"use client";

import type { Game } from "@miolos/core";
import { useEffect, useState } from "react";

import { archiveGameRoute, messages } from "../i18n";
import { absoluteUrl } from "../site-origin";
import { playRecordsAvailable, type PlayRecord } from "./play-record";
import styles from "./share-button.module.css";
import { buildShareText, type ShareSubject } from "./share-text";

/**
 * The one field of `ConclusionResult` this control reads, declared here
 * rather than imported: `T-WEB-S183` bans `conclusion-view` from every
 * `app/arquivo/**` module graph, and its walker is a regex over source text,
 * so even a type-only import would red it. `ConclusionResult` is assignable
 * to this. See ADR-0054 decision 1.
 */
export interface ShareStamp {
  readonly elapsedMs: number;
}

/** A non-breaking space: holds a line box open with nothing in it. */
export const BLANK_VALUE = "\u00a0";

const SHARE_STATUS_MS = 5000;

type ShareStatus = "idle" | "copied" | "failed";

/**
 * `AbortError` by NAME, and with NO `instanceof` anywhere in it. The sheet's
 * dismissal arrives as a `DOMException` in a browser and as whatever a stub
 * rejects with in a test, so `name` is the only thing they agree on — and
 * `instanceof` is worse than merely redundant here: it is realm-scoped, and
 * a `DOMException` raised by the platform fails `instanceof Object` whenever
 * the checking code holds a different realm's intrinsics. Measured, not
 * assumed: under jsdom `new DOMException("x", "AbortError") instanceof
 * Object` is `false`, which made an earlier version of this predicate route
 * every dismissal into the clipboard and announce "Resultado copiado." for a
 * share the player had just cancelled. `typeof` is realm-independent.
 */
function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  );
}

/** The three-armed delivery, and `text` only: see ADR-0054 decision 4. */
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
    // No third fallback: `document.execCommand("copy")` is deprecated, needs
    // a hidden textarea and a selection, and would be more code than the
    // case is worth. `.app` is HSTS-preloaded (ADR-0013) so production and
    // preview are always secure contexts, and so is localhost.
    return "failed";
  }
}

/** TODO(#219): a read-only store leaves this control dead and silent. */
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
  if (subject === undefined && !playRecordsAvailable()) {
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
          // Cleared first, and not as a tidy-up: setting `status` to the
          // value it already holds bails out of the re-render, so the
          // `[status]` effect never re-runs and the FIRST copy's timer
          // clears the second confirmation early (T-WEB-S197).
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
      {/* The reserved box (DESIGN.md § Game card): always rendered, `min-height`
          held by the sheet, so a successful share does not reflow the
          column under the player's thumb. */}
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

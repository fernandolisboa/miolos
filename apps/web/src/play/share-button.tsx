"use client";

import type { Game } from "@miolos/core";
import { useEffect, useState } from "react";

import { archiveGameRoute, messages } from "../i18n";
import { absoluteUrl } from "../site-origin";
import { playRecordsAvailable, type PlayRecord } from "./play-record";
import styles from "./share-button.module.css";
import { buildShareText, type ShareSubject } from "./share-text";

/**
 * The share control (#34, ADR-0054 decisions 1, 1a, 4 and 13), lifted out of
 * `conclusion-view.tsx` at #103 so the archive's late-result panel can render
 * THE SAME BUTTON rather than a second one.
 *
 * WHY A MODULE AND NOT A COPY. `deliverShare` below is the subtle part of
 * this feature — a three-arm delivery whose middle arm is a realm-independent
 * `AbortError` test that a plain `instanceof` gets wrong under jsdom — and a
 * second hand-written copy on the archive is how two screens drift apart
 * (`i18n/messages.ts:26`, the same argument that hoists `Feito`). One module
 * also means one label, one reserved box, one live region and one set of
 * tests for both surfaces.
 *
 * WHY IT COULD NOT SIMPLY BE IMPORTED FROM `conclusion-view.tsx`.
 * `T-WEB-S183` bans that module from every `app/arquivo/**` module graph, and
 * for a real reason: `ConclusionView` calls `useDayState(date)`, whose streak
 * card fires `GET /streak` and whose next-puzzle affordance chains to TODAY's
 * routes. The ban is on `conclusion-view` and not on `src/play/**`, which is
 * exactly the seam `share-text.ts` was placed on — so the button joins it
 * here instead of being widened around.
 *
 * THE STYLESHEET MOVED WITH THE BUTTON, for the same reason: importing
 * `conclusion-view.module.css` from here would pull ~1,400 lines of the
 * conclusion's CSS onto four archive routes whose whole point is that the
 * conclusion tree is outside their module graphs (ADR-0053 decision 4's
 * measured read-cost posture). `.shareBlock`, `.share`, its three states and
 * `.shareStatus` are byte-unmoved; only their file changed.
 */

/**
 * The one field of `ConclusionResult` this control reads, declared here
 * rather than imported. Importing the interface would put `conclusion-view`
 * in the archive's module graph through a TYPE — invisible to a reader,
 * fatal to `T-WEB-S183`, whose walker is textual and does not care that an
 * import is erased at build time. `ConclusionResult` is assignable to it.
 */
export interface ShareStamp {
  readonly elapsedMs: number;
}

/**
 * A non-breaking space: holds a line box open with nothing in it — the
 * `PlaySkeleton` blank-values idiom (binairo/play-view.tsx).
 *
 * DECLARED HERE AND IMPORTED BY `conclusion-view.tsx`, WHICH IS THE ONLY
 * DIRECTION AVAILABLE (#103). There was exactly one named copy of this
 * constant in the tree before the extraction and it must not become two; the
 * obvious repair — importing it from `conclusion-view.tsx` — is the one thing
 * this module may never do, because `T-WEB-S183` bans that module from every
 * `app/arquivo/**` graph and its walker is textual, so a type-only import
 * would be just as fatal. The leaf owns the constant and its former home
 * reads it back. A third file for one character would cost more than it
 * saves.
 */
export const BLANK_VALUE = "\u00a0";

/** How long a share announcement stands before the region is cleared. */
const SHARE_STATUS_MS = 5000;

/** What the `aria-live` region has to say. `idle` says nothing. */
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

/**
 * THREE ARMS, NOT TWO (ADR-0054 decision 4, plan 040 D4 / landmine 5).
 *
 * `navigator.share` rejects with `AbortError` when the player dismisses the
 * sheet — surfacing that as a failure message is the single most common bug
 * in this feature, so it renders nothing at all. But it also rejects with
 * `NotAllowedError` (no transient activation), `DataError` and `TypeError`,
 * and treating only the Abort case would make every one of those a SILENT
 * failure: no sheet, no clipboard write, no message. So any other rejection
 * falls through to the clipboard and takes that branch's own outcome.
 *
 * `text` only — no `url` field and no `title`. Targets disagree about both:
 * WhatsApp appends the url, some replace the text with it, several prepend
 * the title. One field is what makes "the clipboard copies the same bytes
 * the sheet received" a testable property (T-WEB-S196) rather than a hope.
 */
async function deliverShare(text: string): Promise<ShareStatus> {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ text });
      // A sheet that opened needs no confirmation — something visible
      // happened. Only the clipboard write has to announce itself.
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

/**
 * What this device can honestly say about the day, or `undefined` if it can
 * say nothing yet (#34, ADR-0054 decision 1; step-6 blocker K3).
 *
 * The concluded record wins whenever there is one — it is the authoritative
 * copy, and for Termo it is the ONLY source of `guesses[].tiles`. Without it
 * the three grid games fall back to `stamp`, which is `stored ?? result` and
 * therefore the live play state the screen already passes down; their whole
 * share is a header plus an elapsed time, and `ConclusionResult` carries the
 * elapsed time by construction.
 *
 * **THE ARCHIVE PASSES NO `stamp`, AND THAT IS THE PANEL'S OWN RULE RATHER
 * THAN AN OMISSION (#103).** `late-result.tsx:73-76` declares *"no time"*
 * among its deliberate absences, so the panel holds no `ConclusionResult` to
 * hand down and taking one as a prop purely to feed the share would reopen
 * an absence a share button is not a licence to reopen. The consequence is
 * exact and is asserted rather than argued: on the archive the third state
 * below is reachable by all four games instead of by Termo alone. It is a
 * NARROWER surface, never a wider one — nothing is ever shared that a daily
 * conclusion would not share.
 *
 * **THAT SENTENCE IS ABOUT WHAT IS SHARED, AND IT IS NOT TRUE OF THE OTHER
 * AXIS** (#103 step-6 finding m3). On the DEAD-CONTROL axis the archive is
 * strictly wider: a profile whose store READS but cannot WRITE — a full quota,
 * a write-blocked profile — passes `playRecordsAvailable()`, which is a read
 * probe, while `writePlayRecord` swallows `QuotaExceededError`. There the
 * button renders permanently disabled and never explains itself, which is
 * ADR-0045 `:186-191`'s dead share button by a route blocker K3 did not close.
 * The daily already has it for Termo; the archive has it for all four games,
 * because there is no `stamp` to lift the gate. Recorded rather than fixed:
 * separating "cannot read" from "cannot write" is a `play-record.ts` change
 * with its own hydration argument, and it belongs to the ticket that takes it.
 */
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

/**
 * The share (#34, ADR-0054 decisions 1, 1a, 4 and 13; #103) — no prop of its
 * own on `ConclusionView` and none on `LateResult`: the composition it needs
 * is a pure function of values both callers already hold.
 *
 * IT COMPOSES ITS OWN URL, and that is what makes the two surfaces agree by
 * construction: `absoluteUrl(archiveGameRoute(date, game))` is the per-day
 * permalink for the day being shared, which on the archive is the very page
 * the player is looking at and on the daily is the URL ADR-0053 decision 1's
 * 307 resolves to for today. Neither caller passes a URL, so neither can
 * pass a different one (`T-WEB-S192a`).
 *
 * THREE STATES, AND THE THIRD ONE IS THE FIX FOR A SHIPPED FALSEHOOD (step-6
 * blocker K3). The first version of this block claimed the gate was only ever
 * "a control that is momentarily not yet ready and then works". That was true
 * of the in-place swap — React runs a child's mount effect before its
 * parent's, so for one commit `stored` is undefined — and false of the
 * environment `conclusion-view.tsx:44-50` argues it supports — a SELF-
 * reference until #103 moved the paragraph out of that file, and cited by
 * file since (`share-text.ts` writes the same citation the same way): where
 * `localStorage` throws, `readPlayRecord` returns `undefined` FOREVER, so the
 * player got a permanently disabled control that never explained itself. That
 * IS ADR-0045 `:186-191`'s dead share button, reached from the other side.
 *
 *   - **a subject** → enabled. For the three grid games that now includes the
 *     store-less case, composed from `stamp`.
 *   - **no subject, but a store to write one** → disabled. Gating the RENDER
 *     here would move the layout a frame later; gating the enabled state does
 *     not, which is `PlaySkeleton`'s reserve-the-boxes discipline applied to
 *     a button. **HOW LONG IT LASTS IS NOT "one commit", AND #103'S REVIEW IS
 *     WHERE THAT WAS MEASURED RATHER THAN ASSUMED.** `useRecordSnapshot`'s
 *     only notifier is a **1 s `setInterval`** (`use-record-snapshot.ts` —
 *     *"a 1 s poll, because `sync.ts` exposes no notifier"*) and
 *     `writePlayRecord` notifies nobody, so the window is up to a full
 *     POLL INTERVAL, not a frame. On the daily it is invisible for the three
 *     grid games because `stamp` supplies a subject on the very first commit
 *     and only Termo waits; **on the archive, which passes no `stamp`, all
 *     four games wait.** Sub-second and self-healing, and named here in the
 *     right order of magnitude so the next reader does not dismiss a real
 *     report of a greyed-out button as impossible.
 *   - **no subject and no store** → NOTHING RENDERED. On the DAILY only Termo
 *     can reach this: its grid lives on the record alone, so the honest
 *     answer is to omit the control rather than to show one that can never
 *     work. On the ARCHIVE all four games reach it, because the late-result
 *     panel passes no `stamp` (see `shareSubject` above). The decision is
 *     stable from the first client commit — both subtrees render only behind
 *     `hydrated` — so it costs no reflow.
 *
 * There is deliberately NO GATE ON `syncOutcome`: a player whose sync was
 * rejected can still share. The share is this device's record of its own
 * play broadcast in a chat message, which is the purest affordance in the
 * product (ADR-0031 decision 6), and blocking it would punish exactly the
 * offline players the in-place conclusion exists for.
 */
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
          // CLEARED FIRST, AND IT IS NOT A TIDY-UP (step-6 finding K4). A
          // second successful copy sets `status` to the value it already
          // holds, React bails out of the re-render, the `[status]` effect
          // never re-runs — so the old five-second timer expires on the new
          // confirmation, and `aria-live` announces nothing at all because
          // the text never changed. Going through `idle` moves the text
          // twice, which re-arms the timer and gives the region something to
          // speak. Measured by removing this line: the second copy's
          // confirmation is gone at t+6s, where the timer would have expired
          // 5s after the FIRST copy, and the region never clears in between.
          setStatus("idle");
          // Feature detection happens inside `deliverShare`, at CLICK time
          // and never at render time: `typeof navigator.share` evaluated
          // during render is a hydration mismatch, because the server has no
          // `navigator`. One label, one DOM, one test.
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
      {/* The reserved box (DESIGN.md:52): always rendered, `min-height` held
          by the sheet, only the text content changing — so a successful
          share does not reflow the column under the player's thumb. */}
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

/**
 * THIS MODULE IS EXACTLY ONE MODULE, for every game, and that is a
 * correctness constraint rather than a tidiness one: the guards below are
 * module-level and the queue they guard (`listPendingRecords()`) is
 * game-blind, so a second copy mounted in the same SPA session would double
 * every POST and settle the other copy's records out from under it.
 * See ADR-0029.
 */
import {
  completionRequestSchema,
  completionResponseSchema,
} from "@miolos/core";

import {
  confirmSession,
  ensureSession,
  remintSession,
} from "../session/bootstrap";
import {
  ELAPSED_CAP_MS,
  listPendingRecords,
  writePlayRecord,
  type BinairoPlayRecord,
  type NonogramPlayRecord,
  type PlayRecord,
  type SudokuPlayRecord,
  type TermoPlayRecord,
} from "./play-record";

/**
 * Statuses a retry can never turn into an acceptance. Clearing `pendingSync`
 * on these is what stops an unsyncable record from being posted on every
 * mount for the rest of its life. 429 and 5xx are deliberately absent.
 * See ADR-0038, ADR-0053.
 */
const TERMINAL_STATUSES = new Set([400, 403, 404, 415, 422]);

/**
 * Never terminal: the record is a real completion refused by a per-day RATE
 * rule, and settling it would discard a puzzle the player actually solved.
 * See ADR-0053.
 */
const CAPPED_STATUS = 429;

/** Four attempts, then stop — a page load is not a background job. */
const RETRY_DELAYS_MS = [2_000, 5_000, 15_000, 60_000] as const;

let flushing = false;
let retryStep = 0;
let retryTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * The fallback queue for a device with no usable `localStorage` — DOM
 * storage off in an Android WebView, site data blocked. `writePlayRecord`
 * is a silent no-op there and `listPendingRecords()` reads back empty, so
 * without this a solved board would never be posted AT ALL and the day
 * would be lost for the streak.
 */
const memoryQueue = new Map<string, PlayRecord>();

const queueKey = (record: PlayRecord) => `${record.game}:${record.date}`;

/**
 * The queue as this flush sees it: the durable records first, plus anything
 * the store could not hold.
 *
 * **NEWEST DATE FIRST, and the order is what makes the loop's `break` sound.**
 * `listPendingRecords()` walks `localStorage` key order, which is neither date
 * order nor insertion order, and the cap's branch is `isLateDate(date, server
 * today)`, so a TODAY-dated write is never capped. Date-descending puts
 * today's daily first, and a record that took the 429 has proved its own date
 * is `< server today`, so every record after it in this order is also late and
 * also certain to be capped. See ADR-0053.
 */
function pendingQueue(): PlayRecord[] {
  const stored = listPendingRecords();
  const storedKeys = new Set(stored.map(queueKey));
  return [
    ...stored,
    ...[...memoryQueue.values()].filter(
      (record) => !storedKeys.has(queueKey(record)),
    ),
  ].sort((a, b) =>
    a.date === b.date
      ? queueKey(a).localeCompare(queueKey(b))
      : b.date.localeCompare(a.date),
  );
}

/**
 * POST every pending record. Passing `record` makes the flush independent of
 * whether the store accepted the write.
 */
export async function flushPendingCompletions(
  record?: PlayRecord,
): Promise<void> {
  if (record?.pendingSync === true) {
    memoryQueue.set(queueKey(record), record);
  }
  if (flushing) {
    // Arming the ladder for the record we just queued is NOT optional, and
    // returning bare is how a completion goes missing on a perfectly online
    // device: the in-flight flush read `pendingQueue()` before this record
    // existed, so it will not post it, and if its own records all settle it
    // calls `cancelRetries()`. `scheduleRetry` no-ops while a timer is pending
    // and its handler re-reads the queue.
    if (record?.pendingSync === true) {
      scheduleRetry();
    }
    return;
  }
  flushing = true;
  try {
    const pending = pendingQueue();
    if (pending.length === 0) {
      cancelRetries();
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
      console.error(
        "NEXT_PUBLIC_API_URL is unset: the completion sync cannot run, results stay queued on this device",
      );
      return;
    }

    // Before the FIRST post, never after: on a cold first visit a fast solve
    // reliably beats the in-flight mint and would take the 401 branch.
    await ensureSession();

    let stillPending = false;
    for (const record of pending) {
      const verdict = await syncRecord(apiUrl, record);
      stillPending = verdict.stillPending || stillPending;
      // BREAK on the first 429, and this is not an optimisation: the queue is
      // DATE-DESCENDING (see `pendingQueue` above), so every record still
      // ahead of this one is older and certain to be refused for the same
      // reason. The records stay queued and the ladder stays armed; what stops
      // is paying for refusals we already know the answer to.
      if (verdict.capped) {
        stillPending = true;
        break;
      }
    }

    // The queue is RE-READ, never inferred from `pending`: that array was
    // built before the first `await`, so a completion handed to this flush
    // while it was in flight is not in it. A record that cannot be posted at
    // all is settled by `syncRecord`, so this cannot spin.
    if (stillPending || pendingQueue().length > 0) {
      scheduleRetry();
    } else {
      cancelRetries();
    }
  } finally {
    flushing = false;
  }
}

/**
 * Register the ambient sync triggers and flush once for the mount.
 * `visibilitychange` covers a tab that was backgrounded while offline and
 * comes back already online, which fires no `online` event at all.
 */
export function startCompletionSync(): () => void {
  const onOnline = () => {
    void flushPendingCompletions();
  };
  const onVisibility = () => {
    if (document.visibilityState === "visible") {
      void flushPendingCompletions();
    }
  };

  window.addEventListener("online", onOnline);
  document.addEventListener("visibilitychange", onVisibility);
  void flushPendingCompletions();

  return () => {
    window.removeEventListener("online", onOnline);
    document.removeEventListener("visibilitychange", onVisibility);
    cancelRetries();
  };
}

interface SyncVerdict {
  readonly stillPending: boolean;
  /**
   * The late-write ceiling answered. It is per USER per São Paulo day, so
   * record N+1 fails identically to record N.
   */
  readonly capped: boolean;
}

async function syncRecord(
  apiUrl: string,
  record: PlayRecord,
): Promise<SyncVerdict> {
  const body = buildBody(record);
  if (body === undefined) {
    // Unbuildable: there is no result to judge, and no retry can create one.
    console.error(
      `completion for ${record.game} ${record.date} has no submittable result to post; dropping it from the queue`,
    );
    settle(record, "rejected");
    return { stillPending: false, capped: false };
  }

  let response = await post(apiUrl, body);
  if (response?.status === 401) {
    // The one-shot re-mint allowance is `remintSession()`'s, not this
    // module's: two local booleans over one shared mint promise put two
    // cookieless `POST /session` calls in flight at once — two identities, one
    // surviving cookie, and a completion written for the loser.
    if (await remintSession()) {
      response = await post(apiUrl, body);
      if (response?.ok === true) {
        confirmSession();
      }
    }
  }

  if (response === undefined) {
    return { stillPending: true, capped: false };
  }

  if (response.ok) {
    return {
      stillPending: !(await acceptResponse(record, response)),
      capped: false,
    };
  }

  if (TERMINAL_STATUSES.has(response.status)) {
    console.error(
      `completion for ${record.game} ${record.date} was rejected with ${response.status}; it will not be retried`,
    );
    settle(record, "rejected");
    return { stillPending: false, capped: false };
  }

  // 401 (after the one re-mint), 429 and 5xx: retryable, keep it queued.
  return { stillPending: true, capped: response.status === CAPPED_STATUS };
}

/**
 * The POST body, built from the record ALONE. `undefined` means the record
 * cannot produce one. This switch is the module's only per-game branch — a
 * second sync module is refused by the correctness argument at the top of
 * this file.
 */
function buildBody(record: PlayRecord): string | undefined {
  switch (record.game) {
    case "binairo":
    case "nonogram":
    case "sudoku":
      return gridBody(record);
    case "termo":
      return termoBody(record);
    default: {
      // A new member of `playRecordSchema` with no case here is a RED
      // TYPECHECK, never a dropped completion: falling off the end returns
      // `undefined`, which `syncRecord` reads as "no result to post" and
      // permanently settles as rejected. TS cannot catch that on its own —
      // `string | undefined` is a legitimate return here — so this assignment
      // is what fails instead.
      const unhandled: never = record;
      throw new Error(
        `no completion body builder for ${JSON.stringify(unhandled)}`,
      );
    }
  }
}

function gridBody(
  record: BinairoPlayRecord | NonogramPlayRecord | SudokuPlayRecord,
): string | undefined {
  if (record.grid === undefined) {
    return undefined;
  }
  const parsed = completionRequestSchema.safeParse({
    game: record.game,
    date: record.date,
    grid: record.grid,
    // Clamped at BOTH ends, and not merely re-stating what the schema already
    // proved on read: `memoryQueue` holds a record that never reached the
    // store, so on the very devices the fallback exists for this is the FIRST
    // bound the number meets.
    elapsedMs: Math.min(Math.max(record.elapsedMs, 0), ELAPSED_CAP_MS),
    hintsUsed: record.hintsUsed,
  });
  return parsed.success ? JSON.stringify(parsed.data) : undefined;
}

/**
 * Termo's completion body: the GUESS WORDS, oldest first, and no verdict —
 * the server re-judges them and decides won or lost itself. The TILES stay on
 * the device.
 *
 * IT CANNOT RETURN `undefined` FOR A LEGITIMATELY CLOSED RECORD, and that is
 * load-bearing: `syncRecord` reads `undefined` as "no result to post" and
 * PERMANENTLY settles the record as rejected. The record schema requires at
 * least one judged guess when `concluded`, so the empty-list path is
 * unreachable and the only way here is a failed contract parse.
 *
 * See ADR-0044.
 */
function termoBody(record: TermoPlayRecord): string | undefined {
  const parsed = completionRequestSchema.safeParse({
    game: "termo",
    date: record.date,
    guesses: record.guesses.map((row) => row.guess),
    // Clamped at BOTH ends for the memory-queue path, as `gridBody` does.
    elapsedMs: Math.min(Math.max(record.elapsedMs, 0), ELAPSED_CAP_MS),
    hintsUsed: record.hintsUsed,
  });
  return parsed.success ? JSON.stringify(parsed.data) : undefined;
}

/** `undefined` on a network failure — the one case that is not a status. */
async function post(
  apiUrl: string,
  body: string,
): Promise<Response | undefined> {
  try {
    return await fetch(`${apiUrl}/completions`, {
      method: "POST",
      credentials: "include",
      // A JSON content type forces a CORS preflight, which is what makes the
      // WEB_ORIGIN grant load-bearing rather than the origin guard alone.
      headers: { "Content-Type": "application/json" },
      body,
    });
  } catch {
    return undefined;
  }
}

/** Apply a 200. Resolves to `true` when the record left the queue. */
async function acceptResponse(
  record: PlayRecord,
  response: Response,
): Promise<boolean> {
  let stored;
  try {
    stored = completionResponseSchema.parse(await response.json());
  } catch {
    // A 200 the contract does not recognize is a server bug, not a player
    // problem: keep the only copy of the completion queued rather than
    // discarding it on a body we cannot read.
    console.error(
      `completion for ${record.game} ${record.date} came back 200 with an unreadable body; keeping it queued`,
    );
    return false;
  }
  // On `recorded: false` the server is reporting the values it already holds,
  // so the conclusion never shows a time the server does not have.
  settle(
    stored.recorded
      ? record
      : {
          ...record,
          elapsedMs: stored.elapsedMs,
          hintsUsed: stored.hintsUsed,
        },
    "recorded",
  );
  return true;
}

function settle(record: PlayRecord, outcome: "recorded" | "rejected"): void {
  // The fallback queue is dropped here and nowhere else: a settled record is
  // one the server has answered, and re-posting it on the next trigger would
  // resurrect it.
  memoryQueue.delete(queueKey(record));
  writePlayRecord({ ...record, pendingSync: false, syncOutcome: outcome });
}

function scheduleRetry(): void {
  if (retryTimer !== undefined) {
    return;
  }
  const delay = RETRY_DELAYS_MS[retryStep];
  if (delay === undefined) {
    // Ladder exhausted: the next mount, `online` or `visibilitychange` is
    // what tries again.
    return;
  }
  retryStep += 1;
  retryTimer = setTimeout(() => {
    retryTimer = undefined;
    // A hidden tab is throttled and its network is often asleep; the
    // visibility listener flushes as soon as it comes back.
    if (
      typeof document !== "undefined" &&
      document.visibilityState !== "visible"
    ) {
      return;
    }
    void flushPendingCompletions();
  }, delay);
}

function cancelRetries(): void {
  if (retryTimer !== undefined) {
    clearTimeout(retryTimer);
    retryTimer = undefined;
  }
  retryStep = 0;
}

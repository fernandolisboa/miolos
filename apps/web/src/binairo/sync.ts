/**
 * Deferred completion sync (plan 017 §9.2, AC 3). The local play record IS
 * the queue (D18): there is exactly one pending item per (game, date), and
 * its natural key is the same key that makes `POST /completions`
 * idempotent, so no second store and no dedup logic exist.
 *
 * Everything here runs with no play screen mounted — that is the point.
 * The body is built from `record.grid` alone, so a flush needs neither the
 * givens nor a rendered board (§9.1), which is what makes "syncs on
 * reconnect" true on a cold mount, on an `online` event and on
 * /binairo/concluido.
 */
import {
  binairoCompletionRequestSchema,
  completionResponseSchema,
} from "@miolos/core";

import { ensureSession } from "../session/bootstrap";
import {
  listPendingRecords,
  writePlayRecord,
  type PlayRecord,
} from "./play-record";

/** One day in milliseconds — the contract's own bound on `elapsedMs`. */
const ELAPSED_CAP_MS = 86_400_000;

/**
 * Statuses a retry can never turn into an acceptance: the body was
 * rejected, the puzzle was killed, or this client is not allowed to write
 * at all. Clearing `pendingSync` on these is what stops an unsyncable
 * record from being posted on every mount for the rest of its life.
 */
const TERMINAL_STATUSES = new Set([400, 403, 404, 415, 422]);

/**
 * The bounded in-page retry ladder. It is what makes AC 3 true for a
 * player who finishes, sees the pending line and closes the tab: the other
 * triggers all need a new mount or an event that may never arrive.
 * Four attempts, then stop — a page load is not a background job.
 */
const RETRY_DELAYS_MS = [2_000, 5_000, 15_000, 60_000] as const;

// Module-level, so it survives re-mounts (the session-bootstrap precedent).
let flushing = false;
let reminted = false;
let retryStep = 0;
let retryTimer: ReturnType<typeof setTimeout> | undefined;

/** POST every pending record; terminal statuses clear `pendingSync`. */
export async function flushPendingCompletions(): Promise<void> {
  if (flushing) {
    // The POST is idempotent, so a duplicate flush is free — but a
    // concurrent one would double the requests for nothing.
    return;
  }
  flushing = true;
  try {
    const pending = listPendingRecords();
    if (pending.length === 0) {
      cancelRetries();
      return;
    }

    // Loud, not silent: a relative "undefined/completions" fetch would 404
    // against the web app itself and look like a rejected completion.
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
      stillPending = (await syncRecord(apiUrl, record)) || stillPending;
    }

    if (stillPending) {
      scheduleRetry();
    } else {
      cancelRetries();
    }
  } finally {
    flushing = false;
  }
}

/**
 * Register the ambient sync triggers and flush once for the mount. Returns
 * the teardown. `online` covers the reconnect; `visibilitychange` covers a
 * tab that was backgrounded while offline and comes back already online,
 * which fires no `online` event at all.
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

/** Sync one record. Resolves to `true` when it is still queued afterwards. */
async function syncRecord(
  apiUrl: string,
  record: PlayRecord,
): Promise<boolean> {
  const body = buildBody(record);
  if (body === undefined) {
    // Unbuildable: there is no grid to judge, and no retry can create one.
    console.error(
      `completion for ${record.game} ${record.date} has no solved grid to post; dropping it from the queue`,
    );
    settle(record, "rejected");
    return false;
  }

  let response = await post(apiUrl, body);
  if (response?.status === 401 && !reminted) {
    // The cookie the first mint produced is gone or expired. Re-mint once
    // per page load — a loop here would hammer the api on a broken origin.
    reminted = true;
    await ensureSession({ force: true });
    response = await post(apiUrl, body);
  }

  if (response === undefined) {
    // Network failure: the record is the only copy, so it stays queued.
    return true;
  }

  if (response.ok) {
    return !(await acceptResponse(record, response));
  }

  if (TERMINAL_STATUSES.has(response.status)) {
    console.error(
      `completion for ${record.game} ${record.date} was rejected with ${response.status}; it will not be retried`,
    );
    settle(record, "rejected");
    return false;
  }

  // 401 (after the one re-mint) and 5xx: retryable, keep it queued.
  return true;
}

/**
 * The POST body, built from the record ALONE (§9.2) and parsed before it
 * leaves — the request contract is a boundary, so it is validated rather
 * than trusted. `undefined` means the record cannot produce one.
 */
function buildBody(record: PlayRecord): string | undefined {
  if (record.grid === undefined) {
    return undefined;
  }
  const parsed = binairoCompletionRequestSchema.safeParse({
    game: record.game,
    date: record.date,
    grid: record.grid,
    // Already bounded by `playRecordSchema` on read; clamped again so the
    // invariant is local to the thing that depends on it.
    elapsedMs: Math.min(record.elapsedMs, ELAPSED_CAP_MS),
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
      // Required by the route (plan 017 D30): a JSON content type forces a
      // CORS preflight, which is what makes the WEB_ORIGIN grant
      // load-bearing rather than the origin guard alone.
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
  // On `recorded: false` the server is reporting the values it already
  // holds (a second device, a partial sync), so the conclusion never shows
  // a time the server does not have.
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

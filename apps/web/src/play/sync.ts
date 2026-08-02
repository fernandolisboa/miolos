/**
 * Deferred completion sync (plan 017 §9.2, AC 3/AC 4). The local play record
 * IS the queue (D18): there is exactly one pending item per (game, date), and
 * its natural key is the same key that makes `POST /completions`
 * idempotent, so no second store and no dedup logic exist.
 *
 * Everything here runs with no play screen mounted — that is the point.
 * The body is built from `record.grid` alone, so a flush needs neither the
 * givens nor a rendered board (§9.1), which is what makes "syncs on
 * reconnect" true on a cold mount, on an `online` event and on
 * /<jogo>/concluido.
 *
 * THIS MODULE IS EXACTLY ONE MODULE, for every game, and that is a
 * correctness constraint rather than a tidiness one (ADR-0029, plan 018
 * S1/S18): the guards below are module-level and the queue they guard
 * (`listPendingRecords()`) is game-blind, so a second copy mounted in the
 * same SPA session would double every POST and settle the other copy's
 * records out from under it.
 */
import {
  completionRequestSchema,
  completionResponseSchema,
} from "@miolos/core";

import { ensureSession } from "../session/bootstrap";
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

/**
 * The fallback queue for a device with no usable `localStorage` — DOM
 * storage off in an Android WebView, site data blocked. `writePlayRecord`
 * is a silent no-op there and `listPendingRecords()` reads back empty, so
 * without this a solved board would never be posted AT ALL and the day
 * would be lost for the streak (finding
 * `completion-lost-when-localstorage-is-unavailable`). It is a fallback,
 * not a second queue: the record is dropped from it the moment the sync
 * settles, and the store still wins on a key collision.
 */
const memoryQueue = new Map<string, PlayRecord>();

const queueKey = (record: PlayRecord) => `${record.game}:${record.date}`;

/**
 * The queue as this flush sees it: the durable records first, plus anything
 * the store could not hold. A stale memory copy of a record the store has
 * already settled costs one extra POST, which the route answers
 * idempotently — the alternative is dropping a completion.
 */
function pendingQueue(): PlayRecord[] {
  const stored = listPendingRecords();
  const storedKeys = new Set(stored.map(queueKey));
  return [
    ...stored,
    ...[...memoryQueue.values()].filter(
      (record) => !storedKeys.has(queueKey(record)),
    ),
  ];
}

/**
 * POST every pending record; terminal statuses clear `pendingSync`.
 * `record` is the completion the caller has just built — passing it makes
 * the flush independent of whether the store accepted the write.
 */
export async function flushPendingCompletions(
  record?: PlayRecord,
): Promise<void> {
  if (record?.pendingSync === true) {
    memoryQueue.set(queueKey(record), record);
  }
  if (flushing) {
    // The POST is idempotent, so a duplicate flush is free — but a
    // concurrent one would double the requests for nothing.
    //
    // Arming the ladder for the record we just queued is NOT optional here,
    // and returning bare is how a completion goes missing on a perfectly
    // online device (finding `handed-completion-dropped-by-a-concurrent-
    // flush`): the in-flight flush read `pendingQueue()` before this record
    // existed, so it will not post it, and if its own records all settle it
    // calls `cancelRetries()` — clearing the timer and resetting the step.
    // The conclusion then shows "pendente" until a new mount, an `online` or
    // a `visibilitychange`. `scheduleRetry` no-ops while a timer is pending
    // and its handler re-reads the queue, so the skipped record is picked up
    // on the first rung instead.
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

    // The queue is RE-READ, never inferred from `pending`. That array was
    // built before the first `await`, so a completion handed to this flush
    // while it was in flight is not in it — and answering "none of MY records
    // are still pending" with `cancelRetries()` would clear the ladder the
    // handed record just armed and strand it until a new mount, an `online`
    // or a `visibilitychange`, with the conclusion showing "pendente" to a
    // player who is online (finding
    // `handed-completion-dropped-by-a-concurrent-flush`). A record that
    // cannot be posted at all is settled by `syncRecord`, so this cannot
    // spin: everything left here is genuinely retryable.
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
    // Unbuildable: there is no result to judge, and no retry can create one.
    console.error(
      `completion for ${record.game} ${record.date} has no submittable result to post; dropping it from the queue`,
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
 *
 * This switch is the module's ONLY per-game branch, and it is deliberate
 * (plan 018 S18, ADR-0029 consequence (f)): a grid body is a grid body, but
 * Termo's completion request carries GUESSES, not a grid (#27) — so it adds
 * a non-grid case HERE rather than a second sync module, which S1 rejects
 * on the correctness argument at the top of this file.
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
      // TYPECHECK, never a dropped completion (finding
      // `buildbody-switch-fails-open-for-a-new-game`). Falling off the end
      // returns `undefined`, which `syncRecord` reads as "no result to post"
      // and answers with `settle(record, "rejected")` — permanently clearing
      // `pendingSync`, so a game whose case went missing — #25's Nonogram is
      // the one that landed under this guard — would silently lose the day for
      // the streak. TS cannot catch that on its own: `string | undefined` is a
      // legitimate return here (`gridBody` on a record with no grid), so
      // TS2366 never fires. This assignment is what fails instead — the same
      // guarantee `storedSolution` gets for free in
      // apps/api/app/completions/route.ts, where the return type excludes
      // undefined. An unhandled game throws, keeping the record queued
      // rather than settling it.
      const unhandled: never = record;
      throw new Error(
        `no completion body builder for ${JSON.stringify(unhandled)}`,
      );
    }
  }
}

/**
 * Nonogram rides here rather than adding a branch (ADR-0029 consequence (f),
 * plan 020 §14.2): its `grid` is `(0|1)[]` exactly like binairo's, and its
 * completion request carries the same five keys — no `size` on the wire (P4).
 * The only per-game work was the `case` label above, and forgetting it is a
 * RED TYPECHECK on the `never` assignment, never a dropped completion.
 */
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
    // Clamped at BOTH ends, and not merely re-stating what the schema
    // already proved on read: `memoryQueue` holds a record that never
    // reached the store, so on the very devices the fallback exists for
    // (DOM storage off) `buildBody` is the FIRST bound this number meets.
    // A backwards wall-clock step makes it negative, `min(0)` in the
    // request contract then fails the parse, and the flush would drop an
    // intact completion as "no solved grid to post" (finding
    // `memory-queue-record-bypasses-the-two-sided-clamp`).
    elapsedMs: Math.min(Math.max(record.elapsedMs, 0), ELAPSED_CAP_MS),
    hintsUsed: record.hintsUsed,
  });
  return parsed.success ? JSON.stringify(parsed.data) : undefined;
}

/**
 * Termo's completion body: the GUESS WORDS, oldest first, and no verdict
 * (#27, ADR-0044 decision 7). The server re-judges them against its stored
 * answer with `evaluateGuess`/`deriveBoardStatus` and decides won or lost
 * itself — the client never asserts an outcome, which keeps `outcome` off the
 * one surface ADR-0026's rejected list calls forgeable.
 *
 * The TILES stay on the device. They are the client's rendering state, and
 * posting them would be a second copy of a fact the server derives — the
 * "second place for the client to lie" ADR-0032 decision 4 refuses when it
 * keeps `size` off the nonogram wire.
 *
 * TWO PLAYERS WHO BOTH WON ON GUESS 4 POST DIFFERENT BYTES, and that is a
 * real departure from ADR-0032's canonical-body pattern rather than an
 * oversight. It is warranted because the guess SEQUENCE is itself
 * outcome-bearing state: ADR-0008 requires the fail row and #29's
 * distribution is a function of the guess count. Nothing beyond the sequence
 * is carried.
 *
 * IT CANNOT RETURN `undefined` FOR A LEGITIMATELY CLOSED RECORD, and that is
 * load-bearing: `syncRecord` reads `undefined` as "no result to post" and
 * PERMANENTLY settles the record as rejected. The record schema requires at
 * least one judged guess when `concluded` (its `superRefine`, T-WEB-S75), so
 * the empty-list path is unreachable and the only way here is a failed
 * contract parse — exactly as it is for `gridBody`.
 *
 * A six-guess LOSS is a 200 with `outcome: "lost"`, never a 422
 * (ADR-0044 decision 8): 422 stays in `TERMINAL_STATUSES` and keeps
 * ADR-0032 decision 4's meaning — well-formed, but not this puzzle.
 */
function termoBody(record: TermoPlayRecord): string | undefined {
  const parsed = completionRequestSchema.safeParse({
    game: "termo",
    date: record.date,
    guesses: record.guesses.map((row) => row.guess),
    // Clamped at BOTH ends for the memory-queue path, exactly as `gridBody`
    // does and for the same reason (finding
    // `memory-queue-record-bypasses-the-two-sided-clamp`).
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
  // The fallback queue is dropped here and nowhere else: a settled record
  // is one the server has answered, and re-posting it on the next trigger
  // would be the resurrection D15 exists to prevent.
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

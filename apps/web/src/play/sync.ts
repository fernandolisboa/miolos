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

const TERMINAL_STATUSES = new Set([400, 403, 404, 415, 422]);

const CAPPED_STATUS = 429;

const RETRY_DELAYS_MS = [2_000, 5_000, 15_000, 60_000] as const;

let flushing = false;
let retryStep = 0;
let retryTimer: ReturnType<typeof setTimeout> | undefined;

const memoryQueue = new Map<string, PlayRecord>();

const queueKey = (record: PlayRecord) => `${record.game}:${record.date}`;

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

export async function flushPendingCompletions(
  record?: PlayRecord,
): Promise<void> {
  if (record?.pendingSync === true) {
    memoryQueue.set(queueKey(record), record);
  }
  if (flushing) {
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

    await ensureSession();

    let stillPending = false;
    for (const record of pending) {
      const verdict = await syncRecord(apiUrl, record);
      stillPending = verdict.stillPending || stillPending;

      if (verdict.capped) {
        stillPending = true;
        break;
      }
    }

    if (stillPending || pendingQueue().length > 0) {
      scheduleRetry();
    } else {
      cancelRetries();
    }
  } finally {
    flushing = false;
  }
}

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

  readonly capped: boolean;
}

async function syncRecord(
  apiUrl: string,
  record: PlayRecord,
): Promise<SyncVerdict> {
  const body = buildBody(record);
  if (body === undefined) {
    console.error(
      `completion for ${record.game} ${record.date} has no submittable result to post; dropping it from the queue`,
    );
    settle(record, "rejected");
    return { stillPending: false, capped: false };
  }

  let response = await post(apiUrl, body);
  if (response?.status === 401) {
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

  return { stillPending: true, capped: response.status === CAPPED_STATUS };
}

function buildBody(record: PlayRecord): string | undefined {
  switch (record.game) {
    case "binairo":
    case "nonogram":
    case "sudoku":
      return gridBody(record);
    case "termo":
      return termoBody(record);
    default: {
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

    elapsedMs: Math.min(Math.max(record.elapsedMs, 0), ELAPSED_CAP_MS),
    hintsUsed: record.hintsUsed,
  });
  return parsed.success ? JSON.stringify(parsed.data) : undefined;
}

function termoBody(record: TermoPlayRecord): string | undefined {
  const parsed = completionRequestSchema.safeParse({
    game: "termo",
    date: record.date,
    guesses: record.guesses.map((row) => row.guess),

    elapsedMs: Math.min(Math.max(record.elapsedMs, 0), ELAPSED_CAP_MS),
    hintsUsed: record.hintsUsed,
  });
  return parsed.success ? JSON.stringify(parsed.data) : undefined;
}

async function post(
  apiUrl: string,
  body: string,
): Promise<Response | undefined> {
  try {
    return await fetch(`${apiUrl}/completions`, {
      method: "POST",
      credentials: "include",

      headers: { "Content-Type": "application/json" },
      body,
    });
  } catch {
    return undefined;
  }
}

async function acceptResponse(
  record: PlayRecord,
  response: Response,
): Promise<boolean> {
  let stored;
  try {
    stored = completionResponseSchema.parse(await response.json());
  } catch {
    console.error(
      `completion for ${record.game} ${record.date} came back 200 with an unreadable body; keeping it queued`,
    );
    return false;
  }

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
  memoryQueue.delete(queueKey(record));
  writePlayRecord({ ...record, pendingSync: false, syncOutcome: outcome });
}

function scheduleRetry(): void {
  if (retryTimer !== undefined) {
    return;
  }
  const delay = RETRY_DELAYS_MS[retryStep];
  if (delay === undefined) {
    return;
  }
  retryStep += 1;
  retryTimer = setTimeout(() => {
    retryTimer = undefined;

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

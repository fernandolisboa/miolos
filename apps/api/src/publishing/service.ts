import { binairoDailyContentSchema } from "@miolos/core";
import type { Db } from "@miolos/db";
import {
  bufferDepth,
  insertDailyPuzzle,
  listBufferedDates,
  todaySaoPaulo,
} from "@miolos/db/publishing";
import { isWeekday } from "@miolos/games";
import {
  BinairoGenerationError,
  generateBinairo,
  validateBinairo,
} from "@miolos/games/binairo";

import { addDays, isoWeekdayOf } from "./dates";

/**
 * Depth below which the buffer counts as shallow (plan 014 D12). A code
 * constant, not a remote tunable — bufferDepth is the tunable AC 4
 * names; this can become one later if operating shows the need
 * (deliberately not ADR-weight).
 */
export const BUFFER_ALERT_THRESHOLD = 4;

/**
 * The threshold that actually applies: a deliberately tuned-low depth
 * (bufferDepth < 4) must not make every healthy run red forever
 * (plan 014 A3). Shared by the cron status and GET /buffer-depth.
 */
export function effectiveThreshold(configuredDepth: number): number {
  return Math.min(BUFFER_ALERT_THRESHOLD, configuredDepth);
}

// The engine already caps 64 attempts per seed internally; 8 fresh seeds
// on top makes an uncovered date astronomically unlikely without ever
// unbounding the loop.
const MAX_SEED_RETRIES_PER_DATE = 8;

/** Random uint32 via Web Crypto — same entropy source as the session tokens (ADR-0022). */
function randomUint32(): number {
  const box = new Uint32Array(1);
  crypto.getRandomValues(box);
  const value = box[0];
  if (value === undefined) {
    throw new Error("crypto.getRandomValues returned no value");
  }
  return value;
}

/**
 * Idempotent reconciliation (ADR-0010): top the binairo buffer up to
 * `depth` days of coverage starting at the DB clock's SP-today. Vercel
 * crons have no retries, and both missed and duplicate runs are
 * documented behavior — so this reconciles state, never "inserts one
 * more". Existing rows (killed ones included) are never touched (D14).
 *
 * Per date: fresh random seed → generate → re-validate (ADR-0010
 * "pre-generates AND validates" — belt and suspenders) → strict-parse
 * the content contract (fail-closed against shape drift, ADR-0024) →
 * insert with ON CONFLICT DO NOTHING. Retries with a new seed on
 * generation/validation misses; a date that exhausts its budget lands in
 * `failures` and the run continues — it never aborts.
 *
 * EXTENSION POINT: per-game by name on purpose — #23/#25/#27 add their
 * own top-up alongside and widen the cron/buffer-depth contracts
 * (packages/core/src/contracts/cron.ts) in the same PR.
 */
export async function topUpBinairoBuffer(
  db: Db,
  depth: number,
): Promise<{
  generated: number;
  depth: number;
  failures: { date: string; reason: string }[];
}> {
  const today = await todaySaoPaulo(db);
  const existing = new Set(await listBufferedDates(db, "binairo", today));
  let generated = 0;
  const failures: { date: string; reason: string }[] = [];

  // `depth` is already 1..30-clamped by remoteConfigSchema (ADR-0025) —
  // loop bounds never come from unclamped input.
  for (let offset = 0; offset < depth; offset += 1) {
    const target = addDays(today, offset);
    if (existing.has(target)) {
      continue;
    }
    const weekday = isoWeekdayOf(target);
    if (!isWeekday(weekday)) {
      // Unreachable by construction, but the engines demand the guard at
      // untyped boundaries (sudoku generate.ts TSDoc duty).
      throw new RangeError(`derived weekday out of range for ${target}`);
    }

    let covered = false;
    let lastReason = "no attempt made";
    for (let attempt = 0; attempt < MAX_SEED_RETRIES_PER_DATE; attempt += 1) {
      const seed = randomUint32();
      let puzzle;
      try {
        puzzle = generateBinairo({ seed, weekday });
      } catch (error) {
        if (error instanceof BinairoGenerationError) {
          lastReason = error.message;
          continue;
        }
        throw error;
      }
      const verdict = validateBinairo(puzzle, weekday);
      if (!verdict.approved) {
        lastReason = `validator rejected: ${verdict.reasons.join(", ")}`;
        continue;
      }
      const content = binairoDailyContentSchema.safeParse(puzzle);
      if (!content.success) {
        // Deterministic shape drift — retrying other seeds cannot fix it.
        // Fail closed for this date; the buffer drains and the alert fires.
        lastReason = `content schema rejected: ${content.error.message}`;
        break;
      }
      const inserted = await insertDailyPuzzle(db, {
        game: "binairo",
        date: target,
        seed,
        content: content.data,
      });
      if (inserted) {
        generated += 1;
      }
      // A lost ON CONFLICT race still means the date is covered.
      covered = true;
      break;
    }
    if (!covered) {
      failures.push({ date: target, reason: lastReason });
    }
  }

  return { generated, depth: await bufferDepth(db, "binairo"), failures };
}

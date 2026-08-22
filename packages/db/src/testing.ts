import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import * as schema from "./schema";

/**
 * Off unless `MIOLOS_TEST_DB_TIMING` is exactly `"1"` — the strict check
 * keeps the variable's value part of turbo's task hash (ADR-0057).
 */
const TIMING_ENABLED = process.env.MIOLOS_TEST_DB_TIMING === "1";

/** Distinctive, greppable, and never a substring of ordinary vitest output. */
const TIMING_PREFIX = "MIOLOS_DB_TIMING";

/**
 * Read off the stack, not vitest's `expect.getState().testPath`: this
 * module is `packages/db` source consumed across the `@miolos/db/testing`
 * package boundary, and importing vitest here would put a test runner in a
 * src module's import graph.
 */
function callerTestFile(): string {
  const frames = (new Error().stack ?? "").split("\n");
  const frame = frames.find((line) => /\.test\.[cm]?tsx?/.test(line));
  const match = frame?.match(/([^/\\() ]+\.test\.[cm]?tsx?)/);
  return match?.[1] ?? "unknown";
}

function reportTiming(fields: Record<string, string | number>): void {
  const line = Object.entries(fields)
    .map(([key, value]) => `${key}=${value}`)
    .join(" ");
  process.stderr.write(`${TIMING_PREFIX} ${line}\n`);
}

/**
 * The honest test double: an in-memory PGlite database running the REAL
 * committed migrations from ./migrations — the same SQL artifact Neon gets.
 * Only reachable via the `@miolos/db/testing` subpath so app bundles never
 * touch PGlite.
 *
 * THE HOOK BUDGET FOR EVERY CALLER: 30_000 ms, over vitest's bare 10_000 ms
 * hook default. The figures live here, at the cost driver, and the 39 test
 * files that spend the budget point at this symbol rather than restating
 * them — ADR-0055 decision 1 as amended by #114. Do not move them; do not
 * copy them.
 *
 *  - Anchors: CI 9 733.8 ms (2 vCPU runner, `--concurrency=10`), local
 *    uncapped 10 283.1 ms. ADR-0055 decision 2's ×4 procedure on those
 *    yields 38 935 → 40 000 and 41 132 → 45 000, both ABOVE the shipped
 *    30 000, so 30 000 is deliberately NOT re-derived — ADR-0057 decision 5
 *    spends the gate reading on the tripwire below instead.
 *  - The class is AVOIDED BY THE CAP, not closed: uncapped, one run reached
 *    29 389.9 ms against this exact 30 000 wall.
 *  - Tripwire: over 40 % of the budget a test acquires a re-read obligation
 *    (ADR-0055 decision 1); over 15 000 ms — `budget / 2`, decision 4 — it
 *    is a defect.
 *  - Cost drivers for that re-read: this function, `../migrations/**`, the
 *    `@electric-sql/pglite` version, and the concurrency on the root `test`
 *    script.
 *  - Two facts recorded nowhere else: this class HAS fired on CI at the bare
 *    10 000 ms default, on a docs-only PR; and `daily-binairo`, `session`
 *    and `buffer` were the last files riding that default.
 *
 * The 186-line derivation this replaces was removed at #205; ADR-0057
 * decision 5 carries it in full.
 */
export async function createTestDb(): Promise<{
  db: PgliteDatabase<typeof schema>;
  close: () => Promise<void>;
}> {
  const identity = TIMING_ENABLED
    ? {
        pid: process.pid,
        worker: process.env.VITEST_WORKER_ID ?? "-",
        pool: process.env.VITEST_POOL_ID ?? "-",
        file: callerTestFile(),
      }
    : undefined;
  if (identity) reportTiming({ event: "start", ...identity, t: Date.now() });

  // The constructor starts the WASM boot and assigns the promise to
  // `waitReady` without awaiting it, so `t0` must be read BEFORE `new`.
  const t0 = performance.now();
  const client = new PGlite(); // in-memory
  await client.waitReady;
  const t1 = performance.now();
  const db = drizzle(client, { schema });
  const t2 = performance.now();
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL("../migrations", import.meta.url)),
  });
  const t3 = performance.now();

  if (identity) {
    reportTiming({
      event: "end",
      ...identity,
      t: Date.now(),
      pglite_ms: (t1 - t0).toFixed(1),
      drizzle_ms: (t2 - t1).toFixed(1),
      migrate_ms: (t3 - t2).toFixed(1),
      total_ms: (t3 - t0).toFixed(1),
    });
  }

  return { db, close: () => client.close() };
}

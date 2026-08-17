import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import * as schema from "./schema";

/**
 * Phase timing for the test-database boot, off unless MIOLOS_TEST_DB_TIMING=1.
 *
 * vitest prints no hook durations in any reporter (ADR-0055 decision 1 calls
 * the `hookTimeout` axis "unswept" for exactly that reason), so the only way
 * to size this hook's budget from measurement rather than from guesswork is
 * for the boot to report its own cost. One line on stderr at hook start and
 * one at hook end, both stamped with wall-clock epoch ms so overlapping boots
 * across workers can be reconstructed after the fact.
 */
const TIMING_ENABLED = process.env.MIOLOS_TEST_DB_TIMING === "1";

/** Distinctive, greppable, and never a substring of ordinary vitest output. */
const TIMING_PREFIX = "MIOLOS_DB_TIMING";

/**
 * The calling test file, read off the stack rather than off vitest's
 * `expect.getState().testPath`: this module is `packages/db` source, consumed
 * by `apps/api` through the `@miolos/db/testing` subpath, and importing
 * `vitest` here would put a test runner in a src module's import graph.
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

  const t0 = performance.now();
  const client = new PGlite(); // in-memory
  // PGlite's constructor is lazy: the WASM instantiation and `initdb` run on
  // first await, not on `new`. Awaiting readiness here changes nothing about
  // the total cost — `migrate` would await the same promise — but it splits
  // the boot from the migration replay instead of billing both to `migrate`.
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

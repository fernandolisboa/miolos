import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import * as schema from "./schema";

const TIMING_ENABLED = process.env.MIOLOS_TEST_DB_TIMING === "1";

const TIMING_PREFIX = "MIOLOS_DB_TIMING";

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
  const client = new PGlite();
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

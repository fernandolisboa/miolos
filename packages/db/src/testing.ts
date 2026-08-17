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
 * THE HOOK BUDGET FOR EVERY CALLER: 30_000 ms. The arithmetic and the measured
 * figures live here, at the cost driver, rather than at the 26 call sites
 * (ADR-0055 decision 1 as amended by #114 — one cost driver, one comment).
 *
 * WHAT THE BUDGET BUYS, measured with MIOLOS_TEST_DB_TIMING=1. PGlite's WASM
 * `initdb` is ~97 % of the boot; the six-migration replay is 17.9-28.4 ms,
 * under 3 %. Isolated, one process, five serial boots: 1135.1 ms cold, then
 * 797.9 / 718.2 / 714.6 / 703.4 ms.
 *
 * THE NUMBER THAT MATTERS, and it is not the comfortable one. UNCAPPED — six
 * package suites at turbo's default fan-out, which is what CI runs and what a
 * bare `turbo run test` runs — the pooled maximum over five runs is
 * 53 429.8 ms, which is 178 % of this budget. All five of those runs were red.
 * Under the `TURBO_CONCURRENCY=2` cap the root `test` script now ships
 * (ADR-0057), the pooled maximum over four green runs is 11 007.8 ms.
 *
 * SO: THE CLASS IS AVOIDED BY THE CAP, NOT CLOSED. 30_000 is not a ceiling
 * that fits the boot's worst measured cost; it is one that fits the boot under
 * a configuration this repo now chooses locally. The cause is memory
 * exhaustion rather than this hook (ADR-0057), which is why raising the number
 * relocates the failure instead of removing it: at 60_000 and default fan-out,
 * 0 hook timeouts and 26/26 boots complete, and 2 of 3 runs still went red on
 * a different `apps/web` test each time.
 *
 * WHY 30_000 IS NOT RE-DERIVED. This population has no eligible anchor.
 * ADR-0055 decision 2 sizes from the highest measured figure, CI first, worst
 * contended local second; an isolated run is never eligible and a run in which
 * anything timed out is never eligible either, which rules out every uncapped
 * figure above. 11 007.8 ms is a CAPPED pooled maximum, so it is not an anchor
 * either — it shows only that the shipped ceiling is not breached under the
 * shipped local configuration. No green run has ever put a boot near 30_000.
 * Raising it would cost 15 s of hang detection on the largest hook population
 * in the repo to buy nothing any measurement asked for.
 *
 * THE TRIPWIRE, AND THE CONFIGURATION IT IS READ UNDER. Take the pooled
 * maximum from a GREEN run: capped locally, or a CI gate log, which runs
 * uncapped with this instrument on (ADR-0057). Over 12 000 ms — 40 % of this
 * budget, ADR-0055 decision 1 — the explicit timeout this hook carries is
 * confirmed as required. Over 15 000 ms — `budget / 2`, decision 4 — it is a
 * defect to diagnose and record, and only then, if it is drift rather than a
 * draw, the cause to move the number with fresh figures in the pull-request
 * body. Cost drivers for that re-read: this function, `../migrations/**`, the
 * `@electric-sql/pglite` version, and the concurrency setting on the root
 * `test` script.
 *
 * WHAT THE 21 COMMENTS THIS REPLACES GOT WRONG. Three attributed the cost to
 * the migration replay — `published.test.ts` and `remote-config.test.ts` as
 * "PGlite boot + real-migration replay", `session.test.ts` as "WASM Postgres
 * boot + migration replay ~1s" — over-weighting a component that costs under
 * 3 %. The other eighteen said "PGlite boot measures ~1.2 s locally" and named
 * no component at all. The ~1.2 s is right for a cold boot; 17 of the 21 then
 * multiplied it by four and added an unnamed "+ margin", an arithmetic that
 * cannot be checked because the margin carries all the weight between 4.8 s
 * and 30 s. And none of the 21 carried a contended figure, because until this
 * instrument shipped there was none to carry.
 */

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

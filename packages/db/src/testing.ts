import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import * as schema from "./schema";

/**
 * Phase timing for the test-database boot, off unless the environment carries
 * `MIOLOS_TEST_DB_TIMING` set to the exact string `"1"`.
 *
 * The check is strict equality on purpose, and `true`, `on` and `yes` are
 * therefore inert. The variable is declared under `turbo.json`'s `test` task
 * `env`, so its VALUE is part of the task hash: one accepted literal means one
 * hash for "instrument on", which is what makes the cache-hit/cache-miss
 * distinction the comment below leans on readable at all. Widening the check
 * would give several spellings that mean the same thing and hash differently.
 * The one spelling is written the same way in `ci.yml` and in ADR-0057.
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
 * THE HOOK BUDGET FOR EVERY CALLER: 30_000 ms. The measured figures behind
 * that number live here, at the cost driver, rather than at the 26 call sites
 * (ADR-0055 decision 1 as amended by #114 — one cost driver, one comment).
 * vitest's own `hookTimeout` default is 10_000 ms and neither `packages/db`
 * nor `apps/api` overrides it in config, so every one of those 26 `beforeAll`s
 * states 30_000 in the file. What follows is why that override exists and what
 * would have to change to move it.
 *
 * PROVENANCE. Every local figure below: WSL2, 8 cores, 15 545 MB, 2026-08-17,
 * `@electric-sql/pglite` 0.5.4, run with `MIOLOS_TEST_DB_TIMING=1`. The CI
 * figure: gate run 32003396086, same date, 2 vCPU / 7937 MB runner.
 *
 * WHAT THE BUDGET BUYS. PGlite's WASM `initdb` is ~97 % of the boot; the
 * migration replay is 17.9-28.4 ms, under 3 %. Isolated, one process, five
 * serial boots: 1135.1 ms cold, then 797.9 / 718.2 / 714.6 / 703.4 ms.
 *
 * THE NUMBERS THAT MATTER, and they are not the comfortable ones. UNCAPPED —
 * all six package suites running at once, which is what `ci.yml` asks for with
 * `--concurrency=10` and what `turbo run test` does when the root script's cap
 * is not in front of it — the pooled maximum over the six runs taken at THIS
 * wall is 53 429.8 ms, 178 % of this budget, and all six of those runs went
 * red. But the budget is not approached only by runs that failed:
 *
 *   - at this exact 30_000 wall, uncapped, one run reached 29 389.9 ms with
 *     ZERO hook timeouts: 98 % of the budget, the ceiling missed by 610 ms.
 *     That run went red on an `apps/web` `Test timed out`, not here.
 *   - a fully GREEN uncapped run — 6/6 tasks, no timeout of any kind, wall
 *     lifted to 600 000 — reached 26 076.1 ms, 87 %.
 *
 * Under the `TURBO_CONCURRENCY=2` cap the root `test` script now ships
 * (ADR-0057), the pooled maximum over four green runs is 11 007.8 ms, 37 %.
 * And on CI — at `--concurrency=10`, on a 2 vCPU / 7937 MB runner, 26 boots
 * reported — the pooled maximum is 8 686.4 ms, 29 %. That is the first CI
 * figure this hook has ever had, and it is the mildest number in the set: on
 * the evidence so far the two-vCPU runner is not this boot's worst case, the
 * eight-core box under six-way fan-out is.
 *
 * SO: THE CLASS IS AVOIDED BY THE CAP, NOT CLOSED. 30_000 is not a ceiling
 * that fits the boot's worst measured cost; it is one that fits the boot under
 * a configuration this repo now chooses locally. The cause is memory
 * exhaustion rather than this hook (ADR-0057), which is why raising the number
 * relocates the failure instead of removing it: at 60_000 and default fan-out,
 * 0 hook timeouts and 26/26 boots complete,
 * and the suite still went red in 2 of 3 runs — on four `apps/web` tests each,
 * across three files each, two of them (`T-WEB-S119`, `T-WEB-S203`) red in
 * both, all `Test timed out`, all starvation victims rather than defects of
 * their own.
 *
 * WHY 30_000 IS NOT RE-DERIVED. ADR-0055 decision 2 anchors on the highest
 * measured figure, CI first, worst contended local second, then multiplies by
 * four and rounds up to the next 5000 ms. Run that procedure honestly and it
 * does NOT say "keep 30_000" — it says this:
 *
 *   - CI half: the gate figure IS eligible. It is a green run, nothing timed
 *     out, uncapped, and `cache miss, executing` rather than a replay. So the
 *     procedure yields 8 686.4 x 4 = 34 745.6 → 35 000 ms, which is ABOVE the
 *     shipped ceiling, not below it.
 *   - contended-local half: no eligible figure exists — and the reason is NOT
 *     that every uncapped run was red, because four of them were green 6/6
 *     with zero timeouts of any kind. It is that every uncapped run taken at
 *     THIS wall had something time out — five of them lost seven of
 *     `packages/db`'s eight test files to `Hook timed out in 30000ms`, the
 *     sixth lost one `apps/web` test to `Test timed out` — which decision 2
 *     disqualifies. And every uncapped run that stayed green did so only with
 *     the wall lifted to 60 000 or 600 000, a configuration this repo does not
 *     ship and one decision 2 does not contemplate. That exclusion is
 *     load-bearing and has to be argued rather than assumed: admit a
 *     lifted-wall run and the same procedure gives 26 076.1 x 4 → 105 000 ms.
 *
 * So the gate reading is spent on the tripwire below rather than on a
 * re-derivation (ADR-0057 decision 5), and the number stays at 30_000 by
 * ADR-0055 decision 4 rather than by decision 2. Decision 2 sizes a budget;
 * decision 4 governs MOVING a shipped one, and it requires a diagnosed defect
 * and fresh figures, not an arithmetic result. No defect exists: this hook has
 * not fired once under the shipped cap or on the gate. Going to 35 000 would
 * buy nothing — the local evidence says it would not be a bound either, since
 * 29 389.9 ms was measured at the 30_000 wall itself — while spending 5 s more
 * hang detection on the largest hook population in this repo carrying an
 * explicit budget, and in fact the only one: the 75 `beforeEach`es are more
 * numerous and every one of them rides the bare default. And 11 007.8 ms is a
 * CAPPED pooled maximum, so it is not an anchor in either half — it shows only
 * that the shipped ceiling is not breached under the shipped local
 * configuration, which decision 2 requires be labelled as a different question
 * from sizing.
 *
 * THE TRIPWIRE, AND THE CONFIGURATION IT IS READ UNDER. Take the pooled
 * maximum from a GREEN run — capped locally, meaning at the shipped
 * `TURBO_CONCURRENCY=2` and nothing looser, since the green
 * `TURBO_CONCURRENCY=3` runs already sit at 15 704.5-20 760.3 ms — or from a
 * CI gate log, which runs uncapped with this instrument on (ADR-0057). Then:
 *
 *   - under 10 000 ms, the boot fits vitest's bare hook default and the
 *     explicit timeout is no longer doing measurable work. Say so in the PR
 *     rather than leaving it unargued; do not delete it on one green sample.
 *   - over 10 000 ms, the explicit timeout is confirmed as required, because
 *     the hook would have failed on the bare default. 11 007.8 ms capped and
 *     29 389.9 ms uncapped both clear it. This is the whole case for the
 *     override, and it is the criterion that means something here — decision
 *     1's 40 % trigger decides whether a test ACQUIRES an explicit timeout,
 *     so it cannot confirm one this hook already carries.
 *   - over 15 000 ms — `budget / 2`, ADR-0055 decision 4 — it is a defect to
 *     diagnose and record, and only then, if it is drift rather than a draw,
 *     the cause to move the number with fresh figures in the pull-request
 *     body.
 *
 * A CI FIGURE MUST BE A MEASUREMENT, NOT A REPLAY. On a cache hit turbo
 * prints the task's captured output byte for byte, `MIOLOS_DB_TIMING` lines
 * included, carrying the pids and `t=` epoch stamps of the run that produced
 * them; nothing in a replayed line distinguishes it from a fresh one. The test
 * hash keys on `packages/db`'s inputs, so most PRs will replay this package's
 * timing lines rather than produce them — that is the common case, not the
 * edge one. A CI figure counts only from a run whose `@miolos/db:test` line
 * reads `cache miss, executing` or `cache bypass`, never `cache hit, replaying
 * logs`; the `t=` stamp is the secondary tell. The 8 686.4 ms above is from a
 * step reporting `Cached: 0 cached, 6 total`.
 *
 * COST DRIVERS FOR THAT RE-READ: this function, `../migrations/**`, the
 * `@electric-sql/pglite` version, and the concurrency setting on the root
 * `test` script.
 *
 * WHAT THE 21 COMMENTS THIS REPLACES GOT WRONG, AND THE TWO THINGS THEY GOT
 * RIGHT. Three attributed the cost to the migration replay — `published` and
 * `remote-config` as "PGlite boot + real-migration replay", `session` as "WASM
 * Postgres boot + migration replay ~1s" — over-weighting a component that
 * costs under 3 %. The other eighteen said "PGlite boot measures ~1.2 s
 * locally" and named no component at all. The ~1.2 s is right for a cold boot;
 * 17 of the 21 then multiplied it by four and added an unnamed "+ margin", an
 * arithmetic that cannot be checked because the margin carries all the weight
 * between 4.8 s and 30 s. And none carried a contended figure, because until
 * this instrument shipped there was none to carry. Two empirical facts they
 * did carry are kept here because nothing else in the tree records them: this
 * class HAS fired on CI at the bare 10 000 ms default, on a docs-only PR
 * (`published`); and `daily-binairo`, `session` and `buffer` were the last
 * files riding that default, tipped over under parallel fan-out by the
 * database work #31 added.
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
  // The constructor STARTS the boot — it kicks off the WASM instantiation and
  // `initdb` and assigns the resulting promise to `waitReady` without awaiting
  // it — so `t0` has to precede `new`, and it does. Awaiting `waitReady` here
  // only OBSERVES that boot; it changes nothing about the total cost, since
  // `migrate` awaits the same promise on its first query. What it buys is the
  // split: the boot billed to `pglite_ms` instead of hidden inside `migrate`.
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

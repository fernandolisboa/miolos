import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import { z } from "zod";

/**
 * THE FAN-OUT CAP, AND THE COMMENT ITS MANIFESTS CANNOT CARRY (#114,
 * absorbing #110; ADR-0057).
 *
 * `package.json` and `turbo.json` are JSON. JSON has no comments, so the cap's
 * value, the measurements that chose it and the reason CI is exempt from it
 * have nowhere to live beside the settings they explain. THIS FILE IS THAT
 * COMMENT — a place a `git blame` and a red run both lead to.
 *
 * WHAT WENT WRONG. `pnpm test` runs six package suites through turbo, and
 * vitest's forks pool defaults each of them to `cpus - 1` workers. On the
 * 8-core / 15.5 GB developer box that is 6 x 7 workers at ~450 MB, i.e. ~19 GB
 * demanded against 15.5 GB available. The machine swaps, and a PGlite boot
 * that costs ~1.1 s isolated stretches past 30 s and kills its own `beforeAll`.
 * The cause is memory exhaustion, not CPU oversubscription: a 1.75x
 * oversubscription cannot turn 1.1 s into 50 s, and swap thrash can.
 *
 * THE SWEEP THAT CHOSE THE VALUE. Every row is a full `pnpm test`, same box,
 * hook budget 30 000 ms, with `MIOLOS_TEST_DB_TIMING=1` (plan 049 §2.3 is the
 * tracked home of the full table):
 *
 *   config       green      elapsed      peak summed RSS
 *   uncapped     0 of 6     78-100 s     15 484 MB / 33 procs, MemAvailable
 *                                        floor 135 MB, swap 1 348 MB
 *   TC=2         4 of 4     42-97 s       8 042 MB / 16 procs
 *   TC=3         4 of 4     98-120 s      9 841 MB / 25 procs
 *   TC=4         2 of 2     52-53 s      NOT SAMPLED
 *
 * WHY 2. It is simultaneously the greenest, the fastest and the lightest —
 * there is no speed-for-safety trade to make here. 3 costs 22 % more memory
 * and is measurably slower. 4 was green twice and fast, but has no RSS sample
 * at all, and the memory model puts it at ~12.6 GB against a 15.5 GB box —
 * inside the region where MemAvailable was measured collapsing. Shipping the
 * one number with no memory evidence, into a fix whose entire diagnosis is a
 * memory model, is not an option. 1 is slower than 2 (67 s against 43-44 s,
 * measured in #110) and buys nothing.
 *
 * WHY THE CAP MUST STAY OVERRIDABLE, AND WHY IT IS AN INLINE ENV ASSIGNMENT
 * RATHER THAN A FLAG. A `--concurrency=2` baked into the script cannot be
 * overridden: turbo's CLI flag beats `TURBO_CONCURRENCY`, and passing
 * `--concurrency` twice is a hard error — `the argument '--concurrency
 * <CONCURRENCY>' cannot be used multiple times` — so a caller has no way to
 * ask for more. An inline `TURBO_CONCURRENCY=2` is beaten by a caller's flag,
 * which is exactly what CI relies on below. That is why the first scan asserts
 * the ABSENCE of the flag as hard as it asserts the presence of the cap.
 *
 * WHY CI IS DELIBERATELY EXEMPT. The gate runs on `ubuntu-latest`, 2 vCPUs,
 * where vitest's own `maxWorkers` collapses to 1 per package: six packages
 * demand ~2.7 GB and there is no oversubscription to relieve. Capping there
 * would cost ~+55 % (gate run 31888933252: 1021.2 s of per-package work inside
 * a 330 s step; a two-lane makespan floor is max(1021.2/2, 325.6) ~= 510 s) to
 * buy nothing. `--concurrency=10` is turbo's own default, so the gate step is
 * behaviourally identical to the bare `pnpm test` that ran before the cap — it
 * PINS the configuration CI already had. That keeps CI the one runner still
 * executing the suite at the fan-out ADR-0055's timeout budgets are anchored
 * on, which is the whole reason the cap is local-binding.
 *
 * WHAT THESE THREE SCANS DO NOT PROVE. They read manifests and a workflow:
 * they assert what the configuration SAYS, never what turbo DID. Nothing here
 * can show a run happening at 2 or a gate running at 10 — that evidence is
 * behavioural and lives in #114's pull-request body. These are the tripwire
 * that keeps the configuration from drifting away from that evidence.
 *
 * A RED FROM THIS FILE ON A LEGITIMATE FUTURE CHANGE IS THE DESIGN, NOT A
 * DEFECT. These are tripwires, updated with evidence the way the bundle
 * markers and the lint walls are: re-measure, change the setting, change the
 * expectation here, and put the new figures in the pull-request body. What
 * they exist to prevent is the setting moving in silence — the cap being
 * dropped, the CI flag being lost to a "tidy-up", or `concurrency` migrating
 * into `turbo.json` where it would also cap `pnpm typecheck` and break
 * `pnpm dev`.
 *
 * `T-WEB-S226` IS THE REPO'S FIRST TEST TO ASSERT ON A WORKFLOW FILE. It is
 * named as a first rather than dressed as a precedent: the only prior mention
 * of `.github/workflows/**` in any suite is a comment in `route-ssr.test.tsx`,
 * which asserts nothing. The precedent that does exist is a test asserting on
 * a `package.json` — `packages/games/test/purity.test.ts`, on its own
 * package's manifest rather than the root's.
 *
 * Homed in `apps/web/test/` because that is where the repo's root-config scans
 * already live and where `repoRoot` is already resolved as `../../..`:
 * `eslint-db-wall.test.ts` reads the root `eslint.config.mjs`,
 * `medals-content.test.ts` reads `content/medals/README.md`,
 * `og-card.test.tsx` reads `packages/ui/tokens.css`.
 */

const repoRoot = join(import.meta.dirname, "../../..");

function readRepoFile(...segments: string[]): string {
  return readFileSync(join(repoRoot, ...segments), "utf8");
}

/** Parsed, never cast — `JSON.parse` hands back `any`. */
const rootManifest: unknown = JSON.parse(readRepoFile("package.json"));
const rootScripts = z
  .object({ scripts: z.record(z.string(), z.string()) })
  .parse(rootManifest).scripts;

const turboConfig: unknown = JSON.parse(readRepoFile("turbo.json"));

const ciWorkflow = readRepoFile(".github", "workflows", "ci.yml");

/**
 * The `gate` job's steps, split without a YAML parser — the repo has no YAML
 * dependency and a scan of one workflow is not the reason to add one.
 *
 * Robust enough to survive reformatting: full-line comments are dropped first,
 * a step is every line from one `- ` item under `steps:` up to the next item at
 * the same indentation, so a step keeps its own `env:` block, its `with:` block
 * and a `run: |` block scalar whatever the indentation happens to be.
 *
 * Dropping the comments first is not tidiness. It is what stops a `#` line
 * that merely MENTIONS `--concurrency=10` from satisfying the assertion — the
 * exact trap the one prior "workflow test" in this repo fell into by being a
 * comment rather than an assertion.
 */
function gateJobSteps(workflow: string): string[] {
  const lines = workflow
    .split("\n")
    .filter((line) => !/^\s*#/.test(line) && line.trim() !== "");

  const gateIndex = lines.findIndex((line) => /^\s*gate:\s*$/.test(line));
  expect(gateIndex, "ci.yml declares a `gate:` job").toBeGreaterThanOrEqual(0);
  const gateIndent = indentOf(lines[gateIndex] ?? "");

  // The job body: everything indented deeper than the `gate:` key itself.
  const body: string[] = [];
  for (const line of lines.slice(gateIndex + 1)) {
    if (indentOf(line) <= gateIndent) break;
    body.push(line);
  }

  const stepsIndex = body.findIndex((line) => /^\s*steps:\s*$/.test(line));
  expect(
    stepsIndex,
    "the `gate:` job declares `steps:`",
  ).toBeGreaterThanOrEqual(0);

  const steps: string[] = [];
  let itemIndent = -1;
  for (const line of body.slice(stepsIndex + 1)) {
    const itemPrefix = /^(\s*)-\s/.exec(line)?.[1];
    const indent = indentOf(line);
    if (
      itemPrefix !== undefined &&
      (itemIndent === -1 || indent === itemIndent)
    ) {
      itemIndent = itemPrefix.length;
      steps.push(line);
      continue;
    }
    const open = steps.at(-1);
    if (open === undefined) continue;
    if (indent <= itemIndent) break; // out of the steps list entirely
    steps[steps.length - 1] = `${open}\n${line}`;
  }
  return steps;
}

/** The leading-whitespace width of a line. */
function indentOf(line: string): number {
  return /^\s*/.exec(line)?.[0].length ?? 0;
}

/** Every key named `key`, at any nesting depth, in a parsed JSON value. */
function keyPaths(value: unknown, key: string, path = "$"): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) =>
      keyPaths(entry, key, `${path}[${index}]`),
    );
  }
  if (typeof value === "object" && value !== null) {
    return Object.entries(value).flatMap(([name, entry]) =>
      name === key
        ? [`${path}.${name}`]
        : keyPaths(entry, key, `${path}.${name}`),
    );
  }
  return [];
}

describe("the root test script caps turbo and stays overridable (T-WEB-S225)", () => {
  it("sets TURBO_CONCURRENCY inline, at the measured value of 2", () => {
    // The inline assignment, not an ambient-honouring
    // `${TURBO_CONCURRENCY:-2}` form: every agent session in this repo spent
    // months exporting `TURBO_CONCURRENCY=1`, and an ambient-honouring script
    // would let that keep binding invisibly. Killing it is a feature.
    expect(rootScripts.test).toMatch(/^TURBO_CONCURRENCY=2 turbo run test\b/);
  });

  it("carries no --concurrency flag, so a caller can still override it", () => {
    // A flag here would make the override in ci.yml impossible: turbo's flag
    // beats the env var, and a second `--concurrency` is a hard error rather
    // than a last-wins.
    expect(rootScripts.test).not.toMatch(/--concurrency/);
  });

  it("caps the test script alone — dev, typecheck and build are untouched", () => {
    // The blast radius that killed the `turbo.json` placement: below 3,
    // `pnpm dev` breaks, and `pnpm typecheck` would be silently capped.
    const capped = Object.entries(rootScripts)
      .filter(([, command]) => /TURBO_CONCURRENCY/.test(command))
      .map(([name]) => name);
    expect(capped).toEqual(["test"]);
  });
});

describe("the CI gate is deliberately uncapped and instrumented (T-WEB-S226)", () => {
  const testSteps = gateJobSteps(ciWorkflow).filter((step) =>
    /\bpnpm test\b/.test(step),
  );

  it("runs the suite in exactly one step", () => {
    // Fail-closed twice over: zero steps means the gate stopped running the
    // suite (or the scanner stopped finding it, which must also be a red);
    // two would mean the flag below could be true of one and false of the
    // other.
    expect(testSteps).toHaveLength(1);
  });

  it("passes --concurrency=10, keeping the gate at turbo's default fan-out", () => {
    // Drop this flag and CI silently inherits the local cap and its ~+55 %,
    // and the repo loses its one uncapped runner. 10 is turbo's own default,
    // so this pins today's behaviour rather than introducing new behaviour.
    expect(testSteps[0]).toMatch(/--concurrency=10\b/);
  });

  it("sets MIOLOS_TEST_DB_TIMING on that step", () => {
    // The instrument is what gives the PGlite hook population its first
    // eligible anchor — vitest prints no hook durations in any reporter, and
    // ADR-0055 decision 2 sizes CI-first. Asserted on the step rather than on
    // a byte-exact line, so an inline `VAR=1 pnpm test` and an `env:` block
    // both satisfy it.
    expect(testSteps[0]).toMatch(/MIOLOS_TEST_DB_TIMING/);
  });
});

describe("turbo.json carries no global concurrency key (T-WEB-S227)", () => {
  it("declares concurrency at no nesting level at all", () => {
    // turbo's `concurrency` is GLOBAL wherever it appears in this file: it
    // would cap `pnpm typecheck` silently and break `pnpm dev` below 3. The
    // scan is recursive rather than top-level so a future `tasks.test`
    // placement cannot slip in looking task-scoped. (ci.yml's own top-level
    // `concurrency:` is a GitHub Actions run-group and is unrelated — it is
    // deliberately not in this scan's scope.)
    expect(keyPaths(turboConfig, "concurrency")).toEqual([]);
  });

  it("declares MIOLOS_TEST_DB_TIMING on the test task's env", () => {
    // Without the declaration turbo's strict env filtering drops the variable
    // and the CI instrument above is silently inert — it produces no lines and
    // no failure. Declaring it also puts the flag in the task hash, which is
    // correct: toggling it must invalidate the cache.
    const testTaskEnv = z
      .object({
        tasks: z.object({ test: z.object({ env: z.array(z.string()) }) }),
      })
      .parse(turboConfig).tasks.test.env;
    expect(testTaskEnv).toContain("MIOLOS_TEST_DB_TIMING");
  });
});

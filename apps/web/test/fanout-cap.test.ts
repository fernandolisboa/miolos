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
 * tracked home of the full table). THIS SESSION, one box, one tree — the
 * elapsed column is NOT a speed result, see below:
 *
 *   config       green      elapsed (mean)   peak summed RSS
 *   uncapped     0 of 6     78-100 s         15 484 MB / 33 procs,
 *                                            MemAvailable floor 135 MB,
 *                                            swap 1 348 MB
 *   TC=2         4 of 4     42-97 s  (60.5)   8 042 MB / 16 procs
 *   TC=3         4 of 4     98-120 s (106.3)  9 841 MB / 25 procs
 *   TC=4         2 of 2     52-53 s  (52.5)  NOT SAMPLED
 *
 * WHY 2. It is the GREENEST and the LIGHTEST. It is NOT the fastest, and this
 * block claimed it was until #114's step-7 round: TC=4 averaged 52.5 s (52,
 * 53) against TC=2's 60.5 s (97, 61, 42, 42). Nor can "faster than uncapped"
 * be read off the table — every uncapped row is RED, and turbo terminates a
 * red run's siblings on the first failure, so those wall clocks are censored
 * downward and are incomparable with a green one (handoff 048 landmine 6).
 *
 * So the case for 2 over 4 rests on MEMORY, not speed. 4 was green twice and
 * fast, but has no RSS sample at all, and the memory model puts it at
 * ~12.6 GB against a 15.5 GB box — inside the region where MemAvailable was
 * measured collapsing to 135 MB. Shipping the one number with no memory
 * evidence, into a fix whose entire diagnosis is a memory model, is not an
 * option. 3 costs 22 % more memory than 2 (9 841 MB against 8 042) and is the
 * slowest capped setting measured.
 *
 * THE ONLY GREEN-VS-GREEN SPEED FIGURES ARE #110's, AND THEY ARE A DIFFERENT
 * SESSION AND A DIFFERENT TREE FROM THE TABLE ABOVE. Read as a set, never
 * mixed with it: `--concurrency=2` at 43-44 s, uncapped at 56-59 s,
 * `--concurrency=1` at 67 s. That is where "capped is faster than uncapped"
 * comes from, and it is also why 1 is rejected on speed as well as on nothing
 * else it buys. Mixing #110's 43-44 s with this table's 42-97 s is the trap
 * this paragraph exists to stop.
 *
 * WHAT ELSE THE CAP THROTTLES, STATED ONCE SO IT IS NOT RE-DIAGNOSED.
 * `turbo.json` gives the `test` task `dependsOn: ["^build"]`, so on a cold
 * cache a `pnpm test` pulls dependency builds into the same run and the cap
 * of 2 throttles THOSE too, not only the six test tasks. Every row above was
 * measured with `--force`, so the figures already include forced builds and
 * the effect is priced in; a warm bare `pnpm test` — what pre-commit runs —
 * is strictly cheaper. Not a defect, and not a reason to move the cap.
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

/** What `parseGateJob` found. `-1` on either index means "absent". */
type GateJob = {
  /** Where the `gate:` key sits among the comment-stripped lines. */
  gateIndex: number;
  /** Where `steps:` sits within the `gate:` job's own body. */
  stepsIndex: number;
  /** One entry per step, each carrying its own nested block verbatim. */
  steps: string[];
};

/**
 * The `gate` job's steps, split without a YAML parser — the repo has no YAML
 * dependency and a scan of one workflow is not the reason to add one.
 *
 * Robust enough to survive reformatting: comments are dropped first, then a
 * step is every line from one `- ` item under `steps:` up to the next item at
 * the same indentation, so a step keeps its own `env:` block, its `with:`
 * block and a `run: |` block scalar whatever the indentation happens to be.
 *
 * DROPPING THE COMMENTS IS NOT TIDINESS, AND FULL-LINE STRIPPING IS NOT
 * ENOUGH. It is what stops a `#` that merely MENTIONS `--concurrency=10` from
 * satisfying the assertion. The first revision of this file stripped whole
 * comment lines only, and that left a live false green: the line
 * `- run: MIOLOS_TEST_DB_TIMING=1 pnpm test # --concurrency=10` PASSED the
 * flag assertion while CI ran the capped script — exactly the regression
 * `T-WEB-S226` exists to catch. Trailing comments are stripped too, and the
 * *"a trailing comment cannot satisfy the flag assertion"* probe below is
 * what keeps this paragraph true rather than merely claimed.
 *
 * The trailing strip is NAIVE about a `#` inside a quoted scalar — real YAML
 * would keep that one, this drops it. Verified rather than assumed: a grep
 * for a quoted scalar containing `#` over `.github/workflows/ci.yml` matches
 * nothing, and the file's only trailing comments are the five `# vN` markers
 * beside SHA-pinned actions. If such a scalar ever arrives, this scan
 * over-strips and reds — which is the safe direction for a tripwire.
 *
 * It never throws and never asserts: a malformed workflow comes back as
 * `-1`/`-1`/`[]` so it surfaces as a NAMED test failure rather than as a
 * collection error. This runs at collection time, and a `expect()` inside it
 * would take the whole file down before any test was reported.
 */
function parseGateJob(workflow: string): GateJob {
  const lines = workflow
    .split("\n")
    .filter((line) => !/^\s*#/.test(line))
    .map((line) => line.replace(/\s+#.*$/, ""))
    .filter((line) => line.trim() !== "");

  const gateIndex = lines.findIndex((line) => /^\s*gate:\s*$/.test(line));
  if (gateIndex < 0) return { gateIndex, stepsIndex: -1, steps: [] };
  const gateIndent = indentOf(lines[gateIndex] ?? "");

  // The job body: everything indented deeper than the `gate:` key itself.
  const body: string[] = [];
  for (const line of lines.slice(gateIndex + 1)) {
    if (indentOf(line) <= gateIndent) break;
    body.push(line);
  }

  const stepsIndex = body.findIndex((line) => /^\s*steps:\s*$/.test(line));
  if (stepsIndex < 0) return { gateIndex, stepsIndex, steps: [] };

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
  return { gateIndex, stepsIndex, steps };
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
  const gateJob = parseGateJob(ciWorkflow);
  const testSteps = gateJob.steps.filter((step) => /\bpnpm test\b/.test(step));

  it("declares a gate job with a steps list the scanner can find", () => {
    // These two were `expect()` calls inside the parser, which runs at
    // COLLECTION time: a malformed workflow took the whole file down as a
    // collection error, with no test name attached to the failure. Here they
    // are a named red, and the parser returns -1 instead of throwing.
    expect(
      gateJob.gateIndex,
      "ci.yml declares a `gate:` job",
    ).toBeGreaterThanOrEqual(0);
    expect(
      gateJob.stepsIndex,
      "the `gate:` job declares `steps:`",
    ).toBeGreaterThanOrEqual(0);
  });

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

  it("a trailing comment cannot satisfy the --concurrency=10 assertion", () => {
    // NON-VACUITY, and the probe that keeps the parser's doc block honest.
    // Rewrite the gate's own test step so the flag survives ONLY inside a
    // trailing comment — the exact shape a "tidy-up" would leave behind — and
    // the scan must stop seeing it. Against the first revision of the parser,
    // which stripped full-line comments only, this construction PASSED the
    // assertion above while CI ran the capped script.
    const sabotaged = ciWorkflow.replace(
      /^(\s*- run: .*\bpnpm test\b).*--concurrency=10.*$/m,
      "$1 # --concurrency=10",
    );
    expect(
      sabotaged,
      "the sabotage substitution actually fired — if not, the gate step's shape moved and this probe is asserting nothing",
    ).not.toEqual(ciWorkflow);
    expect(sabotaged).toContain("pnpm test # --concurrency=10");

    const sabotagedSteps = parseGateJob(sabotaged).steps.filter((step) =>
      /\bpnpm test\b/.test(step),
    );
    expect(sabotagedSteps).toHaveLength(1);
    expect(sabotagedSteps[0]).not.toMatch(/--concurrency=10\b/);
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

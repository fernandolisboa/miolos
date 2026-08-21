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
 * READ THIS FIRST: EVERYTHING BELOW WAS MEASURED ON A BOX THAT NO LONGER
 * EXISTS, AND THE CAP IS NO LONGER THE WHOLE FIX. The developer box's WSL2
 * allocation was 15 545 MB when this block was written and is 16 GB now, and
 * more importantly ADR-0057 decision 6 added `vitest.shared.ts`, which bounds
 * `maxWorkers` — the axis this block treats as fixed at `cpus - 1` throughout.
 * With that bound in place `pnpm test` peaks at 6 670 MB rather than 9 626,
 * and the uncapped path at 11 629 rather than 17 748. Three specific claims
 * below are dead: "TC=4 ... NOT SAMPLED" (it has three samples now), "It is
 * NOT the fastest" (2 is fastest on the current box, 40-41 s against 4's
 * 50-53), and "uncapped 0 of 6" (uncapped is green). The reasoning is kept
 * because it is why the cap exists and why the budget stays; the numbers are
 * history. Current figures: ADR-0057 decision 6 and plan 049 §2.7.
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
 * *(**FOUR scans as of #126**, which added `T-WEB-S233` over
 * `.github/workflows/properties.yml`. Everything this paragraph says holds of
 * it unchanged and for the same reason: it can show that the nightly full
 * property proof is CONFIGURED, never that it ran or passed. That evidence is
 * a green `workflow_dispatch` run, and it is necessarily POST-MERGE: GitHub
 * exposes `workflow_dispatch` and `schedule` only for workflows already on the
 * default branch, so #126 could not produce it before merging and posted it as
 * a comment on the issue instead. The count is
 * annotated rather than rewritten because a count is exactly the kind of claim
 * this repo has watched rot — the mapping is what matters: `S225` the root
 * script, `S226` the gate job, `S227` `turbo.json`, `S229` the worker bound,
 * `S231` the nightly. (`S230` is #63's, in `aligning-numerals.test.ts` — it
 * landed while #126 was in review and forced the renumber; see
 * `docs/agents/test-ids.md`.))*
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
 * package's manifest rather than the root's. *(**And `T-WEB-S233` at #126 is
 * the second**, over `.github/workflows/properties.yml`. `S226` stays the
 * first; what it stopped being is the only one, which is why the sentence
 * gains this clause rather than losing its claim.)*
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

  it("declares MIOLOS_FULL_PROPERTIES on the test task's env", () => {
    // Same two reasons as the sibling below, and one more that is specific to
    // this flag: without the declaration turbo's strict env filtering drops
    // it, so `MIOLOS_FULL_PROPERTIES=1 pnpm test` would run the REDUCED sample
    // and report it green — a proof that never executed. The declaration also
    // puts the flag in the task hash, so toggling it invalidates the cache
    // rather than replaying the other mode's logs. See ADR-0059 and
    // `packages/games/test/property-runs.ts`.
    const testTaskEnv = z
      .object({
        tasks: z.object({ test: z.object({ env: z.array(z.string()) }) }),
      })
      .parse(turboConfig).tasks.test.env;
    expect(testTaskEnv).toContain("MIOLOS_FULL_PROPERTIES");
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

describe("the worker bound, and the one package that must not carry it (T-WEB-S229)", () => {
  // The turbo cap bounds PACKAGES. `vitest.shared.ts` bounds WORKERS, which is
  // the axis tied to core count and therefore the one that outgrows any box.
  // Both are needed; see that file for the measurements.
  //
  // This scan exists because writing these configs is exactly where the purity
  // backstop nearly died: a first pass generated one for every workspace with a
  // glob, which both clobbered `apps/web`'s real config (jsdom, plugin-react,
  // setup file) and put a `vitest/config` import into `packages/games`.
  const repoRoot = join(import.meta.dirname, "..", "..", "..");
  const read = (p: string) => readFileSync(join(repoRoot, p), "utf8");

  it("binds every workspace that may carry a config to the shared bound", () => {
    // `packages/games` is deliberately absent from this list, not overlooked.
    const bound = [
      "packages/db",
      "packages/core",
      "packages/ui",
      "apps/web",
      "apps/api",
    ];
    const missing = bound.filter(
      (pkg) =>
        !/from "\.\.\/\.\.\/vitest\.shared"/.test(
          read(`${pkg}/vitest.config.ts`),
        ),
    );
    expect(missing).toEqual([]);
  });

  it("keeps apps/web's own settings, which a generated config would have erased", () => {
    // Named individually: a config that merely imports the bound would satisfy
    // the test above while having silently dropped the DOM environment, and
    // every component test would then pass against the wrong environment.
    const web = read("apps/web/vitest.config.ts");
    expect(web).toContain("jsdom");
    expect(web).toContain("plugin-react");
    expect(web).toContain("./test/setup.ts");
  });

  it("leaves packages/games without a vitest config, per ADR-0017 (and #126 kept it that way)", () => {
    // NOT a style rule. Importing `vitest/config` pulls vite's `.d.ts`, which
    // references `@types/node`, into a package whose tsconfig sets `types: []`
    // — silently defeating the typecheck that enforces the project's central
    // invariant that `packages/games` takes zero Node dependencies. ADR-0017
    // records that it was found only when a negative typecheck test began
    // passing when it should not have.
    expect(() => read("packages/games/vitest.config.ts")).toThrow();
  });
});

describe("the nightly full property proof cannot be deleted in silence (T-WEB-S233)", () => {
  /**
   * WHY A SCAN AT ALL. #126 moved `packages/games`'s generator properties off
   * the per-pull-request path: the gate runs a 25-run sample and
   * `.github/workflows/properties.yml` runs ADR-0023's `numRuns >= 100` floor
   * nightly. That trade is only sound while the nightly exists. Delete the
   * workflow — or drop its `schedule`, or its `MIOLOS_FULL_PROPERTIES=1`, or
   * point it at a package that has no properties — and every check in the repo
   * stays green while the project silently keeps only the cheap sample. There
   * is no other signal: a workflow that does not run produces no red.
   *
   * Same limits as the three scans above, stated once more because they are
   * easy to forget: this reads a workflow FILE. It asserts what the
   * configuration says, never that a nightly run happened or passed. The
   * behavioural evidence is a green `workflow_dispatch` run, which could only
   * be taken AFTER #126 merged — GitHub exposes `workflow_dispatch` and
   * `schedule` only for workflows on the default branch — so it lives in a
   * comment on #126 rather than in its pull-request body.
   *
   * Homed here rather than in `packages/games` because that package carries no
   * test ids and no Node-ish repo-scanning tests by design, and because this is
   * the file where `T-WEB-S226`/`S227` already scan `ci.yml` and `turbo.json`
   * for exactly this class of drift.
   */
  const propertiesWorkflow = readRepoFile(
    ".github",
    "workflows",
    "properties.yml",
  );

  /** Comment-stripped, for the same reason `parseGateJob` strips them: a `#` that
   * merely MENTIONS a setting must not satisfy an assertion about it. */
  const live = propertiesWorkflow
    .split("\n")
    .filter((line) => !/^\s*#/.test(line))
    .map((line) => line.replace(/\s+#.*$/, ""))
    .join("\n");

  it("runs on a schedule, and can also be dispatched by hand", () => {
    expect(live).toMatch(/^\s*schedule:\s*$/m);
    expect(live).toMatch(/^\s*-\s*cron:\s*["']?[\d*\s/,-]+["']?\s*$/m);
    expect(live).toMatch(/^\s*workflow_dispatch:\s*$/m);
  });

  it("sets MIOLOS_FULL_PROPERTIES=1, which is the whole point of it", () => {
    // Without this the nightly runs the same reduced sample the gate runs, and
    // ADR-0023's floor binds nowhere at all.
    expect(live).toMatch(/MIOLOS_FULL_PROPERTIES:\s*["']?1["']?/);
  });

  it("actually runs the package whose properties were reduced", () => {
    expect(live).toMatch(/turbo run test[^\n]*--filter=@miolos\/games/);
    // `--force`, because a turbo cache hit is a log REPLAY: a replayed green
    // would report a proof that never executed (napkin, #114).
    expect(live).toMatch(/turbo run test[^\n]*--force/);
  });

  it("opens an issue when it fails, rather than trusting a red run to be seen", () => {
    // `failure() || cancelled()`, not `failure()` alone: `timeout-minutes`
    // CANCELS a hung job, and `if: failure()` does not fire on cancellation —
    // a 30-minute hang would otherwise give a red run and no issue at all.
    expect(live).toMatch(
      /if:\s*\$\{\{\s*failure\(\)\s*\|\|\s*cancelled\(\)\s*\}\}/,
    );
    // The `--label` FLAG, not merely the string: `property-alert` also appears
    // in the issue body, so `toContain` would still pass with both flags gone.
    expect(live).toMatch(/--label property-alert\b/);
    expect(live).toMatch(/issues:\s*write/);
  });

  it("a commented-out schedule cannot satisfy the schedule assertion", () => {
    // NON-VACUITY, the `T-WEB-S226` trailing-comment probe's shape: comment the
    // `schedule:` key out — the exact residue of a "temporarily disable the
    // nightly" change that never got reverted — and the scan must stop seeing
    // it.
    const sabotaged = propertiesWorkflow.replace(
      /^(\s*)schedule:\s*$/m,
      "$1# schedule:",
    );
    expect(
      sabotaged,
      "the sabotage substitution actually fired — if not, the workflow's shape moved and this probe is asserting nothing",
    ).not.toEqual(propertiesWorkflow);
    const sabotagedLive = sabotaged
      .split("\n")
      .filter((line) => !/^\s*#/.test(line))
      .map((line) => line.replace(/\s+#.*$/, ""))
      .join("\n");
    expect(sabotagedLive).not.toMatch(/^\s*schedule:\s*$/m);
  });
});

describe("the hourly streak-notify tick keeps its decided shape (T-WEB-S297)", () => {
  /**
   * The `T-WEB-S226`/`S233` register applied to #146's dispatcher tick
   * (ADR-0064 decision 8, ADR-0067): the workflow is the only thing that
   * makes the hourly tick exist, and a workflow that does not run produces
   * no red. Same limits as the scans above: this reads the FILE — it pins
   * what the configuration says, never that a tick ran. The decided tokens
   * pinned here, each a plan-063 §4 decision rather than a default: the
   * hourly schedule (the granularity ADR-0064 d8 prices), `-X POST` (the
   * route is POST because the tick writes and sends, and Vercel cron —
   * which sends GET — is not the driver), `-fsS` (an HTTP error fails the
   * job, so a red scheduled run IS the alert; 503 = push misconfigured),
   * the secret bearer, and ZERO marketplace actions (`uses:` absent — the
   * #41 convention satisfied by construction, pinned rather than assumed).
   */
  const notifyWorkflow = readRepoFile(
    ".github",
    "workflows",
    "streak-notify.yml",
  );

  /** Comment-stripped, the S233 spelling: a `#` that merely MENTIONS a
   * setting must not satisfy an assertion about it. */
  const live = notifyWorkflow
    .split("\n")
    .filter((line) => !/^\s*#/.test(line))
    .map((line) => line.replace(/\s+#.*$/, ""))
    .join("\n");

  it("ticks hourly, and can also be dispatched by hand for a drill", () => {
    expect(live).toMatch(/^\s*schedule:\s*$/m);
    expect(live).toMatch(/^\s*-\s*cron:\s*["']0 \* \* \* \*["']\s*$/m);
    expect(live).toMatch(/^\s*workflow_dispatch:/m);
  });

  it("curls the route as a POST, with the secret bearer and -fsS, at the api origin", () => {
    const curl = live.split("\n").find((line) => line.includes("curl"));
    expect(curl).toBeDefined();
    expect(curl).toContain("-fsS");
    expect(curl).toContain("-X POST");
    expect(curl).toContain("Authorization: Bearer $CRON_SECRET");
    expect(curl).toContain("/cron/notify");
    // The secret arrives from the repo secret, never a literal.
    expect(live).toMatch(/CRON_SECRET:\s*\$\{\{\s*secrets\.CRON_SECRET\s*\}\}/);
  });

  it("takes zero marketplace actions and zero permissions", () => {
    // No `uses:` line at all: nothing to SHA-pin, by construction.
    expect(live).not.toMatch(/^\s*uses:/m);
    // Least privilege — buffer-alert needs issues:write; this needs nothing.
    expect(live).toMatch(/^permissions:\s*\{\}\s*$/m);
  });
});

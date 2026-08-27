import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import { z } from "zod";

const repoRoot = join(import.meta.dirname, "../../..");

function readRepoFile(...segments: string[]): string {
  return readFileSync(join(repoRoot, ...segments), "utf8");
}

const rootManifest: unknown = JSON.parse(readRepoFile("package.json"));
const rootScripts = z
  .object({ scripts: z.record(z.string(), z.string()) })
  .parse(rootManifest).scripts;

const turboConfig: unknown = JSON.parse(readRepoFile("turbo.json"));

const ciWorkflow = readRepoFile(".github", "workflows", "ci.yml");

type GateJob = {
  gateIndex: number;

  stepsIndex: number;

  steps: string[];
};

function parseGateJob(workflow: string): GateJob {
  const lines = workflow
    .split("\n")
    .filter((line) => !/^\s*#/.test(line))
    .map((line) => line.replace(/\s+#.*$/, ""))
    .filter((line) => line.trim() !== "");

  const gateIndex = lines.findIndex((line) => /^\s*gate:\s*$/.test(line));
  if (gateIndex < 0) return { gateIndex, stepsIndex: -1, steps: [] };
  const gateIndent = indentOf(lines[gateIndex] ?? "");

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
    if (indent <= itemIndent) break;
    steps[steps.length - 1] = `${open}\n${line}`;
  }
  return { gateIndex, stepsIndex, steps };
}

function indentOf(line: string): number {
  return /^\s*/.exec(line)?.[0].length ?? 0;
}

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
    expect(rootScripts.test).toMatch(/^TURBO_CONCURRENCY=2 turbo run test\b/);
  });

  it("carries no --concurrency flag, so a caller can still override it", () => {
    expect(rootScripts.test).not.toMatch(/--concurrency/);
  });

  it("caps the test script alone — dev, typecheck and build are untouched", () => {
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
    expect(testSteps).toHaveLength(1);
  });

  it("passes --concurrency=10, keeping the gate at turbo's default fan-out", () => {
    expect(testSteps[0]).toMatch(/--concurrency=10\b/);
  });

  it("a trailing comment cannot satisfy the --concurrency=10 assertion", () => {
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
    expect(testSteps[0]).toMatch(/MIOLOS_TEST_DB_TIMING/);
  });
});

describe("turbo.json carries no global concurrency key (T-WEB-S227)", () => {
  it("declares concurrency at no nesting level at all", () => {
    expect(keyPaths(turboConfig, "concurrency")).toEqual([]);
  });

  it("declares MIOLOS_FULL_PROPERTIES on the test task's env", () => {
    const testTaskEnv = z
      .object({
        tasks: z.object({ test: z.object({ env: z.array(z.string()) }) }),
      })
      .parse(turboConfig).tasks.test.env;
    expect(testTaskEnv).toContain("MIOLOS_FULL_PROPERTIES");
  });

  it("declares MIOLOS_TEST_DB_TIMING on the test task's env", () => {
    const testTaskEnv = z
      .object({
        tasks: z.object({ test: z.object({ env: z.array(z.string()) }) }),
      })
      .parse(turboConfig).tasks.test.env;
    expect(testTaskEnv).toContain("MIOLOS_TEST_DB_TIMING");
  });
});

describe("the worker bound, and the one package that must not carry it (T-WEB-S229)", () => {
  //

  const repoRoot = join(import.meta.dirname, "..", "..", "..");
  const read = (p: string) => readFileSync(join(repoRoot, p), "utf8");

  it("binds every workspace that may carry a config to the shared bound", () => {
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
    const web = read("apps/web/vitest.config.ts");
    expect(web).toContain("jsdom");
    expect(web).toContain("plugin-react");
    expect(web).toContain("./test/setup.ts");
  });

  it("leaves packages/games without a vitest config, per ADR-0017 (and #126 kept it that way)", () => {
    expect(() => read("packages/games/vitest.config.ts")).toThrow();
  });
});

describe("the nightly full property proof cannot be deleted in silence (T-WEB-S233)", () => {
  const propertiesWorkflow = readRepoFile(
    ".github",
    "workflows",
    "properties.yml",
  );

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
    expect(live).toMatch(/MIOLOS_FULL_PROPERTIES:\s*["']?1["']?/);
  });

  it("actually runs the package whose properties were reduced", () => {
    expect(live).toMatch(/turbo run test[^\n]*--filter=@miolos\/games/);

    expect(live).toMatch(/turbo run test[^\n]*--force/);
  });

  it("opens an issue when it fails, rather than trusting a red run to be seen", () => {
    expect(live).toMatch(
      /if:\s*\$\{\{\s*failure\(\)\s*\|\|\s*cancelled\(\)\s*\}\}/,
    );

    expect(live).toMatch(/--label property-alert\b/);
    expect(live).toMatch(/issues:\s*write/);
  });

  it("a commented-out schedule cannot satisfy the schedule assertion", () => {
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
  const notifyWorkflow = readRepoFile(
    ".github",
    "workflows",
    "streak-notify.yml",
  );

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

    expect(live).toMatch(/CRON_SECRET:\s*\$\{\{\s*secrets\.CRON_SECRET\s*\}\}/);
  });

  it("takes zero marketplace actions and zero permissions", () => {
    expect(live).not.toMatch(/^\s*uses:/m);

    expect(live).toMatch(/^permissions:\s*\{\}\s*$/m);
  });
});

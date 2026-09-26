import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
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

function liveWorkflow(workflow: string): string {
  return workflow
    .split("\n")
    .filter((line) => !/^\s*#/.test(line))
    .map((line) => line.replace(/\s+#.*$/, ""))
    .join("\n");
}

function parseGateJob(workflow: string): GateJob {
  const lines = liveWorkflow(workflow)
    .split("\n")
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
        !/from "\.\.\/\.\.\/vitest\.shared\.ts"/.test(
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

  const live = liveWorkflow(propertiesWorkflow);

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
    const sabotagedLive = liveWorkflow(sabotaged);
    expect(sabotagedLive).not.toMatch(/^\s*schedule:\s*$/m);
  });
});

describe("the hourly streak-notify tick keeps its decided shape (T-WEB-S297)", () => {
  const notifyWorkflow = readRepoFile(
    ".github",
    "workflows",
    "streak-notify.yml",
  );

  const live = liveWorkflow(notifyWorkflow);

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

describe("the buffer alert keeps its two independent issue streams (T-WEB-S414)", () => {
  const alertWorkflow = readRepoFile(
    ".github",
    "workflows",
    "buffer-alert.yml",
  );
  const live = liveWorkflow(alertWorkflow);

  const SHAPE_CHECK = `jq -e '(.shallow | type) == "boolean" and (.termoAnswersLow | type) == "boolean" and (.termoAnswersRemaining | type) == "number"' > /dev/null`;

  const issueStep = (() => {
    const lines = alertWorkflow.split("\n");
    const start = lines.findIndex((line) =>
      line.includes("name: Open or bump the alert issues"),
    );
    const run = lines.findIndex(
      (line, index) => index > start && /^\s*run: \|$/.test(line),
    );
    const body: string[] = [];
    for (const line of lines.slice(run + 1)) {
      if (line.trim() !== "" && !line.startsWith("          ")) break;
      body.push(line.slice(10));
    }
    return body.join("\n");
  })();

  const runIssueStep = (env: Record<string, string>, failList = "never") => {
    const dir = mkdtempSync(join(tmpdir(), "buffer-alert-"));
    const log = join(dir, "gh.log");
    writeFileSync(log, "");
    writeFileSync(
      join(dir, "gh"),
      `#!/bin/bash\necho "$*" >> "${log}"\nif [ "$1 $2" = "issue list" ] && [[ "$*" == *"${failList}"* ]]; then exit 1; fi\n`,
      { mode: 0o755 },
    );
    const result = spawnSync("bash", ["-e", "-c", issueStep], {
      env: {
        NODE_ENV: "test",
        PATH: `${dir}:${process.env["PATH"] ?? ""}`,
        REPO: "r",
        BODY: '{"depths":{"termo":3},"shallow":true,"termoAnswersLow":true,"termoAnswersRemaining":12}',
        SHALLOW: "false",
        ANSWER_LIST_LOW: "false",
        FORCE_SHALLOW: "false",
        FORCE_ANSWER_LIST_LOW: "false",
        ...env,
      },
    });
    return { status: result.status, calls: readFileSync(log, "utf8") };
  };

  const unconstrainedEnvWrites = (text: string): string[] =>
    text
      .split("\n")
      .filter((line) => line.includes("GITHUB_ENV"))
      .filter((line) =>
        /\bjq\b[^|]*(\s-[a-z]*[rj][a-z]*\b|--raw-output|--join-output)/.test(
          line,
        ),
      )
      .filter(
        (line) =>
          !/jq -r 'if \.\w+ == true then "true" else "false" end'/.test(line),
      );

  const streamLabels = (text: string, flag: string): string[] => {
    const lines = text.split("\n");
    const start = lines.findIndex((line) =>
      line.includes(`if [ "$${flag}" = true ]`),
    );
    if (start < 0) return [];
    const indent = /^\s*/.exec(lines[start] ?? "")?.[0] ?? "";
    const end = lines.findIndex(
      (line, index) => index > start && line === `${indent}fi`,
    );
    return lines
      .slice(start, end)
      .flatMap((line) => /open_or_bump (\S+)/.exec(line)?.[1] ?? []);
  };

  it("polls daily after the publish window, and both alerts can be drilled by hand", () => {
    expect(live).toMatch(/^\s*-\s*cron:\s*["']30 7 \* \* \*["']\s*$/m);
    expect(live).toMatch(/^\s*force_shallow:\s*$/m);
    expect(live).toMatch(/^\s*force_answer_list_low:\s*$/m);
    expect(live).toMatch(/curl -fsS "\$API_ORIGIN\/buffer-depth"/);
  });

  it("holds issues: write, runs one at a time, and uses nothing from the marketplace", () => {
    expect(live).toMatch(/^permissions:\s*\n\s+issues:\s*write\s*$/m);
    expect(live).toMatch(/^concurrency: buffer-alert$/m);
    expect(live).not.toMatch(/^\s*uses:/m);
  });

  it("files each stream under its own label, from one list-then-create helper", () => {
    expect(streamLabels(live, "SHALLOW")).toEqual(["buffer-alert"]);
    expect(streamLabels(live, "ANSWER_LIST_LOW")).toEqual([
      "answer-list-alert",
    ]);
    expect(live.match(/--label \S+/g)).toEqual([
      '--label "$1"',
      '--label "$1"',
    ]);
  });

  it("a stream filed under the other stream's label turns the check red", () => {
    const sabotaged = alertWorkflow.replace(
      "open_or_bump answer-list-alert",
      "open_or_bump buffer-alert",
    );
    expect(sabotaged).not.toEqual(alertWorkflow);
    expect(streamLabels(liveWorkflow(sabotaged), "ANSWER_LIST_LOW")).toEqual([
      "buffer-alert",
    ]);
  });

  it("creates its own label against the repo, with a fixed colour, before filing under it", () => {
    const create = live.indexOf("gh label create answer-list-alert");
    expect(create).toBeGreaterThan(-1);
    expect(create).toBeLessThan(live.indexOf("open_or_bump answer-list-alert"));
    const command = live.slice(create, live.indexOf("--force", create));
    expect(command).toContain('-R "$REPO"');
    expect(command).toMatch(/--color [0-9a-f]{6}\b/);
  });

  it("fails on a malformed body and writes only true or false flags to GITHUB_ENV", () => {
    expect(live).toContain(SHAPE_CHECK);
    expect(unconstrainedEnvWrites(live)).toEqual([]);
    expect(live).toMatch(
      /echo "SHALLOW=\$\(printf '%s' "\$body" \| jq -r 'if \.shallow == true then "true" else "false" end'\)" >> "\$GITHUB_ENV"/,
    );
    expect(live).toMatch(
      /echo "ANSWER_LIST_LOW=\$\(printf '%s' "\$body" \| jq -r 'if \.termoAnswersLow == true then "true" else "false" end'\)" >> "\$GITHUB_ENV"/,
    );
  });

  it("a shape check missing the answer-list flag turns the check red", () => {
    const sabotaged = alertWorkflow.replace(
      ' and (.termoAnswersLow | type) == "boolean"',
      "",
    );
    expect(sabotaged).not.toEqual(alertWorkflow);
    expect(liveWorkflow(sabotaged)).not.toContain(SHAPE_CHECK);
  });

  it("each drill input reaches only its own stream", () => {
    const answerList = runIssueStep({ FORCE_ANSWER_LIST_LOW: "true" });
    expect(answerList.status).toBe(0);
    expect(answerList.calls).toContain(
      "issue create -R r --label answer-list-alert",
    );
    expect(answerList.calls).not.toContain("--label buffer-alert");

    const buffer = runIssueStep({ FORCE_SHALLOW: "true" });
    expect(buffer.status).toBe(0);
    expect(buffer.calls).toContain("issue create -R r --label buffer-alert");
    expect(buffer.calls).not.toContain("answer-list-alert");
  });

  it("a failing buffer stream neither skips the answer-list stream nor files a duplicate", () => {
    const run = runIssueStep(
      { SHALLOW: "true", ANSWER_LIST_LOW: "true" },
      "--label buffer-alert",
    );
    expect(run.status).toBe(1);
    expect(run.calls).not.toContain("issue create -R r --label buffer-alert");
    expect(run.calls).toContain("issue create -R r --label answer-list-alert");
  });

  it("a raw jq -r, -rc or -j write to GITHUB_ENV turns the check red", () => {
    for (const raw of ["jq -r .shallow", "jq -rc .shallow", "jq -j .shallow"]) {
      const sabotaged = alertWorkflow.replace(
        `jq -r 'if .shallow == true then "true" else "false" end'`,
        raw,
      );
      expect(sabotaged).not.toEqual(alertWorkflow);
      expect(unconstrainedEnvWrites(liveWorkflow(sabotaged))).toHaveLength(1);
    }
  });
});

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

import { ESLint } from "eslint";
import tseslint from "typescript-eslint";
import { describe, expect, it, vi } from "vitest";

import {
  closureOf,
  resolveSpecifier,
  valueClosureOf,
  valueSpecifiersOf,
} from "./module-graph";
import { withoutComments } from "./ts-source";

const REPO_ROOT = join(import.meta.dirname, "..", "..", "..");
const FREE_PLAY_PROBE = "apps/web/src/free-play/eslint-probe.ts";
const WALL_RULES = ["no-restricted-imports", "no-restricted-syntax"];

const IO =
  /\bfetch\s*\(|\bsendBeacon\b|\b(?:EventSource|WebSocket|XMLHttpRequest)\b|\bserviceWorker\b|\b(?:localStorage|sessionStorage|indexedDB)\b|\bdocument\.cookie\b|["']use server["']|\bcaches\.|\bcookieStore\b|\bnavigator\.storage\b/;
const WALLED_SOURCE = /^packages\/(?:db\/src|games\/src\/termo)\//;

function freePlayEntries(): readonly string[] {
  const found: string[] = [];
  for (const dir of ["apps/web/src/free-play", "apps/web/app/modo-livre"]) {
    for (const entry of readdirSync(join(REPO_ROOT, dir), {
      recursive: true,
      withFileTypes: true,
    })) {
      if (entry.isFile() && /\.tsx?$/.test(entry.name)) {
        found.push(
          relative(REPO_ROOT, join(entry.parentPath, entry.name)).replaceAll(
            "\\",
            "/",
          ),
        );
      }
    }
  }
  if (found.length <= 10) {
    throw new Error(`the free-play walk found only ${String(found.length)}`);
  }
  return found.sort();
}

function union(closures: readonly ReadonlySet<string>[]): readonly string[] {
  return [...new Set(closures.flatMap((closure) => [...closure]))].sort();
}

function doesIo(module: string): boolean {
  return IO.test(
    withoutComments(readFileSync(join(REPO_ROOT, module), "utf8")),
  );
}

function asProbeWouldSpellIt(repoRelative: string): string {
  const path = relative(dirname(FREE_PLAY_PROBE), repoRelative).replaceAll(
    "\\",
    "/",
  );
  return path.startsWith(".") ? path : `./${path}`;
}

function specifiersWrittenBy(modules: readonly string[]): readonly string[] {
  const collected: string[] = [];
  for (const source of modules.filter((m) => m.startsWith("apps/web/"))) {
    for (const specifier of valueSpecifiersOf(source)) {
      collected.push(
        specifier.startsWith(".")
          ? asProbeWouldSpellIt(join(dirname(source), specifier))
          : specifier,
      );
    }
  }
  return [...new Set(collected)].sort();
}

const eslint = new ESLint({
  cwd: REPO_ROOT,
  overrideConfigFile: join(REPO_ROOT, "eslint.config.mjs"),
  overrideConfig: [
    {
      files: ["**/*.{ts,tsx}"],
      ...tseslint.configs.disableTypeChecked,
      languageOptions: {
        parserOptions: { projectService: false, project: false },
      },
    },
  ],
});

async function wallVerdictOn(
  specifiers: readonly string[],
): Promise<readonly string[]> {
  const source = specifiers.map((s) => `import "${s}";`).join("\n") + "\n";
  const [result] = await eslint.lintText(source, {
    filePath: join(REPO_ROOT, FREE_PLAY_PROBE),
  });
  if (result === undefined) {
    throw new Error("ESLint returned no result for the free-play probe");
  }
  return result.messages
    .filter(
      (message) =>
        message.ruleId !== null && WALL_RULES.includes(message.ruleId),
    )
    .map(
      (message) =>
        `${message.ruleId ?? "?"}: ${specifiers[message.line - 1] ?? "?"}`,
    );
}

vi.setConfig({ testTimeout: 40_000 });

const entries = freePlayEntries();
const valueGraph = union(entries.map(valueClosureOf));

describe("free play's runtime graph reaches no I/O and no walled source (T-WEB-S369)", () => {
  it("no module on it does network or storage I/O, or lives in packages/db/src or packages/games/src/termo", () => {
    expect({
      io: valueGraph.filter(doesIo),
      walled: valueGraph.filter((m) => WALLED_SOURCE.test(m)),
      reachesChrome: valueGraph.includes("apps/web/src/play/screen-chrome.tsx"),
      reachesBinairo: valueGraph.includes(
        "packages/games/src/binairo/index.ts",
      ),
      typeEdgeIsFollowedByClosureOnly: [
        union(entries.map(closureOf)).includes(
          "apps/web/src/play/play-record.ts",
        ),
        valueGraph.includes("apps/web/src/play/play-record.ts"),
      ],
      termoScreenIo: [...valueClosureOf("apps/web/src/termo/termo-screen.tsx")]
        .filter(doesIo)
        .sort(),
    }).toEqual({
      io: [],
      walled: [],
      reachesChrome: true,
      reachesBinairo: true,
      typeEdgeIsFollowedByClosureOnly: [true, false],
      termoScreenIo: [
        "apps/web/src/api/client.ts",
        "apps/web/src/play/play-record.ts",
        "apps/web/src/play/push-prompt-card.tsx",
        "apps/web/src/session/bootstrap.ts",
        "apps/web/src/telemetry/client.ts",
      ],
    });
  });
});

describe("every specifier free play's runtime graph writes passes the real wall (T-WEB-S370)", () => {
  it("at a free-play path, through both wall rules", async () => {
    const specifiers = specifiersWrittenBy(valueGraph);

    expect({
      banned: await wallVerdictOn(specifiers),
      reachesStylesheet: specifiers.includes("../play/screen.module.css"),
      reachesCore: specifiers.includes("@miolos/core"),
      doorsAreCaught: await wallVerdictOn([
        ...specifiers,
        "../termo/termo-screen",
        "../streak/streak-client",
        "daily_puzzles",
      ]),
    }).toEqual({
      banned: [],
      reachesStylesheet: true,
      reachesCore: true,
      doorsAreCaught: [
        "no-restricted-imports: ../termo/termo-screen",
        "no-restricted-imports: ../streak/streak-client",
        "no-restricted-syntax: daily_puzzles",
      ],
    });
  });
});

describe("resolveSpecifier lands on source or refuses (T-WEB-S372)", () => {
  it("follows the node_modules symlink, throws on a code extension, skips CSS", () => {
    const from = "apps/web/src/free-play/catalog.ts";

    expect(
      resolveSpecifier(from, "../../node_modules/@miolos/games/src/termo"),
    ).toBe("packages/games/src/termo/index.ts");
    expect(() => resolveSpecifier(from, "../play/sync.js")).toThrow(
      "../play/sync.js",
    );
    expect(resolveSpecifier(from, "./x.module.css")).toBeNull();
  });
});

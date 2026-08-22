import { readdirSync, readFileSync } from "node:fs";
import { builtinModules } from "node:module";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// Mechanical enforcement of the project's architectural invariant:
// `packages/games` takes zero runtime dependencies and its source imports
// nothing but itself. See CLAUDE.md ("Project invariants").

const packageDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(packageDir, "src");

function listSourceFiles(): string[] {
  // Every TS flavor tsc can compile: a `.mts`/`.cts` file slipping the
  // filter is a proven evasion vector.
  return readdirSync(srcDir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && /\.(ts|tsx|mts|cts)$/.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name));
}

function importSpecifiers(source: string): string[] {
  const patterns = [
    // import ... from "x"; export ... from "x". `\b` (not `\s`) after the
    // keyword: `import{x}from"y"` is valid TS and must not slip through.
    /(?:^|[^\w$])(?:import|export)\b[^"'`]*?from\s*["']([^"']+)["']/g,
    // side-effect import "x";
    /(?:^|[^\w$])import\s*["']([^"']+)["']/g,
    // dynamic import("x")
    /(?:^|[^\w$])import\s*\(\s*["']([^"']+)["']\s*\)/g,
    // require("x")
    /(?:^|[^\w$])require\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  const specifiers: string[] = [];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const specifier = match[1];
      if (specifier !== undefined) {
        specifiers.push(specifier);
      }
    }
  }
  return specifiers;
}

describe("packages/games purity", () => {
  it("declares no runtime dependencies of any kind", () => {
    const manifest = JSON.parse(
      readFileSync(join(packageDir, "package.json"), "utf8"),
    ) as Record<string, unknown>;
    for (const field of [
      "dependencies",
      "peerDependencies",
      "optionalDependencies",
    ]) {
      expect(
        manifest[field] ?? {},
        `package.json must not declare ${field}`,
      ).toEqual({});
    }
  });

  it("has source files to check", () => {
    expect(listSourceFiles().length).toBeGreaterThan(0);
  });

  it("never uses dynamic import() or require() in src/**, in any form", () => {
    // Computed specifiers — import("node" + ":fs") — defeat any regex that
    // expects a quoted literal, a proven evasion. Games has no legitimate
    // dynamic imports at all, so ban the tokens outright.
    const offenders: string[] = [];
    const dynamicTokens = /(?:^|[^\w$.])(?:import|require)\s*\(/g;
    for (const file of listSourceFiles()) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(dynamicTokens)) {
        offenders.push(
          `${relative(packageDir, file)} -> ${match[0].trim()} at index ${match.index}`,
        );
      }
    }
    expect(
      offenders,
      "games source must not contain import(...) or require(...) in any form",
    ).toEqual([]);
  });

  it("imports only relative specifiers in src/**", () => {
    const offenders: string[] = [];
    for (const file of listSourceFiles()) {
      const source = readFileSync(file, "utf8");
      for (const specifier of importSpecifiers(source)) {
        if (!specifier.startsWith("./") && !specifier.startsWith("../")) {
          offenders.push(`${relative(packageDir, file)} -> ${specifier}`);
        }
      }
    }
    expect(
      offenders,
      "games source may import only its own files (relative specifiers)",
    ).toEqual([]);
  });

  it("never imports a Node builtin (redundant, for a clear failure message)", () => {
    const offenders: string[] = [];
    for (const file of listSourceFiles()) {
      const source = readFileSync(file, "utf8");
      for (const specifier of importSpecifiers(source)) {
        const bare = specifier.replace(/^node:/, "");
        if (specifier.startsWith("node:") || builtinModules.includes(bare)) {
          offenders.push(`${relative(packageDir, file)} -> ${specifier}`);
        }
      }
    }
    expect(offenders, "games source must not touch Node builtins").toEqual([]);
  });
});

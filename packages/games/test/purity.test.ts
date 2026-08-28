import { readdirSync, readFileSync } from "node:fs";
import { builtinModules } from "node:module";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const packageDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(packageDir, "src");

function listSourceFiles(): string[] {
  return readdirSync(srcDir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && /\.(ts|tsx|mts|cts)$/.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name));
}

function importSpecifiers(source: string): string[] {
  const patterns = [
    /(?:^|[^\w$])(?:import|export)\b[^"'`]*?from\s*["']([^"']+)["']/g,

    /(?:^|[^\w$])import\s*["']([^"']+)["']/g,

    /(?:^|[^\w$])import\s*\(\s*["']([^"']+)["']\s*\)/g,

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

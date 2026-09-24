import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import { expect } from "vitest";

import { withoutComments } from "./ts-source";

const WEB_ROOT = join(import.meta.dirname, "..");
const REPO_ROOT = join(WEB_ROOT, "..", "..");

function workspaceBase(specifier: string): string | null {
  if (!specifier.startsWith("@miolos/")) {
    return null;
  }
  const match = /^@miolos\/([a-z0-9-]+)(?:\/(.*))?$/.exec(specifier);
  if (match?.[1] === undefined) {
    throw new Error(`unresolvable workspace specifier: ${specifier}`);
  }
  return join(REPO_ROOT, "packages", match[1], "src", match[2] ?? "");
}

const SPECIFIER = /(?:from|import)\s*\(?\s*["']([^"']+)["']/g;
const TYPE_ONLY_EDGE =
  /(?:import|export)\s+type\s+(?!from\b)[^;]*?\bfrom\s*["'][^"']+["']|typeof\s+import\s*\(\s*["'][^"']+["']\s*\)/g;

export function resolveSpecifier(
  fromFile: string,
  specifier: string,
): string | null {
  const base = specifier.startsWith(".")
    ? resolve(dirname(join(REPO_ROOT, fromFile)), specifier)
    : workspaceBase(specifier);
  if (base === null || specifier.endsWith(".css")) {
    return null;
  }
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ]) {
    if (existsSync(candidate) && /\.tsx?$/.test(candidate)) {
      return relative(REPO_ROOT, realpathSync(candidate)).replaceAll("\\", "/");
    }
  }
  throw new Error(
    `${fromFile} imports ${specifier}, which resolves to nothing`,
  );
}

function specifiersIn(code: string): readonly string[] {
  return [...code.matchAll(SPECIFIER)]
    .map((match) => match[1] ?? "")
    .filter((specifier) => specifier !== "");
}

function codeOf(module: string): string {
  return withoutComments(readFileSync(join(REPO_ROOT, module), "utf8"));
}

function specifiersOf(module: string): readonly string[] {
  return specifiersIn(codeOf(module));
}

export function valueSpecifiersOf(module: string): readonly string[] {
  return specifiersIn(codeOf(module).replace(TYPE_ONLY_EDGE, ""));
}

function walk(
  entry: string,
  edgesOf: (module: string) => readonly string[],
): ReadonlySet<string> {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined || seen.has(current)) {
      continue;
    }
    seen.add(current);
    for (const specifier of edgesOf(current)) {
      const resolved = resolveSpecifier(current, specifier);
      if (resolved !== null) {
        queue.push(resolved);
      }
    }
  }
  return seen;
}

export function closureOf(entry: string): ReadonlySet<string> {
  return walk(entry, specifiersOf);
}

export function valueClosureOf(entry: string): ReadonlySet<string> {
  return walk(entry, valueSpecifiersOf);
}

function routeEntries(): readonly string[] {
  const found: string[] = [];
  for (const entry of readdirSync(join(WEB_ROOT, "app"), {
    recursive: true,
    withFileTypes: true,
  })) {
    if (entry.isFile() && /^(page|layout)\.tsx$/.test(entry.name)) {
      found.push(
        relative(REPO_ROOT, join(entry.parentPath, entry.name)).replaceAll(
          "\\",
          "/",
        ),
      );
    }
  }
  expect(found.length).toBeGreaterThan(20);
  return found.sort();
}

export function routesReaching(module: string): readonly string[] {
  return routeEntries().filter((route) => closureOf(route).has(module));
}

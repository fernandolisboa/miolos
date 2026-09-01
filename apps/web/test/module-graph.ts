import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import { expect } from "vitest";

import { withoutComments } from "./ts-source";

const WEB_ROOT = join(import.meta.dirname, "..");
const REPO_ROOT = join(WEB_ROOT, "..", "..");

export function workspaceBase(specifier: string): string | null {
  if (!specifier.startsWith("@miolos/")) {
    return null;
  }
  const match = /^@miolos\/([a-z0-9-]+)(?:\/(.*))?$/.exec(specifier);
  if (match?.[1] === undefined) {
    throw new Error(`unresolvable workspace specifier: ${specifier}`);
  }
  return join(REPO_ROOT, "packages", match[1], "src", match[2] ?? "");
}

export function resolveSpecifier(
  fromFile: string,
  specifier: string,
): string | null {
  const base = specifier.startsWith(".")
    ? resolve(dirname(join(REPO_ROOT, fromFile)), specifier)
    : workspaceBase(specifier);
  if (base === null) {
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
      return relative(REPO_ROOT, candidate).replaceAll("\\", "/");
    }
  }
  return null;
}

export function closureOf(entry: string): ReadonlySet<string> {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined || seen.has(current)) {
      continue;
    }
    seen.add(current);
    const code = withoutComments(
      readFileSync(join(REPO_ROOT, current), "utf8"),
    );
    for (const match of code.matchAll(
      /(?:from|import)\s*\(?\s*["']([^"']+)["']/g,
    )) {
      const specifier = match[1];
      if (specifier === undefined) {
        continue;
      }
      const resolved = resolveSpecifier(current, specifier);
      if (resolved !== null) {
        queue.push(resolved);
      }
    }
  }
  return seen;
}

export function routeEntries(): readonly string[] {
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

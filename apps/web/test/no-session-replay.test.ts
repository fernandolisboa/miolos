import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import { z } from "zod";

const repoRoot = join(import.meta.dirname, "../../..");

const BANNED_CLIENTS = [
  "posthog-js",
  "posthog-js-lite",
  "@posthog/react",
  "@posthog/nextjs",
  "@posthog/browser",
  "rrweb",
  "rrweb-snapshot",
  "@rrweb/record",
];

const manifestSchema = z.object({
  dependencies: z.record(z.string(), z.string()).optional(),
  devDependencies: z.record(z.string(), z.string()).optional(),
  peerDependencies: z.record(z.string(), z.string()).optional(),
  optionalDependencies: z.record(z.string(), z.string()).optional(),
});

function workspaceManifests(): { path: string; names: string[] }[] {
  const found: { path: string; names: string[] }[] = [];
  const roots = ["", "apps", "packages"];
  for (const root of roots) {
    const dir = join(repoRoot, root);
    const entries =
      root === ""
        ? ["package.json"]
        : readdirSync(dir)
            .filter((name) => statSync(join(dir, name)).isDirectory())
            .map((name) => join(name, "package.json"));
    for (const entry of entries) {
      const relative = root === "" ? entry : join(root, entry);
      let raw: string;
      try {
        raw = readFileSync(join(repoRoot, relative), "utf8");
      } catch {
        continue;
      }

      const parsed: unknown = JSON.parse(raw);
      const manifest = manifestSchema.parse(parsed);
      found.push({
        path: relative,
        names: [
          ...Object.keys(manifest.dependencies ?? {}),
          ...Object.keys(manifest.devDependencies ?? {}),
          ...Object.keys(manifest.peerDependencies ?? {}),
          ...Object.keys(manifest.optionalDependencies ?? {}),
        ],
      });
    }
  }
  return found;
}

describe("no session replay, and no client PostHog SDK (T-WEB-S322)", () => {
  const manifests = workspaceManifests();

  it("finds every workspace manifest, so the scan below cannot pass by scanning nothing", () => {
    expect(manifests.length).toBeGreaterThanOrEqual(7);
    const paths = manifests.map((manifest) => manifest.path);
    for (const expected of [
      "package.json",
      join("apps", "web", "package.json"),
      join("apps", "api", "package.json"),
      join("packages", "core", "package.json"),
      join("packages", "db", "package.json"),
      join("packages", "games", "package.json"),
      join("packages", "ui", "package.json"),
    ]) {
      expect(paths).toContain(expected);
    }

    expect(
      manifests.filter((manifest) => manifest.names.length > 0).length,
    ).toBeGreaterThanOrEqual(6);
  });

  it("declares no replay-capable client in any workspace", () => {
    for (const manifest of manifests) {
      for (const banned of BANNED_CLIENTS) {
        expect(
          manifest.names,
          `${manifest.path} declares ${banned}: session replay is a CLAUDE.md veto and ADR-0069 decision 1 rejected every client SDK. Superseding ADRs first, dependency second.`,
        ).not.toContain(banned);
      }
    }
  });

  it("resolves none of them transitively either — the lockfile is the real answer", () => {
    const lockfile = readFileSync(join(repoRoot, "pnpm-lock.yaml"), "utf8");
    const keys = [...lockfile.matchAll(/^ {2}(\S+?)@[^@\s]+:/gm)].map(
      (match) => match[1] ?? "",
    );

    expect(keys.length).toBeGreaterThan(100);
    for (const banned of BANNED_CLIENTS) {
      expect(
        keys,
        `pnpm-lock.yaml resolves ${banned} transitively — see the direct-dependency assertion above for why that is a decision, not a bump.`,
      ).not.toContain(banned);
    }
  });
});

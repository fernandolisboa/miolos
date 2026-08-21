import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import { z } from "zod";

/**
 * "NO SESSION REPLAY" AS A MECHANICAL WALL (#33, ADR-0069 decision 1;
 * step-6 issue B1).
 *
 * CLAUDE.md lists *"No session replay in telemetry"* among the invariants
 * that are vetoes rather than gaps, and issue #33's AC 2 is *"session replay
 * is disabled **and stays disabled**"*. The five-event ceiling is already
 * structural — `TELEMETRY_EVENTS` types `captureEvent`, so a sixth event is
 * a compile error — but the no-replay half rested on a convention: no SDK is
 * installed, ADR-0069 records why, and `privacidade.test.tsx` pins the
 * published copy. Nothing in the tree went red if a later PR ran
 * `pnpm add posthog-js`.
 *
 * THIS FILE IS THE INSTALL HALF, and it is the half that closes the doors an
 * import ban cannot see. `no-restricted-imports` (the source half,
 * `T-LINT-S53` in `eslint-db-wall.test.ts`) reads static specifiers only: a
 * `await import("posthog-js")` or a `require()` walks straight through it.
 * A package that is not installed cannot be reached by any import shape at
 * all, so scanning the manifests and the lockfile is strictly upstream of
 * every evasion.
 *
 * WHY A DEPENDENCY AND NOT A BEHAVIOUR is the honest framing: replay is not
 * a flag we turn off, it is code we do not have. `posthog-js` ships `rrweb`
 * and a recorder that a config object enables; `posthog-js-lite` is smaller
 * and still a client SDK. Both were rejected by name in ADR-0069 decision 1.
 * `rrweb` itself is banned separately because "roll our own replay" is the
 * same veto by another route.
 *
 * A RED HERE IS A DECISION, NOT A BUG. If a future ticket genuinely needs
 * one of these, it needs an ADR that supersedes ADR-0069 decision 1 and the
 * CLAUDE.md invariant first — and then this list changes in that diff, in
 * the open, which is the whole point.
 *
 * Homed in `apps/web/test/` for the reason `fanout-cap.test.ts` states: it
 * is where the repo's root-config scans already live and where `repoRoot` is
 * already resolved as `../../..`.
 */

const repoRoot = join(import.meta.dirname, "../../..");

/**
 * Exact package names, never a `posthog*` prefix match. A substring rule
 * would red on an unrelated package that merely mentions one of them and
 * would still miss a rename — the value here is that the list is a
 * DECISION, readable beside ADR-0069's own rejected alternatives.
 */
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

/**
 * Every workspace manifest plus the root one. Discovered by walking
 * `apps/` and `packages/` rather than listed: a workspace added later is
 * covered without anyone remembering this file, which is the same reason
 * `fanout-cap.test.ts`'s worker-bound scan enumerates rather than lists.
 */
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
      // Parsed, never cast — `JSON.parse` hands back `any`.
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
    // ANTI-VACUITY, and the reason it is its own assertion: a scan that
    // silently found zero manifests would report the invariant as held.
    // The six workspaces are the ones `pnpm test` runs — apps/web, apps/api,
    // packages/{core,db,games,ui} — plus the root.
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
    // And every manifest yielded at least one name, so a manifest whose
    // dependency blocks were all missing cannot read as "clean".
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
    // The manifests above are the direct half. A replay recorder could also
    // arrive under some other dependency, which is exactly the supply-chain
    // shape CLAUDE.md's dependency posture worries about, so the lockfile
    // gets the same question. Matched on the lockfile's own package keys
    // (`  posthog-js@1.2.3:`), not on a bare substring: a bare one would
    // red on any package whose description or resolution path happened to
    // contain the word.
    const lockfile = readFileSync(join(repoRoot, "pnpm-lock.yaml"), "utf8");
    const keys = [...lockfile.matchAll(/^ {2}(\S+?)@[^@\s]+:/gm)].map(
      // `?? ""` is `noUncheckedIndexedAccess`'s price, not a real branch:
      // the pattern cannot match without group 1.
      (match) => match[1] ?? "",
    );
    // The scan works at all: the lockfile really does yield package keys.
    expect(keys.length).toBeGreaterThan(100);
    for (const banned of BANNED_CLIENTS) {
      expect(
        keys,
        `pnpm-lock.yaml resolves ${banned} transitively — see the direct-dependency assertion above for why that is a decision, not a bump.`,
      ).not.toContain(banned);
    }
  });
});

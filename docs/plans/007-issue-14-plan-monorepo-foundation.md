# Plan — Issue #14: M0 Monorepo foundation — scaffold, gates, deployed shell

**Target file:** `docs/plans/007-issue-14-plan-monorepo-foundation.md` · **Branch:** `feat/14-monorepo-foundation` · **Closes #14**

> **Plan review:** reviewed 2026-07-31, verdict **APPROVE-WITH-FIXES**, all findings applied in this revision. Claims verified true by the reviewer: TS 6.0.3 pin arithmetic, pnpm `packageManager` self-switching, Fraunces `axes` API against Next 16.2.12 types, `z.iso.datetime()` in Zod 4.4.3, ESLint 10 peer ranges, husky v9 shebang-less hooks, prettier respecting `.prettierignore` under lint-staged.

**Read first (implementer):** `/home/ferna/projects/miolos/CLAUDE.md` (mechanical gate, invariants), `CONTEXT.md`, ADR-0002, ADR-0006, ADR-0007, ADR-0013, `DESIGN.md`, `packages/ui/tokens.css`, and the two Hoje reference frames `docs/design/006-handoff-design-winner-atelie/f1-hoje-desktop.dc.html` / `f2-hoje-mobile.dc.html` (visual specs, never production code).

---

## 1. Decisions (each verified live on 2026-07-31 with `npm view`)

### D1 — TypeScript: pin to **6.0.3**; draft **ADR-0016**

Verified live: `typescript` latest is **7.0.2**; `typescript-eslint@8.65.0` (latest) declares `peerDependencies.typescript: ">=4.8.4 <6.1.0"`; its only TS7-tolerant build is `canary` (`8.65.1-alpha.19`) — no stable or `next` dist-tag supports TS 7. TypeScript **6.0.3** is the newest release inside the peer range (`6.0.3 < 6.1.0`, verified against the versions list).

Type-aware linting is part of the mechanical gate (`pnpm lint`), so forcing the peer or dropping typescript-eslint is not acceptable. Pinning one major behind latest requires an ADR per CLAUDE.md → **ADR-0016** (see §3). The pin is expressed as an exact `"typescript": "6.0.3"` devDependency in every workspace, and the ADR names the unpin condition: typescript-eslint stable supporting TS 7.

Risk note: TS 6.0 is the bridge release to the 7.0 native port; Next 16 officially targets TS 5.x/6.x. If `next build` fails under 6.0.3 (not expected), fall back within the same ADR rationale to the newest version both toolchains accept, and record the actual version in the ADR before merging.

### D2 — Test runner: **Vitest 4.1.10** + **fast-check 4.9.0**; draft **ADR-0017**

No doc names a runner. Vitest: native TS/ESM (no transform config), one runner for Node-env package tests and jsdom React smoke tests, first-class monorepo usage (per-workspace configs), engines `^20 || ^22 || >=24` match Node 24, and fast-check integrates directly for the `packages/games` property gate that binds from #16. Jest would need ESM/TS shims; node:test lacks the ecosystem (jsdom pairing, watch DX). This is a project-wide decision of weight → short **ADR-0017**. fast-check enters now (devDep of `packages/games` only) so the first games test sets the property-testing prior art the spec demands.

### D3 — i18n: **typed in-repo message module, no library**; draft **ADR-0018**

Requirement (ADR-0013, verified): strings externalized from the first screen; "route slugs are externalized alongside the i18n strings". CLAUDE.md: prefer fewer dependencies. v1 is pt-BR only; `next-intl` buys locale negotiation/middleware we will not use, at the cost of a dependency and runtime indirection. Decision: an in-repo typed module; a future second locale is the trigger to revisit (recorded in **ADR-0018**).

Exact shape (all under `apps/web/src/i18n/` — web-only for now; moves to a package only when a second consumer exists, per ADR-0002's rule):

- `apps/web/src/i18n/messages.ts` — `export const messages = { … } as const;` plus `export type Messages = typeof messages;`. Pure values and pure value-returning functions (e.g. `completedOfTotal(done, total)`). All Hoje copy and the metadata title/description live here (full string inventory in §6.5).
- `apps/web/src/i18n/routes.ts` — `export const routeSlugs = { archive: 'arquivo', freePlay: 'modo-livre', stats: 'estatisticas' } as const;` — English identifiers, pt-BR slugs, satisfying "route slugs live with the i18n strings" from the first screen even though these routes render nothing yet.
- `apps/web/src/i18n/index.ts` — re-exports both.

### D4 — `packages/games` purity check: **workspace test + ESLint restriction**, both in the gate

Two mechanical layers, no new dependency (rejecting dependency-cruiser per "prefer fewer dependencies"):

1. **Primary (runs under `pnpm test`):** `packages/games/test/purity.test.ts` asserts:
   - `packages/games/package.json` has no `dependencies`, `peerDependencies` or `optionalDependencies` (absent or empty) — zero runtime deps of any kind, which subsumes "zero React Native and zero Node deps";
   - every `import`/`export … from`/`require(`/dynamic-`import(` specifier in every file under `packages/games/src/**` is **relative** (`./` or `../`) — games source may import only itself. This is a total rule: it forbids `node:*` builtins, bare builtins (checked redundantly against `builtinModules` from `node:module` for a clear failure message), `react-native`, and everything else.
   The test itself uses `node:fs`/`node:path` — legal, because it lives in `test/`, outside the pure surface, under its own tsconfig (§6.1).
2. **Secondary (runs under `pnpm lint`, fast feedback):** in the root flat config, a block scoped to `packages/games/src/**` with `no-restricted-imports` whose patterns are built in-config from `builtinModules` + `node:*` + `react`, `react-dom`, `react-native`.
3. **Type-level backstop:** `packages/games/tsconfig.json` sets `"lib": ["ES2023"]`, `"types": []` — no DOM, no Node globals; `process`/`fs`/`window` fail `pnpm typecheck`.

### D5 — apps/api health check

- Path: **`/health`** (the whole app *is* the API at `api.miolos.app`; no `/api` prefix).
- Response: `200` with `{ "status": "ok", "service": "api", "timestamp": "<ISO-8601 UTC>" }`. No DB, no dependencies (Neon arrives in #15).
- Contract: `healthResponseSchema` is a **Zod schema in `packages/core`** (`z.object({ status: z.literal('ok'), service: z.literal('api'), timestamp: z.iso.datetime() })`, Zod 4 syntax) — the route builds a typed value and `parse`s it before responding; the api integration test parses the handler's response with the same schema. This sets prior art for two spec seams at once (Zod-at-boundary, api HTTP integration tests).
- `export const dynamic = 'force-dynamic'` so it is never statically cached.
- Nothing hardcodes the apex: the route reads no domain; CORS (D6) reads env.

### D6 — CORS posture in M0 (ADR-0007: "real configuration")

Minimal but real: `apps/api/src/cors.ts` exports `corsHeaders(): HeadersInit` returning `{ 'Access-Control-Allow-Origin': process.env.WEB_ORIGIN }` when `WEB_ORIGIN` is set and `{}` when it is unset — an empty-valued `Access-Control-Allow-Origin` header is invalid, not absent, so the header is conditionally omitted, never emitted empty. Applied to the health route. `WEB_ORIGIN` is documented in `apps/api/.env.example` as `https://miolos.app` and set in Vercel by Fernando. No credentials, no preflight handling in M0 — there are no credentialed cross-origin calls yet; the seam exists, is env-driven, and is where #15 extends. The apex appears only in `.env.example` and docs — never in code (ADR-0013).

### D7 — pnpm: `packageManager: "pnpm@11.18.0"`

Latest stable is 11.18.0 (verified; `latest-11` = `latest`). CLAUDE.md forbids staying an entire major behind without an ADR, so 10.x is out. Local pnpm 10.31.0 self-manages: since pnpm 10, `managePackageManagerVersions` (default on) makes the local binary fetch and run the exact version in `packageManager`. Verification: `pnpm --version` at repo root must print `11.18.0` after the field lands.

### D8 — CI: one GitHub Actions workflow; **impeccable detect runs locally, not in CI, in M0**

`.github/workflows/ci.yml`, single job `gate`, on `pull_request` and `push` to `main`: checkout → pnpm setup → Node from `.nvmrc` with pnpm cache → `pnpm install --frozen-lockfile` → `pnpm typecheck` → `pnpm lint` → `pnpm test` → `pnpm build`. No Turbo remote caching (needs a Vercel token — an operator secret; local Turbo cache within the job is enough for M0). Exact YAML in §8.

`npx impeccable detect`: required by CLAUDE.md on any UI change, and this PR ships UI. It needs a running, browsable UI (and the local design context), which a bare CI job does not have; its CLI contract cannot be confirmed offline. **Decision: run it locally against `pnpm dev` during step 8 of the build order, paste the real output into the PR as gate evidence, and state explicitly in the PR that CI integration of `impeccable detect` (per brief §9) is deferred with a follow-up issue filed.** Plan conservatively: if the local run turns out to be non-executable in this environment, the evidence rule applies — report that it could not be run, verbatim, in the PR; do not fake it.

Push the branch over **SSH** (already configured): the gh token lacks the `workflow` scope, so an HTTPS push adding `.github/workflows/*` would be refused. If Actions turn out to be disabled on the private repo, that is an operator ask (§9).

### D9 — Node: `.nvmrc` = `24`, `engines.node: ">=24.15"`

Node 24 is Active LTS (v24.18.1); CI uses `node-version-file: .nvmrc`. The floor is `>=24.15` (not `>=24`) because `jsdom@30.0.1` declares engines `^22.22.2 || ^24.15.0 || >=26.0.0` — a 24.x below 24.15 fails its range. Local Node is currently v24.14.1, which is below that floor: build-order **step 0** upgrades it before anything installs.

### D10 — Package strategy: internal packages, no build step

Packages export TypeScript source directly (`"exports": { ".": "./src/index.ts" }`); each Next app lists in `transpilePackages` only the workspace packages it actually imports (web: `@miolos/ui` + `@miolos/core`; api: `@miolos/core`), matching §6.5/§6.6. No `dist/`, no per-package build task; `pnpm build` builds only the two apps. Simplest thing that satisfies "all six workspaces exist and typecheck", and the Turborepo-endorsed pattern for app-consumed packages.

### ADRs beyond the TS pin — yes

Test runner (D2) and i18n mechanism (D3) are both "technical decisions of weight" per CLAUDE.md → three short ADRs total (§3). The purity-check mechanism, health shape, CORS stance and pnpm version are ticket-scope engineering choices recorded in this plan and the PR, not ADRs.

---

## 2. Exact dependency versions (looked up 2026-07-31 — implementer re-verifies with `npm view <pkg> version` at install time and uses newer patches if published, except `typescript`, which stays exactly 6.0.3 per ADR-0016)

| Package | Version | Where |
|---|---|---|
| typescript | **6.0.3** (exact pin) | every workspace devDeps |
| next | 16.2.12 | apps/web, apps/api |
| react / react-dom | 19.2.8 | apps/web, apps/api |
| turbo | 2.10.8 | root |
| vitest | 4.1.10 | games, core, ui, web, api |
| fast-check | 4.9.0 | games |
| zod | 4.4.3 | core |
| eslint | 10.8.0 | root |
| @eslint/js | 10.0.1 | root |
| typescript-eslint | 8.65.0 | root |
| eslint-config-next | 16.2.12 | root |
| eslint-config-prettier | 10.1.8 | root |
| globals | 17.8.0 | root |
| prettier | 3.9.6 | root |
| husky | 9.1.7 | root |
| lint-staged | 17.3.0 | root |
| @types/node | 26.1.2 | web, api, packages/games (test tsconfig) |
| @types/react / @types/react-dom | 19.2.18 / 19.2.4 | web, api |
| @vitejs/plugin-react | 6.0.5 | web |
| vite | 8.2.0 | web (explicit peer of @vitejs/plugin-react 6) |
| jsdom | 30.0.1 | web |
| @testing-library/react | 16.3.2 | web |
| @testing-library/dom | 10.4.1 | web (explicit peer of @testing-library/react 16 and jest-dom 7) |
| @testing-library/jest-dom | 7.0.0 | web |

`drizzle-orm`, `@neondatabase/serverless`, `next-intl`, `dependency-cruiser`: **not installed** (deferred to #15 / rejected).

---

## 3. ADRs to draft (three, short — same template as existing ADRs: Status/Context/Decision/Rejected/Consequences)

1. **`docs/adr/0016-pin-typescript-below-7-for-typescript-eslint.md`** — Pin `typescript` to 6.0.3 (latest is 7.0.2) because typescript-eslint stable caps at `<6.1.0` and type-aware linting is part of the mechanical gate; TS 7 support exists only in typescript-eslint canary. Rejected: forcing peers (unsupported combination inside a gate), dropping type-aware linting. Consequence: unpin in an ordinary dependency-bump PR the moment typescript-eslint stable supports TS 7; the exact-version pin makes drift visible.
2. **`docs/adr/0017-vitest-and-fast-check-are-the-test-stack.md`** — Vitest as the single runner across all seams; fast-check as the property-testing library for `packages/games` (rationale in D2). Rejected: Jest (ESM/TS friction), node:test (jsdom pairing, DX).
3. **`docs/adr/0018-i18n-is-an-in-repo-typed-message-module.md`** — Typed `as const` message module + `routeSlugs` map in `apps/web/src/i18n/`; no i18n library while v1 is pt-BR-only (rationale in D3). Rejected: next-intl (dependency and middleware for a single locale). Consequence: a second locale, or a second consumer of the strings, reopens this with the `Messages` type as the migration contract.

---

## 4. Repository layout after this PR (new files only)

```
package.json  pnpm-workspace.yaml  pnpm-lock.yaml  turbo.json
tsconfig.base.json  eslint.config.mjs  .prettierrc.json  .prettierignore
.nvmrc  .gitignore (amended)
.husky/pre-commit
.github/workflows/ci.yml
docs/adr/0016-*.md  0017-*.md  0018-*.md
docs/plans/007-issue-14-plan-monorepo-foundation.md   (this file)
apps/web/      package.json  next.config.ts  tsconfig.json  vitest.config.ts  vercel.json
               .env.example  next-env.d.ts (generated, committed)
               app/{layout.tsx,page.tsx,page.module.css,globals.css}
               src/i18n/{messages.ts,routes.ts,index.ts}
               src/components/{ad-slot.tsx}
               test/hoje.smoke.test.tsx  test/setup.ts
apps/api/      package.json  next.config.ts  tsconfig.json  vitest.config.ts  vercel.json
               .env.example  app/route.ts  app/health/route.ts  src/cors.ts
               test/health.test.ts
packages/games/ package.json  tsconfig.json  tsconfig.test.json  vitest.config.ts
                src/{index.ts,random.ts}  test/{purity.test.ts,random.test.ts}
packages/core/  package.json  tsconfig.json  vitest.config.ts
                src/{index.ts,entitlements.ts,feature-flags.ts,contracts/health.ts}
                test/{entitlements.test.ts,health-contract.test.ts}
packages/db/    package.json  tsconfig.json  src/index.ts
packages/ui/    package.json  tsconfig.json  vitest.config.ts
                tokens.css (UNTOUCHED)  src/{index.ts,ad-slot-placements.ts}
                test/ad-slot-placements.test.ts
```

---

## 5. Root configuration (load-bearing contents)

### 5.1 `package.json` (root)

```json
{
  "name": "miolos",
  "private": true,
  "packageManager": "pnpm@11.18.0",
  "engines": { "node": ">=24.15" },
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "typecheck": "turbo run typecheck",
    "lint": "eslint --max-warnings 0 .",
    "test": "turbo run test",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "prepare": "husky"
  },
  "devDependencies": {
    "turbo": "2.10.8", "typescript": "6.0.3", "eslint": "10.8.0",
    "@eslint/js": "10.0.1", "typescript-eslint": "8.65.0",
    "eslint-config-next": "16.2.12", "eslint-config-prettier": "10.1.8",
    "globals": "17.8.0", "prettier": "3.9.6", "husky": "9.1.7", "lint-staged": "17.3.0"
  },
  "lint-staged": {
    "*.{ts,tsx,css,json,mjs,yml,yaml}": "prettier --write"
  }
}
```

`lint` runs ESLint once at the root (single flat config, simplest correct setup); `typecheck`/`test`/`build` fan out through Turbo.

### 5.2 `pnpm-workspace.yaml`

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

pnpm ≥10 blocks postinstall build scripts by default. After the first `pnpm install`, if pnpm warns about ignored build scripts (likely `esbuild`, possibly `sharp`, `unrs-resolver`), run `pnpm approve-builds`, approve only those, and commit the resulting `onlyBuiltDependencies` entry in `pnpm-workspace.yaml`.

### 5.3 `turbo.json`

```json
{
  "$schema": "https://turborepo.com/schema.json",
  "globalDependencies": ["tsconfig.base.json"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "env": ["NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_API_URL", "WEB_ORIGIN"],
      "outputs": [".next/**", "!.next/cache/**"]
    },
    "typecheck": { "dependsOn": ["^typecheck"] },
    "test": {},
    "dev": { "cache": false, "persistent": true }
  }
}
```

### 5.4 `tsconfig.base.json`

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2023",
    "module": "esnext",
    "moduleResolution": "bundler",
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "forceConsistentCasingInFileNames": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true
  }
}
```

Strictness beyond `strict: true` (`noUncheckedIndexedAccess`) is deliberate — the gate says "no unjustified `any`"; start maximal while the codebase is empty.

### 5.5 `eslint.config.mjs` (root, flat, ESLint 10)

Composition, in order:

1. Global ignores: `node_modules`, `.next`, `.turbo`, `coverage`, `next-env.d.ts`, `docs/**`, `content/**`, `.claude/**`, `pnpm-lock.yaml`.
2. `@eslint/js` recommended.
3. `typescript-eslint` recommendedTypeChecked (or strictTypeChecked) with `languageOptions.parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname }`, scoped to `**/*.{ts,tsx}`; disable type-aware rules for `**/*.mjs`.
4. Next rules scoped to `apps/web/**` and `apps/api/**`. eslint-config-next@16 ships flat-config exports; check its README in `node_modules/eslint-config-next` after install for the exact import (expected: `import next from 'eslint-config-next'` or the `flat` subpath / `@next/eslint-plugin-next` `configs['core-web-vitals']`). Set `settings: { next: { rootDir: ['apps/web', 'apps/api'] } }` so the plugin finds both apps.
5. Games purity block scoped to `packages/games/src/**` (D4): build the restricted list in-config via `import { builtinModules } from 'node:module'`.
6. `eslint-config-prettier` **last**.

Smoke-test note: ESLint 10 + eslint-config-next@16 is range-satisfied but unproven — verify with `pnpm lint` in build-order step 2 before piling on source; if the Next flat export misbehaves under ESLint 10, fall back to scoping `@next/eslint-plugin-next` rules manually and record it in the PR.

### 5.6 `.prettierrc.json` — `{}` (defaults). `.prettierignore`:

```
pnpm-lock.yaml
.next/
.turbo/
coverage/
next-env.d.ts
packages/ui/tokens.css
docs/
content/
.claude/
CLAUDE.md
CONTEXT.md
DESIGN.md
PRODUCT.md
README.md
NEXT-SESSION.md
```

Rationale: `tokens.css` must remain **byte-identical**; existing prose documents and the design bundle must not churn under a formatter.

### 5.7 `.nvmrc` — `24`. `.gitignore` additions:

```
.next/
.turbo/
dist/
coverage/
*.tsbuildinfo
.vercel
```

(`next-env.d.ts` is committed, per Next convention. Existing entries already cover `node_modules/`, `.env*` with `!.env.example`.)

### 5.8 Pre-commit — `.husky/pre-commit`

Desired end state (the **setup-pre-commit** skill is the documented path to wire this; the end state below is binding regardless of the tool used):

```sh
pnpm exec lint-staged
pnpm typecheck
pnpm test
```

Installed via root `"prepare": "husky"`. Matches the CLAUDE.md gate: Husky + lint-staged + typecheck + tests. Never bypassed with `--no-verify`.

---

## 6. Workspace-by-workspace specification

All packages: `"version": "0.0.0"`, `"private": true`, `"type": "module"`.

### 6.1 `packages/games` — `@miolos/games`

`package.json`:

```json
{
  "name": "@miolos/games",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "typecheck": "tsc -p tsconfig.json && tsc -p tsconfig.test.json",
    "test": "vitest run"
  },
  "devDependencies": { "typescript": "6.0.3", "vitest": "4.1.10", "fast-check": "4.9.0", "@types/node": "26.1.2" }
}
```

No `dependencies` key at all — the purity test asserts this.

- `tsconfig.json`: extends `../../tsconfig.base.json`; `"lib": ["ES2023"]`, `"types": []`; `include: ["src"]`.
- `tsconfig.test.json`: extends `../../tsconfig.base.json`; `"lib": ["ES2023"]`, `"types": ["node"]`; `include: ["test", "src"]` (src included so test imports resolve under the same program).
- `src/random.ts`: a pure seeded PRNG — `createSeededRandom(seed: number)` implementing splitmix32/mulberry32, returning `{ next(): number, nextInt(maxExclusive: number): number }`. This is real M1 substrate (seed → puzzle determinism, ADR-0011), not filler. `src/index.ts` re-exports it.
- `test/random.test.ts`: fast-check property — for any `seed` (uint32 arbitrary), two generators created with the same seed produce identical first 100 outputs, and every output is in `[0, 1)`. Sets the property-testing prior art at this seam.
- `test/purity.test.ts`: as specified in D4 (manifest has no dep fields; all `src/**` import specifiers are relative; redundant builtin-name check for good failure messages).

### 6.2 `packages/core` — `@miolos/core`

`package.json`: name `@miolos/core`, exports `"." : "./src/index.ts"`, scripts `typecheck: "tsc --noEmit"`, `test: "vitest run"`; `"dependencies": { "zod": "4.4.3" }`; devDeps `typescript@6.0.3`, `vitest@4.1.10`.

- `tsconfig.json`: extends base; `"lib": ["ES2023"]`, `"types": []` — core is shared client/server and stays platform-pure too. `include: ["src", "test"]`.
- `src/entitlements.ts` (dormant seam, ADR-0006 — an array, never a boolean):
  ```ts
  export type Entitlements = string[];
  export function hasEntitlement(entitlements: Entitlements, entitlement: string): boolean;
  ```
- `src/feature-flags.ts` (dormant seam):
  ```ts
  export type FeatureFlags = Readonly<Record<string, boolean>>;
  export const defaultFeatureFlags: FeatureFlags = {};
  export function isFeatureEnabled(flags: FeatureFlags, flag: string): boolean; // flags[flag] ?? false
  ```
  Remote resolution arrives with a later ticket; the type + default + accessor is the whole M0 shape.
- `src/contracts/health.ts`: `healthResponseSchema` + `HealthResponse` per D5. First API contract; establishes `src/contracts/` as the home of all Zod boundary schemas.
- `src/index.ts` re-exports all three modules.
- Tests: `test/entitlements.test.ts` (unit: present/absent/empty-array cases), `test/health-contract.test.ts` (example-based round-trip: valid payload parses and round-trips; wrong `status`, missing field, non-ISO timestamp all reject — per spec seam 2).

### 6.3 `packages/db` — `@miolos/db`

Empty-but-valid (schema is issue #15). `package.json`: name, exports `"./src/index.ts"`, script `typecheck: "tsc --noEmit"`, **no `test` script** (Turbo skips it), devDep `typescript@6.0.3`. `tsconfig.json`: extends base; `"lib": ["ES2023"]`, `"types": []` for now. `src/index.ts`:

```ts
// Drizzle schema and migrations arrive with issue #15 (M0 auth + schema ticket).
export {};
```

### 6.4 `packages/ui` — `@miolos/ui`

Tokens and primitives only (ADR-0002: a primitive is a value or a pure value-returning function, **no JSX**). `tokens.css` stays at its existing path, **byte-identical** — verify with `git diff -- packages/ui/tokens.css` showing nothing.

`package.json`:

```json
{
  "name": "@miolos/ui",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts", "./tokens.css": "./tokens.css" },
  "scripts": { "typecheck": "tsc --noEmit", "test": "vitest run" },
  "devDependencies": { "typescript": "6.0.3", "vitest": "4.1.10" }
}
```

- `tsconfig.json`: extends base; `"lib": ["ES2023"]`, `"types": []`, no `jsx` option — JSX physically cannot compile here.
- `src/ad-slot-placements.ts` (the value half of the AdSlot seam; the component lives in apps/web):
  ```ts
  export const adSlotPlacements = {
    "hub-desktop": { minHeightPx: 60 },
    "hub-mobile": { minHeightPx: 64 },
  } as const;
  export type AdSlotPlacement = keyof typeof adSlotPlacements;
  ```
  60/64 are the DESIGN.md-measured reserved heights (desktop hub / mobile hub).
- `src/index.ts` re-exports.
- `test/ad-slot-placements.test.ts`: asserts the two placements exist with exactly 60 and 64 — a real regression guard on the "activation is a paint, not a reflow" invariant.

### 6.5 `apps/web` — `@miolos/web`

`package.json`: scripts `dev: "next dev"`, `build: "next build"`, `start: "next start"`, `typecheck: "tsc --noEmit"`, `test: "vitest run"`. deps: `next@16.2.12`, `react@19.2.8`, `react-dom@19.2.8`, `@miolos/ui: "workspace:*"`, `@miolos/core: "workspace:*"`. devDeps: `typescript@6.0.3`, `@types/node@26.1.2`, `@types/react@19.2.18`, `@types/react-dom@19.2.4`, `vitest@4.1.10`, `@vitejs/plugin-react@6.0.5`, `vite@8.2.0` (explicit — peer of @vitejs/plugin-react 6; avoids a legal-but-breaking transitive resolution), `jsdom@30.0.1`, `@testing-library/react@16.3.2`, `@testing-library/dom@10.4.1` (explicit — peer of @testing-library/react 16 and jest-dom 7, not auto-installed), `@testing-library/jest-dom@7.0.0`.

- `next.config.ts`: `transpilePackages: ['@miolos/ui', '@miolos/core']` (only those actually imported).
- `tsconfig.json`: extends base; adds `"lib": ["DOM", "DOM.Iterable", "ES2023"]`, `"jsx": "preserve"`, `"allowJs": true`, `"incremental": true`, `"types": ["node"]`, `"plugins": [{ "name": "next" }]`; `include: ["next-env.d.ts", "app", "src", "test", ".next/types/**/*.ts"]`.
- `.env.example`:
  ```
  NEXT_PUBLIC_SITE_URL=https://miolos.app
  NEXT_PUBLIC_API_URL=https://api.miolos.app
  ```
- `vitest.config.ts`: `@vitejs/plugin-react`, `test: { environment: 'jsdom', setupFiles: ['./test/setup.ts'] }` (setup imports `@testing-library/jest-dom/vitest`).
- `vercel.json`: `{ "ignoreCommand": "npx turbo-ignore" }` (skips deploys when the app's dependency graph is untouched).

**Fonts** (`app/layout.tsx`), via `next/font/google` — this wiring is load-bearing because `tokens.css` (untouchable) names families `'Fraunces'`/`'Instrument Sans'` while next/font emits hashed family names:

```ts
const fraunces = Fraunces({
  subsets: ["latin"], style: ["normal", "italic"], axes: ["opsz"],
  variable: "--font-fraunces", display: "swap",
});
const instrumentSans = Instrument_Sans({
  subsets: ["latin"], style: ["normal", "italic"],
  variable: "--font-instrument-sans", display: "swap",
});
```

Both are variable fonts: `wght` comes free; Fraunces gets `opsz` via `axes`, italic via `style` (`ital`). Apply `${fraunces.variable} ${instrumentSans.variable}` on `<html lang={locale}>` (`locale` from the i18n module). Then in `app/globals.css`, imported **after** `@miolos/ui/tokens.css` in `layout.tsx`:

```css
:root {
  --font-display: var(--font-fraunces), serif;
  --font-ui: var(--font-instrument-sans), sans-serif;
}
```

This is app-level wiring by cascade override — tokens.css itself is not edited. Because the composite `--text-*` shorthands reference `var(--font-display)`/`var(--font-ui)` lazily, they pick up the override.

`globals.css` also carries: `body { margin: 0; background: var(--paper-desk); background-image: var(--texture-dots); background-size: var(--texture-dots-size); color: var(--ink); font: var(--text-body); }`, the link rules from the frames (`a { color: var(--ink) } a:hover { color: var(--accent-app) }`), a mobile media query switching `background-size` to `24px 24px`, and a `font-variant-numeric: tabular-nums` utility class for numerals.

**Metadata** (`app/layout.tsx`): `metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000")` — the apex never appears as a literal in code (ADR-0013); `title` and `description` come from `messages.meta`.

**`src/i18n/messages.ts`** — exact string inventory (all UI copy; nothing hardcoded in components):

```ts
export const messages = {
  meta: {
    title: "Miolos — quatro jogos por dia",
    description:
      "Quatro jogos de raciocínio por dia — Termo, Sudoku, Nonogram e Binairo. Um puzzle novo de cada, todos os dias, igual para todo mundo.",
  },
  hoje: {
    wordmark: "Miolos",
    completedOfTotal: (done: number, total: number) => `${done} de ${total} concluídos`,
    streak: { label: "sequência" },
    games: {
      termo:    { kicker: "Palavras", name: "Termo",    description: "Seis tentativas para a palavra do dia." },
      sudoku:   { kicker: "Números",  name: "Sudoku",   description: "De 1 a 9, sem repetição, no clássico 9×9." },
      nonogram: { kicker: "Imagem",   name: "Nonogram", description: "Revele a figura escondida pelos números." },
      binairo:  { kicker: "Lógica",   name: "Binairo",  description: "Zeros e uns, em perfeito equilíbrio." },
    },
    playCta: "Jogar hoje",
    playCtaShort: "Jogar",
    links: { archive: "Arquivo", freePlay: "Modo livre", stats: "Estatísticas" },
  },
} as const;
export type Messages = typeof messages;
```

(Game descriptions are the frames' copy verbatim. `Feito` chip and result strings are **not** included — M0 renders no done states. The dormant promo strip renders no copy — the "do Miolos" strings arrive with activation.)

The i18n module also exports the locale tag itself — `export const locale = "pt-BR";` (in `src/i18n`, re-exported from `index.ts`) — used for `<html lang={locale}>` and as the `Intl.DateTimeFormat` locale argument, so locale tags are externalized alongside the strings, not hardcoded in components.

**`app/page.tsx` — placeholder Hoje page.** `export const dynamic = "force-dynamic"` (the date must be today's, not build-day's). A synchronous server component (so the smoke test can render it directly).

Placeholder-state decisions (M0 has no real data; **no fake data presented as real**):

- **Date**: real — `new Intl.DateTimeFormat(locale, { dateStyle: "full", timeZone: "America/Sao_Paulo" }).format(new Date())` (`locale` from the i18n module) → "sexta-feira, 31 de julho de 2026". Display-only; rollover/streak logic remains server-side future work. (Node 24 ships full ICU; verify output in the smoke run.)
- **Meta line**: `0 de 4 concluídos` via `completedOfTotal(0, 4)`. The frame's "Caderno nº 214" segment is **omitted** — no edition number exists yet; inventing one would be fake data.
- **Streak stamp**: numeral `0`, label **`sequência`** (CONTEXT.md term; F1's "dias seguidos" and F2's "dias" are overridden by the design-handoff amendment table — same label both breakpoints).
- **All four game cards pending** — solid-accent CTA (`Jogar hoje` desktop / `Jogar` mobile), no `Feito` chips, no results. The F1 done states are reference-only.
- **CTAs and secondary links** render as placeholder anchors **without `href`** (valid HTML placeholder links, non-navigating, honest about routes not existing); target slugs already live in `routeSlugs` for the tickets that create them.
- **Promo strip**: **dormant** — `<AdSlot placement>` rendering an empty, transparent, `aria-hidden` div with inline `minHeight` from `adSlotPlacements`; desktop variant 60px above a `border-top: 1px solid var(--line)` hairline zone, mobile variant 64px. **Do not** render F1's filled sample copy and **do not** render F2's dashed border/annotation (both are spec annotations, not design).

Structure and styling (one DOM, restructured by CSS in `page.module.css`; token variables everywhere, no raw hex):

- Header row: masthead (wordmark — Fraunces italic 600, 42px desktop / 28px mobile, `rotate(-1deg)`; date — Fraunces 450, 28px / 19px with the mobile line break after the weekday comma; meta line — 13px/12px `var(--ink-2)`, `tabular-nums`) + streak stamp (paper-desk bg per the frames — the bundle-README `#FBF7EF` discrepancy is resolved in favor of the frames; `1.5px solid var(--accent-app)` border, `var(--shadow-md) rgba(158,59,47,0.25)` desktop / `--shadow-sm` mobile, `rotate(2deg)`, Fraunces 600 tabular numeral 44px/30px, uppercase label 11px/10px letter-spaced).
- Games: desktop `grid-template-columns: repeat(4, 1fr); gap: 28px` of vertical cards (paper-card bg, `1px solid var(--line)`, hard shadow `5px 5px 0 rgba(accent, 0.22)`, `padding: 44px 24px 24px`, `min-height: 250px`, rotations `-0.6deg / 0.5deg / -0.4deg / 0.6deg`, washi tape 78×26 centered at `top:-12px` in `rgba(accent, 0.32)` with tape rotations `-4/3/-3/4deg`, kicker + Fraunces 550 30px name + description with `text-wrap: pretty`); mobile (≤768px) flex-column rows per F2 (horizontal, `padding: 16px 18px`, tape 54×18 at `left:26px; top:-9px`, description hidden, name 22px, shadow `4px 4px 0`). Per-game accent delivered via a CSS custom property set inline per card (`style={{ "--accent": "var(--accent-termo)" }}` etc.) so the module CSS stays generic. Desktop/mobile CTA label variants are two spans toggled by the same media query.
- Secondary links: centered Fraunces 550, 19px gap 56px desktop / 15px gap 28px mobile, `border-bottom: 2px solid var(--line)`.
- Motion note: the rotations are **static transforms**, not animation — no `prefers-reduced-motion` work is required; the only transition (link hover color) is trivially safe. State this in the PR rather than adding dead media queries.
- Accessibility floor (PRODUCT.md): touch targets ≥ `var(--touch-target-min)` on the mobile `Jogar` buttons; contrast is inherited from the token palette; the streak numeral gets an `aria-label` combining number + label.

**`src/components/ad-slot.tsx`**: the `<AdSlot placement="…" />` **component** (JSX ⇒ lives in apps/web, never in ui). Props `{ placement: AdSlotPlacement; className?: string }`; renders `<div aria-hidden className={className} data-ad-placement={placement} style={{ minHeight: adSlotPlacements[placement].minHeightPx }} />`. Page renders both hub variants, visibility toggled by the CSS breakpoint.

**`test/hoje.smoke.test.tsx`** (spec seam 5 — one smoke test per screen): render `<HojePage />` with testing-library; assert the wordmark, all four game names and kickers, the streak label `sequência`, `0 de 4 concluídos`, and the pending CTA text render **from the messages module** (import `messages` and assert against it, not against string literals); assert both `data-ad-placement` divs exist with the correct inline min-heights; assert the string `dias seguidos` appears nowhere.

### 6.6 `apps/api` — `@miolos/api`

`package.json`: scripts `dev: "next dev --port 3001"`, `build: "next build"`, `start: "next start --port 3001"`, `typecheck: "tsc --noEmit"`, `test: "vitest run"`. deps: `next@16.2.12`, `react@19.2.8`, `react-dom@19.2.8` (Next peers), `@miolos/core: "workspace:*"`. devDeps: `typescript@6.0.3`, `@types/node@26.1.2`, `@types/react@19.2.18`, `vitest@4.1.10`.

- `next.config.ts`: `transpilePackages: ['@miolos/core']`.
- `tsconfig.json`: same shape as web's.
- `.env.example`: `WEB_ORIGIN=https://miolos.app`.
- `vercel.json`: `{ "ignoreCommand": "npx turbo-ignore" }`.
- `src/cors.ts`: per D6.
- `app/health/route.ts`: per D5 — builds a typed `HealthResponse`, `healthResponseSchema.parse(...)`, `Response.json(body, { headers: corsHeaders() })`, `dynamic = 'force-dynamic'`.
- `app/route.ts`: root `GET` returning `Response.json({ service: "api" })` — gives the app a root response without any page/layout (an app with only route handlers needs no root layout; if `next build` unexpectedly demands one, add a minimal `app/layout.tsx` passing children through and note it in the PR).
- `test/health.test.ts`: import `GET` from the route file, invoke it, `await res.json()`, parse with `healthResponseSchema` — asserting status 200, schema validity, and CORS in **both** env states: with `WEB_ORIGIN` set (via `vi.stubEnv`) the `Access-Control-Allow-Origin` header equals it; with `WEB_ORIGIN` unset the header is absent from the response entirely (per D6 — never present with an empty value).
- `vitest.config.ts`: default node environment.

---

## 7. Vercel deployment (config committed now; provisioning is Fernando's)

Committed in this PR: the two `vercel.json` files above, `.env.example` files, and `packageManager` (Vercel reads it for pnpm). **Do not run any `vercel` command** — the CLI is not installed and deployment is not this machine's job.

**Operator checklist for Fernando (goes verbatim in the PR description):**

1. In Vercel, create project **miolos-web**: import `fernandolisboa/miolos`, Root Directory `apps/web`, Framework Next.js. Set Node.js version to 24.x. Env vars (Production+Preview): `NEXT_PUBLIC_SITE_URL=https://miolos.app`, `NEXT_PUBLIC_API_URL=https://api.miolos.app`.
2. Create project **miolos-api**: same repo, Root Directory `apps/api`, Framework Next.js, Node 24.x. Env var: `WEB_ORIGIN=https://miolos.app`.
3. Domains (already registered in Vercel per ADR-0013): attach `miolos.app` (apex) to miolos-web; attach `api.miolos.app` to miolos-api.
4. If GitHub Actions is disabled for the private repo, enable it; optionally add branch protection requiring the `gate` check on `main`.
5. After deploy, confirm `https://miolos.app` renders the Hoje placeholder and `curl https://api.miolos.app/health` returns the JSON payload — then tick the deployment acceptance box on #14.

The PR must **not** claim the live domains work — only that local equivalents do, with evidence.

---

## 8. CI workflow — `.github/workflows/ci.yml`

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]
jobs:
  gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: pnpm/action-setup@v6   # version comes from packageManager
      - uses: actions/setup-node@v7
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm build
```

Before committing, verify current action majors (`gh api repos/actions/checkout/releases/latest --jq .tag_name`, same for `actions/setup-node`, `pnpm/action-setup`) and use the latest majors. No Turbo remote cache (D8). `impeccable detect` deferred from CI per D8 — file a follow-up issue (`ci: run impeccable detect against a preview deployment`) and link it in the PR.

---

## 9. Build order (each step ends green before the next starts)

0. **Node upgrade.** Local Node v24.14.1 is below jsdom@30.0.1's engines range (`^22.22.2 || ^24.15.0 || >=26.0.0`). Upgrade to the latest 24.x LTS: `nvm install 24` (expect ≥24.18). — *Verify:* `node --version` prints ≥ 24.15 **before any install or test runs**.
1. **Branch + docs.** `git checkout -b feat/14-monorepo-foundation`. Add `docs/plans/007-issue-14-plan-monorepo-foundation.md` (this document) and ADRs 0016–0018. — *Verify:* files exist; ADR numbering continues 0015.
2. **Root scaffold.** Root `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `turbo.json`, `eslint.config.mjs`, `.prettierrc.json`, `.prettierignore`, `.nvmrc`, `.gitignore` additions. `pnpm install` (approve builds if prompted, commit config). — *Verify:* `pnpm --version` → `11.18.0`; `pnpm lint` runs clean on the empty tree (this is the ESLint 10 + eslint-config-next smoke test); `pnpm-lock.yaml` exists.
3. **packages/games** per §6.1. — *Verify:* `pnpm --filter @miolos/games run typecheck && pnpm --filter @miolos/games run test` (purity + property tests green). Negative check: temporarily add `import { readFileSync } from "node:fs"` to `src/random.ts`, confirm typecheck **and** the purity test **and** lint all fail, revert. Paste this negative evidence in the PR — it proves the check is mechanical.
4. **packages/core** per §6.2. — *Verify:* `pnpm --filter @miolos/core run typecheck && pnpm --filter @miolos/core run test`.
5. **packages/ui + packages/db** per §6.3/§6.4. — *Verify:* `pnpm --filter @miolos/ui run typecheck && pnpm --filter @miolos/ui run test`; `pnpm --filter @miolos/db run typecheck`; `git diff --stat -- packages/ui/tokens.css` → empty.
6. **apps/api** per §6.6. — *Verify:* `pnpm --filter @miolos/api run typecheck && pnpm --filter @miolos/api run test`; `pnpm --filter @miolos/api dev` then `curl -s localhost:3001/health` → the JSON payload (paste output); `pnpm --filter @miolos/api build`.
7. **apps/web** per §6.5 — i18n module first, then AdSlot, then layout/fonts/globals, then the page + module CSS, then the smoke test. — *Verify:* `pnpm --filter @miolos/web run typecheck && pnpm --filter @miolos/web run test && pnpm --filter @miolos/web run build`.
8. **Visual verification.** `pnpm --filter @miolos/web dev`; with Playwright MCP: navigate `http://localhost:3000`, resize 1440×900 → screenshot; resize 390×844 → screenshot; compare against F1/F2 (adjusted for the placeholder-state decisions in §6.5). Then run `npx impeccable detect` against the running app and capture output (D8 fallback applies). — *Evidence:* both screenshots + command output into the PR.
9. **Root gates + pre-commit.** Wire `.husky/pre-commit` (setup-pre-commit skill; end state §5.8). — *Verify:* `pnpm typecheck && pnpm lint && pnpm test && pnpm build` all green at root (paste full output); make a trivial commit and show the hook running.
10. **CI.** Add `.github/workflows/ci.yml` (§8). Push over **SSH**. — *Verify:* after opening the PR, `gh pr checks` shows the `gate` run; paste its conclusion. If Actions is disabled, report it and move it to the operator checklist.
11. **PR.** File the follow-up issue `ci: run impeccable detect against a preview deployment` (the D8 deviation) with `gh issue create`, then open the PR per §10 and link that issue in the PR body alongside the deviation note.

---

## 10. Commits and PR

Conventional Commits, one branch `feat/14-monorepo-foundation`, suggested sequence (mirrors the build order; adjust only if a step forces it):

1. `docs: add plan and ADRs 0016-0018 for the monorepo foundation`
2. `chore: scaffold pnpm and turborepo monorepo with typescript, eslint and prettier`
3. `feat: add @miolos/games with seeded PRNG and mechanical purity check`
4. `feat: add @miolos/core with entitlements, feature-flag and health-contract seams`
5. `feat: add @miolos/ui package wiring and ad-slot placement primitives; add @miolos/db placeholder`
6. `feat: add @miolos/api with env-configured health check`
7. `feat: add @miolos/web with the placeholder Hoje page`
8. `chore: add husky pre-commit with lint-staged, typecheck and tests`
9. `ci: add GitHub Actions gate workflow`

**PR into `main`**, title `feat: M0 monorepo foundation — scaffold, gates, deployed shell (#14)`, body containing:

- What changed (workspace map + decisions D1–D10 summarized, linking ADRs 0016–0018).
- **Mechanical gate evidence**: full pasted output of `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, the purity-check negative test, the pre-commit hook run, `curl localhost:3001/health`, both screenshots, the `impeccable detect` output (or the honest report that it could not run), and the CI check result.
- **"Decisions Fernando needs to make / actions only Fernando can take"**: the §7 operator checklist verbatim, plus: confirm the TS-6 pin ADR; note that the deployed-domain acceptance box stays unchecked until he acts; and one line surfacing the streak-stamp background discrepancy — the design-bundle README says `#FBF7EF` while both reference frames render `#F7F2E9`; this plan follows the frames, flagged here so the resolution is surfaced, not silent.
- The D8 deviation note (`impeccable detect` deferred from CI) with a link to the filed follow-up issue `ci: run impeccable detect against a preview deployment`.
- Explicit statement: *live `miolos.app` / `api.miolos.app` are not claimed; verified locally only.*
- `Closes #14`.

---

## 11. Exit criteria — mapped to #14's acceptance boxes

| Acceptance criterion | Status after this plan | Verified by |
|---|---|---|
| `pnpm typecheck`/`lint`/`test` green at root, running in CI on every PR, output in PR | **Agent-verifiable** (CI observation requires Actions enabled — else operator) | Step 9–10 outputs, `gh pr checks` |
| Pre-commit (Husky + lint-staged + typecheck + tests) installed and green | **Agent-verifiable** | Step 9 hook-run evidence |
| `miolos.app` placeholder + `api.miolos.app` health check | **Blocked on Fernando** (Vercel projects, domains, env). PR shows local equivalents + operator checklist; issue box ticked only after his confirmation | Steps 6, 8; §7 checklist |
| Six workspaces exist and typecheck; games purity mechanically enforced | **Agent-verifiable** | Steps 3–7; negative test in step 3 |
| `packages/ui` tokens + primitives only, no cross-platform abstraction | **Agent-verifiable** (no-JSX tsconfig + review; tokens byte-identical diff) | Step 5 |
| First screen's pt-BR strings externalized, no hardcoded copy | **Agent-verifiable** | Smoke test asserts render-from-messages; code review |
| Dependencies at current latest stable, looked up; lockfile committed | **Agent-verifiable** (TypeScript exception governed by ADR-0016) | §2 table re-verified at install; `pnpm-lock.yaml` |

The PR communicates the split with an explicit two-list section: "Verified now (evidence above)" vs "Awaiting Fernando (checklist)".

---

## 12. Landmines — the implementer must NOT

- **No Tailwind, no CSS-in-JS, no preprocessor** — plain CSS/CSS Modules consuming the tokens.
- **No Expo / React Native / react-native-web anywhere** (ADR-0001/0002 killed them).
- **`packages/ui`: no JSX, no components, no cross-platform abstraction.** The `AdSlot` *component* lives in `apps/web`; only placement *values* live in ui.
- **`packages/ui/tokens.css` is adopted byte-identical** — no reformatting (it's in `.prettierignore`), no value changes, no added dark block. Font-family overrides happen in `apps/web/app/globals.css`, never in the token sheet.
- **No dark palette invention** — dark mode is #36 (M4); no `prefers-color-scheme` handling in M0.
- **No hardcoded `miolos.app` apex in code** — env config only (`.env.example`, Vercel dashboard); metadata uses `metadataBase` from env.
- **No fake data presented as real**: no done states, no fabricated streak, no "Caderno nº". Streak shows `0`; all four games pending.
- **Streak label is `sequência`** — never F1's "dias seguidos" or F2's "dias" (CONTEXT.md + amendment table). Never "Wordle" — the game is Termo.
- **Do not ship or adapt the `.dc.html` frames** — they are visual specs; production markup is written fresh.
- **Never `--no-verify`**; never weaken a gate that exists.
- **Do not run `vercel` commands or claim live-domain results.**
- **Push over SSH** — the gh token lacks the `workflow` scope for HTTPS pushes carrying workflow files.
- No PWA manifest, no service worker, no DB connection, no PostHog, no ads SDK — all later milestones.
- Anti-references from the brief are hard law: no gradients, glassmorphism, card-in-card, diffuse shadows everywhere, Inter/DM Sans/Poppins/Montserrat/Roboto.

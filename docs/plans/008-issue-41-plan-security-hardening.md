# Plan — Issue #41: security: harden CI and headers before auth ships

> Step-2 plan for the eight-step flow. The implement step (step 5) commits this document into the
> repo as `docs/plans/008-issue-41-plan-security-hardening.md` (next number after 007) before or
> alongside the code changes. Source inputs: issue #41, exploration brief
> `scratchpad/streams/issue-41/01-explore.md` (SHA resolutions verified there via `gh api`).

## 1. Scope

Exactly the issue's three items:

1. **SHA-pin the three GitHub Actions** in `.github/workflows/ci.yml` (tag kept in a trailing comment).
2. **Security headers** in both `apps/web/next.config.ts` and `apps/api/next.config.ts` via `headers()`:
   `X-Content-Type-Options: nosniff` and `Content-Security-Policy: frame-ancestors 'none'`, on all routes.
3. **Audit note (no code)** — item 3 lands only as PR-description text: re-run `pnpm audit --prod`
   on the next `next` bump; the 3 high + 1 moderate advisories are transitive via `next@16.2.12`'s
   hard pins (postcss 8.4.31, sharp ^0.34.5), postcss is build-time-only here, sharp backs the
   unused `next/image`. `next` is already at latest.

**Out of scope — do not touch:**
- A full CSP (`default-src`, `script-src`, nonces). A `frame-ancestors`-only CSP restricts nothing
  else (absent directives are unrestricted; `frame-ancestors` does not fall back to `default-src`),
  so this scope is safe by construction. Full CSP is a future issue, not this PR.
- `apps/api/src/cors.ts` and the route handlers — header names are disjoint from
  `Access-Control-Allow-Origin`; no interaction, no change.
- Any dependency bump (item 3 is explicitly note-only; `next@16.2.12` is latest).
- HSTS (platform-level on Vercel/`.app` already), `Referrer-Policy`, `Permissions-Policy`, or any
  header the issue does not name.
- `vercel.json` (both contain only `ignoreCommand`; no header collision exists).

## 2. Exact edits

### 2.1 `.github/workflows/ci.yml` — lines 12–14 only

Replace the three `uses:` lines with (SHAs verified in the exploration brief; **the pnpm one is the
dereferenced commit behind the annotated tag, NOT the tag-object SHA `b0f76dfb…`**):

```yaml
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7
      - uses: pnpm/action-setup@0ebf47130e4866e96fce0953f49152a61190b271 # v6 — version comes from packageManager
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7
```

Everything else in the file (permissions, triggers, `with:` block, run steps) stays byte-identical.
Line 13's existing comment is merged into the pin comment as shown.

### 2.2 `apps/web/next.config.ts` — full intended file content

```ts
import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
];

const nextConfig: NextConfig = {
  transpilePackages: ["@miolos/ui", "@miolos/core"],
  poweredByHeader: false,
  headers: async () => [
    {
      source: "/(.*)",
      headers: securityHeaders,
    },
  ],
};

export default nextConfig;
```

### 2.3 `apps/api/next.config.ts` — full intended file content

Identical shape, keeping the api's own `transpilePackages`:

```ts
import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
];

const nextConfig: NextConfig = {
  transpilePackages: ["@miolos/core"],
  poweredByHeader: false,
  headers: async () => [
    {
      source: "/(.*)",
      headers: securityHeaders,
    },
  ],
};

export default nextConfig;
```

**Why `frame-ancestors 'none'` (not `'self'`) for both apps:**
- **web** — Miolos has no embedding use case anywhere in the handoff or ADRs (no widgets, no
  iframe distribution), and the app never frames itself. `'none'` is the strict clickjacking
  posture and matches "before auth ships": a framed login/session surface is exactly the attack
  this blocks.
- **api** — a JSON API is never legitimately rendered in a frame at all; `'self'` would grant a
  pointless allowance. `'none'` for both keeps the two configs symmetric and least-privileged.

**Why `source: "/(.*)"`:** covers `/`, `/health`, future routes, and Next-generated responses.
It also stamps `/_next/static` assets — harmless and actually desirable for nosniff (Next sets
correct Content-Types). Note: do NOT define `securityHeaders` in a shared package — `packages/ui`
holds tokens/primitives only and `packages/core` is the Zod-contract seam; a 4-line duplicated
constant in two config files is the right cost.

No other file in the repo changes (besides the two new test files below and the committed plan doc).

## 3. Test plan

Existing convention (see `apps/api/test/health.test.ts`): Vitest, `describe`/`it`, direct import of
the unit under test, header assertions via `.get(...)`/`toBe(...)`. Mirror it. Note that route
tests calling `GET()` directly never see next.config `headers()` — that is why the configs get
their own unit tests.

### 3.1 New: `apps/api/test/next-config.test.ts`

```ts
import { describe, expect, it } from "vitest";

import nextConfig from "../next.config";

describe("next.config security headers", () => {
  it("applies nosniff and frame-ancestors 'none' to all routes", async () => {
    const rules = await nextConfig.headers!();
    expect(rules).toHaveLength(1);
    expect(rules[0]!.source).toBe("/(.*)");
    expect(rules[0]!.headers).toContainEqual({
      key: "X-Content-Type-Options",
      value: "nosniff",
    });
    expect(rules[0]!.headers).toContainEqual({
      key: "Content-Security-Policy",
      value: "frame-ancestors 'none'",
    });
  });
});
```

### 3.2 New: `apps/web/test/next-config.test.ts`

Same file body (import path `../next.config` works from `apps/web/test/` too). It runs under the
web app's jsdom Vitest config — fine, no DOM is touched.

Assertion set is deliberately minimal: the two mandated headers + the catch-all source. Do NOT
assert `poweredByHeader`/`transpilePackages` (over-testing config that typecheck already guards).
The non-null assertions compile and lint as written: `tsconfig.base.json` sets
`noUncheckedIndexedAccess: true` (making `rules[0]!` both necessary and legal), and
`eslint.config.mjs` extends `recommendedTypeChecked`, which does not include
`no-non-null-assertion` (that rule is in the `strict` presets). No fallback needed.

### 3.3 How the pins are proven

Nothing local can validate an action pin. **The proof is the PR's own CI run**: the `gate` workflow
on the PR executes the pinned SHAs; a green run is the evidence that all three resolve and behave
as their tags did. Paste the run URL + conclusion (`gh run view <id>`) into the PR. A wrong SHA
fails at workflow set-up within seconds — blast radius is the PR only.

### 3.4 Runtime header proof (local, pre-merge)

From repo root, in two shells (or backgrounded):

```sh
pnpm --filter web dev        # port 3000
pnpm --filter api dev        # port 3001
curl -sI http://localhost:3000 | grep -iE "x-content-type-options|content-security-policy"
curl -sI http://localhost:3001/health | grep -iE "x-content-type-options|content-security-policy"
```

Expected on both: `x-content-type-options: nosniff` and
`content-security-policy: frame-ancestors 'none'`. Paste raw output in the PR (evidence rule).

## 4. Verification commands and expected outcomes

Run from `/home/ferna/projects/miolos`, all output pasted in the PR:

| Command | Expected |
|---|---|
| `pnpm typecheck` | Green — both configs stay valid `NextConfig`; new tests strict-clean |
| `pnpm lint` | Green — no new lint surface (config + test files) |
| `pnpm test` | Green — existing suites + 2 new next-config tests pass |
| `pnpm build` | Green — proves both configs parse and `headers()` compiles into the build |
| Local curls (§3.4) | Both headers present on web `/` and api `/health` |
| PR CI run | Green on the pinned SHAs (this IS the pin verification) |
| Pre-commit hook | Fires normally; never `--no-verify` |

`npx impeccable detect` is not required (no UI change). No Zod boundary is crossed.

**Known-benign noise in evidence output:** the local Node (24.14.1) is below the `engines` floor
(`>=24.15`), so pnpm prints an `Unsupported engine` warning in every command's output. Not
engine-strict — commands run fine; CI uses `.nvmrc` and is unaffected. Leave the warning in the
pasted evidence (the evidence rule wants raw output) rather than trimming it.

**Post-merge (after Vercel auto-deploy on main settles):**

```sh
curl -sI https://miolos.app | grep -iE "x-content-type-options|content-security-policy"
curl -sI https://api.miolos.app/health | grep -iE "x-content-type-options|content-security-policy"
```

Expected: both headers on both domains (baseline curls from 2026-07-31 show neither exists today,
and no platform layer duplicates them). Paste as a follow-up PR comment.

## 5. Branch / commits / PR

- **Branch:** `fix/41-harden-ci-and-headers` off `main`.
- **Commits** (Conventional Commits, English; one commit is acceptable, two keeps the diff legible):
  1. `ci: pin GitHub Actions to commit SHAs (#41)` — body: names the three actions, notes the
     annotated-tag dereference for pnpm/action-setup.
  2. `fix: send nosniff and frame-ancestors headers from both apps (#41)` — body: why
     `frame-ancestors`-only CSP, why `'none'`; includes the two tests and the committed plan doc
     `docs/plans/008-issue-41-plan-security-hardening.md`.
- **PR title:** `fix: harden CI and security headers before auth ships (#41)` → closes #41.
  Main is squash-merged, so the PR title becomes the commit message on `main` and MUST use one of
  CLAUDE.md's Conventional Commit types (`security:` is not one). The issue title stays as-is.
- **PR body skeleton:**

```markdown
Closes #41. Step 6 security-review follow-up from #14/#40; lands before #15 ships sessions.

## What changed
- ci.yml: actions/checkout, pnpm/action-setup, actions/setup-node pinned to commit SHAs (tags in comments; pnpm pin is the dereferenced commit behind the annotated v6 tag)
- apps/web + apps/api next.config.ts: `headers()` sending `X-Content-Type-Options: nosniff` and `Content-Security-Policy: frame-ancestors 'none'` on all routes
- Unit tests asserting each config's headers() output
- Plan committed as docs/plans/008-issue-41-plan-security-hardening.md

## Audit note (issue item 3 — no code change)
`pnpm audit --prod` as of 2026-07-31: 3 high + 1 moderate, all transitive via next@16.2.12
(postcss 8.4.31 — GHSA-6g55-p6wh-862q, GHSA-r28c-9q8g-f849, GHSA-qx2v-qp2m-jg93; sharp ^0.34.5 —
GHSA-f88m-g3jw-g9cj). next is at latest; postcss is build-time on our own CSS; sharp backs
next/image, which is unused. Action: re-run the audit on the next `next` bump and clear.

## Follow-up (not this PR)
Action pins are now manual — no dependabot/renovate config exists, so the three pinned SHAs never
update on their own. Consider adding a dependabot `github-actions` ecosystem config as a follow-up
issue so the pins keep moving with upstream releases.

## Evidence
### pnpm typecheck
<output>
### pnpm lint
<output>
### pnpm test
<output>
### pnpm build
<output>
### Local runtime headers (curl -sI, both apps)
<output>
### CI on pinned SHAs
<run URL + conclusion>

## Decisions needed from Fernando
None — scope is exactly issue #41; `frame-ancestors 'none'` chosen over `'self'` (no embedding
use case exists; api responses are never framed).
```

- Merge only with every gate green and step 6/7 of the flow satisfied. Post-merge: run the two prod
  curls (§4) and comment the output on the PR.

## 6. Risks and rollback

| Risk | Detection | Rollback / mitigation |
|---|---|---|
| Wrong SHA (esp. pinning pnpm's tag-object `b0f76dfb…` instead of commit `0ebf4713…`) | PR's own CI fails at workflow resolution, pre-merge | Fix the SHA on the branch; main never sees it. The plan hardcodes the correct commit SHA |
| Pinned action behaves differently from tag | Same CI run executes the full gate (install→build) | Re-verify SHA↔tag with `gh api repos/<owner>/<repo>/git/ref/tags/<tag>` |
| API CORS preflight/header regression | health.test.ts CORS tests in `pnpm test`; local curl on `/health` shows ACAO still present alongside new headers | None expected — header names disjoint, cors.ts untouched; if curl shows loss, revert config hunk |
| `frame-ancestors 'none'` blocks a legitimate embed | Product review: no embedding use case exists in handoff/ADRs | Single-line value change to `'self'` in a follow-up if one ever appears |
| `source: "/(.*)"` stamping static assets | Visual smoke on localhost + prod curls | Harmless by design (correct Content-Types); no action |
| Header change breaks build | `pnpm build` locally and in CI, pre-merge | Fix config syntax; shape is documented verbatim in §2 |
| Prod headers missing after merge (platform stripping) | Post-merge curls in §4 | Investigate Vercel config; baseline showed no conflicting layer, so unexpected |

## Step-4 changelog

Dispositions for the step-3 review (`03-plan-review.md`, verdict REJECTED):

1. **BLOCKING — PR title used non-conventional `security:` type.** APPLIED. §5 PR title changed to
   `fix: harden CI and security headers before auth ships (#41)`, with a note explaining that the
   squash-merge makes the PR title the `main` commit message. Issue title untouched.
2. **ADVISORY — branch commit 1 should be `ci:`, not `fix:`.** APPLIED. §5 commit 1 retyped to
   `ci: pin GitHub Actions to commit SHAs (#41)`.
3. **ADVISORY — pinned SHAs have no refresh mechanism.** APPLIED. Added a "Follow-up (not this PR)"
   section to the §5 PR body skeleton naming dependabot's `github-actions` ecosystem as the
   follow-up, so the manual-pin cost is recorded rather than silently lost.
4. **ADVISORY — §3.2 contingency misdirected.** APPLIED. Replaced the "if Vitest rejects the
   non-null assertions" fallback with the verified reality: `noUncheckedIndexedAccess: true` makes
   `rules[0]!` necessary and legal, and `recommendedTypeChecked` does not include
   `no-non-null-assertion`. No fallback needed.
5. **ADVISORY — local Node 24.14.1 is below the `>=24.15` engines floor.** APPLIED. §4 now warns
   that pnpm's `Unsupported engine` warning will appear in pasted evidence output, is benign
   (non-strict; CI uses `.nvmrc`), and should be left in per the evidence rule.

Editorial: removed a stray trailing ``` code fence at end-of-file (leftover artifact; it would have
broken rendering of this appended section). No content change.

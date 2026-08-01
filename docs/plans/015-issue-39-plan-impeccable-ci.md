# Issue #39 — Implementation plan (step 2 of 8)

`ci: run impeccable detect against a preview deployment` · branch `ci/39-impeccable-preview` · plan written 2026-07-31/08-01. Grounded in the step-1 brief (`01-explore.md`); every version/SHA below re-verified live during planning.

## 0. Pre-flight (landmine from the brief, §0)

Local `main` (204b607) is six PRs behind remote. **First action of the implement step:**

```
git fetch origin && git checkout main && git reset --hard origin/main
git checkout -b ci/39-impeccable-preview
```

Never branch from the stale local main.

**Standing rule for every local shell:** agent shells reset between calls, so prefix every node/pnpm/vercel command with `source ~/.nvm/nvm.sh && nvm use default` (→ node 24.18.1; jsdom needs ≥24.15 — `NEXT-SESSION.md` line 9).

## 1. Design decision (settled): option B — separate `deployment_status` workflow

New workflow `.github/workflows/impeccable.yml`, triggered by `on: deployment_status`, filtered to successful `Preview – miolos-web` deployments. Justification (brief §5–6):

- **Event-driven, zero polling/timeouts** — the Vercel GitHub app posts the deployment status with `target_url` (payload shape verified live against this repo, brief §3); option A's poll loop is exactly the flakiness the ticket fears and races turbo-ignore.
- **Path-conditionality for free and dependency-aware** — both `vercel.json` files run `npx turbo-ignore`, so a PR that doesn't affect `apps/web` (through the whole workspace graph, incl. `packages/ui`) produces no web preview → no event → no run. A hand-rolled `paths:` filter would approximate turbo's graph badly and `deployment_status` doesn't support `paths:` anyway.
- **No new third-party actions for URL discovery, no `VERCEL_TOKEN` in CI** — the URL rides the event. Only one secret is needed (protection bypass, §3).
- Option C (`repository_dispatch`) needs extra Vercel-side settings and only ever runs default-branch workflow files; no gain over B today.

The existing `gate` job in `ci.yml` is **not touched** (CLAUDE.md: never weaken an existing gate; this issue only adds).

## 2. The workflow file (exact content)

`.github/workflows/impeccable.yml` — SHA pins: checkout/pnpm/setup-node copied from remote ci.yml (pin convention from #41/#42); `actions/cache` is the only new action, resolved during planning: latest release **v6.1.0** → commit `55cc8345863c7cc4c66a329aec7e433d2d1c52a9` (via `gh api repos/actions/cache/releases/latest` + tag deref). Re-verify all four at implement time.

```yaml
name: Impeccable

permissions:
  contents: read

on:
  deployment_status:

jobs:
  detect:
    # Only successful web previews. Environment string uses an EN DASH (U+2013),
    # exactly as vercel[bot] creates it: "Preview – miolos-web". Production
    # deployments ("Production – …") and the api project are filtered out here.
    if: >-
      github.event.deployment_status.state == 'success' &&
      github.event.deployment.environment == 'Preview – miolos-web'
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7
        # For deployment_status, GITHUB_SHA is the deployed commit (GitHub docs),
        # so the default checkout gives us the PR's own .impeccable/config.json.
      - uses: pnpm/action-setup@0ebf47130e4866e96fce0953f49152a61190b271 # v6 — version comes from packageManager
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - uses: actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6
        with:
          path: ~/.cache/puppeteer
          key: puppeteer-chrome-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}
      - run: pnpm exec puppeteer browsers install chrome
      - name: impeccable detect — desktop 1440x900
        env:
          DEPLOYMENT_URL: ${{ github.event.deployment_status.target_url }}
          BYPASS: ${{ secrets.VERCEL_AUTOMATION_BYPASS_SECRET }}
        run: >-
          pnpm exec impeccable detect
          "$DEPLOYMENT_URL/?x-vercel-protection-bypass=$BYPASS&x-vercel-set-bypass-cookie=true"
          --viewport 1440x900
      - name: impeccable detect — mobile 390x844
        env:
          DEPLOYMENT_URL: ${{ github.event.deployment_status.target_url }}
          BYPASS: ${{ secrets.VERCEL_AUTOMATION_BYPASS_SECRET }}
        run: >-
          pnpm exec impeccable detect
          "$DEPLOYMENT_URL/?x-vercel-protection-bypass=$BYPASS&x-vercel-set-bypass-cookie=true"
          --viewport 390x844
```

Notes:
- Two invocations because `--viewport` takes one value (brief §4, real `--help` output). Both run even conceptually independent; if desktop fails the job fails there — acceptable, findings repeat across viewports rarely enough.
- `--json`/`--quiet` deliberately not used: the human-readable finding list is the PR evidence.
- Failure semantics come from impeccable itself: real anti-patterns → non-zero exit → red job; advisory findings never change the exit code (verified in brief §4). No extra scripting.

## 3. Protection bypass secret — flow and exact commands

Preview URLs 302 to Vercel SSO (verified live, brief §3). Chosen mechanism: **Protection Bypass for Automation** (docs-canonical; do NOT disable Vercel Authentication — that weakens posture and needs no weakening).

**Transport into impeccable:** impeccable accepts a URL, not headers, so the secret rides query params on the initial URL: `?x-vercel-protection-bypass=<secret>&x-vercel-set-bypass-cookie=true`. Vercel then sets `__vercel_protection_bypass` as a cookie via redirect, so subsequent same-origin requests (assets, RSC fetches) are also bypassed. This is the documented automation pattern (`vercel.com/docs/deployment-protection/automated-agent-access`); feasibility for impeccable's puppeteer specifically must be **proved live** at implement step (see §7, step 2) — fallback if the redirect breaks the scan: surface to Fernando the option of disabling Vercel Authentication for previews (decision, not to be made silently).

**Agent-operable setup (no Fernando action targeted):**

```bash
# 1. Vercel token from the authed CLI store (path varies by CLI version — try both):
TOKEN=$(jq -r '.token' ~/.local/share/com.vercel.cli/auth.json 2>/dev/null || jq -r '.token' ~/.vercel/auth.json)

# 2. Discover the scope slug (deployment URLs say feuxs-projects; confirm, don't assume):
vercel teams ls   # or: vercel project ls

# 3. Generate the project-level bypass secret (endpoint verified via Vercel REST docs:
#    PATCH /v1/projects/{idOrName}/protection-bypass, body {"generate":{...}}):
curl -s -X PATCH "https://api.vercel.com/v1/projects/miolos-web/protection-bypass?slug=<scope-slug>" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"generate":{"note":"CI impeccable detect (issue #39)"}}' > /tmp/bypass.json
# The secret is the key of the new entry in .protectionBypass with scope "automation".
# Inspect the real response shape before extracting — do not print it to the transcript raw;
# extract with jq into a variable.

# 4. Prove the bypass works before wiring CI (evidence rule):
curl -s -o /dev/null -w '%{http_code}\n' \
  "https://<latest-web-preview>/?x-vercel-protection-bypass=$SECRET&x-vercel-set-bypass-cookie=true"
# expect 200 (the naked URL gives 302 — show both)

# 5. Store as the repo Actions secret:
gh secret set VERCEL_AUTOMATION_BYPASS_SECRET --repo fernandolisboa/miolos --body "$SECRET"
```

**Leak hygiene:** in CI the value comes from `secrets.` context → auto-masked in logs even inside the URL. Locally: never echo it; keep it out of committed files and the PR body; the curl evidence pastes the HTTP code, not the URL.

## 4. Advisory vs required (settled): failing job, non-required check

- The **job itself is a hard gate**: real findings exit non-zero and the check goes red. This satisfies the issue's "so real regressions still fail the job".
- It is **not a GitHub-enforced required status check**, because `main` has no branch protection or rulesets at all (verified 404/[] in brief §1). Merge discipline in this repo is agent-owned (a red check blocks merge per CLAUDE.md + memory `agent-owned-pr-review-and-merge`), so nothing is lost.
- **Future ratchet, record in PR body:** if branch protection is ever added, this check must NOT be listed as required as-is — it legitimately never runs on non-UI PRs (turbo-ignore skips the deployment) and would deadlock them. Either exclude it or add a path-aware no-op then.

## 5. `.impeccable/config.json` — seeded ignores (net-new dir)

Map the four PR #40 dismissals to ignores — each *rule* stays live everywhere else, so real regressions still fail. Never `ignores add-rule` (would blind the gate globally). **Amended at step 5 (see "Step-5 amendment" below):** value-level ignores are only possible for `overused-font`; `low-contrast` and `cream-palette` have no value extraction in impeccable (verified in 3.4.0 and 3.5.0 source) and get **file-scoped wildcard** ignores instead — impeccable's designed mechanism for such rules. Seed via the CLI so the schema is exactly what impeccable 3.4.0 writes:

```bash
pnpm exec impeccable ignores add-value overused-font fraunces \
  --reason "Fraunces is the chosen display font (DESIGN.md, Atelie direction)"
pnpm exec impeccable ignores add-value overused-font "instrument sans" \
  --reason "Instrument Sans is the chosen text font (DESIGN.md, Atelie direction)"
pnpm exec impeccable ignores add-value low-contrast "*" \
  --file "https://miolos-*.vercel.app/**" --file "http://localhost:*" --file "http://localhost:*/**" \
  --reason "By-design: termo kicker accent-termo #c08a1e on paper-card matches the winning Atelie frames byte-identically (PR #40 dismissal). …"
pnpm exec impeccable ignores add-value cream-palette "*" \
  --file "https://miolos-*.vercel.app/**" --file "http://localhost:*" --file "http://localhost:*/**" \
  --reason "By-design: cream page background (paper-bg token) is the recorded Atelie design direction (DESIGN.md, docs/design/002). …"
```

**Verify semantics before committing:** run detect against the live preview (superior to a local dev server — same target CI scans), both viewports — expect the four findings gone, exit 0; also verify against a second preview URL with a different hash to prove the glob generalizes. Paste before/after output as evidence.

## 6. Dependency pinning (settled): exact root devDependencies

Add to **root** `package.json` `devDependencies` (CI-level tooling, not an app dependency):

- `impeccable`: `3.4.0` (exact). **Not 3.5.0**: this machine's `~/.npmrc` sets `min-release-age=3` (days), a deliberate supply-chain cooldown, and 3.5.0 was published 2026-07-30 — under 3 days old — so npm hard-refuses it (`notarget … with a date before …`, reproduced by the step-3 review). 3.4.0 (published 2026-07-28) clears the gate and the review verified its `detect --help` / `ignores --help` grammar is identical to everything this plan relies on (single-value `--viewport <WxH>`, advisory-never-fails exit semantics, `.impeccable/config.json`, `ignores add-value`). **Never bypass the cooldown** (`--before`, npmrc overrides, etc.). If at implement time 3.5.0 is ≥3 days old, taking it instead is fine — same rule applies.
- `puppeteer`: `25.4.0` (exact — npm latest; published 2026-07-27, which cleared the cooldown at review time). Required at runtime for URL scans (`detect` uses "Puppeteer full browser rendering"); impeccable declares **no** peerDependencies, so no version range pins compatibility — the live §7-step-2 run against the real preview is the compatibility proof. **Implement step must re-verify 25.4.0 still clears the `min-release-age=3` cooldown** (check its publish date via `npm view puppeteer time`); if a newer release has shifted things or the check fails, pick the newest version that *does* clear it — never bypass the cooldown.

Rationale over bare `npx impeccable`: CLAUDE.md deps policy wants pinned, lockfile-committed versions; unpinned `npx` in CI floats and is a supply-chain hole. `pnpm exec` in the workflow then resolves the lockfile-pinned copy. Note: `~/.npmrc` also sets `ignore-scripts=true` globally, so puppeteer's postinstall (Chrome download) never runs locally regardless of `allowBuilds` — the local `pnpm exec puppeteer browsers install chrome` in §7 step 3 is therefore mandatory, not optional (and `save-exact=true` makes exact pinning fall out of any `pnpm add`).

**Deliberately do NOT add `puppeteer` to `allowBuilds`** in `pnpm-workspace.yaml`: its postinstall (Chrome download) stays blocked; CI installs Chrome explicitly (`pnpm exec puppeteer browsers install chrome`, cached), matching the issue's "install the puppeteer Chrome in the job". Local URL scans need the same one-time command — note it in the PR body.

## 7. Implementation order

1. Pre-flight sync + branch (§0).
2. **Bypass secret end-to-end** (§3): generate, curl-prove 200 vs 302, `gh secret set`. Then prove impeccable itself gets through: `pnpm exec impeccable detect "https://<preview>/?x-vercel-protection-bypass=…&…" --viewport 1440x900` locally (after step 3 installs deps) — it must report findings from the real app, not an SSO page. This settles brief §7.2 with real output.
3. Add deps (§6): first re-verify both versions clear the `min-release-age=3` cooldown (`npm view impeccable time`, `npm view puppeteer time` — §6 rules); then `pnpm add -D -w impeccable@3.4.0 puppeteer@25.4.0`; `pnpm exec puppeteer browsers install chrome` locally (mandatory — `ignore-scripts=true`, §6).
4. Seed + verify ignores (§5) against local dev server.
5. Write `.github/workflows/impeccable.yml` (§2).
6. Plan doc: `docs/plans/015-issue-39-plan-impeccable-ci.md` (015 is reserved; 014=#17, 016=#43) + its row in `docs/README.md`.
7. Local gates: `pnpm typecheck && pnpm lint && pnpm test` (workflow YAML and JSON config don't compile, but the root package.json change must not break anything; paste output).
8. Commit(s), Conventional: e.g. `ci: run impeccable detect against the web preview deployment (#39)` — body explains the deployment_status design, the bypass mechanism, and the four seeded ignores; separate `docs:` commit for the plan doc is fine.
9. Open PR, verify (§8), then steps 6–8 of the flow (multi-lens review → fix → merge & close #39).

## 8. Verification of the workflow itself (honest plan)

- The PR **will** produce a `Preview – miolos-web` deployment: it changes root `package.json` + `pnpm-lock.yaml`, which turbo-ignore treats as affecting everything. So the triggering event will exist.
- Whether GitHub runs a `deployment_status` workflow file that only exists on the PR branch is **undocumented** (brief §7.1). Determine empirically: after the preview succeeds, check `gh run list --workflow impeccable.yml`.
  - If it fires: green run on the PR is the primary evidence. Done.
  - If it does not fire pre-merge: the step-2 local run against the real preview URL (§7 step 2, both viewports) is the functional evidence in the PR body; merge on that, then confirm the trigger post-merge — the next push to main yields `Production – miolos-web` deployment events, and a **visible skipped run** of this workflow already proves the trigger+filter wiring; full green proof lands on the first subsequent UI-touching PR. State this explicitly in the PR body rather than manufacturing a throwaway UI PR.

## 9. Files touched

| File | Change |
|---|---|
| `.github/workflows/impeccable.yml` | new (§2) |
| `.impeccable/config.json` | new, seeded via CLI (§5) |
| `package.json` (root) | +`impeccable@3.4.0`, +`puppeteer@25.4.0` devDeps (§6 cooldown rules) |
| `pnpm-lock.yaml` | regenerated |
| `docs/plans/015-issue-39-plan-impeccable-ci.md` | new plan doc |
| `docs/README.md` | +row for 015 |

Not touched: `.github/workflows/ci.yml`, `pnpm-workspace.yaml` (`allowBuilds` unchanged, deliberate), anything in `apps/` or `packages/`.

## 10. PR body skeleton

```
## What
- New deployment_status-triggered workflow running `impeccable detect` (1440x900 + 390x844)
  against every successful miolos-web preview; turbo-ignore makes it UI-conditional for free.
- `.impeccable/config.json` seeding the four PR #40 dismissals as value-level ignores (rules stay live).
- impeccable 3.4.0 + puppeteer 25.4.0 pinned as root devDeps (3.5.0 refused by the
  min-release-age=3 supply-chain cooldown); Chrome installed per-job (cached).
- Vercel Protection Bypass for Automation generated for miolos-web and stored as
  repo secret VERCEL_AUTOMATION_BYPASS_SECRET (rides the URL as query params, auto-masked).

## Verified
- <curl 302 naked vs 200 with bypass params>
- <impeccable detect output against the live preview, both viewports, exit code>
- <local detect before/after ignores: 4 findings → 0, and rules still live>
- <pnpm typecheck / lint / test output>
- <workflow run link, or the §8 fallback statement>

## Decisions for Fernando
None required. Recorded: check is intentionally NOT a GitHub-required status check
(no branch protection exists; if rulesets are ever added, exclude this check or
non-UI PRs deadlock). Vercel Authentication on previews stays ON.
```

## 11. Risks

1. **Bypass-through-puppeteer unproven until §7 step 2** — hard stop with a surfaced decision (disable preview auth?) if it fails; do not ship a workflow that scans an SSO page.
2. **Secret leakage** — secret only ever in Actions secret (auto-masked) and local env vars; never in committed files, PR body, or echoed URLs.
3. **Event races/noise** — api and production events produce filtered no-op runs (cosmetic); duplicate redeploys of a SHA re-run the scan (idempotent, harmless).
4. **Flaky headless runs** — no polling by design; `timeout-minutes: 15` bounds the job; Chrome cached by lockfile hash.
5. **Fork PRs** — Vercel doesn't deploy forks unauthorized; solo repo; note the posture, no code needed.
6. **Cost** — one Chrome scan pair per web preview; bounded, cached, acceptable.

## Step-4 changelog

Applied per `03-plan-review.md` (step 3, REJECTED with one blocking finding):

- **Blocking #1 — APPLIED.** Repinned `impeccable` 3.5.0 → **3.4.0** everywhere (§5 schema note, §6, §7 step 3, §9 table, §10 PR-body skeleton): the machine's `~/.npmrc` `min-release-age=3` cooldown refuses 3.5.0 (published 2026-07-30); the reviewer verified 3.4.0's CLI grammar is identical to everything the plan relies on. §6 now names the policy, forbids bypassing the cooldown, allows 3.5.0 only once it ages past 3 days, and instructs the implement step to **re-verify puppeteer@25.4.0's publish date against the same cooldown** (newest clearing version if not; never bypass).
- **Advisory #2 — APPLIED.** §6 puppeteer rationale corrected: impeccable declares no peerDependencies; puppeteer is required at runtime for URL scans, with the live §7-step-2 run as the compatibility proof.
- **Advisory #3 — APPLIED.** §0 gains the standing nvm preamble (`source ~/.nvm/nvm.sh && nvm use default`) for every local shell, per `NEXT-SESSION.md`.
- **Advisory #4 — APPLIED.** §6/§7 note that global `ignore-scripts=true` makes the local Chrome install mandatory, and `save-exact=true` yields exact pins from `pnpm add`.
- **Advisory #5 — DISMISSED.** Reviewer's own verdict is "no change required": runs are per-SHA/per-URL and a `concurrency` group keyed by environment could cancel a live run for a different PR; risk §3 already accepts the noise as cosmetic.

## Step-5 amendment (orchestrator decision, 2026-08-01)

The original §5 mandated value-level ignores for all four PR #40 dismissals and a hard stop if any proved un-suppressable at value granularity. Step 5 hit that stop and surfaced it; the orchestrator decided **option (a): file-scoped wildcard ignores for `low-contrast` and `cream-palette`**, amended here.

- **Why value-level is impossible:** impeccable's `extractFindingIgnoreValue` (`cli/lib/impeccable-config.mjs`) extracts a matchable value only for `overused-font`, `bounce-easing`, and the `design-system-*` rules; for every other rule it returns `''`, so a value entry can never match. Verified in the installed 3.4.0 and in the 3.5.0 tarball (read-only inspection; identical `directValueRules` set) — waiting out the release-age cooldown gains nothing. A bare `'*'` wildcard without `--file` is explicitly non-matching; the file-scoped wildcard is the tool's designed mechanism for rules without value extraction (its own help uses it).
- **Why by-design:** both rules conflict with the recorded Ateliê design system itself (docs/design/002 + DESIGN.md): the cream/paper palette *is* the product's design direction, and the termo-kicker contrast pair matches the winning frames byte-identically (tokens byte-identical by hard rule). These findings are permanent by-design signals, not regressions.
- **Scope robustness:** in URL mode `finding.file` is the full scanned URL (query included). Globs `https://miolos-*.vercel.app/**` (impeccable glob: `*` = `[^/]*`, `**` = `.*`, anchored) plus `http://localhost:*` / `http://localhost:*/**` cover any preview deployment URL and local dev scans. Verified empirically against two different preview URLs (different hashes): 0 findings, exit 0, both viewports.
- **Residual risk (recorded honestly):** a *new* `low-contrast` or `cream-palette` finding on a scanned app page passes green — these two rules are blind on app pages. All other rules stay at full strength, and `overused-font` stays value-level. Upstream ask (value extraction for these rules) tracked in a follow-up issue filed from #39.

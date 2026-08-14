# Handoff — after #31: the gate moved, and `pnpm install` can now refuse

**To:** the session that picks the next ticket.
**From:** the session that landed four pull requests on top of handoff 038 — none of them product code, all of them changes to the environment the next session runs in.
**Next step:** **pick from §5 and start at step 1 of `CLAUDE.md`'s eight-step flow.** The natural next ticket is still **[#34](https://github.com/fernandolisboa/miolos/issues/34)**.

**This is a delta handoff.** [Handoff 038](./038-handoff-31-merged-the-archive-is-live.md) is the record of **#31** and is accurate about it, its §6 flags included — read it for the archive, for `ADR-0053`, and for everything #31 leaves armed. Nothing here restates it. What 038 could not know is that four PRs landed after it, and one of them changes how `pnpm install` behaves and another removes a CI signal that past handoffs cite as evidence. Its §0 says to expect `main` at `e784633`; that is now four commits stale.

Point-in-time snapshot; where an ADR disagrees, the ADR wins.

---

## 0. Check this before you read anything else

```
git checkout main && git pull && git log --oneline -5
source ~/.nvm/nvm.sh && nvm use default >/dev/null && pnpm install --frozen-lockfile
gh api repos/fernandolisboa/miolos/automated-security-fixes
gh api repos/fernandolisboa/miolos/rulesets/20162549 \
  --jq '{name, enforcement, bypass: .bypass_actors, checks: [.rules[] | select(.type=="required_status_checks") | .parameters.required_status_checks[].context]}'
gh run list --workflow=ci.yml --limit 5 \
  --json databaseId,event,headBranch,conclusion --jq '.[] | "\(.databaseId) \(.event) \(.headBranch) \(.conclusion)"'
```

Expect `main` at **`40492b1`** ("chore: Actions cache instead of a Vercel token, and a 7-day dependency cooldown (#100)"), or a descendant, on top of `e046ea7` (#99), `89b668e` (#98) and `2083fc9` (#80).

Verified on 2026-08-14, at `40492b1`:

| Command | Result |
|---|---|
| `pnpm install --frozen-lockfile` | **succeeds** — the lockfile satisfies the new 7-day cooldown and the new trust policy. From cold it also succeeded in CI, run [`31844446116`](https://github.com/fernandolisboa/miolos/actions/runs/31844446116) |
| `…/automated-security-fixes` | `{"enabled":true,"paused":false}` — **changed this session, outside git** |
| `…/vulnerability-alerts` | **204 No Content** (enabled). It used to 404 |
| `…/rulesets/20162549` | `protect-main`, **active**, **no bypass actors**, requires the **`gate`** context (integration 15368) plus `pull_request`, `deletion`, `non_fast_forward` |
| `…/branches/main/protection` | still **404 "Branch not protected"** — the classic API cannot see a ruleset. `main` **is** protected. Do not conclude otherwise from this 404 |
| `gh run list --workflow=ci.yml` | the four newest runs are all `pull_request`. **The last `push`-event run is `31836905719`, 2026-08-14T20:13Z** — before #98 merged at 21:04Z. The three merges after it (21:04, 21:19, 21:58Z) produced **no** run on `main` |

Production is untouched by all four PRs and is still #31's archive. Re-verified 2026-08-14 (`api.miolos.app/health` → `ok`): `/arquivo`, `/sitemap.xml`, `/robots.txt`, `/arquivo/2026-08-01`, `/arquivo/mes/2026-08`, `/arquivo/2026-08-13/sudoku` → **200**; `/arquivo/2099-01-01`, `/arquivo/2099-01-01/sudoku`, `/arquivo/mes/0000-01`, `/arquivo/2026-02-30` → **404**; `/arquivo/<hoje>` → **307 → `https://miolos.app/`**, `/arquivo/<hoje>/sudoku` → **307 → `https://miolos.app/sudoku`**; `sitemap.xml` still **70 `<loc>`s** (same day, so 038's breakdown stands unchanged).

**No schema change, no migration, no product code.** `git diff e784633..40492b1` touches eight files: `.claude/napkin.md`, `.github/dependabot.yml`, `.github/workflows/ci.yml`, `.github/workflows/impeccable.yml`, `docs/README.md`, ADR-0053, handoff 038 and `pnpm-workspace.yaml`. Nothing under `apps/` or `packages/`.

---

## 1. What landed after #31

**[#80](https://github.com/fernandolisboa/miolos/pull/80) (`2083fc9`) — Dependabot.** `pnpm/action-setup` 6.0.9 → 6.0.10, SHA-pinned, in both `ci.yml` and `impeccable.yml`. Mentioned only because it is a fourth commit 038 does not know about.

**[#98](https://github.com/fernandolisboa/miolos/pull/98) (`89b668e`) — Actions minutes, without weakening the gate.** Three things changed about *when* work runs, none about *what* is checked:

- **`concurrency`** on `ci.yml`, keyed `${{ github.workflow }}-${{ github.ref }}` with `cancel-in-progress: true`. For `pull_request` the ref is `refs/pull/<n>/merge`, unique per PR, so two PRs can never cancel each other.
- **`push: [main]` removed.** Every commit reaches `main` through a squash merge the ruleset already gated on the PR, so the push run only re-proved the same tree.
- **Dependabot weekly → monthly** for the grouped `github-actions` ecosystem.

`impeccable.yml` was **deliberately left un-keyed**: Vercel sets `deployment.ref` to a 40-char commit SHA, so a concurrency group there would collapse nothing useful and could let the skipping `miolos-api` event cancel the in-flight `miolos-web` scan. Verified — there is no `concurrency` key in that file.

**Read `ci.yml`'s comment blocks rather than this paragraph.** They carry the reasoning, the ruleset-vs-branch-protection finding, and the two things the file forbids.

**[#99](https://github.com/fernandolisboa/miolos/pull/99) (`e046ea7`) — the eight flags, recorded.** ADR-0053 gains an **append-only dated section**, "Product flags confirmed — 2026-08-14", one line per flag, with F1's and F4's costs stated. Four sentences in handoff 038 that said the eight were open were corrected in the same commit: §6's heading, F4's "still wants a confirmation", §2's "load-bearing open flag", §5's conditional "if F1 flips". Plan 037 is deliberately untouched — it is a snapshot. **The flags are settled. Do not re-ask.** The caching question reopens only on ADR-0053 decision 2's revisit trigger *and* its `revalidatePath` precondition.

**[#100](https://github.com/fernandolisboa/miolos/pull/100) (`40492b1`) — supply chain and caching.**

- **`TURBO_TOKEN`/`TURBO_TEAM` removed** — #98 had wired the Vercel Remote Cache onto the gate job; #100 rips it out. The reason is the threat model: a bearer token in the job env is readable by every process the job starts, and `pnpm install`, `test` and `build` all execute third-party code. The gate job now carries **no `env:` block at all**.
- **turbo cached through `actions/cache` on `.turbo/cache`**, split restore/save (v6, SHA-pinned), key `turbo-<os>-<lockfile hash>-<sha>` with two `restore-keys` prefixes. Save is guarded `!cancelled() && hashFiles('.turbo/cache/**') != ''`.
- **`pnpm-workspace.yaml`**: `minimumReleaseAge: 10080` (7 days) and `trustPolicy: no-downgrade` added; the **ten-entry `minimumReleaseAgeExclude` list deleted**; a two-entry `trustPolicyExclude` added (`semver@6.3.1`, `eslint-import-resolver-typescript@3.10.1`, both dev-only transitives, both verified against `registry.npmjs.org`). **`allowBuilds` untouched.**

**Outside git, and therefore invisible to any diff:** Dependabot **vulnerability alerts** and **automated security fixes** were enabled by API. They were off. `.github/dependabot.yml`'s comment still says they are disabled — see §3.

---

## 2. New rules of the road

- **The merge evidence is the PR's own `gate` run.** It is the ruleset-required context, produced before merge. A `gate` showing **cancelled** means a newer commit superseded it, not that it failed — read the newest run.
- **Never re-add `push: [main]` to `ci.yml`.** It buys back nothing the ruleset does not already enforce pre-merge, and it re-adds the duplicated run #98 removed. This holds even when the motive is cache warmth (§3).
- **Check rulesets, never `branches/main/protection`.** The classic endpoint 404s on a ruleset-protected branch.
- **A failing `pnpm install` under the cooldown or the trust policy is the setting working.** The fix is a narrow, dated, exact-`name@version` exclude in its own commit, naming the advisory and the date it may be pruned — never a bare name, never a range, never turning the policy off. **The procedure is written in `pnpm-workspace.yaml`'s own comments; follow those rather than this line.**
- **`impeccable.yml` stays un-keyed**, for the reason in §1.
- **Test-id frontier at `40492b1`, re-derived by grep** (`grep -rhoE "T-<AREA>-S[0-9]+[a-z]?" apps packages`, excluding `.next` and `node_modules`): **unchanged from `e784633`**, because nothing since #31 touched a test. Next free **`T-CORE-S86` · `T-DB-S59` · `T-API-S109` · `T-WEB-S189` · `T-LINT-S39`**; highest in use S84 / S58 / S107 / S186 / S37. `T-WEB-S187`, `T-WEB-S188`, `T-CORE-S85`, `T-API-S108` and `T-LINT-S38` stay **burned unspent**. `docs/agents/test-ids.md` is current.

---

## 3. Landmines

All of [handoff 038 §3](./038-handoff-31-merged-the-archive-is-live.md) stands — the nvm preamble, `TURBO_CONCURRENCY=1` on every commit, `--force` for gate evidence, the `.next`/`bundle-check` ordering, per-viewport `impeccable detect`, and the calendar-dependent-gate rule. These are new, and the napkin was curated for all of them at `89b668e` and `40492b1` (items 8 and 10 of Execution & Validation, item 6 of Shell & Command Reliability) — read it.

1. **`pnpm install` can now hard-fail by design, in two distinct ways.** A version younger than seven days is refused; a version whose publish-time trust evidence is weaker than an earlier release's fails with `ERR_PNPM_TRUST_DOWNGRADE`. Both fail `--frozen-lockfile` in CI as a **red gate**, not a warning. `pnpm add <pkg>@latest` on anything published this week will not resolve — check `pnpm view <pkg> time --json` and take a version older than the window.

2. **`minimumReleaseAgeStrict` is the subtle one, and it is not in the file as a key.** Upstream, verbatim: its default is *"`true` if `minimumReleaseAge` is explicitly configured, **false** otherwise"*, and when false *"pnpm falls back to a version that doesn't meet the `minimumReleaseAge` constraint so installation can still succeed"* ([pnpm.io/settings/dependency-resolution](https://pnpm.io/settings/dependency-resolution)). Until #100 the cooldown was **inherited** (pnpm 11's built-in 1440 minutes), so it was loose and installs silently proceeded. Declaring the value flips strict on. **A next session that "fixes" a failing install by re-adding `minimumReleaseAgeExclude` entries is undoing #100, not repairing it.** The ten deleted entries were all `@turbo`/`turbo`/`lint-staged`/`@types` pins dated 2026-07-31, long past any cooldown — a standing age-check exemption for exactly them.
   - **One correction to the record, since it will otherwise mislead.** #100's commit message and the surviving comment in `pnpm-workspace.yaml` say pnpm *"silently wrote the pair into this file"*. Git does not corroborate that: the ten entries entered whole in M0's `204b607`, under a hand-written comment, and upstream documents the non-strict path as *installing the non-conforming version*, with no auto-write behaviour described. The operative rule is unaffected — don't re-add entries — but do not repeat the provenance claim as fact.

3. **There is no CI run on `main` any more.** Past handoffs cite "CI green on main post-merge" as evidence; **that signal is gone by decision** (#98). Evidence is the PR's `gate` run. §0's `gh run list` output is the proof: nothing after 2026-08-14T20:13Z ran on a push.

4. **The Actions cache is branch-scoped, and nothing writes `main`'s scope.** A run may read only its own branch's caches and the default branch's; with CI `pull_request`-only, no run ever populates the default branch's. So **every PR's first `gate` run is cold by design** and warmth accrues only across pushes to the same PR. That is not a cache bug and it is **not to be bought back with a `push: [main]` trigger** — the file says so in a comment, and #100's message says why.

5. **`.github/dependabot.yml` now says something false.** Its comment argues the monthly interval's cost on the ground that *"Dependabot security updates are currently DISABLED on this repo (`GET /repos/…/automated-security-fixes` → `{"enabled": false}`, and `/vulnerability-alerts` 404s)"*. Both were enabled by API later the same session; §0 shows `{"enabled":true,"paused":false}` and a 204. The **interval decision still holds** — monthly is right precisely *because* the advisory fast path now exists — but the justification's premise is stale. Under the napkin's falsified-record standard this is owed a correction; it is a comment edit, no behaviour attached, and a good first commit for whoever next touches CI.

6. **There is an untracked `miolos-activate-attach.sh` in the repo root**, byte-identical to `~/miolos-activate-attach.sh`, and it is **not gitignored**. `git status --porcelain` therefore never reads clean on this machine, and `git add -A` would commit a wizard script into the repo. **Stage explicitly, always.** This handoff's own commit did.

7. **`pnpm install --frozen-lockfile` returning "Already up to date" in 350ms proves nothing about the cooldown**, because a warm `node_modules` short-circuits resolution. The cold-install evidence is CI run [`31844446116`](https://github.com/fernandolisboa/miolos/actions/runs/31844446116).

8. **`packages/games` `P2 — determinism` flakes on CI, and it is now a merge blocker.** 038 §3 recorded it as a local full-concurrency flake. **This handoff's own PR — two markdown files, zero code — went red on it**: `test/binairo/generate.test.ts > generateBinairo > P2 — determinism` timed out at **5165ms against vitest's 5000ms default** in gate run [`31846743499`](https://github.com/fernandolisboa/miolos/actions/runs/31846743499), while the same suite passed locally uncached. The test is `fc.assert(…, { numRuns: 100 })` generating **200** Binairo puzzles with **no explicit timeout** (`packages/games/test/binairo/generate.test.ts:69-78`), which is exactly what the napkin's Execution & Validation item 3 says not to ship — CI runners are 3-4× slower, so any test near its timeout locally is a coin flip there. **Diagnosis before re-run:** confirm the failing test is unrelated to your diff, then `gh run rerun <id> --failed`. **The durable fix** is an explicit timeout sized at local wall time × 4 with the arithmetic in a comment, per ADR-0023's constraint that this property keeps its ≥100 runs — it is not filed as an issue yet and is a good small ticket for whoever tires of re-running.

**`docs/` numbering:** handoff 039 is this file. Next plan/handoff: **`040`**. Next ADR: **`0054`**.

---

## 4. Live state

Unchanged from [handoff 038 §4](./038-handoff-31-merged-the-archive-is-live.md), re-verified in §0 above: four dailies, free play, streak, stats/calendar/Dia Perfeito, medals, and the whole archive with `sitemap.xml` and `robots.txt`. The archive's floor is `2026-08-01` and deepens by one day per rollover. No schema change and no migration since `0005` (`medal_grants`, #30). Attach still dormant; `medal_grants` still empty.

The only live-state deltas this session produced are outside the app: the gate's shape (§1, §2) and the two repo security settings (§0).

---

## 5. Open work, in the order it is likely to matter

[Handoff 038 §5](./038-handoff-31-merged-the-archive-is-live.md)'s table stands in full and nothing was added to or removed from it — `gh issue list --state open` returns the same 22 issues. Only the top two are worth restating:

| Issue | Why it might come first |
|---|---|
| [#34](https://github.com/fernandolisboa/miolos/issues/34) | **Unblocked by #31, and the natural next ticket.** Sharing — spoiler-free results and OG cards. Verified substrate it inherits: the **per-day-per-game URLs** `/arquivo/<data>/<jogo>`; the four archive readers on `@miolos/db`'s **root barrel** (`archiveDateClass`, `getArchivedDaily`, `listArchivedDays`, `listArchivedMonths`, `packages/db/src/index.ts:18-23`); **`absoluteUrl()`** at `apps/web/src/site-origin.ts:23`. **The nuance:** `/arquivo/<hoje>/<jogo>` **307s to the daily route**, so a crawler fetching today's permalink reads the *daily* route's metadata, not an archive page's — plan the OG card for that redirect, not around it. **And the `getTodayDaily` TSDoc trap** (`packages/db/src/published.ts:125-145`): its `ProjectedGame` invariant was moved once already, #31 → #34, and the fix at step-6 F22 was to **state it without a ticket at all**. #34 must not re-hang it on a ticket number — a third move falsifies it again |
| [#96](https://github.com/fernandolisboa/miolos/issues/96) | The smaller `ready-for-agent` alternative. The archive day page's per-game done chip, deferred from #31's fix round (plan 037 §14 **I60**, step-6 F10c). The issue already names its files, its ADR-0031 constraints, the new client boundary per card, and the `usePriorConclusion` → `useRecordSnapshot` swap |

---

## 6. Pending on Fernando — and blocking nothing

**No open ticket depends on either of these.** Neither is a reason to delay #34, #96 or anything else in §5.

- **Attach activation.** The wizard is `~/miolos-activate-attach.sh` — **outside the repo, and it must be run in a real terminal, not through an agent's `!`**. Until it runs, the attach stack stays **dormant and fail-closed** (no `RESEND_API_KEY`), exactly as it has been since #21. The checklist is [handoff 032 §6](./032-handoff-21-merged-m1-complete.md). See §3 landmine 6 about the untracked copy in the repo root.
- **The founder grant**, on [#37's launch checklist](https://github.com/fernandolisboa/miolos/issues/37#issuecomment-5289169618). `medal_grants` stays empty until it runs.

#31's eight flags are **not** on this list. They were confirmed on 2026-08-14 and the durable record is [ADR-0053's "Product flags confirmed" section](../adr/0053-the-archive-is-a-public-past-only-read-and-a-late-write.md). The standing debts from #30 ([handoff 036 §6](./036-handoff-30-merged-medals-live.md)) and the #29-era copy flags ([handoff 034 §6](./034-handoff-29-merged-m3-opens.md)) are unchanged.

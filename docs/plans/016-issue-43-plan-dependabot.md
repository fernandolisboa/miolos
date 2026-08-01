# Plan — issue #43: Dependabot github-actions ecosystem

Step-2 plan, built on the step-1 brief (`01-explore.md`). Small config-only chore: one new file, one docs commit.

## Scope

- **In scope:** create `.github/dependabot.yml` with a single `github-actions` ecosystem entry so Dependabot refreshes the SHA pins landed by PR #42 (it preserves pin-by-SHA and maintains the `# vN` version comments).
- **Out of scope:** an `npm` ecosystem entry. That is a possible future issue — mention it in the PR description as a candidate follow-up, do not add it here.

## Precondition

Local main is behind origin (PR #42's SHA pins are only on origin). Plans 014 and 015 are orchestrator-reserved for the in-flight #17 and #39 streams and may not yet be on origin when you pull — use 016 regardless; do not renumber down even if 014/015 are absent. **First action of the implement step: `git pull` on main**, then branch.

## Exact final content of `.github/dependabot.yml`

```yaml
version: 2
updates:
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
    groups:
      github-actions:
        patterns: ["*"]
    commit-message:
      prefix: "chore"
```

Settled choices (from the brief; do not reopen):

- `directory: "/"` — Dependabot searches `.github/workflows` from the repo root.
- **Weekly**, **one group for all actions** — at most one PR per week; each Dependabot PR runs the full CI gate once.
- `commit-message.prefix: "chore"` — conforms to the repo's Conventional Commits rule; Dependabot's default prefix would not.
- **No `labels:` override** — automatic `dependencies` + `github_actions` labels suffice; the repo's triage labels are for the issue-tracker workflow, not dependency PRs.
- **No `target-branch`** — default branch is correct.

## Steps (for the implement session)

1. `git checkout main && git pull`, then branch `chore/43-dependabot-actions`.
2. Write `.github/dependabot.yml` exactly as above.
3. Write `docs/plans/016-issue-43-plan-dependabot.md` — this plan, committed as a snapshot. 016 is orchestrator-reserved for this issue; 014 and 015 are reserved for the in-flight #17 and #39 streams and may not be on origin yet — use 016 regardless, never renumber down.
4. Add one row to the index table in `docs/README.md`:
   `| `plans/016-issue-43-plan-dependabot.md` | Implementation plan for #43 (Dependabot for SHA-pinned actions) |`
   If #17/#39 haven't merged yet, the table will read 013 → 016 — that gap is the reservation scheme working correctly. Do not "fix" it by renumbering or padding.
5. Single Conventional Commit: `chore: add dependabot config to refresh SHA-pinned actions (#43)` — body notes it's the step-6 security-review follow-up from PR #42. Pre-commit hooks run normally; never `--no-verify`.
6. Open PR, run gates, paste evidence, merge via the normal flow (steps 6–8 of the eight-step flow still apply).

## Verification

The change is config-only — no TypeScript, no UI. Evidence to paste in the PR:

- **YAML validity:** `python3 -c "import yaml,sys; yaml.safe_load(open('.github/dependabot.yml')); print('valid')"` (or `npx yaml-lint`/`yamllint` if python3+pyyaml is unavailable). Paste real output.
- **Dependabot schema validation (pre-merge):** `npx --yes check-jsonschema --builtin-schema vendor.dependabot .github/dependabot.yml` — validates against the official SchemaStore dependabot-2.0 schema, catching key typos that plain YAML parsing misses. Paste real output as evidence beside the YAML parse.
- **Schema sanity:** note in the PR that GitHub validates `dependabot.yml` on merge — a bad config surfaces as an error in the repo's Insights → Dependency graph → Dependabot tab, not silently. Check that tab after merge as part of step 8.
- **Mechanical gate anyway:** run `pnpm typecheck`, `pnpm lint`, `pnpm test` and paste output — the change cannot affect them, but the gate is unconditional. `npx impeccable detect` not required (no UI touched).

## PR body skeleton

- **What changed:** added `.github/dependabot.yml` (github-actions ecosystem, weekly, grouped, `chore` commit prefix); committed plan snapshot `docs/plans/016-issue-43-plan-dependabot.md` + index row. Closes #43.
- **Evidence:** YAML parse output; `pnpm typecheck`/`lint`/`test` output inline.
- **Out of scope / follow-up:** npm ecosystem entry — candidate future issue, not filed here unless the orchestrator says so.
- **Decisions needed from Fernando: none.**

## Risks

Near-none, honestly: additive file, zero runtime surface, and a wrong config fails visibly in the Dependabot tab rather than silently. One cosmetic watch item: the `pnpm/action-setup` pin's comment carries trailing prose (`# v6 — version comes from packageManager`); Dependabot updates the version token but may mangle or skip the prose (dependabot-core #7912 edge). Verify on the first Dependabot PR — nothing to do now.

## Step-4 changelog

Applied from the step-3 review (`03-plan-review.md`):

- **B1 (blocking, fixed):** both claims that plans 014/015 "exist on origin" (Precondition and step 3) reworded to the true state — 014/015 are orchestrator-reserved for the in-flight #17/#39 streams, may not be on origin yet; use 016 regardless and never renumber down.
- **A2 (advisory, adopted):** added pre-merge Dependabot schema validation to Verification — `npx --yes check-jsonschema --builtin-schema vendor.dependabot .github/dependabot.yml` — beside the plain YAML parse.
- **A3 (advisory, noted):** added a note at step 4 that a 013 → 016 gap in the `docs/README.md` index is the reservation scheme working — the implementer must not "fix" it.

No changes to the YAML block or settled choices (review confirmed them key-by-key).

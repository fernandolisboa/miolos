# Handoff — #27 is merged and live; [#28](https://github.com/fernandolisboa/miolos/issues/28) (free play) is M2's last ticket

**To:** the session that builds free play.
**From:** the session that took #27 from step 6 to merge — the parallel code review, two fix rounds, the seeding, `B11`/`B12`, and the merge.
**Next step:** **step 1 of `CLAUDE.md`'s eight-step flow on #28.** There is no work left on #27.

This is a point-in-time snapshot, not a living spec. Where it and an ADR disagree, the ADR wins.

---

## 0. Check this before you read anything else

```
git checkout main && git pull && git log --oneline -1
curl -s https://api.miolos.app/buffer-depth
curl -s https://api.miolos.app/daily/termo
```

Expect `main` at **`0c5d5d5`** ("feat: the daily Termo end to end … (#27) (#77)"), buffer-depth showing **four** games, and `/daily/termo` returning **`{"game":"termo","date":"…"}`** — two keys, no answer. If the answer is in that response, stop and read §4.

The `feat/27-daily-termo-end-to-end` branch was deleted on merge. PR [#77](https://github.com/fernandolisboa/miolos/pull/77) is merged, [#27](https://github.com/fernandolisboa/miolos/issues/27) is closed.

---

## 1. What #27 actually shipped, and where the reasoning lives

The daily Termo, end to end. Publication draws the day's answer from the curated list and stores the **word** on `daily_puzzles`; a stateless server route judges each guess; the client renders a six-row board, an on-screen pt-BR keyboard, and a fourth conclusion state. A six-guess loss is recorded **played, not completed** — it never counts toward streak or Dia Perfeito.

- **The plan:** [`docs/plans/022-issue-27-plan-daily-termo-end-to-end.md`](../plans/022-issue-27-plan-daily-termo-end-to-end.md), 4 234 lines. Accurate as of the ten pre-review commits; §21.6's deviation list and §26's unverified list are the two sections that outlived the ticket.
- **The ADRs:** **0038–0045**, plus 0041 merged separately via PR [#73](https://github.com/fernandolisboa/miolos/pull/73). **Read the merged ADR files, never the plan's summary of them** — six of the eight were materially amended during the review.
- **The review:** six lenses, then a three-lens verification round on the fix commits. Full dispositions in a [PR comment](https://github.com/fernandolisboa/miolos/pull/77#issuecomment-5162319891) — including the ten findings dismissed in writing, which is the list to read before re-raising anything about Termo.

**Final gate on the merge candidate:** `pnpm typecheck` 6/6 · `pnpm lint` exit 0 · `pnpm test` **1 266 passing** (was 1 248 pre-review) · `pnpm build` 2/2 · `pnpm bundle-check` exit 0 · CI `gate` and `detect` both green.

---

## 2. #28 — what it is, and the four things already built for it

[#28](https://github.com/fernandolisboa/miolos/issues/28): infinite Binairo, Sudoku and Nonogram generated **in the browser** with a client-picked seed. No endpoint, no rows, no streak or stats or medals. **Termo is excluded** — its word list is finite curated content and free play would burn it. Once loaded, it works offline. Governed by [ADR-0011](../adr/0011-free-play-is-generated-on-the-client.md) and [ADR-0008](../adr/0008-completion-and-streak-semantics-across-play-modes.md); the exclusion is a `CLAUDE.md` project invariant, not a preference.

Seams that already exist — check each rather than rebuilding it:

- **The route slug**: `apps/web/src/i18n/routes.ts:10` — `freePlay: "modo-livre"`. The route itself does not exist.
- **The label**: `apps/web/src/i18n/messages.ts:154` — `freePlay: "Modo livre"`.
- **A reserved grid row**: `apps/web/src/play/screen.module.css:48` puts a `free` area in the ≥1141px `grid-template-areas`, and `:266` documents it as *"a 1fr spacer with no element"*. It is a spacer today. Decide deliberately whether #28's entry point belongs there or whether the row should stay empty — do not assume the name is a promise.
- **The engines**: all three generators are done, property-tested, and take `{seed, weekday}`. `packages/games` is pure — zero React Native, zero Node — and free play is the case that architecture was for.

**The hard part of #28 is not generation, it is proving the negatives.** Three of its five acceptance criteria are "nothing happened": no requests, no rows, streak and stats untouched. Plan the *evidence* for those at step 2, not at step 5 — a test that asserts an absence is exactly the kind that passes against broken code. `apps/web/test/eslint-db-wall.test.ts` and `apps/web/scripts/route-client-js.mjs` are the two shipped precedents for mechanising a negative.

**`packages/games` has no test ids by convention** (`docs/agents/test-ids.md:11`), and new suites there keep it that way.

---

## 3. Landmines — things that cost this session or the last one real time

**The gate needs `rm -rf apps/web/.next` first, every time.** `apps/web/next-env.d.ts:3` hard-imports the gitignored `.next/types/routes.d.ts`; only `next build` regenerates it, so a typecheck after a stale build is red for reasons unrelated to your diff.

**`pnpm bundle-check` does not exist at the repo root.** It is a script in `apps/web/package.json:12` — run it from `apps/web`. At the root you get `Command "bundle-check" not found`, exit **0**, and no output, which reads as a pass.

**`impeccable detect` prints nothing on a clean page, and also prints nothing when it fails to load the page.** Exit code is 0 either way and `--json` gives `[]` for both. It is a silent-green trap. **Always run a positive control beside the real scan** — `--no-config` on the same URL is the cheapest one, because it surfaces the three suppressed Ateliê findings (`overused-font` ×2, `cream-palette`) and so proves the browser reached the page. Locally, scan one URL per invocation; CI's nine-URL invocation is fine.

**The Vercel preview is behind deployment protection**, so you cannot `curl` it without `VERCEL_AUTOMATION_BYPASS_SECRET`, which is CI-only. To check a route locally, build and `next start` with the env passed **through the process**, never written to a file:

```
( set -a && . ./apps/api/.env.local && set +a
  export NEXT_PUBLIC_SITE_URL=https://miolos.app NEXT_PUBLIC_API_URL=https://api.miolos.app
  source ~/.nvm/nvm.sh && nvm use default >/dev/null
  pnpm --filter @miolos/web start -p 3000 )
```

**`@neondatabase/serverless` does not resolve from `apps/api`** under pnpm's strict layout. Use the `@miolos/db/publishing` exports (`createPublishingDb`, `bufferDepth`, `listBufferedDates`, `todaySaoPaulo`, `listUsedTermoAnswers`) instead of importing the driver — and note `todaySaoPaulo(db)` **takes the db**, because the date comes from Postgres, never from the local clock.

**Anything touching `.env.local` may be refused by the sandbox**, correctly — those files hold live credentials. Pass values through a subshell's environment; do not try to write them anywhere.

**Migrations are hand-applied. `drizzle-kit migrate` must never be pointed at Neon** — the journal is not authoritative and what the bookkeeping table contains is unknown. #28 should need no migration at all: free play writes nothing.

**`docs/` numbering is one sequence across every subdirectory.** This document took **024**. Next plan: `docs/plans/025-issue-28-plan-<slug>.md`. Next ADR: `docs/adr/0046-<slug>.md` (ADRs keep their own sequence and owe no `docs/README.md` row; a plan and a handoff each owe one).

---

## 4. Live state you can break

`daily_puzzles` now holds **seven termo rows**, `2026-08-03` … `2026-08-09`, seeded by hand from the branch before the merge because `CRON_SECRET` is Production-only and production ran `main`. The cron has taken over; nothing further is owed.

Two properties worth re-checking if you touch publication or the wall:

- **`GET /daily/termo` must return exactly `{game, date}`.** The answer never crosses the wall — `stripDailyContent`'s termo arm parses strictly and discards, and `dailyTermoResponseSchema` is a two-key `z.strictObject`.
- **The validation dictionary ships to the client and the answer pool does not.** That is by design: the client rejects non-words offline, and every answer is necessarily *also* a validation word, so finding today's answer in a client chunk proves nothing. The real tripwires are `então`, `mamãe`, `época` — answer-only, accented, absent from every chunk, asserted by `pnpm bundle-check` with `zurro` as the positive control.

`daily_puzzles` rows are **immutable and killed rows count as covered**. A content-schema change after rows exist 500s the route, and only a hard `DELETE` recovers.

---

## 5. Open work, in the order it is likely to matter

Free of blockers, from `gh`:

| Issue | Why it might come first |
|---|---|
| **[#28](https://github.com/fernandolisboa/miolos/issues/28)** | **M2's last ticket.** The milestone closes with it |
| [#75](https://github.com/fernandolisboa/miolos/issues/75) | `playRoutes` is still `Partial<…>` although all four games are routed. Small, and #28 adds a fifth route shape — worth doing *before* or *with* #28, not after |
| [#74](https://github.com/fernandolisboa/miolos/issues/74) · [#76](https://github.com/fernandolisboa/miolos/issues/76) | #27's own follow-ups: a real low-pool alert, and one TSDoc |
| [#78](https://github.com/fernandolisboa/miolos/issues/78) | **New.** ADR line citations drift; argues for a checker rather than a sweep, and records the one citation that must deliberately stay wrong |
| [#63](https://github.com/fernandolisboa/miolos/issues/63) · [#67](https://github.com/fernandolisboa/miolos/issues/67) | Two a11y/polish items on the **shared** play layer, so #28 inherits both. #67 now carries a [#27 comment](https://github.com/fernandolisboa/miolos/issues/67#issuecomment-5162307255) correcting its option (ii): `/termo` renders nothing into `grid-area: hint`, so the row list must move with the area list in both bands. Verified there is no `row-gap`, so an empty `auto` track collapses cleanly |
| [#51](https://github.com/fernandolisboa/miolos/issues/51) | `low-contrast` and `cream-palette` are wildcard-ignored in `.impeccable/config.json`, so **a green impeccable scan is not contrast evidence**. Compute contrast by hand and put the arithmetic in the PR, as #25 and #27 both did |
| [#29](https://github.com/fernandolisboa/miolos/issues/29) · [#31](https://github.com/fernandolisboa/miolos/issues/31) | M3. #29 owns the guess distribution and the hub's `em 4/6` string, both deliberately absent today |

Two obligations #27 transferred rather than discharged, recorded as comments so they cannot evaporate: **[#19](https://github.com/fernandolisboa/miolos/issues/19#issuecomment-5159949996)** and **[#29](https://github.com/fernandolisboa/miolos/issues/29#issuecomment-5159949515)** — whatever derives the streak and Dia Perfeito must exclude `outcome = 'lost'`, and the test proving it belongs there. Today `apps/web/app/page.tsx` has `const streakCount = 0` and no aggregating route exists, which is why #27 could not prove it at the `apps/api` seam its own AC 4 named.

---

## 6. Still owed by ADRs, and not doable in this environment

Say so plainly in the PR rather than letting a green suite imply otherwise:

- **A real screen-reader pass** (VoiceOver/NVDA), owed by ADR-0042 consequence (e) and ADR-0043 decision 10. jsdom cannot stand in for it.
- **The 320px `apagar` browser measurement** — plan 022 §12.6 carries a fallback ladder; the measurement was never taken.

---

## 7. Environment

Every node/pnpm/npx command needs the nvm preamble, or you get the system node:

```
source ~/.nvm/nvm.sh && nvm use default >/dev/null && <command>
```

Node v24.18.1, pnpm 11.18.0. Pre-commit (Husky + lint-staged + typecheck + tests) is **never** bypassed with `--no-verify` — note it runs under Node 24.14.1 and prints an "Unsupported engine" warning; that is cosmetic and the hooks pass.

```
rm -rf apps/web/.next && pnpm typecheck     # --force bypasses turbo's cache
pnpm lint                                   # no --force; eslint rejects the flag
pnpm test
pnpm build
cd apps/web && pnpm bundle-check            # from apps/web, NOT the root
npx impeccable detect <url> --viewport WxH  # from the REPO ROOT only, one URL, with a control
```

The Impeccable workflow fires on `deployment_status` and produces **two runs per push**, one per Vercel project; the `miolos-api` one is filtered at job level and reports as skipped. Find the `miolos-web` run.

The `T-LINT-1` timing worry from handoff 023 **did not reproduce** — measured 376 ms in isolation, 791 ms for the whole file inside a concurrent run. The `apps/api` top-up tests already carry explicit `30_000` timeouts.

---

## 8. Exit criteria for #28

- All five acceptance criteria met, each with a **machine-checkable** proof — especially the three negatives.
- `pnpm typecheck` / `pnpm lint` / `pnpm test` / `pnpm build` / `pnpm bundle-check` green, with counts pasted.
- `npx impeccable detect` green on every new route at both viewports, with a positive control beside each scan, and `.github/workflows/impeccable.yml` extended to cover them.
- Step-6 review closes on an empty blocking/high pass, every dismissal written down in the PR.
- `docs/agents/test-ids.md`'s frontier re-derived by grep at step 8 — it is accurate as of `0c5d5d5` and will be stale the moment #28 adds an id.
- M2 closed.

---

## 9. Kickoff prompt

Copy everything between the markers.

--------------- BEGIN KICKOFF ---------------

Continue Miolos with #28 (M2: Free play on the grid games) — M2's last ticket.
Read docs/handoffs/024-handoff-m2-free-play-the-last-ticket.md in full first.

#27 is done: PR #77 merged, main is at 0c5d5d5, the daily Termo is live in
production and all four dailies are playable. There is no work left on it.

Start at STEP 1 of CLAUDE.md's eight-step flow — explore, then plan. Read
CONTEXT.md and ADR-0011, ADR-0008 and ADR-0005 before anything else; the
plan goes to docs/plans/025-issue-28-plan-<slug>.md and owes a docs/README.md
row in the same commit.

The hard part of #28 is proving the negatives — no requests, no rows, streak
and stats untouched. Plan that evidence at step 2, not at step 5. Termo is
excluded from free play; that is a project invariant, not a preference.

Every node/pnpm/npx command needs:
  source ~/.nvm/nvm.sh && nvm use default >/dev/null &&

`pnpm bundle-check` runs from apps/web, not the repo root. Always
`rm -rf apps/web/.next` before a typecheck.

--------------- END KICKOFF ---------------

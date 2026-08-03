# Handoff — #27's daily Termo, mid-flight: PR [#77](https://github.com/fernandolisboa/miolos/pull/77) is open and step 6 has not run

**To:** the session that finishes [#27](https://github.com/fernandolisboa/miolos/issues/27).
**From:** the session that planned it and wrote all ten code commits. Stopped on a usage limit, deliberately, with the branch pushed and green locally.
**Next step:** **step 6 of `CLAUDE.md`'s eight-step flow — the parallel code review.** Steps 1–5 are done. Do **not** re-plan, do **not** re-implement.

This is a point-in-time snapshot, not a living spec. Where it and an ADR disagree, the ADR wins.

---

## 0. Check this before you read anything else

```
git fetch && git checkout feat/27-daily-termo-end-to-end && git log --oneline -1
gh pr view 77 --json state,mergeStateStatus && gh pr checks 77
curl -s https://api.miolos.app/buffer-depth
```

Expect the branch at `5f649e9` with **ten commits** ahead of `main`, PR #77 **open**, and buffer-depth still showing **three** games — termo's buffer is deliberately **not seeded yet** (§6 below).

`main` is at `79bad18` — PR [#73](https://github.com/fernandolisboa/miolos/pull/73) merged and **closed #68**. That is a prerequisite of this branch, not part of it.

---

## 1. What is done

**Steps 1–4** produced `docs/plans/022-issue-27-plan-daily-termo-end-to-end.md` (4 200 lines) and eight ADRs. The plan is the spec; it is committed and it is accurate as of `5f649e9`. **Read its §21.2, §21.4, §24 and §26 before touching anything.**

Step 3 ran **six adversarial reviewers on the plan** (correctness, ADR/invariant adherence, issue adherence, security, design/a11y, feasibility). They returned 7 blocking and 20 high findings, **zero dismissed**, and step 4 applied all of them. Three reviewers independently reproduced the same blocking defect against the installed drizzle-orm — see §3.

**PR A — [#73](https://github.com/fernandolisboa/miolos/pull/73), merged, closes #68.** ADR-0041 ("accents colour shapes, never words"), the `DESIGN.md`/`PRODUCT.md` amendment, `accent.ts`'s `INKS_ON_ACCENT.termo → var(--ink)`, eleven shared `--accent`-as-text conversions, and `ink-on-accent.test.ts`. It went through its own step-6 review (two reviewers, ten findings, all applied in three fix commits) — dispositions are in a [PR comment](https://github.com/fernandolisboa/miolos/pull/73#issuecomment-5160112450). **PR A materially rewrote ADR-0041 during that loop**: decision 1 was recut on a *fixed-value vs per-game-value* axis, decisions 8 and 9 were added, consequence (h) enumerates thirteen surviving sites. Read the merged file, never the plan's summary of it.

**PR B — [#77](https://github.com/fernandolisboa/miolos/pull/77), open, closes #27.** Ten commits, `B1`…`B10` in the plan's numbering:

| Commit | Subject |
|---|---|
| `714311e` | `docs: plan 022 and Termo's vocabulary for #27` |
| `c3ff3e1` | `docs: ADR-0038…0040 and ADR-0042…0045 for the daily Termo (#27)` |
| `ad25303` | `feat(core): the termo daily contracts and the wall's fourth projection` |
| `a0fc9bd` | `feat(db,api): draw and publish the daily Termo answer` |
| `af01432` | `feat(core,api,db): judge a Termo guess and record its outcome` |
| `40e93e7` | `feat(web): the termo play record, its sync body and three-verb day state` |
| `09a7e58` | `feat(web): the termo reducer, the guess client and its offline behaviour` |
| `f844fbf` | `feat(web): the termo screen, its keyboard, and the conclusion's fourth state` |
| `fcb2938` | `feat(web): activate the termo hub tile and the conclusion chain` |
| `5f649e9` | `feat(games): keep the answer list out of the client bundle` |

Local gate at `5f649e9`, run with `--force`: `pnpm typecheck` 6/6 · `pnpm lint` exit 0 · `pnpm test` **1 248 passing** (963 at `b308349`, 972 after PR #73) · `pnpm build` 2/2 with `/termo` and `/termo/concluido` emitted · `pnpm bundle-check` exit 0.

**Follow-ups already filed**, so the PR body's links are real: [#74](https://github.com/fernandolisboa/miolos/issues/74) (a real alert when the answer pool runs low), [#75](https://github.com/fernandolisboa/miolos/issues/75) (totalise `playRoutes`), [#76](https://github.com/fernandolisboa/miolos/issues/76) (the `FORBIDDEN_DAILY_KEYS` TSDoc). Obligations recorded as comments on [#19](https://github.com/fernandolisboa/miolos/issues/19#issuecomment-5159949996) and [#29](https://github.com/fernandolisboa/miolos/issues/29#issuecomment-5159949515).

---

## 2. What is NOT done — your work, in order

1. **Step 6 — the parallel code review.** Multiple specialised reviewers, one lens each, on `git diff main...feat/27-daily-termo-end-to-end`. `CLAUDE.md` names the lenses: correctness and bugs; security; quality and maintainability; performance; adherence to the ADRs and `CONTEXT.md`; adherence to #27. **This has not run at all on PR B's code.** Tell them what is known-deferred (§5) or the loop will not converge — landmine (d).
2. **Step 7 — apply the findings.** Expect two or three `fix:` commits; plan §24.4 R4 says so.
3. **Seed the preview buffer** (§6). Only after the content schema is frozen by step 7 — landmine (a): `daily_puzzles` rows are immutable and killed rows count as covered, so seeding early means a schema change 500s the route and only a hard `DELETE` recovers.
4. **`B11` — the impeccable arming commit.** `.github/workflows/impeccable.yml`, `/termo` and `/termo/concluido` in **all three** places (the preflight loop and both detect invocations). Plan §21.5. Pushed **last**, after seeding.
5. **`B12`** — re-derive `docs/agents/test-ids.md`'s frontier. Plan §19.9. #27 allocates ~56 ids.
6. **Verify `npx impeccable detect`** green on both new routes at both viewports, against the seeded preview.
7. **Merge PR #77 and close #27.** Then run `/handoff` for whatever comes next (#28 is M2's last).

---

## 3. Three facts that cost this session real time — do not re-derive them

**Drizzle builds an INSERT's column list from the table schema object, not the values object.** Adding `guesses` to `packages/db/src/schema.ts` changed the SQL for **all four games** — an omitted key is emitted as `default`, and `.returning()` selects it too. So a deploy that precedes the migration 500s `POST /completions` for every game, and because 500 is not in `sync.ts`'s `TERMINAL_STATUSES` the records replay — which, across a São Paulo midnight, silently reclassifies every user's on-time completion as late. **The migration is already applied** (§4); this is recorded so nobody "simplifies" the ordering rule back out.

**`termo-guess.ts` ⇄ `completion.ts` was an ESM cycle that throws `ReferenceError` at import in every consumer of `@miolos/core`** — fixed by moving `calendarDateString` into `contracts/daily.ts`. **`vitest` does not reproduce it**: its SSR transform hands the circular binding over as `undefined`, so module bodies complete and the failure moves to the first `.parse()`. **A green `pnpm test` is not evidence the cycle is absent.** The probe is a real `tsx` process:
```
cd apps/api && pnpm exec tsx -e "void import('@miolos/core').then(()=>console.log('OK')).catch(e=>{console.error(e);process.exit(1)})"
```

**`z.tuple` infers a MUTABLE tuple under zod 4.4.3 while the engine's `TileStates` is `readonly`.** Assigning the record's rows is `TS4104`/`TS2322` even per row, so `buildRecord` spreads: `state.guesses.map((row) => ({ guess: row.guess, tiles: [...row.tiles] }))` — the idiom `use-nonogram-play.ts:247` already ships. Never an `as`.

All four of plan §26's preflight probes (P-a…P-d) were **run and confirmed** at step 5; §26 carries their output.

---

## 4. The database — already migrated, and that is load-bearing

`packages/db/migrations/0003_omniscient_venom.sql` was generated by `drizzle-kit generate` and **hand-applied to Neon** before the branch was ever deployed. Verified live:

```
completions columns: user_id, game, date, completed_at, outcome, elapsed_ms, hints_used, guesses:integer?
completions_guesses_check = CHECK ((((game = 'termo') = (guesses IS NOT NULL))
                              AND ((guesses IS NULL) OR ((guesses >= 1) AND (guesses <= 6)))))
existing rows: 4/4 survived, all guesses = null
```

**Do not apply it again. Do not run `drizzle-kit migrate` against Neon** — every migration here is hand-applied and the journal is not authoritative. There is no `psql` on this machine; the apply was done with a throwaway script under `packages/db/` using `@neondatabase/serverless` and `DATABASE_URL_UNPOOLED` from `apps/api/.env.local` (pnpm's strict layout means the script must live inside `packages/db` to resolve the driver). Rollback, if ever needed: `ALTER TABLE completions DROP CONSTRAINT completions_guesses_check;` then `DROP COLUMN guesses`.

---

## 5. Known-deferred — show this list to the step-6 reviewers, up front

Landmine (d): #25's review loop ran four rounds without an empty pass, largely because reviewers kept raising a deliberately-sequenced-later item as blocking.

1. **`.github/workflows/impeccable.yml` is not armed yet** — that is `B11`, and its precondition is a database state no commit can carry.
2. **`docs/agents/test-ids.md` is not re-derived yet** — that is `B12`.
3. **The preview buffer is not seeded**, so `/termo` currently renders `DailyUnavailable` at HTTP **200**. That is the failure mode the CI preflight exists to catch, not a bug.
4. **`em 4/6` on the hub is deferred to #29**; a won Termo shows no result string at all rather than a wrong one.
5. **Issue #63's timer digit swing** — `/termo` renders no clock, so it is not a fourth surface. Not touched.
6. **Issue #67 (hint-button tab order)** — Termo has no hint button, so #67's option (ii) is foreclosed. #27 owes a comment on that issue; it has **not** been posted yet.
7. **`playRoutes` stays `Partial`** — filed as #75.
8. **A real screen-reader pass** (VoiceOver/NVDA) is owed by ADR-0042 consequence (e) and ADR-0043 decision 10, and jsdom cannot stand in for it.
9. **The 320px `apagar` browser measurement** — plan §12.6 carries a fallback ladder; the measurement was not taken.
10. **The five per-game `color: var(--accent*)` declarations** remain by design — ADR-0041's decision 1 was recut to permit a *literal* token where the measured ratio clears 4.5:1, and consequence (h) enumerates all thirteen.

---

## 6. Seeding the preview — the exact procedure

`CRON_SECRET` is Production-only, so seed by running the branch's own `topUpTermoBuffer` locally against the database — same code path, same validation, idempotent. Plan §21.4(b) has the full text; the shape is:

```
( cd apps/api && set -a && . .env.local && set +a && source ~/.nvm/nvm.sh && nvm use default >/dev/null && <run topUpTermoBuffer> )
```

Run it in a **subshell** so the exported `DATABASE_URL_UNPOOLED` does not outlive it. Paste the `{generated, depth, failures}` output into the PR.

**The seed decays one day per day** — `bufferDepth` counts rows with `date >= SP-today` — so "seed once" means *once after the schema is frozen*, and re-run if more than a day passes before the merge. `generated: 0` on a re-run is the success case only if the buffer is still full; assert on `depth` and `failures`, not on `generated`.

Pre-merge safety, and **verify it rather than assuming**: nothing deployed reads termo rows yet. On `main`, `stripDailyContent`'s termo arm threw and `ProjectedGame` excluded termo, so `getTodayDaily(db, "termo")` did not compile. `curl -s -o /dev/null -w '%{http_code}' https://api.miolos.app/daily/termo` should be **404**.

---

## 7. Environment

Every node/pnpm/npx command needs the nvm preamble, or you get the system node:

```
source ~/.nvm/nvm.sh && nvm use default >/dev/null && <command>
```

Node v24.18.1, pnpm 11.18.0. The gate, from the repo root — **`rm -rf apps/web/.next` first, every time**: `apps/web/next-env.d.ts:3` hard-imports the gitignored `.next/types/routes.d.ts`, only `next build` regenerates it, and a typecheck after a stale build is red for reasons unrelated to the diff.

```
rm -rf apps/web/.next && pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm bundle-check
npx impeccable detect <url>    # from the REPO ROOT only
```

Add `--force` to bypass turbo's cache. Pre-commit (Husky + lint-staged + typecheck + tests) is **never** bypassed with `--no-verify`.

Two observations from this session: **`impeccable detect` with ≥3 URLs in one invocation returned zero findings locally** (including with `--no-config` on pages that individually report findings) — intermittent, probably WSL resource pressure, and **CI's seven-URL invocation works fine**, so scan one URL per invocation locally with a positive control on each. And **`eslint-db-wall.test.ts`'s `T-LINT-1` sits near vitest's 5 000 ms default** at full concurrency — it passed in CI every time, but it is the thinnest budget in the suite.

The Impeccable workflow fires on `deployment_status` and produces **two runs per push**, one per Vercel project; the `miolos-api` one is filtered out at job level and reports as skipped. Find the `miolos-web` run.

---

## 8. Exit criteria

- Step-6 review loop closes on an **empty blocking/high** pass, with every dismissal written down in the PR (plan 020 §27 is the format; PR #73's dispositions comment is the recent precedent).
- `pnpm typecheck` / `pnpm lint` / `pnpm test` / `pnpm build` / `pnpm bundle-check` green with counts pasted.
- `npx impeccable detect` green on `/termo` and `/termo/concluido` at both viewports, against a **seeded** preview, with the preflight asserting page **content** (`data-play-state=` / `data-conclusion-state=`), not just a 200.
- `B11` and `B12` pushed last.
- The #67 comment posted.
- PR #77 merged, #27 closed.

---

## 9. Next free numbers

`docs/README.md` uses **one `NNN` sequence shared across every subdirectory**. This document took **023** (022 was the plan).

- **Next plan:** `docs/plans/024-issue-<n>-plan-<slug>.md`.
- **Next ADR:** `docs/adr/0046-<slug>.md`. ADRs keep their own sequence and owe no README row; a plan and a handoff each owe one.
- **Test ids:** `docs/agents/test-ids.md` is **stale until `B12`** — re-derive by grep before allocating:
  `grep -rhoE "T-(CORE|DB|API|WEB|LINT)-S[0-9]+[a-z]?" apps packages | sort -u | tail`

---

## 10. Kickoff prompt

Copy everything between the markers.

--------------- BEGIN KICKOFF ---------------

Continue Miolos #27 (M2: Daily Termo end-to-end). Read
docs/handoffs/023-issue-27-handoff-termo-mid-flight.md in full first.

Steps 1-5 of CLAUDE.md's eight-step flow are DONE: PR #77 is open with ten
commits, the plan is docs/plans/022-issue-27-plan-daily-termo-end-to-end.md,
and eight ADRs are committed. PR #73 already merged and closed #68.

Start at STEP 6 — the parallel code review on
`git diff main...feat/27-daily-termo-end-to-end`, multiple reviewers, one lens
each, in fresh subagents. Show them section 5 of the handoff (known-deferred)
before they start. Then step 7 (fix), then seed, then B11/B12, then merge and
close without Fernando.

Do not re-plan and do not re-implement. The database migration is already
applied — do not apply it again.

Every node/pnpm/npx command needs:
  source ~/.nvm/nvm.sh && nvm use default >/dev/null &&

--------------- END KICKOFF ---------------

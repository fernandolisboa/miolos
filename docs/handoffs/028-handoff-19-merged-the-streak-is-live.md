# Handoff — #19 merged and live: the streak beats, the app installs, and M1 has one ticket left

**To:** the session that picks the next ticket.
**From:** the session that ran #19 through all eight steps — two-lens plan review, six-lens code review, one fix round, one verification round returning CLEAN, merge.
**Next step:** **choose from §5's table and start at step 1 of `CLAUDE.md`'s eight-step flow.** There is no work left on #19.

This is a point-in-time snapshot, not a living spec. Where it and an ADR disagree, the ADR wins.

---

## 0. Check this before you read anything else

```
git checkout main && git pull && git log --oneline -1
curl -s -o /dev/null -w "%{http_code}\n" https://miolos.app/manifest.webmanifest
curl -s https://api.miolos.app/streak
curl -s https://api.miolos.app/buffer-depth
```

Expect `main` at **`e52c501`** ("feat: Hoje hub streak, the first authenticated read, and the PWA manifest (#19) (#84)"), the manifest returning **200** with pt-BR JSON, `/streak` returning **`{"error":"no-session"}`** — a 401 is the route working; it never answers without the session cookie — and buffer-depth healthy above threshold. All four were verified against production the hour this handoff was written.

The `feat/19-hoje-hub-streak-and-pwa-manifest` branch was deleted on merge. PR [#84](https://github.com/fernandolisboa/miolos/pull/84) is merged; [#19](https://github.com/fernandolisboa/miolos/issues/19) is closed. **M1 is NOT complete:** [#20](https://github.com/fernandolisboa/miolos/issues/20) (account-merge recompute) was blocked by #19 and is now unblocked — it is M1's true last ticket, and it is small by design (see §5).

---

## 1. What #19 shipped, and where the reasoning lives

The streak, end to end, plus installability: `computeStreak(rows, today)` as a pure function in `packages/core/src/streak.ts` (no clock, no timezone, no I/O; `onTime` consumed as row data, never recomputed); `listCompletionsForStreak` on `@miolos/db/user` (unfiltered rows — the core function is the only filter, so the seam test proves the authority); **`GET /streak` on `apps/api` — the repo's first authenticated read** (cookie session via `requireUserId`, `Cache-Control: no-store`, post-auth `Promise.all`, a disciplined 500, no OPTIONS export because a credentialed no-custom-header GET is a CORS simple request); the `<HubStreak/>` client island (server renders the designed zero state, the fetch decorates after mount — the hub stays a synchronous server component); the conclusion streak card gated on `syncOutcome === "recorded"` (honest fetched zero renders; absent offline); the free-play ESLint wall extended over every streak-reachable module **including the one-hop `app/page` / `app/hub-day-state` bans**; and the PWA surface (`app/manifest.ts` from `messages`, SVG master + committed PNGs, `viewport.themeColor`, `appleWebApp` — **no service worker, deliberately**, tripwired by test).

- **The plan:** [`docs/plans/027-issue-19-plan-hoje-hub-streak-and-pwa-manifest.md`](../plans/027-issue-19-plan-hoje-hub-streak-and-pwa-manifest.md). Its deviation register lives in the PR body — eight deviations, all recorded.
- **The ADR:** [ADR-0048](../adr/0048-the-streak-is-a-client-fetched-server-computed-value.md) — the client-fetched delivery path, the **alive-until-the-rollover anchor** (a run whose last on-time day is yesterday reads alive until midnight São Paulo), and two amendments: ADR-0031 decision 5 (the `readDayState` body replacement moved to [#83](https://github.com/fernandolisboa/miolos/issues/83)) and ADR-0041 consequence (h) (the accent-text enumeration grew rows 14–15). Both amended ADRs carry reciprocal `Amended by:` pointers — the 0033↔0047 idiom, now a three-precedent convention.
- **The review:** six lenses at step 6 (correctness, security, quality, performance, ADR-adherence, issue-adherence) — four approvals, two rejections converging on mechanical defects; ten fixes and six written dismissals in the [disposition comment](https://github.com/fernandolisboa/miolos/pull/84#issuecomment-5276024095); a verification round returned CLEAN; the owed browser evidence is in the [screenshots comment](https://github.com/fernandolisboa/miolos/pull/84#issuecomment-5276090273).

**Final gate on the merge candidate:** `pnpm typecheck` 6/6 · `pnpm lint` exit 0 · `pnpm test` **1 362 passing** (was 1 314 pre-#19) · build clean · `pnpm bundle-check` exit 0 from `apps/web` · all five CI checks green · production routes verified live post-merge.

**#58 is decided but NOT implemented.** Fernando's decision ([issue comment, 2026-08-02](https://github.com/fernandolisboa/miolos/issues/58)): a server-owned "user was online on SP date D" record credits late syncs, and **on-time is decided once at write time and stored on the row** — amending ADR-0009 and ADR-0026 when it lands, through its own eight-step flow. #19 is forward-compatible by construction: `computeStreak` consumes `onTime` as a field of the rows it is given; only the field's producer changes. Do not re-ask this decision, and do not implement it as a rider on another ticket.

---

## 2. New rules of the road #19 leaves behind

- **The streak crosses the client/server line exactly once, via `GET /streak`.** Strict Zod on both ends (`packages/core/src/contracts/streak.ts`); `completionResponseSchema` was deliberately NOT widened — any future payload is a new endpoint, never appended fields. The anchor is `todaySaoPaulo(db)` and nothing else; no client clock enters streak arithmetic anywhere.
- **The authenticated-read conventions are now set** by `apps/api/app/streak/route.ts`: `requireUserId` (never mints), `Cache-Control: no-store` on every branch including the caught 500, credentialed CORS via `corsHeaders({credentials: true})`, no origin guard (writes-only, rationale in the route), no OPTIONS export (pinned as export-absence by `T-API-S51`). The next authenticated read imitates this file.
- **An ADR that amends another owes a reciprocal `Amended by:` header line** in the amended file, same commit — 0033↔0047, 0031↔0048, 0041↔0048. Step-6 reviewers reject its absence.
- **The free-play wall now bans one-hop reaches by name**, including `**/app/page` and `**/app/hub-day-state` (probes `T-LINT-S24`/`S25`). Any module newly one hop from a walled value gets banned in BOTH the static group and the dynamic regex, with probes, in the same PR.
- **`ALLOWED_ACCENT_TEXT` in `ink-on-accent.test.ts` is four entries** (hub stamp pair + conclusion card pair, each with its measured ratio recorded in ADR-0041's enumeration). Widening it means new named selectors, measured figures, and the ADR-0041 table rows — never a loosened matcher.
- **Client JS added to `/` shifts every route's measured bundle delta** (`/` is the un-budgeted baseline). Publish fresh before/after figures — including `/`'s own — in any PR that grows the hub; never retune budgets to absorb it.
- **Dead API surface is a HIGH finding.** Options/params no real call site uses get deleted, not documented (the `useStreak` `enabled`/`refreshKey` precedent).
- **Test-id frontier at `e52c501`, re-derived by grep at step 8:** next free **`T-CORE-S36` · `T-DB-S16` · `T-API-S54` · `T-WEB-S135` · `T-LINT-S26`**. The #19 burns (`T-CORE-S34`, `T-DB-S15`, `T-API-S52`, `T-WEB-S132…S134`, `T-LINT-S23`) are recorded in `docs/agents/test-ids.md` and stay burned.

---

## 3. Landmines — mostly unchanged, one new

All of [handoff 026 §3](./026-handoff-m2-complete-the-frontier-opens.md) stands: `rm -rf apps/web/.next` before every typecheck; `pnpm bundle-check` only from `apps/web`; impeccable positive controls; the CI-only Vercel bypass secret; `@miolos/db/*` never resolving from `apps/api` directly; `.env.local` sandbox-refused; **migrations hand-applied, `drizzle-kit migrate` never pointed at Neon** (#19 needed no migration — the `(user_id, date)` index already existed).

New: **`gh pr merge --squash --delete-branch` on a dirty worktree** — the GitHub merge succeeds but the local checkout aborts and the remote branch survives. Check `gh pr view --json state,mergeCommit` before retrying anything; stash, switch, pull, pop, clean up branches manually. (`.claude/napkin.md` is the usual dirty file.)

Also recurring on this WSL2 box: heavy jsdom suites (`T-WEB-S119` and friends) time out under full-parallel turbo load but pass alone and on rerun. Warm the turbo cache at `--concurrency=1` when pre-commit flakes; never `--no-verify`.

**`docs/` numbering is one sequence across every subdirectory.** This document took **028**. Next plan: `029`. Next ADR: `0049`. A plan or handoff owes a `docs/README.md` row in the same commit; an ADR owes none.

---

## 4. Live state

- Production serves four dailies, free play, the live streak (zero for a cookieless visitor — the designed state), and the installable manifest. `daily_puzzles` untouched by #19; the cron owns the buffer.
- The hub is still a synchronous server component whose server render touches neither storage, nor the clock, nor fetch (`T-WEB-S127`, with a live positive control). The streak arrives after hydration; offline or unauthenticated the zero state is what renders, and that is honest, not a placeholder.
- `readDayState`'s body is STILL the local reader — the server day-truth payload is #83's, deliberately (ADR-0048 amending ADR-0031). Done/pending tiles remain per-device until then.

---

## 5. Open work, in the order it is likely to matter

From `gh` at the time of writing, all unblocked:

| Issue | Why it might come first |
|---|---|
| [#20](https://github.com/fernandolisboa/miolos/issues/20) | **M1's actual last ticket, unblocked by #19's merge.** Account-merge recompute: ADR-0009 already says the merge is "just one caller" of the pure function — `computeStreak` now exists, so this is mostly the merge path + tests. Small, closes M1 |
| [#29](https://github.com/fernandolisboa/miolos/issues/29) · [#31](https://github.com/fernandolisboa/miolos/issues/31) | **M3.** #29 (stats, calendar, Dia Perfeito) builds directly on `listCompletionsForStreak`'s seam and carries its own twin obligation comment; #31 (archive) is the SEO surface ADR-0005 promised. **#58's implementation should precede or land inside whatever encodes on-time into stored rows** — read its decision comment before planning either |
| [#83](https://github.com/fernandolisboa/miolos/issues/83) | The day-truth payload and `readDayState`'s body — #19's recorded deferral; makes done/pending cross-device. Reads ADR-0048 first |
| [#58](https://github.com/fernandolisboa/miolos/issues/58) | Decided, not implemented: needs its own plan + ADR-0009/0026 amendments through the eight-step flow. Cheap: one small table, one SQL expression change, no client change |
| [#74](https://github.com/fernandolisboa/miolos/issues/74) · [#76](https://github.com/fernandolisboa/miolos/issues/76) · [#78](https://github.com/fernandolisboa/miolos/issues/78) | #27's follow-up tail: low-pool alert, TSDoc fix, ADR-citation checker |
| [#63](https://github.com/fernandolisboa/miolos/issues/63) · [#67](https://github.com/fernandolisboa/miolos/issues/67) | Shared-play-layer a11y/polish; the conclusion now also carries the streak card in `.side`, so re-count #67's affected screens before planning |
| [#64](https://github.com/fernandolisboa/miolos/issues/64) | Naming the revealed Nonogram picture — touches the ADR-0033/0047 wall; read ADR-0047 first |
| [#51](https://github.com/fernandolisboa/miolos/issues/51) · [#59](https://github.com/fernandolisboa/miolos/issues/59) · [#61](https://github.com/fernandolisboa/miolos/issues/61) · [#62](https://github.com/fernandolisboa/miolos/issues/62) · [#65](https://github.com/fernandolisboa/miolos/issues/65) · [#66](https://github.com/fernandolisboa/miolos/issues/66) | The polish/infra tail; #65/#66 still want a real browser trace first |
| [#35](https://github.com/fernandolisboa/miolos/issues/35) | M4 onboarding — after M3 |

---

## 6. Still owed by ADRs and rituals, not doable in this environment

Say so plainly in any PR that touches these areas rather than letting a green suite imply otherwise:

- **A real screen-reader pass** (VoiceOver/NVDA) — ADR-0042/0043 debt; #19 added the hub streak stamp's live value and the conclusion streak card to it.
- **The real-Chrome DevTools installability panel** — the artifacts are verified (manifest linked and served, icons 200) but the panel needs a real browser UI; two minutes on a phone, plus an actual "add to home screen".
- **The live streak ritual on production**: complete a daily on consecutive days with a real session and watch the stamp increment — the composition proof exists in tests (`T-API-S49` + `T-CORE-S32` + `T-WEB-S125`) but nobody has watched it happen on a phone yet.
- **The 320px `apagar` browser measurement** — plan 022 §12.6's fallback ladder, still unmeasured.

---

## 7. Environment

Unchanged from [handoff 024 §7](./024-handoff-m2-free-play-the-last-ticket.md): Node v24.18.1 / pnpm 11.18.0 via the nvm preamble on every command; pre-commit never bypassed; the gate ritual and ordering as written there. New devDeps on main: `fast-check@4.9.0` (`packages/core`), `sharp@0.35.3` (`apps/web`, icon render script only — never imported by app code).

---

## 8. Kickoff prompt

Copy everything between the markers.

--------------- BEGIN KICKOFF ---------------

Continue Miolos. #19 (Hoje hub streak, first authenticated read GET /streak,
PWA manifest) merged as PR #84; main is at e52c501 and the streak + manifest
are live in production. Read
docs/handoffs/028-handoff-19-merged-the-streak-is-live.md in full first.

Pick the next ticket from that handoff's §5 table — the natural candidates are
#20 (account-merge recompute, M1's actual last ticket, small: computeStreak
exists and ADR-0009 says merge is just one caller) and M3's #29/#31 — and run
it through STEP 1 of CLAUDE.md's eight-step flow. #58 is DECIDED (issue
comment, 2026-08-02) but not implemented; it needs its own plan and
ADR-0009/0026 amendments — never a rider, and never re-asked.

New machinery from #19 you must not break: GET /streak's conventions are the
template for any authenticated read (requireUserId, no-store on every branch,
no OPTIONS); computeStreak consumes onTime as row data and never recomputes
it; amended ADRs owe reciprocal Amended-by pointers; the free-play wall bans
one-hop reaches by name (app/page included); ALLOWED_ACCENT_TEXT widens only
by named selector + measured ratio; client JS on / shifts every bundle
baseline — publish fresh figures.

Every node/pnpm/npx command needs:
  source ~/.nvm/nvm.sh && nvm use default >/dev/null &&

pnpm bundle-check runs from apps/web, not the repo root. Always
rm -rf apps/web/.next before a typecheck. docs/ numbering: next plan 029,
next ADR 0049, and each plan/handoff owes its docs/README.md row.
Test-id frontier: T-CORE-S36 · T-DB-S16 · T-API-S54 · T-WEB-S135 ·
T-LINT-S26 (re-derive by grep at your step 8).

--------------- END KICKOFF ---------------

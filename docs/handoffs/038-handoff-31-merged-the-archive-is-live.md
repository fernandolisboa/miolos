# Handoff — #31 merged: the archive is live, and M3's last pillar is done

**To:** the session that picks the next ticket.
**From:** the session that ran #31 through all eight steps and shipped it as **two sequenced pull requests** — **two step-3 rounds** over the plan (four lenses then two, **~61 findings**, both REJECT, taking it to revision 3), **two step-6 rounds** over the two branches (**six lenses then seven, 54 findings**, eleven of the thirteen REJECT), a step-7 verification round on each branch, then merge and close.
**Next step:** **pick from §5's table and start at step 1 of `CLAUDE.md`'s eight-step flow.** The natural next ticket is **[#34](https://github.com/fernandolisboa/miolos/issues/34)** — it is now unblocked and #31 built most of its substrate.

Point-in-time snapshot; where an ADR disagrees, the ADR wins.

---

## 0. Check this before you read anything else

```
git checkout main && git pull && git log --oneline -2
curl -s https://api.miolos.app/health
TODAY=$(TZ=America/Sao_Paulo date +%F)
for u in /arquivo /sitemap.xml /robots.txt /arquivo/2026-08-01 \
         /arquivo/2099-01-01 /arquivo/2099-01-01/sudoku \
         /arquivo/mes/0000-01 /arquivo/2026-02-30; do
  printf "%-34s %s\n" "$u" "$(curl -s -o /dev/null -w '%{http_code}' "https://miolos.app$u")"
done
curl -s -o /dev/null -w "today -> %{http_code} %{redirect_url}\n" "https://miolos.app/arquivo/$TODAY"
curl -s -o /dev/null -w "today/sudoku -> %{http_code} %{redirect_url}\n" "https://miolos.app/arquivo/$TODAY/sudoku"
```

Expect `main` at **`e784633`** ("feat: the archive — /arquivo index, months, days and four playable past dailies (#31, PR 2 of 2) (#95)") on top of **`d4d8655`** (PR 1 of 2), or a descendant. Health `ok`.

Verified against production after the post-merge deploy, on 2026-08-14:

| URL | Result |
|---|---|
| `/arquivo` · `/sitemap.xml` · `/robots.txt` | **200** |
| `/arquivo/2026-08-01` | **200** — the real floor, no backfill; the archive is exactly as deep as the data |
| `/arquivo/mes/2026-08` | **200** |
| `/arquivo/2099-01-01` · `/arquivo/2099-01-01/sudoku` | **404** through the ADR-0004 wall |
| `/arquivo/mes/0000-01` · `/arquivo/2026-02-30` | **404** — the two parse traps (I45's `0000` SQLSTATE 22008 500, and a real-looking impossible date) |
| `/arquivo/<hoje>` | **307 → `https://miolos.app/`** |
| `/arquivo/<hoje>/sudoku` | **307 → `https://miolos.app/sudoku`** |

`sitemap.xml`: **70 `<loc>`s** — **7** static (`/`, `/modo-livre` and its three games, `/privacidade`, `/arquivo`), **1** month (`/arquivo/mes/2026-08`), **13** day pages (`2026-08-01` … `2026-08-13`) and **49** play URLs (not 52: a day is listed only for the games it actually holds). **Zero** dates beyond today; today itself absent. `robots.txt` allows `/`, disallows `/vincular`, points at the sitemap.

**No migration.** #31 shipped **no schema change at all** — `git diff` on `packages/db/src/schema.ts` and `packages/db/migrations` is 0 lines across both PRs. There is nothing to apply and nothing to check in Neon.

---

## 1. What #31 shipped, and where the reasoning lives

Two PRs, in a **deploy order that is now a rule** (ADR-0053 decision 15, §2 below).

**PR [#94](https://github.com/fernandolisboa/miolos/pull/94) (`d4d8655`) — the write window.** `ACCEPTED_DAYS_BACK` held two ideas under one name and split, one owner each (`apps/api/src/publishing/dates.ts`): **`ROLLOVER_SLACK_DAYS = 1`** is the *calendar clamp* (fed to `computeCalendar`, `packages/core/src/stats.ts`), and **`isWritableDate` / `isLateDate`** are the *write window* — lower bound removed, so any published past date is writable, with a route-level **future** bound that is new. The abuse trade is stated as *what forgery buys*, not what it costs, on ADR-0006's terms. The ceiling: **50 late writes per user per São Paulo day**, `ARCHIVE_WRITES_PER_DAY` in `apps/api/app/completions/route.ts`, refused as `429 archive-cap`, and enforced **inside `recordCompletion`'s own INSERT** (`packages/db/src/completions.ts`, `guardedInsertSelect` + the `LateWriteCeiling` overload) rather than as a preceding `count(*)`. The record: **ADR-0053**, amending **eight** standing records with **ten** new reciprocal `Amended by:` lines — eight naming 0053 (0008, 0014, 0024, 0026, 0028, 0038, 0039, 0051) plus **two repairs on ADR-0014** (its missing 0028 and 0031 lines, added at `d4d8655`). The plan went in claiming **seven**; ADR-0039 was found by the fourth audit pass, and the ADR says why it was missed by the first three — *an ADR ruled on for one reason is not thereby ruled on for all*, because 0039 had already been **cleared** on a different sentence.

**PR [#95](https://github.com/fernandolisboa/miolos/pull/95) (`e784633`) — the archive.** Three archived-day readers plus a clock classifier in `packages/db/src/published.ts` — `getArchivedDaily`, `listArchivedDays`, `listArchivedMonths`, `archiveDateClass` — all spelling the wall exactly once through the shared private **`publishedConjuncts()`** and **`saoPauloToday()`**, with `archivedWallPredicate` adding the single `date < saoPauloToday()` conjunct. All four plus `ArchivedDay` are on the **root barrel** (`packages/db/src/index.ts`). Routes: `/arquivo`, `/arquivo/mes/[mes]`, `/arquivo/[data]` and **four literal** `/arquivo/[data]/{binairo,sudoku,nonogram,termo}` play routes (literal, not a `[jogo]` segment). `app/sitemap.ts` and `app/robots.ts`, over a new `apps/web/src/site-origin.ts` and its **`absoluteUrl()`** (Next does not resolve a sitemap `url` against `metadataBase`). Archive play shells in `apps/web/src/archive/` consume the **per-game hooks and views**, never the four `*-screen.tsx` roots — pinned by `T-WEB-S183`, whose forbidden set includes those roots. The **late-result panel** (`src/archive/late-result.tsx`) with **five** arms in refusal order: not-read/no-record → `pendingSync` → `syncOutcome: "rejected"` → `alreadyConcluded` → settled `recorded`. **Bounded retention** in `prunePlayRecords` (`RETAINED_PAST_RECORDS = 50`, same fifty as the ceiling, pending records kept forever). **`isClosedAndFrozen(state: PlayCore)`** extracted to `src/play/use-play-lifecycle.ts` and called by the hook and **all eight** screens (four daily roots + four archive shells), replacing three spellings and nine copies. `ArchivePlayChrome` moved to `src/play/types.ts`. And the `sync.ts` `break` on the first 429 — with the queue **sorted newest-date-first**, which is what makes the `break`'s own reasoning true.

- **The plan:** [`docs/plans/037-issue-31-plan-archive.md`](../plans/037-issue-31-plan-archive.md) — §14 carries **eight batches** (I1–I71). Read it before touching any of this; §2 below is the short list of what it forbids.
- **The ADR:** [ADR-0053](../adr/0053-the-archive-is-a-public-past-only-read-and-a-late-write.md) — **fifteen** decisions.
- **Dispositions:** the full finding-by-finding record is in the two PR bodies ([#94](https://github.com/fernandolisboa/miolos/pull/94), [#95](https://github.com/fernandolisboa/miolos/pull/95)).

**Four catches worth carrying forward as pattern, not incident:**

1. **A reviewer *ran* the typed-routes probe the plan prescribed, and it returns a false positive.** `typedRoutes` is not enabled in this repo, so `<Link href="/does-not-exist">` typechecks clean. The plan would have recorded a verified-nothing as evidence and the premise was deleted (plan §14 D7). *A probe is evidence only once someone has watched it fail.*
2. **The 50/day ceiling was originally check-then-act.** A `count(*)` then an INSERT: every request in a `Promise.all` reads the same snapshot, passes the same comparison, writes. The counter-factual is pinned as a test — `T-DB-S56a`, twenty concurrent late writes against a ceiling of ten: **20 rows the old way, exactly 10 the new way**, with `T-DB-S58` proving the guarded form renders as **one statement** through both the PGlite and neon-http dialects, because the ceiling is a correctness property only while it is one statement.
3. **The `break` on 429 head-of-line-blocked *today's* daily.** The cap only ever fires on a late date, but an unordered queue could put archive records ahead of today's on-time completion; the `break` would then hold it until after the rollover, where it flushes as `on_time = false` — **a permanently lost streak day**, from a feature that is supposed to be unable to touch the streak. Fixed by sorting the queue newest-date-first (I44).
4. **Two calendar bombs, neither reachable by any commit.** The month page failed `impeccable detect` `first-viewport-column-overflow` from the **21st row** — production's archive was 13 days old, so CI was green and would have gone red around **2026-08-22**. And the *fix round's own relabel* (`← <mês>` → `Mês anterior · <mês>`) made a **31-character** uppercase link that trips `all-caps-body` (>30 chars of direct text under `text-transform: uppercase`), which would have gone red in **fevereiro, setembro, novembro and dezembro — forever**. Both were found by rendering the shipped stylesheet at future sizes rather than trusting a passing gate, and both are pinned by tests (`T-WEB-S169`'s DOM half applies impeccable's own predicate over all twelve months).

Plus: **four separate lenses independently converged** on the late-result panel claiming registrations the server had refused — including the `killed_at` kill-switch 404, where an operator withdrew a puzzle mid-board and the panel said "registrada". Resolved as one defect (F3/F5/F16 → I42), not three patches.

**Final gate at `e784633`:** typecheck 6/6 · lint 0 · **1,673 tests, 155 files, nothing cached** (`@miolos/games` 187 · `@miolos/ui` 3 · `@miolos/core` 205 · `@miolos/db` 97 · `@miolos/web` 935 · `@miolos/api` 246) · bundle green, **no budget retuned** · impeccable green at 4 viewports, from CI run [`31829557884`](https://github.com/fernandolisboa/miolos/actions/runs/31829557884) · `git reflog … | grep -c no-verify` → **0**.

---

## 2. New rules of the road #31 leaves behind

- **One spelling of the wall, one spelling of the clock.** Every archive reader spreads `publishedConjuncts()` and derives "today" from `saoPauloToday()` — a second timezone literal or a second published-predicate is the bug ADR-0004 exists to prevent. `T-DB-S53b` is the source scan that enforces it, and it counts `killedAt` appearing **once in the file at all**, not merely once inside an `isNull`.
- **The archive's floor is the data's own.** Nothing records a start date; `/arquivo` shows what is published and past, and that is why `2026-08-01` is the floor today with no backfill anywhere.
- **`force-dynamic` everywhere on the archive, and `revalidatePath` before any caching.** Seven pages plus `sitemap.ts` and `robots.ts`: no `revalidate`, no `generateStaticParams`, no `fetch` on any server path. The reason is the **kill switch**, not the rollover — `killed_at` is a database write with no deploy and no invalidation hook, so a cached page outlives a takedown for the whole TTL. **ADR-0053 decision 2's standing precondition:** a `killed_at` writer must call `revalidatePath` **first**; cache-then-invalidate is the wrong order. This is the load-bearing open flag (§6).
- **The two-PR deploy ordering is a rule, not a preference** (ADR-0053 decision 15). A write-window change ships and **deploys** before the routes that produce those writes exist, gated by a timestamp in the second PR's body earlier than its first commit. It runs backwards too: **rolling back the window PR while the routes are live must be paired with rolling back the routes.** The window it closes is real — 404 is in `sync.ts`'s terminal set, so in any gap where the web has archive routes and the API still refuses old dates, every archive completion is silently and **irreversibly** discarded, and then the prune is entitled to delete it.
- **Archive play composes hooks and views, never screen roots.** `T-WEB-S183` forbids `conclusion-view`, `termo-conclusion`, `nonogram-conclusion`, `readDayState` **and** the four `*-screen.tsx` roots inside `src/archive/`. `T-WEB-S185` asserts byte-identity of each archive shell against its daily twin when absent, parameterised over all four games.
- **The write window's two halves have one owner each.** `ROLLOVER_SLACK_DAYS` is the calendar clamp; `isWritableDate` / `isLateDate` are the write window. They may move independently — that is the whole point of the split — and `ACCEPTED_DAYS_BACK` no longer exists.
- **Date-bearing gate URLs are DISCOVERED from the app, never hardcoded.** `.github/workflows/impeccable.yml` walks `/arquivo` → month → day → play, validates each discovered path against a shape pattern, and skips the date-bearing scans with a printed reason when the archive is empty.
- **Test-id frontier at `e784633`, re-derived by grep** (`grep -rhoE "T-<AREA>-S[0-9]+[a-z]?" apps packages`, excluding `.next` and `node_modules`): next free **`T-CORE-S86` · `T-DB-S59` · `T-API-S109` · `T-WEB-S189` · `T-LINT-S39`**; highest in use S84 / S58 / S107 / S186 / S37. **`T-WEB-S187`, `T-WEB-S188` and `T-LINT-S38` are burned unspent** — #31's reserved review-round headroom. `docs/agents/test-ids.md` is current. Two same-file duplicates in one branch is what `T-DB-S53a/b`, `T-WEB-S177a`, `T-WEB-S186a` cost: **a new assertion inside a landed id takes the sibling letter; `apps/web` puts the id on the `describe` only.**

---

## 3. Landmines

All of [handoff 036 §3](./036-handoff-30-merged-medals-live.md) and [handoff 034 §3](./034-handoff-29-merged-m3-opens.md) stand. The ones that cost this session real time, with their evidence:

- **The nvm preamble.** `source ~/.nvm/nvm.sh && nvm use default >/dev/null && …` on every node/pnpm command.
- **`TURBO_CONCURRENCY=1` on every commit and on any gate run you paste as evidence.** Not decoration: at full fan-out this session saw **two** `pnpm test --force` runs each fail once, differently and non-reproducibly — `packages/games` `P2 — determinism` (a file this work never touched) and `apps/web` `T-LINT-S9` — both green in isolation and both green serialised. A flake at full concurrency is not a finding about your branch.
- **`--force` for evidence.** Turbo caches gate runs; a cached re-run is a log replay, not a result. Note that `pnpm lint` is a **root** script (`eslint --max-warnings 0 .`) — it is never turbo-cached and `--force` is not a valid eslint flag.
- **`rm -rf apps/web/.next` before typecheck deletes the stats file `pnpm bundle-check` reads** — run `pnpm build` in `apps/web` before `bundle-check` whenever `.next` was wiped. `bundle-check` is a **manual** gate: nothing in CI, turbo or a git hook invokes it, so the criterion is the pasted output.
- **`impeccable detect` is per-viewport** — check both steps of the detect job.
- **NEW, and the sharpest thing this session learned: a gate whose input is data- or copy-dependent can go red on the calendar with no commit.** Today's green does not imply tomorrow's; `impeccable`'s thresholds are literal and are measured against *rendered* text. On any page whose CONTENT grows with the calendar, or whose LABEL is a template, **seed the worst case and render it** — a 31-row month, the longest month name — rather than trusting the green you have. Both of #31's calendar bombs (§1) were invisible to CI and to every commit. Reproduce locally with `impeccable detect file://…` over the real component and the **real stylesheet** (CSS-module names unhashed), and pin the shape with a test. The napkin was curated for exactly this at **`2d18f7a`** — read item 9 and stay consistent with it.

**`docs/` numbering:** plan 037 and handoff 038 are taken. Next plan/handoff: **`039`**. Next ADR: **`0054`**.

---

## 4. Live state

- Production: four dailies, free play, streak, stats/calendar/Dia Perfeito, medals — **plus the whole archive**: `/arquivo`, month pages, day pages and four playable past dailies per day, all public, unauthenticated, uncached and indexable, with `sitemap.xml` and `robots.txt` live.
- **Late completions finally have a writer.** Any published past date is writable, capped at 50 per user per SP day. `on_time = false` rows are now producible in production for the first time — every consumer of `onTime` is live against real late data from today.
- The archive's floor is `2026-08-01` and it deepens by one day per rollover. 13 archived days at merge.
- Termo **is** in the archive, all four games are archivable, and an archived Termo reveals the day's word on **both** outcomes.
- The attach flow stays **DORMANT** (no `RESEND_API_KEY`); activation is still Fernando's checklist in [handoff 032 §6](./032-handoff-21-merged-m1-complete.md).
- `medal_grants` still empty; the **founder grant** still waits on [#37's checklist](https://github.com/fernandolisboa/miolos/issues/37#issuecomment-5289169618).
- `readDayState` still local ([#83](https://github.com/fernandolisboa/miolos/issues/83)); [#58](https://github.com/fernandolisboa/miolos/issues/58) still decided-not-implemented — and #31 makes it materially more interesting, because late rows now exist.
- **No schema change and no migration** since `0005` (`medal_grants`, #30).

---

## 5. Open work, in the order it is likely to matter

| Issue | Why it might come first |
|---|---|
| [#34](https://github.com/fernandolisboa/miolos/issues/34) | **Unblocked by #31 and the natural next ticket.** Sharing — spoiler-free results and OG cards. It inherits most of its substrate already built: the **per-day-per-game URLs** (`/arquivo/<data>/<jogo>`, with today's date 307-ing to the daily so a link shared right after playing lands correctly — flag F2), the three archived-day readers **on the root barrel**, **`absoluteUrl()`** in `src/site-origin.ts`, and `getTodayDaily`'s TSDoc, whose `ProjectedGame` invariant was **repointed from #31 to #34** and must not be moved a third time. Note the threat-model line #94 recorded: #34 is where a self-minted volume medal first becomes socially visible |
| [#96](https://github.com/fernandolisboa/miolos/issues/96) | **Filed this session**, `ready-for-agent`. The archive day page shows no per-game done state — deferred from #31's fix round as a feature rather than a repair (plan 037 §14 **I60**, step-6 design finding F10c). Small, self-contained, and the issue already names its files, its ADR-0031 constraints and the `usePriorConclusion` → `useRecordSnapshot` swap it needs |
| [#32](https://github.com/fernandolisboa/miolos/issues/32) | M3's remaining pillar — streak-at-risk notifications. Reminder consent stored since #21, never acted on. One push type only |
| [#33](https://github.com/fernandolisboa/miolos/issues/33) | M3 — PostHog telemetry. No session replay |
| Attach activation | Fernando's checklist (handoff 032 §6) — still pending, attach still invisible |
| [#58](https://github.com/fernandolisboa/miolos/issues/58) · [#83](https://github.com/fernandolisboa/miolos/issues/83) | The late-sync decision (own plan + ADR-0009/0026 amendments; T-DB-S24 armed) and cross-device day state. #58 is sharper now that late rows have a real writer |
| [#37](https://github.com/fernandolisboa/miolos/issues/37) | Launch hardening — inheritance grew again: the founder grant, the `revalidate = 60` decision if F1 flips, the crawler-read figures (≈5,550 Neon round trips per full crawl of a three-year sitemap), the AC-3 residuals, the `last_seen_at` constraint |
| [#74](https://github.com/fernandolisboa/miolos/issues/74) · [#76](https://github.com/fernandolisboa/miolos/issues/76) · [#78](https://github.com/fernandolisboa/miolos/issues/78) · [#63](https://github.com/fernandolisboa/miolos/issues/63) · [#67](https://github.com/fernandolisboa/miolos/issues/67) · [#64](https://github.com/fernandolisboa/miolos/issues/64) · [#51](https://github.com/fernandolisboa/miolos/issues/51) · [#59](https://github.com/fernandolisboa/miolos/issues/59) · [#61](https://github.com/fernandolisboa/miolos/issues/61) · [#62](https://github.com/fernandolisboa/miolos/issues/62) · [#65](https://github.com/fernandolisboa/miolos/issues/65) · [#66](https://github.com/fernandolisboa/miolos/issues/66) | The polish/infra tail |
| [#35](https://github.com/fernandolisboa/miolos/issues/35) · [#36](https://github.com/fernandolisboa/miolos/issues/36) | M4 — onboarding, settings and paper-dark theme |

---

## 6. Fernando's open flags from #94/#95 (non-blocking, adjustable without re-review)

All eight were raised on PR #94 and **none moved** on #95. Three (F3, F4, F8) are implemented in code; the rest are recorded decisions.

1. **F1 — the load-bearing one. The issue calls these pages cacheable; they ship uncached.** `force-dynamic`, because a `killed_at` takedown has no invalidation hook. `export const revalidate = 60` would bound takedown latency to sixty seconds and cut crawler-driven database reads by roughly two orders of magnitude. **The standing precondition before any caching lands is `revalidatePath` in the `killed_at` writer, first** — cache-then-invalidate is the wrong order (ADR-0053 decision 2).
2. **F2 — `/arquivo/<hoje>` and `/arquivo/<hoje>/<jogo>` resolve** (307 to the hub and to the daily) rather than 404, because #34's AC is that a shared link lands on the exact day/game page and sharing happens right after playing.
3. **F3 ✅ — pre-birth late completions are off-calendar.** Solving a day from before your account existed moves your totals but paints no calendar cell.
4. **F4 ✅ — a lost Termo counts in the fail row whether on time or from the archive** (ADR-0008 rule 3 as written). **#31's AC 3 as literally worded is therefore not met**, because the fail row is part of the guess distribution and it moves; `T-API-S100` asserts that it moves. **This one still wants a confirmation.**
5. **F5 — Termo is playable in the archive**, reversing the pattern free play set. Its answer was already spent as that date's shared daily, so nothing is burned.
6. **F6 — there is no archive conclusion URL.** A closed archived board swaps to the late-result panel in place, on the same URL.
7. **F7 — replaying a day you already solved shows the stored result *after* you finish it, not before.**
8. **F8 ✅ — 50 late completions per São Paulo day**; the 51st stays queued and lands tomorrow. The number is **chosen, not measured** — there is no traffic to measure — above the largest plausible human session (a full week of all four games is 28) and two orders of magnitude below the 4,380 an uncapped three-year archive allows one identity.

Plus the standing debts: attach activation ([handoff 032 §6](./032-handoff-21-merged-m1-complete.md)), #30's four medal flags ([handoff 036 §6](./036-handoff-30-merged-medals-live.md)), and the #29-era product-copy flags ([handoff 034 §6](./034-handoff-29-merged-m3-opens.md)).

# Handoff — #29 merged: stats, calendar and Dia Perfeito land, and M3 is open

**To:** the session that picks the next ticket.
**From:** the session that ran #29 through all eight steps — two-lens plan review (both rejected, 23 findings fixed), six-lens code review (one HIGH honesty bug in the calendar clamp found and closed, plus a CI-caught mobile layout red), one fix round of 25 findings, a verification round that came back CLEAN first try, merge.
**Next step:** **pick from §5's table and start at step 1 of `CLAUDE.md`'s eight-step flow.** There is no code work left on #29.

Point-in-time snapshot; where an ADR disagrees, the ADR wins.

---

## 0. Check this before you read anything else

```
git checkout main && git pull && git log --oneline -1
curl -s https://api.miolos.app/health
curl -s https://api.miolos.app/stats
curl -s -o /dev/null -w "%{http_code}\n" https://miolos.app/estatisticas
```

Expect `main` at **`39b0341`** ("feat: stats, calendar, and Dia Perfeito — pure derivations on closed contracts (#29) (#90)") or a descendant, health `ok`, `/stats` answering **`{"error":"no-session"}`** (the route working, cookieless), `/estatisticas` **200**. Verified against production the hour this was written, after the post-merge deploy.

---

## 1. What #29 shipped, and where the reasoning lives

The statistics stack end to end: **`packages/core/src/stats.ts`** (pure derivations — `perfectDays`, `computeCalendar` with the won-only clamped range, `computeStats` with the fail row counting ALL lost rows unqualified, three-game times with a 30-day average window and `averageSampleCount`, `todayTermoGuesses` as a total min-reduction); **`packages/core/src/date.ts`** (the `epochDay` hoist out of `streak.ts` plus its guarded inverse `dateFromEpochDay` and the exported `MIN/MAX_EPOCH_DAY` bounds); **two closed contracts** (`GET /stats`, `GET /stats/calendar` — strict, parsed both ends, no request parameters, growth is a new endpoint per ADR-0048 D3; the calendar payload is `{days}` only, dates validated by `calendarDateString` so a malformed 200 fails at `safeParse` instead of throwing in render); **two authenticated-read routes** cloning the streak template; **one unfiltered db reader** (`listCompletionsForStats`, projecting `guesses` for the first time) plus `getUserSince`, both on `@miolos/db/user`; **the `/estatisticas` screen** (F5 stat rows, accent-bar/ink-label histograms, the Termo 7-row distribution, the calendar with geometry-first state carriers — filled/outlined/empty plus a paper-diamond perfect mark); **the conclusion stat block** behind the `syncOutcome === "recorded"` gate AND a `stats.date === date` day-match for every today-decoration; **the hub's `em 4/6`** via `TermoDoneLink`, which owns the whole done anchor for a completed Termo (`DayEntry` gained nothing).

- **The plan:** [`docs/plans/033-issue-29-plan-stats-calendar-dia-perfeito.md`](../plans/033-issue-29-plan-stats-calendar-dia-perfeito.md) — §13 carries ten deviations, all recorded with reasons.
- **The ADR:** [ADR-0051](../adr/0051-statistics-are-read-time-derivations-on-closed-contracts.md) — six decisions. It **amends nothing** (audited three times: plan review, step 6, verification). Its decision 3 carries the revisit triggers (~1,100 days / 64 KB ≈ 1,210 days / ~2,000 DOM elements / ~4,000-row hot read), its consequences name the recorded-gate post-paint insertion #37 must measure on a warm profile, and the single legal device-clock read (the settled-null neutral month title).
- **The review:** six lenses. The ADR lens found the real bug of the ticket — the calendar clamp extended its range for ANY pre-range row, so a 00:20 account that played and lost yesterday's Termo got "sem conclusão" painted on a pre-birth day; closed by the **won-only clamp** (extension days must carry their own won row). CI's impeccable mobile scan caught a first-viewport-column-overflow on `/estatisticas`, closed by making the mobile layout block flow. Disposition (all 25 findings + four written no-change dispositions): [PR #90 disposition](https://github.com/fernandolisboa/miolos/pull/90#issuecomment-5288063897).
- **Recorded residuals (read before touching this area):** a late-lost Termo row will enter the fail row when #31 creates one (ADR-0008 rule 3 as written — "played" is not a "late completion"; forward-flagged to #31); the session `last_seen_at` write on cookieless GETs is replicated from `/streak` and must be revisited if #37 makes session lifetime load-bearing; `ConclusionStats` rides the play routes (~6.8 KB each, budgets green — the number the next play-route change inherits).

**Final gate:** typecheck 6/6 · lint 0 · **1,502 tests** (was 1,447 pre-#29) · bundle-check all budgets green (`/` 822.6 KB raw, `/estatisticas` −9.1 KB below `/` under its 40 KB budget, `/termo` ~10 KB headroom) · impeccable green both viewports after the mobile fix · CI green on main post-merge.

---

## 2. New rules of the road #29 leaves behind

- **The stats read conventions:** every server-sourced user aggregate is a pure derivation over `listCompletionsForStats`'s unfiltered rows, exclusions live in `packages/core` where seam 2 tests them, and a new consumer means a NEW endpoint/contract — `statsResponseSchema` and `statsCalendarResponseSchema` are closed. #30's medals follow this shape (own endpoint, derivations over the same `StatsRow` reader, medal display slots into the stats screen's documented comment slot between summary and per-game blocks).
- **Response-date fields that feed throwing parsers use `calendarDateString`**, not `isoDateString` (the F14 rule). `statsResponseSchema.date` stays `isoDateString` because it feeds only equality checks — the asymmetry is commented in the contract.
- **Today-decorations on fetched aggregates gate on `stats.date === <the record's date>`** — "recorded" proves the row is on the server, NOT that the server still holds that date as today (the midnight-boundary rule, now in ADR-0051's consequences and `conclusion-view.tsx`'s gate comment).
- **`apps/web/src/i18n/sao-paulo-day.ts` is the single client-side SP-day helper** — `app/page.tsx` and `stats-view.tsx` both import it; never re-copy it.
- **`Intl.DateTimeFormat` instances are module-scope** in `format.ts` — constructing one per call was measured at 40× the cost.
- **Test-id frontier at `39b0341`, re-derived by grep:** next free **`T-CORE-S70` · `T-DB-S37` · `T-API-S92` · `T-WEB-S160` · `T-LINT-S33`**. #29 spent every reserved id plus S91 and five sibling letters; all recorded in `docs/agents/test-ids.md`.

---

## 3. Landmines

All of [handoff 032 §3](./032-handoff-21-merged-m1-complete.md) stands (nvm preamble; `.next` wipe before typecheck; bundle-check needs a build after the wipe; napkin stash before `gh pr merge`; migrations never via `drizzle-kit migrate`; preview-shares-prod-DB push ordering). New from this session:

- **`TURBO_CONCURRENCY=1` on every `git commit`** — pre-commit runs the full suite and PGlite `beforeAll` hooks flake non-deterministically under turbo's parallel fan-out on this machine. All ten of this session's commits passed with the prefix; several failed without it.
- **Turbo caches the gate** — a re-run for PR-body evidence must use `--force` or you are pasting a log replay, not a result (the evidence rule cares).
- **`impeccable detect` runs per-viewport** — desktop green does not imply mobile green; `/estatisticas`'s failure was mobile-only.

**`docs/` numbering:** plan 033 and handoff 034 are taken. Next plan/handoff: `035`. Next ADR: `0052`. Plans/handoffs owe a `docs/README.md` row; this session also gave ADR-0051 a README row (a first — Fernando may keep or drop the convention).

---

## 4. Live state

- Production: four dailies, free play, streak, manifest, `/privacidade`, `/vincular`, the dormant attach stack, **plus** `/estatisticas`, `GET /stats`, `GET /stats/calendar`, the hub's `em 4/6`, and the conclusion stat block — all live for real users (no flag; anonymous sessions get honest zeros).
- The attach flow stays DORMANT (no `RESEND_API_KEY`); activation is still Fernando's checklist in [handoff 032 §6](./032-handoff-21-merged-m1-complete.md).
- `readDayState` still local (#83); #58 still decided-not-implemented; both untouched by #29 (verified — no schema change, `onTimeSql()` still the single producer, T-DB-S24 never fired).

---

## 5. Open work, in the order it is likely to matter

| Issue | Why it might come first |
|---|---|
| [#30](https://github.com/fernandolisboa/miolos/issues/30) | **Now unblocked by #29.** Medals: 20–30 pt-BR curated definitions, rule-derived medals as pure derivations over the SAME `StatsRow` reader (ADR-0049 D6 named them together), curated grants as rows surviving merge by union-dedupe, display in the stats screen's documented slot. Own endpoint/contract per ADR-0051 D3. `hintsUsed`/`elapsedMs` may never back a medal (ADR-0027/0031) |
| [#31](https://github.com/fernandolisboa/miolos/issues/31) | Archive — the other M3 pillar. **Owns three recorded revisits:** widening `ACCEPTED_DAYS_BACK` (the calendar's pre-birth late-completion treatment, ADR-0051 D2's named revisit), the late-lost fail-row case, and published-past-days enumeration behind the ADR-0004 wall |
| [#32](https://github.com/fernandolisboa/miolos/issues/32) | Streak-at-risk notifications — unblocked since #21; reminder consent stored, never yet acted on |
| Attach activation | Fernando's checklist (handoff 032 §6) — still pending, still invisible to users until done |
| [#83](https://github.com/fernandolisboa/miolos/issues/83) · [#58](https://github.com/fernandolisboa/miolos/issues/58) | Cross-device day state; the late-sync decision (own plan + ADR-0009/0026 amendments; the T-DB-S24 tripwire will catch its stored column) |
| [#37](https://github.com/fernandolisboa/miolos/issues/37) | Launch hardening — inherits from #29: the warm-profile CLS measurement (recorded-gate insertion), the session `last_seen_at` CSRF note, ADR-0051 D3's growth triggers |
| [#74](https://github.com/fernandolisboa/miolos/issues/74) · [#76](https://github.com/fernandolisboa/miolos/issues/76) · [#78](https://github.com/fernandolisboa/miolos/issues/78) · [#63](https://github.com/fernandolisboa/miolos/issues/63) · [#67](https://github.com/fernandolisboa/miolos/issues/67) · [#64](https://github.com/fernandolisboa/miolos/issues/64) · [#51](https://github.com/fernandolisboa/miolos/issues/51) · [#59](https://github.com/fernandolisboa/miolos/issues/59) · [#61](https://github.com/fernandolisboa/miolos/issues/61) · [#62](https://github.com/fernandolisboa/miolos/issues/62) · [#65](https://github.com/fernandolisboa/miolos/issues/65) · [#66](https://github.com/fernandolisboa/miolos/issues/66) | The polish/infra tail |
| [#33](https://github.com/fernandolisboa/miolos/issues/33) · [#34](https://github.com/fernandolisboa/miolos/issues/34) · [#35](https://github.com/fernandolisboa/miolos/issues/35) · [#36](https://github.com/fernandolisboa/miolos/issues/36) | M3/M4 tail, mostly blocked |

---

## 6. Still owed by ADRs and rituals, not doable in this environment

Handoff 032 §7's list stands. #29 adds: the **local seeded-data browser pass with screenshots** over the data-bearing stats surfaces (CI's impeccable scan only ever sees the anonymous zero state — recorded in the PR body and ADR-0051), and the five product-copy decisions flagged as Fernando-adjustable in the PR (`sem conclusão` legend, "Nonograms resolvidos" anglicism, F5 label unification, the omitted histogram kicker, the calendar anchor).

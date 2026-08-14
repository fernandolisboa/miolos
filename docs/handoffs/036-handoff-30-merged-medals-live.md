# Handoff — #30 merged: 23 medals live, and M3's stats area is complete

**To:** the session that picks the next ticket.
**From:** the session that ran #30 through all eight steps — two-lens plan review (both rejected, 25 findings fixed), six-lens code review (a real Safari/VoiceOver silence bug and an unrecorded ADR-0018 amendment found and closed), one fix round, a verification round that rejected once more on the plan's own register discipline (deviation 8) and then cleared, merge.
**Next step:** **pick from §5's table and start at step 1 of `CLAUDE.md`'s eight-step flow.**

Point-in-time snapshot; where an ADR disagrees, the ADR wins.

---

## 0. Check this before you read anything else

```
git checkout main && git pull && git log --oneline -1
curl -s https://api.miolos.app/health
curl -s https://api.miolos.app/medals
curl -s -o /dev/null -w "%{http_code}\n" https://miolos.app/estatisticas
```

Expect `main` at **`7817519`** ("feat: medals — 23 curated definitions, pure derivations, and the grants table (#30) (#92)") or a descendant, health `ok`, `/medals` answering **`{"error":"no-session"}`** (the route working, cookieless), `/estatisticas` **200**. All verified against production after the post-merge deploy. **Migration `0005` (`medal_grants`) is applied to production Neon** — it was applied BEFORE the branch's first push per the napkin ordering rule, with apply/push timestamps recorded in PR #92's body.

---

## 1. What #30 shipped, and where the reasoning lives

The medal stack end to end: **23 curated definitions** (`packages/core/src/medals/definitions.ts`, authored at implement time against the written constraints in `content/medals/README.md` — quotas, ≥2× threshold spacing, past-tense first-word allowlist, forbidden-vocabulary regex, 10-row rejected sample); **pure derivations** (`packages/core/src/medals/derive.ts` — six rule kinds over the same `StatsRow` reader as #29, one shared streak sweep capped at 365, the `today` anchor on every rule, `hintsUsed`/`elapsedMs` structurally inexpressible); **the `medal_grants` table** (migration 0005; three columns, composite PK, slug CHECK, cascade) with its **merge duty** at the reserved extension point (union-earliest via `least()` conflict arm + loser delete, both individually idempotent, T-DB-S20's snapshot widened to five tables); **`GET /medals`** (the streak-route template; earned id set only — no dates, no prose on the wire; ids shape-validated slugs, never enum'd, so catalog growth is additive and old clients drop unknowns); **the medal section on `/estatisticas`** (compact list, never a tile grid; uniform `--accent-app` stamp-outline rings; visible text is the accessible content with `role="list"` for WebKit; nothing renders at zero — flagged Fernando-adjustable); **`medalCopy` in `apps/web/src/medals/copy.ts`** (measured out of `messages.ts` — the barrel deliberately does not re-export it); the **AC-3 mechanical triad** (8-table set pin, grants column pin, ledger-vocabulary column scan); the `/privacidade` inventory line.

- **The plan:** [`docs/plans/035-issue-30-plan-medals.md`](../plans/035-issue-30-plan-medals.md) — §14 carries **eight** deviations, all with reasons.
- **The ADR:** [ADR-0052](../adr/0052-medals-are-derived-facts-plus-curated-grants.md) — ten decisions. It **amends ADR-0018** (narrowing: bulk per-item copy whose measured bundle cost forces it out of the shared module may live in its own typed in-repo module; reciprocal `Amended by:` line in ADR-0018 — the amendment was found by the step-6 ADR lens after the ADR's own audit claimed "amends nothing").
- **The review:** six lenses; the sharpest catches were the **VoiceOver silence** (aria-hidden row text under a name-prohibited `generic` — WebKit strips list semantics from `list-style: none`), the **ADR-0018 amendment**, and the **CLS attribution correction** (the measured 0.677 mobile is the medal section's 13-row insert, not the screen's; 1-row common case ≈ 0.10–0.14). Disposition: [PR #92 disposition](https://github.com/fernandolisboa/miolos/pull/92#issuecomment-5289281971).
- **Recorded residuals:** the wallet-as-view/jsonb gap in the AC-3 triad (named in the test and ADR-0052 D6); the `last_seen_at` write on a third cookieless GET (standing constraint, #37); `/medals` pulls `elapsedMs`/`hintsUsed` it never consumes (~25–30% wider read — the narrowed projection is #37's cheap lever if ADR-0052 D10's trigger fires); the sweep's recalibrated ~700-counted-day trigger.

**Final gate:** typecheck 6/6 · lint 0 · **1,541 tests** (was 1,502 pre-#30) · bundle green (`/estatisticas` 818.8 KB raw, −4.1 KB vs its 40 KB budget delta; medal prose provably in one chunk on one route) · impeccable green both viewports (zero state — the caveat recorded) · **seeded browser pass with screenshots landed** (a first; scratchpad artifacts, described in the PR) · CI green on main post-merge.

---

## 2. New rules of the road #30 leaves behind

- **The medal conventions:** rule-derived medals are pure derivations over `listCompletionsForStats`; curated grants are rows with NO production writer (the operator ritual in ADR-0052 D2 is the v1 mechanism); a new medal is content (a definition + copy + README row) — no schema/engine/contract change; the client drops unknown ids, so definitions ship BEFORE grants ever reference them.
- **ADR-0018 as amended:** UI copy lives in `messages.ts` UNLESS measured bundle evidence forces a bulk per-item module out (then: own typed module, chrome stays, barrel never re-exports). `medalCopy` is the precedent.
- **The founder grant is #37's launch-checklist obligation** — the tombstone-safe one-shot SQL lives in [#37's checklist comment](https://github.com/fernandolisboa/miolos/issues/37#issuecomment-5289169618), cited from ADR-0052 D9.
- **Register discipline extends to plans** (napkin item 10): a fix that changes a plan statement owes a §-deviations entry in the same round — the #30 verification round rejected solely on that.
- **Test-id frontier at `7817519`, re-derived by grep:** next free **`T-CORE-S80` · `T-DB-S44` · `T-API-S97` · `T-WEB-S166` · `T-LINT-S35`**. #30's burns (CORE S78/S79, API S96, WEB S164/S165) recorded in `docs/agents/test-ids.md`, stay burned.

---

## 3. Landmines

All of [handoff 034 §3](./034-handoff-29-merged-m3-opens.md) stands (nvm preamble; `TURBO_CONCURRENCY=1` on every commit; turbo-cache `--force` for evidence; `.next` wipe vs bundle-check; per-viewport detect; migrations via the serverless temp script, never `psql`/`drizzle-kit migrate`; preview-shares-prod-DB push ordering). New:

- **The Neon serverless script quirks** (napkin Shell §2): a scratchpad script can't resolve `@neondatabase/serverless` by name — import the absolute path `<repo>/packages/db/node_modules/@neondatabase/serverless/index.mjs`; and `sql.query()` returns a plain row ARRAY, not `{rows}`.
- **`git commit -am` sweeps the modified napkin** into feature commits — stage files explicitly, or accept the ride and note it (one line rode #92's last commit, deliberately).

**`docs/` numbering:** plan 035 and handoff 036 are taken. Next plan/handoff: `037`. Next ADR: `0053`.

---

## 4. Live state

- Production: four dailies, free play, streak, stats/calendar/Dia Perfeito, **plus** `GET /medals` and the medal section on `/estatisticas` — live for real users; every user with history sees their earned medals now (23 definitions, `first-win` earnable today).
- `medal_grants` is empty (0 rows) — no curated grant has ever been issued; the founder grant waits on #37's launch checklist.
- The attach flow stays DORMANT (no `RESEND_API_KEY`); activation is still Fernando's checklist in [handoff 032 §6](./032-handoff-21-merged-m1-complete.md).
- `readDayState` still local (#83); #58 still decided-not-implemented; `onTimeSql()` still the single on-time producer — all untouched by #30.

---

## 5. Open work, in the order it is likely to matter

| Issue | Why it might come first |
|---|---|
| [#31](https://github.com/fernandolisboa/miolos/issues/31) | **M3's last pillar.** Archive of past dailies — owns three recorded revisits by name: widening `ACCEPTED_DAYS_BACK` (the calendar's pre-birth late-completion treatment, ADR-0051 D2), the late-lost fail-row case, published-past-days enumeration behind the ADR-0004 wall. Late rows finally get a writer; archive medal definitions become additive content afterward |
| [#32](https://github.com/fernandolisboa/miolos/issues/32) | Streak-at-risk notifications — reminder consent stored since #21, never yet acted on. One push type only |
| Attach activation | Fernando's checklist (handoff 032 §6) — still pending, attach still invisible |
| [#83](https://github.com/fernandolisboa/miolos/issues/83) · [#58](https://github.com/fernandolisboa/miolos/issues/58) | Cross-device day state; the late-sync decision (own plan + ADR-0009/0026 amendments; T-DB-S24 armed) |
| [#37](https://github.com/fernandolisboa/miolos/issues/37) | Launch hardening — its inheritance grew: the founder-grant checklist comment, the warm-profile CLS numbers (medal insert decomposed), the AC-3 residuals, the narrowed-projection lever, the `last_seen_at` constraint |
| [#74](https://github.com/fernandolisboa/miolos/issues/74) · [#76](https://github.com/fernandolisboa/miolos/issues/76) · [#78](https://github.com/fernandolisboa/miolos/issues/78) · [#63](https://github.com/fernandolisboa/miolos/issues/63) · [#67](https://github.com/fernandolisboa/miolos/issues/67) · [#64](https://github.com/fernandolisboa/miolos/issues/64) · [#51](https://github.com/fernandolisboa/miolos/issues/51) · [#59](https://github.com/fernandolisboa/miolos/issues/59) · [#61](https://github.com/fernandolisboa/miolos/issues/61) · [#62](https://github.com/fernandolisboa/miolos/issues/62) · [#65](https://github.com/fernandolisboa/miolos/issues/65) · [#66](https://github.com/fernandolisboa/miolos/issues/66) | The polish/infra tail |
| [#33](https://github.com/fernandolisboa/miolos/issues/33) · [#34](https://github.com/fernandolisboa/miolos/issues/34) · [#35](https://github.com/fernandolisboa/miolos/issues/35) · [#36](https://github.com/fernandolisboa/miolos/issues/36) | M3/M4 tail (share #34 unblocks after #31 per its blocked-by) |

---

## 6. Fernando's open flags from PR #92 (non-blocking, adjustable without re-review)

1. **Nothing-at-zero** (D8): a player with no earned medals sees no medal section at all. Alternatives (a count, a locked list) were rejected as gamification chrome — say the word to revisit.
2. **The 23-medal catalog's names and descriptions** — the full table is in the PR body and `content/medals/README.md`; revise freely (ids are frozen).
3. **The founder grant** — definition ships, grants nothing until #37's checklist runs the one-shot SQL at launch.
4. **Medal-section placement** — currently between the summary and the game blocks (plan 033 D10's order); moving it after the calendar would zero its CLS insert. Product call.

Plus the standing debts: attach activation (handoff 032 §6), the #29-era product-copy flags (handoff 034 §6).

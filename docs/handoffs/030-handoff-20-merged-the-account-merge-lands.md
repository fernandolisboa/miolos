# Handoff — #20 merged: the account merge lands, and M1's real last ticket is #21

**To:** the session that picks the next ticket.
**From:** the session that ran #20 through all eight steps — two-lens plan review (both rejected, both fixed), six-lens code review (four approvals, quality REJECT + ADR conditional), one fix round, one verification round that went REJECT → CLEAN after three residuals, merge.
**Next step:** **pick from §5's table and start at step 1 of `CLAUDE.md`'s eight-step flow.** There is no work left on #20.

This is a point-in-time snapshot, not a living spec. Where it and an ADR disagree, the ADR wins.

---

## 0. Check this before you read anything else

```
git checkout main && git pull && git log --oneline -1
curl -s https://api.miolos.app/health
curl -s https://api.miolos.app/streak
curl -s https://api.miolos.app/buffer-depth
```

Expect `main` at **`2b0df5f`** ("feat: account merge — one pure function, one idempotent operation (#20) (#86)") or a descendant, health `ok`, `/streak` returning **`{"error":"no-session"}`** (the route working without a cookie), buffer healthy above threshold. All verified against production the hour this handoff was written. #20 shipped **no route and no web change** — production behavior is deliberately identical; the merge machinery is dormant until #21 calls it.

**Correction to handoff 028:** it called #20 "M1's actual last ticket". That was wrong — [#21](https://github.com/fernandolisboa/miolos/issues/21) is titled "M1: Email attach — magic link, merge, minimal LGPD", was blocked by #20, and is now unblocked. **M1 completes with #21, not #20.** Verify milestone claims against the live issue list rather than inheriting them from a prior handoff.

---

## 1. What #20 shipped, and where the reasoning lives

The ADR-0009 account merge, at two seams: **`mergeCompletions(canonical, other)`** in `packages/core/src/merge.ts` — pure, role-sensitive union-earliest-dedupe over completion rows carrying an **opaque fixed-width ordering key** (`completedAtOrder`, compared lexicographically, never parsed; no Date, no timezone arithmetic in core), survivors returned **by reference**; and **`mergeAccounts(db, a, b)`** in `packages/db/src/merge.ts` on the `@miolos/db/user` surface — the operational twin: winner selected DB-side (older `created_at`, tie → lower id), then **six ordered, individually idempotent statements** (sessions remap → winner's strictly-later duplicate DELETE → ordered repoint INSERT `ON CONFLICT DO NOTHING` → loser completions DELETE → loser `hint_grants` DELETE → guarded tombstone UPDATE nulling all four identity handles, loser row **retained forever**). Crash recovery is re-running the merge; no transaction spans the sequence (neon-http's interactive `transaction()` throws; non-interactive `db.batch()` exists but PGlite in the union `Db` has no `batch`). `listCompletionsForMerge` reuses `onTimeSql()` — still the single on-time spelling. No migration; `schema.ts` changed by a 3-line comment only.

- **The plan:** [`docs/plans/029-issue-20-plan-account-merge-recompute.md`](../plans/029-issue-20-plan-account-merge-recompute.md). Deviation register in the PR body — four deviations, all recorded.
- **The ADR:** [ADR-0049](../adr/0049-account-merge-one-pure-function-one-idempotent-operation.md) — two-layer seam split, winner rule, tombstone-by-remap (delete forbidden: cascade would let `POST /session` mint the revived empty account ADR-0009 bans), grant deletion-not-carriage, and the statement-sequence idempotence argument. It **amends ADR-0026** (the merge-repoint consequence's sufficiency claim only — the ordered repoint alone does not deliver earliest-wins when the winning account already holds a later row; the strictly-later DELETE completes it; the ordering prescription itself stands). Reciprocal `Amended by:` line is in ADR-0026.
- **The review:** six lenses at step 6; findings and dispositions in the [PR #86 disposition comment](https://github.com/fernandolisboa/miolos/pull/86#issuecomment-5283940553) (10 findings, one dismissal) plus the [verification addendum](https://github.com/fernandolisboa/miolos/pull/86#issuecomment-5284016309) (findings 11–13). Verification returned CLEAN at `04773f3`.
- **#21's preconditions from the security lens** are recorded [on issue #21](https://github.com/fernandolisboa/miolos/issues/21#issuecomment-5283933998): serialize merges sharing a participant (no `pg_advisory_lock` over stateless neon-http), and both ids must derive from verified identities, never from request-supplied ids.

**Final gate on the merge candidate:** `pnpm typecheck` 6/6 · `pnpm lint` exit 0 · `pnpm test --force --concurrency=1` **1 383 passing** (was 1 362 pre-#20) · migrations diff empty · `pnpm bundle-check` exit 0 (23 assertions ok, after a rebuild — see §3) · all five CI checks green · production verified post-merge.

---

## 2. New rules of the road #20 leaves behind

- **The merge is two functions, one semantics, held together by a test.** `mergeCompletions` (core) and `mergeAccounts`' SQL implement the same union-earliest-dedupe; `T-DB-S22` is the agreement bridge. Change either side and that test is the tripwire. Read-only callers (nightly checks, support previews) use the core function over `listCompletionsForMerge` rows; the attach flow calls `mergeAccounts`.
- **Exact-tie convention:** at equal ordering keys the **canonical/winner row wins** — strict `<` in both JS and SQL. Callers pass the winner's rows first; `T-CORE-S38`/`T-DB-S17` pin the same cell.
- **The repoint column list is tripwired.** `mergeAccounts`' INSERT names all 8 `completions` columns; `T-DB-S24` deep-equals that list against `getTableColumns(completions)`. Adding a column to `completions` turns it red — classify the column for the merge (carry it) in the same PR. (#58's stored `on_time`, when it lands, will hit exactly this tripwire — that is by design.)
- **"Emptied" is literal:** the tombstone keeps zero completions, zero sessions, zero hint grants, four nulled identity handles — and the `users` row itself is **never deleted**.
- **ADR-0023's "prove" is repo-wide:** reserved for construction-backed invariants in tests and docs alike; single-fixture tests "pin" or "show". Three review rounds enforced this.
- **A corrected sufficiency claim in an old ADR is an amendment** — 0049↔0026 joins the reciprocal-header precedents (0033↔0047, 0031/0041↔0048).
- **Test-id frontier at `2b0df5f`, re-derived by grep at your step 8:** next free **`T-CORE-S49` · `T-DB-S26` · `T-API-S57` · `T-WEB-S135` · `T-LINT-S26`**. #20's burns (`T-CORE-S47/S48`, `T-DB-S25`, `T-API-S55/S56`) are recorded in `docs/agents/test-ids.md` and stay burned.

---

## 3. Landmines — mostly unchanged, one new

All of [handoff 028 §3](./028-handoff-19-merged-the-streak-is-live.md) stands: `rm -rf apps/web/.next` before every typecheck; `pnpm bundle-check` only from `apps/web`; the nvm preamble on every node command; migrations hand-applied, never `drizzle-kit migrate` at Neon; the dirty-worktree `gh pr merge` trap (stash `.claude/napkin.md` first — it worked cleanly this time); WSL2 jsdom flakes under parallel turbo (`--concurrency=1` warm, never `--no-verify`).

New: **wiping `.next` for typecheck deletes the stats file `pnpm bundle-check` reads** — run `pnpm build` in `apps/web` before bundle-check whenever `.next` was wiped, or the checker has nothing to check.

**`docs/` numbering is one sequence across every subdirectory.** Plan 029 and this handoff (030) are taken. Next plan: `031`. Next ADR: `0050`. A plan or handoff owes a `docs/README.md` row in the same commit; an ADR owes none.

---

## 4. Live state

- Production is behaviorally identical to pre-#20: four dailies, free play, the streak, the manifest. `mergeAccounts` has **zero production callers** — dormant by design (the `grantHints` posture) until #21.
- The merge's concurrency story is deliberately deferred: ADR-0049 records idempotent re-run as crash recovery for the **same** merge; overlapping merges sharing a participant are #21's serialization problem (recorded on the issue).
- `readDayState` is still the local reader (#83); done/pending tiles remain per-device.
- #58 remains decided-not-implemented; #20 carried `onTime` through untouched and left the column-list breadcrumb for it.

---

## 5. Open work, in the order it is likely to matter

| Issue | Why it might come first |
|---|---|
| [#21](https://github.com/fernandolisboa/miolos/issues/21) | **M1's real last ticket, unblocked by #20.** Email attach: magic link, merge-on-collision (calls `mergeAccounts`), minimal LGPD. Read first: ADR-0049, ADR-0012, ADR-0022's consent notes, and the two preconditions recorded on the issue. Blocking #32. Biggest ticket left in M1 — email transport, verification tokens, consent flags, privacy policy |
| [#29](https://github.com/fernandolisboa/miolos/issues/29) · [#31](https://github.com/fernandolisboa/miolos/issues/31) | **M3.** #29 (stats, calendar, Dia Perfeito) builds on `listCompletionsForStreak`; #31 (archive) is ADR-0005's SEO surface. **#58 should precede or land inside whatever encodes on-time into stored rows** |
| [#83](https://github.com/fernandolisboa/miolos/issues/83) | Cross-device day state — #19's recorded deferral; reads ADR-0048 first |
| [#58](https://github.com/fernandolisboa/miolos/issues/58) | Decided, not implemented; own plan + ADR-0009/0026 amendments; #20's T-DB-S24 tripwire will catch its stored column mechanically |
| [#74](https://github.com/fernandolisboa/miolos/issues/74) · [#76](https://github.com/fernandolisboa/miolos/issues/76) · [#78](https://github.com/fernandolisboa/miolos/issues/78) | #27's follow-up tail |
| [#63](https://github.com/fernandolisboa/miolos/issues/63) · [#67](https://github.com/fernandolisboa/miolos/issues/67) | Shared-play-layer a11y/polish |
| [#64](https://github.com/fernandolisboa/miolos/issues/64) · [#51](https://github.com/fernandolisboa/miolos/issues/51) · [#59](https://github.com/fernandolisboa/miolos/issues/59) · [#61](https://github.com/fernandolisboa/miolos/issues/61) · [#62](https://github.com/fernandolisboa/miolos/issues/62) · [#65](https://github.com/fernandolisboa/miolos/issues/65) · [#66](https://github.com/fernandolisboa/miolos/issues/66) | Polish/infra tail; #65/#66 still want a browser trace first |
| [#35](https://github.com/fernandolisboa/miolos/issues/35) | M4 onboarding — after M3 |

---

## 6. Still owed by ADRs and rituals, not doable in this environment

All of handoff 028 §6 stands (screen-reader pass, DevTools installability panel, the live streak ritual, the 320px `apagar` measurement). #20 adds:

- **A real production merge has never run.** PGlite over the real migrations is the substitute; #21's post-deploy smoke owns the first live `mergeAccounts` (and the first live neon-http execution of the six statements).
- **PGlite↔Neon `to_char` microsecond agreement** is assumed (both real Postgres); plan 029 §12 risk 3 records the residual.

---

## 7. Environment

Unchanged from [handoff 028 §7](./028-handoff-19-merged-the-streak-is-live.md): Node v24.18.1 / pnpm 11.18.0 via the nvm preamble; pre-commit never bypassed. No new dependencies from #20.

---

## 8. Kickoff prompt

Copy everything between the markers.

--------------- BEGIN KICKOFF ---------------

Continue Miolos. #20 (account merge: mergeCompletions in core, mergeAccounts
in db, ADR-0049) merged as PR #86; main is at 2b0df5f and production is
deliberately unchanged — the merge is dormant until #21 calls it. Read
docs/handoffs/030-handoff-20-merged-the-account-merge-lands.md in full first.

Correction inherited from 028: M1 is NOT complete — #21 (email attach) is
M1's real last ticket and is now unblocked. Pick the next ticket from the
handoff's §5 table — the natural candidate is #21 (read ADR-0049, ADR-0012,
and the two security preconditions recorded on the issue before planning) —
and run it through STEP 1 of CLAUDE.md's eight-step flow. #58 stays
decided-but-unimplemented; never a rider, never re-asked.

New machinery from #20 you must not break: the T-DB-S22 agreement bridge
(core and SQL implement one union-earliest-dedupe); strict-< exact-tie rule
(canonical wins, winner's rows passed first); the T-DB-S24 column tripwire
(any new completions column must be classified for the merge in the same
PR); the tombstone is remap+empty+retain, never delete; ADR-0023's "prove"
is reserved repo-wide — single-fixture tests "pin".

Every node/pnpm/npx command needs:
  source ~/.nvm/nvm.sh && nvm use default >/dev/null &&

pnpm bundle-check runs from apps/web and needs a pnpm build first if .next
was wiped for typecheck. docs/ numbering: next plan 031, next ADR 0050, and
each plan/handoff owes its docs/README.md row. Test-id frontier: T-CORE-S49 ·
T-DB-S26 · T-API-S57 · T-WEB-S135 · T-LINT-S26 (re-derive by grep at your
step 8).

--------------- END KICKOFF ---------------

# Handoff — #28 merged and live, M2 is complete, and the frontier is open

**To:** the session that picks the next ticket.
**From:** the session that ran #28 through all eight steps — two-lens plan review, six-lens code review, one verification round, merge.
**Next step:** **choose from §5's table and start at step 1 of `CLAUDE.md`'s eight-step flow.** There is no work left on #28, and no M2 ticket remains.

This is a point-in-time snapshot, not a living spec. Where it and an ADR disagree, the ADR wins.

---

## 0. Check this before you read anything else

```
git checkout main && git pull && git log --oneline -1
curl -s -o /dev/null -w "%{http_code}\n" https://miolos.app/modo-livre
curl -s -o /dev/null -w "%{http_code}\n" https://miolos.app/modo-livre/termo
curl -s https://api.miolos.app/buffer-depth
```

Expect `main` at **`f348aa1`** ("feat: free play on the grid games … (#28) (#81)"), `/modo-livre` returning **200**, `/modo-livre/termo` returning **404** — the exclusion is a route that does not exist, not a redirect — and buffer-depth showing four games above threshold. All four were verified against production the hour this handoff was written.

The `feat/28-free-play-on-the-grid-games` branch was deleted on merge. PR [#81](https://github.com/fernandolisboa/miolos/pull/81) is merged; [#28](https://github.com/fernandolisboa/miolos/issues/28) and the folded-in [#75](https://github.com/fernandolisboa/miolos/issues/75) are closed. **M2 — Catalogue is complete** (it is a textual milestone in issue bodies; there is no GitHub milestone object to close).

---

## 1. What #28 shipped, and where the reasoning lives

Free play on the three grid games: `/modo-livre` (index) plus `/modo-livre/{binairo,sudoku,nonogram}` — static pages, browser-side generation from `packages/games` with a `crypto.getRandomValues` seed, a Leve/Médio/Difícil picker mapped to weekdays 1/4/7, one free hint from the generator's own solution, no timer, no persistence, nothing recorded anywhere. Termo excluded at the type level, the lint level, the route level and the bundle level. #75 (`playRoutes` totalisation) rode along as the first commit.

- **The plan:** [`docs/plans/025-issue-28-plan-free-play-on-the-grid-games.md`](../plans/025-issue-28-plan-free-play-on-the-grid-games.md). Its deviation register lived in the PR body — eight deviations, all recorded, none architectural.
- **The ADRs:** [ADR-0046](../adr/0046-free-play-routes-levels-and-the-ephemeral-session.md) (routes, levels, ephemeral session) and [ADR-0047](../adr/0047-bundle-markers-are-route-scoped.md) (route-scoped bundle markers, **amends ADR-0033's** "not by shipping the motif library" clause — ADR-0033 carries the reciprocal pointer). `CONTEXT.md`'s Motif row was rewritten to match.
- **The review:** six lenses at step 6 (correctness, security, quality, performance, ADR-adherence, issue-adherence) — zero blocking/high findings; four fixes and two written dismissals in the [disposition comment](https://github.com/fernandolisboa/miolos/pull/81#issuecomment-5274988076); one verification round caught a half-finished comment refresh, closed in the [verification comment](https://github.com/fernandolisboa/miolos/pull/81#issuecomment-5275042201).

**Final gate on the merge candidate:** `pnpm typecheck` 6/6 · `pnpm lint` exit 0 · `pnpm test` **1 314 passing** (was 1 266 pre-#28) · `pnpm build` 2/2 · `pnpm bundle-check` exit 0 (8 budgets, 20 daily / 5 free-play-only / 2 unattributed chunks) · CI `gate` and `detect` green on the final head · production routes verified live.

**The three negatives, as they now stand mechanised** (the pattern to imitate, not re-derive):

- *No requests:* the free-play ESLint wall (`eslint.config.mjs`, third wall object; probes `T-LINT-S9…S18` in `apps/web/test/eslint-free-play-wall.test.ts`) plus zero-fetch full-session jsdom tests, each beside a control proving the stub records calls.
- *Streak/stats untouched:* `T-WEB-S117` asserts the whole `localStorage` keyspace byte-identical across a session, control included.
- *No Termo:* `satisfies readonly Exclude<Game, "termo">[]` in `apps/web/src/free-play/catalog.ts`, route absence by directory listing, wall bans on `@miolos/games/termo` in three specifier shapes, and answer-canonical bundle markers forbidden everywhere.

---

## 2. New rules of the road #28 leaves behind

These are now live machinery, not plans. Breaking them is a step-6 finding waiting to happen.

- **`route-client-js.mjs` is route-scoped and fails closed.** Every route must be attributable: a NEW route that is neither `/modo-livre*` nor covered by the daily union makes the script exit 2 by design. Adding any route means deciding its scope in that script in the same PR ([ADR-0047](../adr/0047-bundle-markers-are-route-scoped.md)). The same string can be forbidden in one scope and expected in the other (`Escada`, `zurro` both are) — that double role is the anti-vacuity mechanism; do not "clean it up".
- **The free-play wall bans named modules, not directories, and is non-transitive.** A helper both sides need lives on the wall-legal side — precedents: `sameMode` in `apps/web/src/binairo/state.ts`, `picturePath` in `apps/web/src/play/picture-path.ts`. Never copy a helper into `free-play/` to dodge the wall; hoist it.
- **Free play is ephemeral by decision, not omission** (ADR-0046). No localStorage key, no day-state entry, no timer. `FREE_PLAY_DATE = "1970-01-01"` is an inert reducer-init sentinel — it must never reach a wire, a store, or a screen.
- **`messages.freePlay.*` deliberately contains no completion language.** "Conclusão" is a daily word ([ADR-0008](../adr/0008-completion-and-streak-semantics-across-play-modes.md)); the solved card says solved things without it.
- **Test-id frontier at `f348aa1`, re-derived by grep at step 8:** next free `T-CORE-S25` · `T-DB-S13` · `T-API-S46` · `T-WEB-S125` · `T-LINT-S21`. `T-WEB-S123/S124` and `T-LINT-S19/S20` were review headroom, unspent, **burned**. The LINT area is now defined as the `apps/web/test/eslint-*-wall.test.ts` suites (both files, one numbering).

---

## 3. Landmines — unchanged from handoff 024, still armed

All of [handoff 024 §3](./024-handoff-m2-free-play-the-last-ticket.md) stands: `rm -rf apps/web/.next` before every typecheck; `pnpm bundle-check` only from `apps/web` (root silently exits 0); `impeccable detect` needs a positive control beside every scan (`--no-config` on the same URL — the three suppressed Ateliê findings prove the browser arrived); the Vercel preview needs the CI-only bypass secret; `@neondatabase/serverless` does not resolve from `apps/api` (use `@miolos/db/publishing`); `.env.local` is sandbox-refused, pass values through a subshell env; **migrations are hand-applied and `drizzle-kit migrate` must never be pointed at Neon**.

**`docs/` numbering is one sequence across every subdirectory.** This document took **026**. Next plan: `027`. Next ADR: `0048`. A plan or handoff owes a `docs/README.md` row in the same commit; an ADR owes none.

---

## 4. Live state

- Production serves four dailies plus free play. `daily_puzzles` was untouched by #28 (its `apps/api`/`packages/db` diff was empty); the cron owns the buffer and nothing is owed there.
- The two properties from handoff 024 §4 still bind: `GET /daily/termo` returns exactly `{game, date}`, and the answer pool never ships while the validation dictionary does — now asserted per-scope by the reworked bundle-check rather than globally.

---

## 5. Open work, in the order it is likely to matter

From `gh` at the time of writing, all unblocked:

| Issue | Why it might come first |
|---|---|
| [#19](https://github.com/fernandolisboa/miolos/issues/19) | **M1's remainder: streak, hub polish, PWA manifest.** `apps/web/app/page.tsx` still hardcodes `streakCount = 0`; no aggregating route exists. Carries the [#27-transferred obligation](https://github.com/fernandolisboa/miolos/issues/19#issuecomment-5159949996): streak derivation must exclude `outcome = 'lost'`, with the test at the `apps/api` seam |
| [#29](https://github.com/fernandolisboa/miolos/issues/29) · [#31](https://github.com/fernandolisboa/miolos/issues/31) | **M3.** #29 (stats, calendar, Dia Perfeito) carries the [twin obligation](https://github.com/fernandolisboa/miolos/issues/29#issuecomment-5159949515) and owns the guess distribution and the hub's `em 4/6` string; #31 (archive) is the SEO surface ADR-0005 promised |
| [#74](https://github.com/fernandolisboa/miolos/issues/74) · [#76](https://github.com/fernandolisboa/miolos/issues/76) · [#78](https://github.com/fernandolisboa/miolos/issues/78) | #27's follow-ups: the low-pool alert, one TSDoc correction, and the ADR-citation checker — #78 grew more relevant now that ADR-0045's figures are deliberately point-in-time (see the [verification comment](https://github.com/fernandolisboa/miolos/pull/81#issuecomment-5275042201)) |
| [#63](https://github.com/fernandolisboa/miolos/issues/63) · [#67](https://github.com/fernandolisboa/miolos/issues/67) | Shared-play-layer a11y/polish; **free play now inherits both** — its three screens use the shared `screen.hint` classes in the shared grid (verified: `binairo-free-screen.tsx:309-328` and siblings), so #67's fix now covers **six** hint-bearing screens, not three |
| [#64](https://github.com/fernandolisboa/miolos/issues/64) | Naming the revealed Nonogram picture on the **daily** conclusion — touches exactly the wall ADR-0033/ADR-0047 now guard; whoever takes it reads ADR-0047 first |
| [#58](https://github.com/fernandolisboa/miolos/issues/58) | A decision, not a build: post-rollover sync deriving as late. Needs Fernando's word before #29 encodes streak arithmetic |
| [#51](https://github.com/fernandolisboa/miolos/issues/51) · [#59](https://github.com/fernandolisboa/miolos/issues/59) · [#61](https://github.com/fernandolisboa/miolos/issues/61) · [#62](https://github.com/fernandolisboa/miolos/issues/62) · [#65](https://github.com/fernandolisboa/miolos/issues/65) · [#66](https://github.com/fernandolisboa/miolos/issues/66) | The polish/infra tail; #65/#66 want a real browser trace first |

**A decision the next session should surface early:** #58 blocks #29's streak arithmetic in spirit. If M3 is next, get Fernando's call on #58 in the PR text of whatever lands first.

---

## 6. Still owed by ADRs, and not doable in this environment

Say so plainly in any PR that touches these areas rather than letting a green suite imply otherwise:

- **A real screen-reader pass** (VoiceOver/NVDA) — ADR-0042 consequence (e), ADR-0043 decision 10; #28 added the level picker and solved card to the debt.
- **The 320px `apagar` browser measurement** — plan 022 §12.6's fallback ladder, still unmeasured.
- **The live free-play rituals** — plan 025 §13: a real Network tab (Fetch/XHR: one `POST /session`, nothing after) and a real DevTools offline toggle, on production. Two minutes on a phone; worth doing now that it is live.

---

## 7. Environment

Unchanged from [handoff 024 §7](./024-handoff-m2-free-play-the-last-ticket.md): Node v24.18.1 / pnpm 11.18.0 via the nvm preamble on every command; pre-commit never bypassed; the gate ritual and its ordering as written there. The Impeccable workflow still produces two runs per push and only the `miolos-web` one matters.

---

## 8. Kickoff prompt

Copy everything between the markers.

--------------- BEGIN KICKOFF ---------------

Continue Miolos. M2 is complete: #28 (free play) merged as PR #81, main is at
f348aa1, and /modo-livre is live in production with Termo correctly absent.
Read docs/handoffs/026-handoff-m2-complete-the-frontier-opens.md in full first.

Pick the next ticket from that handoff's §5 table — the natural candidates are
#19 (streak + PWA manifest, M1's remainder) and M3's #29/#31 — and run it
through STEP 1 of CLAUDE.md's eight-step flow. Surface #58 (the post-rollover
late-completion decision) to Fernando in the first PR that touches streak
arithmetic; it needs his word, not a build.

New machinery from #28 you must not break: route-client-js.mjs is route-scoped
and fails closed (any new route must be classified there in the same PR), the
free-play ESLint wall bans named modules (hoist shared helpers wall-legal,
never copy them), and free play stays ephemeral — no persistence, no timer,
no completion language.

Every node/pnpm/npx command needs:
  source ~/.nvm/nvm.sh && nvm use default >/dev/null &&

pnpm bundle-check runs from apps/web, not the repo root. Always
rm -rf apps/web/.next before a typecheck. docs/ numbering: next plan 027,
next ADR 0048, and each plan/handoff owes its docs/README.md row.

--------------- END KICKOFF ---------------

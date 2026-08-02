# Handoff — M2's last two: the daily Termo (#27) and free play (#28)

**To:** the session that continues M2 after #25.
**From:** the session that built #25 (daily Nonogram end to end), merged as [`b308349`](https://github.com/fernandolisboa/miolos/commit/b308349) via PR [#69](https://github.com/fernandolisboa/miolos/pull/69).
**Next step:** the mandatory eight-step flow in `CLAUDE.md`, on **[#27](https://github.com/fernandolisboa/miolos/issues/27)** — the higher-leverage of the two, and the one with real unresolved structure.

This is a point-in-time snapshot, not a living spec. Where it and an ADR disagree, the ADR wins.

It **supersedes handoff [019](./019-handoff-m2-nonogram-and-termo.md) wherever they differ.** 019 remains the better long-form account of *why* the shared layer is shaped as it is; sections 3–5 of it are now partly stale and §2 below lists every correction.

---

## 0. Check this before you read anything else

Everything below assumes `main` is at `b308349` or later and green.

```
git log --oneline -1 main
curl -s https://api.miolos.app/buffer-depth
```

Expect `{"depths":{"binairo":N,"nonogram":N,"sudoku":N},"threshold":4,"shallow":false}` — **three** games. If `nonogram` is absent, #25 did not deploy and nothing below holds.

**The publication cron is confirmed self-sustaining**, by observation rather than inference. On 2026-08-02 at `06:00:35 UTC` it inserted `2026-08-08` for both shipped games, taking each buffer 6 → 7. Before that, every row in `daily_puzzles` came from two hand-seeded batches, and a depth reading alone could not tell the two apart — check `count(distinct date_trunc('minute', created_at))` per game, not just depth, if you ever need to re-establish this.

---

## 1. Scope

Two issues, both `ready-for-agent`, both unblocked. **#27 first.**

### #27 — M2: Daily Termo end-to-end
Acceptance criteria, verbatim:

- The day's answer comes from the curated list only after the harness gate; the answer never reaches the client before completion beyond normal gameplay feedback
- Accent-free input matches accent-insensitively; canonical accented form revealed at the end
- Rejected guesses show "não está na lista"; accepted guesses come from the validation dictionary
- A six-guess loss is recorded as played (fail row), completes nothing, and never counts toward streak or Dia Perfeito — covered at the `apps/api` seam
- Screen designed against the design system, passes `npx impeccable detect`; hub tile live; all four dailies now playable

### #28 — M2: Free play on the grid games
Largely mechanical by comparison, and it **inherits ADR-0032, ADR-0035 and ADR-0037** directly. Termo is excluded from free play by project invariant — its word list is finite curated content. Free play never touches the streak, the statistics distributions or the medals.

---

## 2. What changed in #25, and where handoff 019 is now wrong

**Read this section before re-reading 019.** Four of its factual claims cost this session time.

| 019 said | The truth, verified in code |
|---|---|
| `validateNonogram(puzzle, criteria)` returning `{approved, reasons}` | **One argument**, returns `{ok, failures}`, and it derives criteria from `puzzle.weekday` itself — so re-validating generator output is a tautology. `topUpNonogramBuffer` therefore asserts weekday→size independently (ADR-0010's "belt and suspenders" restored) |
| `stripDailyContent` has a throwing **`default:`** | There is **no `default:` clause**. `nonogram`/`termo` were a fall-through case group sharing one `throw`, and the function typechecks only because the switch is exhaustive over `Game`. #27 replaces termo's arm; keep the exhaustiveness or a forgotten game stops being a compile error |
| `screen.module.css`'s four per-game custom properties all have Binairo fallbacks | **`--board-mobile-max` has no fallback** (`:409` is a bare `var()`). The file's own header comment claims otherwise and is wrong. Omitting it makes the declaration invalid at computed-value time and the ≤768px cap silently disappears |
| The Binairo roving-focus retrofit is "cheap" | It is **~450 lines** with a novel focus-under-pointer-capture path jsdom cannot cover. Filed as **[#61](https://github.com/fernandolisboa/miolos/issues/61)**, not done. #25 built `onStrokeEnd` specifically so the retrofit has a mechanism to adopt rather than re-derive |

### The shared layer, as it stands now

`apps/web/src/play/` is **fifteen** files. New or changed since 019:

| Module | What #27 needs to know |
|---|---|
| `use-pointer-stroke.ts` | **New.** The pointer-stroke machinery, moved verbatim out of `binairo/grid.tsx` (firing ADR-0029 consequence (c)). Termo has no drag surface — you almost certainly do not touch this |
| `accent.ts` | **`accentVar` is gone; it is now `accentVars(game): CSSProperties`**, returning `--accent` *and* `--ink-on-accent`. The pair is deliberately inseparable — `.ctaNext` sets it on itself so the label follows the fill being rendered, not the page |
| `types.ts` | Gained `ConclusionPicture`. `ConclusionCopy` is still plain-data-only — a render function throws "Functions cannot be passed directly to Client Components" on SSR, an HTTP 500 only an SSR test sees |
| `play-record.ts` | Three members now. **`v` is still `1` and may never bump.** The nonogram member is the precedent for a non-uniform shape: a `size` field plus a `superRefine`, which is a legal `z.discriminatedUnion` option in Zod 4 and *is not* in Zod 3 |
| `sync.ts` | Still exactly one module. `buildBody`'s switch now has three arms; its `const unhandled: never = record` makes **adding a termo member to `playRecordSchema` a compile error** until you add the case. That is deliberate — fail-closed, because falling through would settle the record as rejected and silently lose the day |
| `conclusion-view.tsx` | Takes one optional `picture` prop. This is your precedent for widening it for a **loss** state |

`packages/core/src/contracts/daily-content.ts` is **new**: the server-only content schemas live there so they stay off the client bundle, enforced by the ESLint wall. **Termo's content schema goes there, not in `daily.ts`.** The wall was hardened in #25 to catch relative paths and dynamic imports, not just bare specifiers.

`docs/agents/test-ids.md` is new and carries the live frontier. **Re-derive it by grep before allocating** — it is a snapshot.

---

## 3. Read first, in this order

1. `CLAUDE.md` — the eight steps and the mechanical gate. Eight is the floor.
2. `CONTEXT.md` — the vocabulary, now including #25's seven rows for picture/motif/cell states.
3. `docs/plans/020-issue-25-plan-daily-nonogram-end-to-end.md` — **§6 (where six decision papers conflicted and which won), §26 (what is UNVERIFIED) and §27 (all 64 review dispositions)**. §27 is the single most useful page: it records what a hard adversarial review actually finds, and three places a reviewer was wrong with the refuting evidence.
4. `docs/adr/0032`–`0037` — #25's six. **0032** (what "finished" means and how the wire encoding makes two finishing styles identical) and **0034** (the celebration renders in the conclusion, with a measured one-frame justification) are the two #27 reasons against.
5. `docs/adr/0008` (`lost` is Termo-only; a lost Termo is *played*, never *completed*), `0015` (the word list), `0027` (**and precisely why its argument does not transfer to Termo**), `0028` (routes and the conclusion), `0029` (the shared layer), `0031` (per-device day state).
6. `apps/web/src/nonogram/` end to end — the freshest worked example, and the one that had to widen the shared layer honestly rather than contort it.
7. `packages/games/src/termo/index.ts` — 25 lines, the whole public surface. Never a deep import (ADR-0019).
8. `content/termo/README.md` — provenance, licences, and the constraints the list was built under.

---

## 4. #27 — the two things that are genuinely unresolved

Both want deciding at **step 2 with an ADR**, not discovering at step 6. Handoff 019 §7 remains the best long-form treatment; this is what is still true and what #25 changed.

### 4.1 Termo structurally cannot play offline

ADR-0028 makes finishing offline a requirement — the conclusion is an in-place state precisely so a player who solves offline gets a stamp rather than a navigation error. **Every Termo guess needs a server round trip to be judged.** That is a real conflict between ADR-0028 and ADR-0004; it cannot be engineered away.

It needs an ADR that says so plainly and defines the degraded behaviour: what the screen does when a guess POST fails, what the record holds, what the conclusion shows. Do not let it surface as a step-6 finding.

### 4.2 ADR-0027 does not transfer, so the hint is decided from scratch

The reasoning that lets the other three games compute hints on the client is in `apps/web/src/play/grid-hint.ts`'s own header: today's board is published, its givens are legitimately in the player's hands, and it is uniquely solvable by construction — so the solution is client-recoverable anyway. **Termo has no analogue.** The strip gives its client `game, date` and nothing else; the answer word appears in no field of any payload.

The module is named `grid-hint`, not `hint`, for exactly this reason. #27 decides Termo's hint from scratch, or ships without one. ADR-0027:125-131 also forecloses defending anything on confidentiality grounds — read it before arguing.

### 4.3 The decisions that follow from those two

- **Guess state has to live somewhere.** Six guesses judged one at a time is a per-user per-day sequence, and `completions` is write-once so it cannot hold in-flight guesses. Either the server stores them (new table, migration, ADR) or it re-judges a client-supplied guess list on every request (stateless, replayable, no schema). **The stateless route is much cheaper and does not weaken ADR-0004** — but decide it, do not drift into it.
- **Answer selection needs a no-repeat rule.** 400 answers is 13+ months, but a uniform seeded pick collides inside ~24 days (birthday problem). The natural check is "not used by any existing `daily_puzzles` row for `game = 'termo'`" — which is a database read inside the top-up that the grid games do not do. `TERMO_ANSWERS` is in `answers.csv` row order and **that order is contractual**; the harness pins it and reordering is a breaking change.
- **The word list's bundle cost.** `TERMO_VALIDATION_WORDS` is 5310 words and public by design, so "não está na lista" can be instant and offline. Measure what the barrel actually pulls in. #25 proved Turbopack eliminates unused barrel re-exports — but it measured that on the nonogram barrel, so **re-measure for termo**. If it does not tree-shake, the sanctioned fix is making the existing barrel tree-shakeable, never a sub-barrel and never a deep import (ADR-0019).
- **`lost` is a real outcome and the layer already knows.** `PlayCore.status` carries `"lost"`; `buildRecord`'s third argument is `closed`, not `solved`. Both exist for you — verify they still do before relying on them. `POST /completions` currently 422s a mismatched grid and writes no row; **Termo inverts that** — six guesses exhausted *is* an outcome and must write `outcome: "lost"`.

### 4.4 Where the shared layer will need widening

Be honest at step 2 rather than contorting at step 5. An abstraction bent onto Termo is worse than a fourth module.

- **`ConclusionView` has three states**: skeleton, "ainda não concluído", and a **win** stamp. A loss is a fourth, with different chrome, different copy and no time-as-achievement framing. #25's optional `picture` prop is the precedent for widening it honestly.
- **`DayEntry.concluded` would be wrong for a loss.** Under ADR-0008 a lost Termo must render as *not* completing the day while still being visibly *played*. Note ADR-0031's monotone-safety rule: a false "pending" is invisible to the player, a false "done" is not — err toward pending.
- **`nextPendingDaily` chains on `!entryOf(candidate).concluded`**, so a lost Termo would be offered as the next pending daily forever. Decide whether "played" closes the chain.
- **`grid-hint.ts` and `progress.ts` do not apply at all.** No `null`-empty grid, no "{filled} de {total}".
- **The board is not a grid game's board.** Six rows × five tiles, fixed, read-only until submitted; the input is a keyboard. ADR-0030 is about *grid games* — whether a Termo board is one composite widget is a fresh decision, and the natural answer is that the keyboard is the interactive surface and the tile board is `role="group"` output.

### 4.5 One concrete thing already decided for you

`packages/core/src/contracts/cron.ts:38-42` already records the run order argument: cost-ascending is the principle, and **a curated-word-list pick is not a generate-and-validate loop at all, so termo goes _first_** — while the alphabet would put it last. The TSDoc is written; honour it.

---

## 5. Every extension point still fail-closed for termo

Each throws, rejects, or does not typecheck for your game today.

| File | What #27 adds |
|---|---|
| `packages/core/src/contracts/daily-content.ts` | `termoDailyContentSchema` — **here, not in `daily.ts`**, or it lands in the client bundle and the ESLint wall fails you |
| `packages/core/src/contracts/daily.ts` | The termo arm of `stripDailyContent` (no `default:` — keep exhaustiveness), `dailyTermoResponseSchema`, and its member on `dailyPuzzleResponseSchema`, which widens `ProjectedGame` |
| `packages/core/src/contracts/completion.ts` | Your member on the `discriminatedUnion`. **Not grid-shaped** — the three grid members must not be generalised |
| `packages/core/src/contracts/cron.ts` | Your key in both `strictObject`s, in the same PR as the top-up |
| `apps/api/src/publishing/service.ts` | `topUpTermoBuffer` — and it is genuinely different: a curated pick, not a generate-and-validate loop |
| `apps/api/app/cron/publish/route.ts` | Termo **first**, per §4.5. Fault isolation per game is not optional |
| `apps/api/app/completions/route.ts` | `storedSolution`'s exhaustive switch is a **compile error** until you handle termo. This is not "compare a grid" |
| `apps/api/app/daily/termo/route.ts` | The fourth literal route. **Never a `[game]` dynamic segment** — that puts an untrusted `params.game` in front of the wall |
| `apps/web/src/play/play-record.ts` | Your member, `v: 1` unchanged |
| `apps/web/src/play/sync.ts` | A **non-grid** case, not a second module (ADR-0029 consequence (f)) |
| `apps/web/src/i18n/routes.ts` | Your slug, both composed routes, and your `playRoutes` key — `Partial<Record<Game, Route>>` on purpose |
| `.github/workflows/impeccable.yml` | Both routes in **all three** places. See landmine 2 |

No migration: `daily_puzzles` and `completions` already carry all four games in their enums and CHECK constraints, and `completions.outcome` already accepts `'lost'`.

---

## 6. Landmines

Numbered ones carry forward from 019 and are still live; lettered ones are new from #25.

1. **jsdom has no layout and no pointer capture.** Layout rules are asserted by reading stylesheet text through `apps/web/test/css-source.ts`. It is the only mechanism in the repo that can assert a layout rule at all.
2. **`impeccable detect` exits 0 on an unreachable URL, and passes green on the *wrong screen* when the URL is reachable but empty.** An unseeded route renders `DailyUnavailable` at HTTP **200**. That is why the CI preflight asserts `data-play-state=`/`data-conclusion-state=` **in the response body**. A 200 alone is not evidence; it is the failure mode.
3. **`CRON_SECRET` is Production-only.** Seed a preview by running the branch's own `topUp<Game>Buffer` locally against the database — same code path, same validation, idempotent, and safe pre-merge because nothing deployed reads that game's rows yet. **Verify that last clause** (`curl` the production route for a 404) rather than assuming it.
4. **Minification defeats identifier greps.** Grep for **string literals** the engine carries, and include a **positive control** in the same test so a broken grep fails loudly.
5. **A comment or ADR claiming a guarantee the code lacks was caught three times in #18 and again in #25.** Every "this is enforced by X" must name a file and a line you have read. Reviewers check these first.
6. **CI runners are ~3–4× slower than local; vitest's default per-test timeout is 5 000 ms.** Commit `271a935` exists solely because this was underestimated. Put the arithmetic in a comment.
7. **`packages/db` migrations are applied to Neon manually via `DATABASE_URL_UNPOOLED`.** Nothing in CI or Vercel runs them. If #27's guess state needs one, that is a plan-level decision, not a step-5 discovery.
8. **`apps/web/next-env.d.ts` and `apps/api/next-env.d.ts` are tracked.** If Next regenerates them modified, restore them.
9. **`.returning()` must be bare** on the union `Db` type.
10. **CSS Modules compile in `pure` mode** and **hash per file** — per-game values are custom properties, and a shared rule cannot be overridden by a same-named per-game rule.
11. **Two impeccable structural traps:** `<h1>` must be the first element child of its wrapper in *every* view — play, skeleton, unavailable, conclusion — and no keyframe name matching `/bounce|elastic|wobble|jiggle|spring/i`.
12. **`turbo` runs in `envMode: strict`.** Anything new goes in `tasks.build.env` or it is stripped.
13. **A missing `docs/README.md` row has been a blocking review finding six times.** Ship it in commit 1.

**a. `daily_puzzles` rows are immutable and killed rows count as covered.** So seeding *before* the content schema is frozen means a later schema change 500s the route, and only a hard `DELETE` recovers it. Seed once, after the review loop closes.

**b. `low-contrast` and `cream-palette` are wildcard-ignored in `.impeccable/config.json`** ([#51](https://github.com/fernandolisboa/miolos/issues/51)). **Those rules pass green regardless of what you ship — they are not evidence.** #25 nearly shipped a real WCAG AA regression on two *already-shipped* screens behind that silence. Compute and paste real contrast figures for anything new.

**c. `--accent-termo` is 2.731:1 against `--paper-desk` — the worst of the four accents**, filed as [#68](https://github.com/fernandolisboa/miolos/issues/68). #25 fixed every paper-on-accent-*fill* case via `--ink-on-accent`, but `--paper-card` cannot rescue termo either (2.736:1). **Its remaining scope is exactly the palette decision, and it is Fernando's.** Worth resolving before Termo's screen is designed, not after.

**d. A review loop will not converge if a scheduled-but-absent item is reviewable.** #25's ran four rounds (41 → 31 → 24 → 29) without an empty pass, largely because the `impeccable.yml` commit is deliberately sequenced *after* seeding and reviewers kept raising its absence as blocking. **Tell step-6 reviewers what is known-deferred and why.** Also judge convergence on blocking/high: of 125 findings across those rounds, 108 were medium or low, and fresh adversarial reviewers will always produce more.

---

## 7. Open decisions you inherit

| # | What | Status |
|---|---|---|
| [#58](https://github.com/fernandolisboa/miolos/issues/58) | A completion synced after the São Paulo rollover derives as **late** | `ready-for-human` — **Fernando's call.** Do not implement a grace window, do not widen `ACCEPTED_DAYS_BACK` (it is `1`). #27 inherits the identical window |
| [#59](https://github.com/fernandolisboa/miolos/issues/59) | A least-privilege `miolos_web` Neon role | Unstarted. Your duty is **negative**: no document, comment, ADR or PR body may say or imply the grant exists |
| [#68](https://github.com/fernandolisboa/miolos/issues/68) | The accent palette's WCAG AA failures | **Design decision.** Termo's is the worst; see landmine (c) |
| [#61](https://github.com/fernandolisboa/miolos/issues/61) | Binairo's ADR-0030 retrofit | Filed with the pointer-capture hazard documented. `use-pointer-stroke.ts`'s `onStrokeEnd` is the mechanism to adopt |
| [#63](https://github.com/fernandolisboa/miolos/issues/63) [#64](https://github.com/fernandolisboa/miolos/issues/64) [#62](https://github.com/fernandolisboa/miolos/issues/62) [#65](https://github.com/fernandolisboa/miolos/issues/65) [#66](https://github.com/fernandolisboa/miolos/issues/66) [#67](https://github.com/fernandolisboa/miolos/issues/67) | Small follow-ups from #25's review rounds | All `ready-for-agent`. #67 (hint-button tab order) touches all three games |

---

## 8. Environment

**Every node/pnpm/npx command needs the nvm preamble**, or you get the system node:

```
source ~/.nvm/nvm.sh && nvm use default >/dev/null && <command>
```

Node v24.18.1, pnpm 11.18.0. The gate, from the repo root:

```
pnpm typecheck     # turbo, 6 projects, strict
pnpm lint          # eslint --max-warnings 0 .
pnpm test          # full suite — 963 passing at b308349
pnpm build         # Turbopack prints no First Load JS column; see plan 020 §20
npx impeccable detect <url>    # from the REPO ROOT only
```

Add `--force` to bypass turbo's cache. Pre-commit (Husky + lint-staged + typecheck + tests) is **never** bypassed with `--no-verify`.

`apps/api/.env.local` holds a working `DATABASE_URL`; `apps/web/.env.local` does not. Copy it in to run the web app against real data, and **delete it afterwards**.

The Impeccable workflow fires on `deployment_status` and produces **two runs per push** — one per Vercel project. The `miolos-api` one is filtered out and reports as `skipping`; `gh pr checks` may surface that one. **Find the successful `miolos-web` run and read its log**, or you will think the gate skipped when it passed.

---

## 9. Exit criteria

Per issue, all of it green with output pasted:

- Every acceptance criterion in §1 satisfied, each mapped to named evidence.
- `pnpm typecheck` / `pnpm lint` / `pnpm test` green, with counts.
- `npx impeccable detect` green on both new routes, scanned against a preview whose buffer was seeded first, with the preflight asserting page **content**.
- The strip table updated in the same PR as the projection, and no longer throwing for termo.
- The cron and buffer-depth contracts widened in the same PR as the top-up.
- A new ADR for every decision of weight — **for #27, the offline tension and the server-judging shape are both of weight**. Next free ADR is **0038**.
- `docs/README.md` gains the plan's row in commit 1.
- The step-6 review loop closes on an **empty blocking/high** pass, with every dismissal written down.
- PR merged and issue closed, by you. The PR body states what changed, what was verified with command output inline, and whether anything needs Fernando. If nothing does, say so explicitly.

---

## 10. Next free numbers

`docs/README.md` uses **one `NNN` sequence shared across every subdirectory**. This document took **021**.

- **Next plan:** `docs/plans/022-issue-27-plan-<slug>.md`.
- **Next ADR:** `docs/adr/0038-<slug>.md` — ADRs keep their own 4-digit sequence and owe no README row. A plan and a handoff each owe one.
- **Test ids:** see `docs/agents/test-ids.md` for the frontier, and **re-derive it by grep before allocating**.

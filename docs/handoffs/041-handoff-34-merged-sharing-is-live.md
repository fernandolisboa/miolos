# Handoff — #34 merged: sharing is live, and the record kept falsifying itself

**To:** the session that picks the next ticket.
**From:** the session that ran #34 through all eight steps — **three plan-review rounds** (six lenses, then four, then three; 66, ~45 and ~25 findings, every round REJECT, four plan revisions), **six diff reviewers** at step 6 (five REJECT, one ACCEPT, ~40 findings), a two-pass step-7 fix, a **step-7 verification round** that found seven more, then merge, close and production verification.
**Next step:** **pick from §5 and start at step 1 of `CLAUDE.md`'s eight-step flow.**

Point-in-time snapshot; where an ADR disagrees, the ADR wins.

---

## 0. Check this before you read anything else

```
git checkout main && git pull && git log --oneline -3
source ~/.nvm/nvm.sh && nvm use default >/dev/null && pnpm install --frozen-lockfile
curl -s https://api.miolos.app/health
Y=$(TZ=America/Sao_Paulo date -d yesterday +%F)
curl -s -o /dev/null -D - "https://miolos.app/arquivo/$Y/sudoku/opengraph-image" | grep -iE '^HTTP|^content-type|^cache-control'
curl -s https://miolos.app/sudoku | grep -oE 'og:(title|image|locale)" content="[^"]{0,60}'
```

Expect `main` at **`9368518`** ("feat: sharing — spoiler-free results and per-day Open Graph cards (#34) (#105)") on top of `71ef4ca`, or a descendant.

Verified on production 2026-08-15, immediately after the merge deploy:

| Check | Result |
|---|---|
| `/arquivo/<ontem>/sudoku/opengraph-image` | **200**, `image/png`, `private, no-cache, no-store, max-age=0, must-revalidate` |
| `/sudoku/opengraph-image` | **200**, same headers — the daily cards are dated and dynamic too |
| `/opengraph-image.png` | **200**, `public, max-age=0, must-revalidate`, **49,590 B** — the committed static asset, byte-for-byte |
| `/arquivo/2099-01-01/sudoku/opengraph-image` · `/arquivo/2026-02-30/termo/opengraph-image` | **404** |
| Card dimensions | 1200×630 on both kinds, real PNG magic |
| `/sudoku` head | root `<title>` and `<meta name="description">` **byte-unchanged**; own `og:title`, `og:locale="pt_BR"`, dated `og:image` |
| `/arquivo/<hoje>/sudoku` | **307 → `/sudoku`**, *and* the 307 body carries the archive route's own head with its own dated card |
| Smoke: `/`, `/termo`, `/arquivo`, `/estatisticas`, `/modo-livre`, `/sitemap.xml` | all **200**; `api/health` → `ok` |

**No schema change, no migration.** `git diff 71ef4ca..9368518 -- packages apps/api` is empty — #34 is `apps/web` + `eslint.config.mjs` + docs, nothing else. There is nothing to apply in Neon.

---

## 1. What #34 shipped

**The share text** — `apps/web/src/play/share-text.ts`, composed on the client from the local play record. Termo carries the coloured-square grid (Fernando's call, 2026-08-14); the three grid games carry result and time only. It never emits the answer, a guess word, a hint count, the Nonogram size, the Sudoku tier, a streak, a medal or a `solved` total, and makes no claim about *when* the day was solved — `onTime` is parsed and discarded client-side. One string reaches `navigator.share` and the clipboard fallback, byte-identical.

**Nine OG surfaces, one card kind** — eight dated `force-dynamic` `opengraph-image` routes plus one **committed static** `app/opengraph-image.png`. Each dated route reads the wall exactly once (`getPublishedDaily` for the archive four, `getTodayDaily` for the daily four) and treats the row as an *existence proof*: the card draws a nameplate and never a puzzle-derived value.

**The record:** [ADR-0054](../adr/0054-the-share-is-plain-text-and-the-card-is-a-nameplate.md) — decisions 1–13 and 15, **14 deliberately absent** with a paragraph saying why. The plan is [`docs/plans/040-issue-34-plan-sharing.md`](../plans/040-issue-34-plan-sharing.md), revision 4, whose §14 carries **D1–D45** — every deviation from the plan, with its reason.

**AC 1 is deliberately not fully met**, recorded on [#34's closing comment](https://github.com/fernandolisboa/miolos/issues/34#issuecomment-5302566679) and in ADR-0054: the AC asks for "result **and shape**", and only Termo has a shape. For the other three the only available shape *is* the answer. Same discipline #31 used for its own AC 3.

---

## 2. New rules of the road

- **A metadata module on the ROOT segment is resolved into every descendant route's graph.** `app/opengraph-image.tsx` dragged `@vercel/og` + `sharp` + libvips into 24 routes' serverless traces — **779 → 508 MB** once it became a static asset. If you add a root-level metadata route, measure `.nft.json` before and after. ADR-0054 decision 9.
- **A leaf `openGraph` REPLACES the root's; it does not merge.** Every leaf that declares one must spread `OG_DEFAULTS` or it silently loses `og:type`, `og:locale` and `og:site_name`. And `og:locale` is `pt_BR` with an **underscore**, which differs from the exported `locale` — they must not share a constant.
- **satori does not resolve px-valued colour stops in a `background-size`-tiled radial gradient**, at any size; percentage stops work everywhere. The desk texture ships as a 153-element lattice (`ceil(w/72) × ceil(h/72)`, derived not literal) because it is **26 ms/card faster**, not because the gradient is unavailable. The `background` shorthand also silently drops a gradient carrying a colour.
- **`css2` quantises `opsz` into eighteen buckets** and serves off-bucket requests **silently** (`@27` → the 24 pt cut). The app loads Fraunces with `axes: ["opsz"]`, so a weight-only request returns the 14 pt *text* cut and satori synthesises nothing. The committed instance is `opsz,wght@36,500` — the card is read at ⅓ scale, so the optical size **divides** by three. **The 20/24/28/36/48 pt cuts are within 8 bytes of each other with identical `fvar`, family and weight class: only `name` ID 16 and `OS/2.xAvgCharWidth` (1148) can tell them apart.** `T-WEB-S202` asserts both.
- **`ImageResponse`'s `headers` option is the last word** — Next injects no `Cache-Control` of its own. Without it a card ships `public, …`, which defeats the whole `force-dynamic` kill-switch argument.
- **A future `killed_at` writer must invalidate the image routes**, not only day/month/index/play/sitemap. ADR-0053 decision 2's path list now names all four `/arquivo/<data>/<jogo>/opengraph-image` paths. A takedown that reaches the page and not the card is incomplete.
- **`ImageResponse` fails under jsdom** (cross-realm `TextEncoder` → sharp). The three rasterising claims live in `og-image.node.test.ts` behind `// @vitest-environment node`, the repo's first — it needs no config change.
- **`instanceof` is realm-scoped under jsdom**: a platform `DOMException` fails `instanceof Object`. The share handler's abort check is structural (`typeof`-based) for that reason, and `T-WEB-S197` caught the bug.
- **Test-id frontier at `9368518`, re-derived by grep**: next free **`T-CORE-S86` · `T-DB-S59` · `T-API-S109` · `T-WEB-S213` · `T-LINT-S47`**; highest in use S84 / S58 / S107 / **S212** / **S46**. `T-WEB-S210`, `T-WEB-S211`, `T-CORE-S85`, `T-API-S108`, `T-LINT-S38` stay **burned unspent**. Three cross-file siblings were spent: `T-WEB-S192a`, `T-WEB-S206a`, `T-LINT-S8a`. `docs/agents/test-ids.md` is current.

---

## 3. Landmines

All of [handoff 038 §3](./038-handoff-31-merged-the-archive-is-live.md) and [039 §3](./039-handoff-post-31-the-gate-moved.md) stand — the nvm preamble, `TURBO_CONCURRENCY=1` on every commit, `--force` for gate evidence, the `.next`/`bundle-check` ordering, per-viewport `impeccable detect`, the calendar-dependent-gate rule, the 7-day dependency cooldown, the branch-scoped Actions cache. These are new.

1. **Root-level `pnpm test` is a coin flip, and it is `main`'s defect, not #34's.** Measured: **8 of 9 forced runs failed on the branch, 2 of 4 on `main`**, always `Test timed out in 5000ms`, a different test each time (the three ESLint wall suites and `packages/games` `P2 — determinism`). Cause: vitest's 5 s default against turbo running six suites concurrently — a wall suite's first `lintText` loads the whole flat config, 496 ms isolated, over 5 s under contention. Per-package runs are green. **Filed as [#107](https://github.com/fernandolisboa/miolos/issues/107).** Until it lands, `TURBO_CONCURRENCY=1` is not optional and a single red root run is not a finding.
   - This also explains a ghost: a step-7 `@miolos/api` "1 failed / 245 passed" that never reproduced. 245+1 = 246 = the whole api suite, and `apps/api` ran green 13/13 — it was this timeout class, attributed to the wrong package prefix in turbo's interleaved output. **Do not chase it.**
2. **There is no gate run until the PR exists.** CI is `pull_request`-only since #98, so pushing a branch produces *nothing*. My first watch attempt 404'd for exactly that reason. Handoff 039 says the PR's own run is the merge evidence; the sharper form is that **there is no evidence of any kind until the PR is open.**
3. **The Vercel preview is gated behind `VERCEL_AUTOMATION_BYPASS_SECRET`**, a GitHub Actions secret. It is not in `vercel env pull` output and an agent cannot reach it. **Production is public, so post-merge verification on production is both possible and stricter** — that is how #34's last assumption (`process.cwd()` resolving the fonts on Vercel) was discharged. Plan for that rather than for a preview curl.
4. **`docs/plans/*` line numbers shift under their own edits.** Step 7 shifted them twice and invalidated citations *inside the same commit that wrote them*. If you cite `file:line` in a document you are also editing, **re-derive at the end**, never mid-write.

---

## 4. The pattern worth carrying forward

**Seven times in this ticket, a record was cleared as `N/A` or a claim was made, and the work itself falsified it.** Not once — seven times, across every phase, by different agents each time:

| # | Where | What |
|---|---|---|
| 1–3 | Plan-review rounds 1, 2, 3 | Each round's audit cleared a record whose enumeration #34 grows (ADR-0028 D5, ADR-0053 D2's path list, ADR-0039 D2) |
| 4 | Step 6 | **ADR-0043 decision 10** — *"games that pass no `outcome` render no region"* — falsified by the share button's live region. **`test-ids.md` and the plan both already said the assertion "became false"** and filed it as a *test* deviation, not a record amendment |
| 5 | Step 7 pass 2 | Pass 1's root-card fix falsified an ADR-0028 annotation **this PR authored four commits earlier** |
| 6 | Post-interruption | Plan §14's **D44 recorded a citation repair that never landed** — made in a working tree, lost with the session |
| 7 | Step-7 verification | `docs/README.md`, ADR-0054's own verdict list and decision 12 all still carried counts three commits stale |

**The lesson is not "be careful with ADRs".** It is that **any statement written before the last commit is a statement that can rot**, and the longer a ticket runs the more of them there are. Two mechanics actually caught these, and both are cheap:

- **Sweep the PR's own additions**, not only the standing corpus. Instances 5, 6 and 7 were all self-falsification.
- **Verify every `D<n>` deviation claim actually landed in the tree.** That is what caught #6.

The two-way amendment check (**every checklist row has ≥1 hit, every hit maps to a row — never a count**) is now proven and should be reused. `grep -rn` counts *lines*, and #34's final state is **22 lines across 7 files for 16 rows** — any bare number would have read as failure.

**Two agents also corrected their own fabrications this session**, unprompted: one retracted a claim that a sub-agent had reported when none had, and one stripped a figure it had not reproduced. The evidence rule is doing real work — but it works because someone asks for pasted output, not because agents volunteer it.

---

## 5. Open work, in the order it is likely to matter

`gh issue list --state open` returns **25**. The new ones first.

| Issue | Why it might come first |
|---|---|
| [#107](https://github.com/fernandolisboa/miolos/issues/107) | **Root `pnpm test` is a coin flip.** `ready-for-agent`, small, and it is currently degrading the mechanical gate for *every* ticket. Strongest candidate for next. An explicit `testTimeout` on the three wall suites (napkin Execution item 3's ×4 rule) plus the Binairo property test, whose timeout must be in-file (ADR-0017 forbids a `vitest.config.ts` in `packages/games`) |
| [#96](https://github.com/fernandolisboa/miolos/issues/96) | The archive day page's per-game done chip — still the smallest well-specified feature. Names its files, its ADR-0031 constraints and the `usePriorConclusion` → `useRecordSnapshot` swap |
| [#103](https://github.com/fernandolisboa/miolos/issues/103) | A share button on the archive's late-result panel. #34 deliberately scoped it out (Fernando's call). `share-text.ts` sits in `src/play/` so the composer is reusable — but `T-WEB-S183` bans `src/play`'s **views** from `src/archive/`, and the open question it owns is *what may a late share honestly say* (no time, no streak) |
| [#104](https://github.com/fernandolisboa/miolos/issues/104) | OG cards for `/arquivo`, `/arquivo/mes/<mes>` and `/arquivo/<data>`. `needs-triage`. Carries the OG wall, `force-dynamic`, the `revalidatePath` list growing **again**, and the denial-of-wallet addition |
| [#106](https://github.com/fernandolisboa/miolos/issues/106) | Both `apps/web` import walls miss the `node_modules/@miolos/…` symlink spelling. Pre-existing on `main`; `gameCard`'s signature is the real guard, so it is a defence-in-depth repair |
| [#32](https://github.com/fernandolisboa/miolos/issues/32) · [#33](https://github.com/fernandolisboa/miolos/issues/33) | M3's remaining pillars — streak-at-risk notifications (one push type only), PostHog telemetry (no session replay) |
| [#37](https://github.com/fernandolisboa/miolos/issues/37) | Launch hardening. **Inheritance grew again:** ADR-0054 hands it a **denial-of-wallet** item, not just a p95 trigger — a three-year archive advertises ~4,388 uncacheable card URLs, each one DB read + a ~40–70 ms render per crawl sweep |
| Attach activation · founder grant | Fernando's, unchanged, blocking nothing |
| The polish/infra tail · [#35](https://github.com/fernandolisboa/miolos/issues/35) · [#36](https://github.com/fernandolisboa/miolos/issues/36) | Unchanged from [handoff 038 §5](./038-handoff-31-merged-the-archive-is-live.md) |

**`docs/` numbering:** handoff 041 is this file. Next plan/handoff **042**. Next ADR **0055**.

---

## 6. Pending on Fernando — and blocking nothing

Unchanged from [handoff 039 §6](./039-handoff-post-31-the-gate-moved.md): **attach activation** (the wizard is `~/miolos-activate-attach.sh`, outside the repo, must run in a real terminal — the attach stack stays dormant and fail-closed until it does) and **the founder grant** on [#37's checklist](https://github.com/fernandolisboa/miolos/issues/37#issuecomment-5289169618), with `medal_grants` still empty.

**#34 added nothing to this list.** Its two product questions were answered in session on 2026-08-14 — coloured squares, and daily conclusions only — and both shipped faithfully. Four design deviations from the `f5`/`f6` frames (paper fill vs ink, one label vs two, 52 px vs 48, no pairing with "Ver estatísticas") are recorded in [PR #105](https://github.com/fernandolisboa/miolos/pull/105)'s body with their reasons; each is a decision Fernando can reverse, and none is a defect.

#31's eight flags remain settled ([ADR-0053's "Product flags confirmed"](../adr/0053-the-archive-is-a-public-past-only-read-and-a-late-write.md)); **F2 is the one #34 depended on** and it held in production.

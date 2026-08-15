# Implementation plan — Issue #34: M4: Sharing — spoiler-free results and OG cards

**Revision 4 (step-4 fix, round 3).** Revision 1 was rejected by all six step-3 lenses (66 findings); revision 2 by all four round-2 lenses (~45, eleven blocking); **revision 3 by all three round-3 lenses (~25, three blocking plus one medium blocking on substance)** — narrowly, and with all three agreeing that no product, design, route or ADR *decision* had to move. None did. Revision 4 resolves every round-3 finding; **nothing is dismissed**, and the two fixed differently from the way they were proposed say so in §14 batch 3. **§14 carries all three disposition tables** — batch 1 for round 1's 66, batch 2 for round 2's, batch 3 for round 3's — and nothing any round raised is closed by silence. Where earlier text is now wrong it has been **replaced, not annotated**. Decision ids (D1…D15) and batch ids (I1…) are stable; where content moved, the id kept its subject.

**Read this if you read nothing else: four things more than one round has now proved wrong.** (i) A claim labelled *measured* that is not is worse than no claim — V4's justification was false in revision 1 and false again, differently, in revision 2; §7.2a's optical-cut numbers were then wrong in a third way in revision 3, using three references in one paragraph. Both are going into a permanent ADR. (ii) An absence assertion with no way to go red is not a test — round 1's B7 came back on revision 2's fixtures and again on revision 3's daily log line. (iii) **A criterion stated after the choice it selects is not a criterion**; §7.2a now states it in one sentence first, applies it, and reports every rival criterion with its number. (iv) The amendment audit has cleared, in **three** consecutive rounds, records whose **enumerations** #34 grows. Revision 4 changes its method, not only its answer: it is run by **shape** — forward-tense prescriptions that enumerate route artifacts — and §11.2(iii-b) records the sweep and its full hit list so the hunt can be checked, not only the verdicts. §13's exit count is derived **from the (iv) table**, never adjusted by hand.

**The five structural changes revision 3 made, each of which rewrote more than one section — and what revision 4 changed in each:**

1. **The committed Fraunces face is an *optical* instance, and it is chosen against the size the card is READ at, not the size it is authored at** (RB1). The card ships `Fraunces:opsz,wght@36,500`, not the `wght@500` default — which is silently the 13–15 pt **text** bucket. The reasoning is V6's own ×3 rule applied to the one property that must **not** be multiplied by three. **§7.2a states the selection criterion before it quotes a number** (T1): minimise the deviation of the hero run — the game name — from the browser's own `font-optical-sizing: auto` at the size the recipient reads it, holding the wordmark inside 2.5 %. On that criterion 36 pt is **−0.23 %** at the name and **−2.22 %** at the wordmark, against **−16.5 %** for the opsz96 cut a naive author-pixel reading would pick. `T-WEB-S202` gains two assertions that can actually see the cut — necessary, because the three adjacent cuts are byte-for-byte the same size (§7.2a, D12, §9).
2. **The OG wall is written out in full, in the shape `eslint.config.mjs:526-555` uses, and it proves it did not delete the db wall** (RB2). Measured on the real config: a wall object that declares only its own arrays takes **all eight** db-wall probes that red today at `apps/web/app/opengraph-image.tsx` to clean, and `pnpm lint` stays green. Four fresh probes and one sibling id pin it (D15, §9).
3. **A transient database failure returns 500, not 404** (RB11). The catch is narrowed to the projection class — the failure `getArchivedDaily`'s doc block is actually about — and everything else re-throws. A Neon timeout on a route whose audience negative-caches for days is not a 404 (D8, §7.3, §9).
4. **The desk texture's mechanism is justified on what was measured, and the measurement is right this time** (RB5). Satori resolves a **px** gradient stop as `value / elementWidth` of the gradient's own radius, so a 3 px stop inside a `background-size`-tiled radial gradient collapses to ~0.13 px at *every* output size; **percentage** stops tile correctly everywhere. The lattice ships because it is ~26 ms/card faster, not because the gradient does not work — and it is **153** elements, not 120 (V4, §7.2).
5. **The amendment audit is re-derived from scratch** (RB3, RB4, RA4–RA10), and it is no longer "no decision moves, two annotations": #34 grows the `force-dynamic` route enumerations in **ADR-0028 (three sites), ADR-0053 and — found only at round 3 — ADR-0039**, plus one standing `revalidatePath` path list, and that last one is a live kill-switch hole (§11.2, §11.4). The authoritative list is §11.2(iv)'s table; no count is stated outside it.

**What revision 4 changed, in one line each** (§14 batch 3 is the full disposition): (1) §7.2a's argument is replaced — criterion first, one reference, the bucket set enumerated against live `css2`, the rival criteria reported with their numbers — while the committed cut stays `opsz,wght@36,500`; (2) nothing; (3) `dailyCardHandler` is written out, because it has no date to log and revision 3's shared sample did not compile for four of the eight routes; (4) nothing; (5) the audit gains ADR-0039's fifth-game recipe, ADR-0053 decision 4's 404-vs-500 clause and ADR-0002 `:41`, is re-run by **shape** with the sweep recorded, and its exit count is re-derived from the table at **thirteen rows**. Eleven test rows are tightened besides.

Written at step 2 of CLAUDE.md's eight-step flow, against `main` at `71ef4ca`; revisions 2, 3 and 4 re-verified against the same commit. Point-in-time snapshot; where a later ADR disagrees, the ADR wins.

**Issue:** [#34](https://github.com/fernandolisboa/miolos/issues/34) — four acceptance criteria: (1) each game produces a spoiler-free share text, *result and shape, never the answer or the grid's content*; (2) per-day, per-game OG images on the public URLs, in the Ateliê system, generated in code; (3) OG generation is a public read path through the published-predicate helper and can never render an unpublished day (ADR-0004/0014); (4) shared links land on the exact day/game page, and the share flow works on mobile (Web Share API with clipboard fallback). Zero comments on the issue. Blocked-by [#31](https://github.com/fernandolisboa/miolos/issues/31) (CLOSED); blocks [#37](https://github.com/fernandolisboa/miolos/issues/37).

**What #31 handed over, and it is exactly three things** ([ADR-0053](../adr/0053-the-archive-is-a-public-past-only-read-and-a-late-write.md) `:964-967`): a stable per-day-per-game URL, a per-day URL that resolves for today too (the 307), and the same wall readers as the single public read path. *"It inherits **no dormant surface** — no image route, no share text, no card ships here."* Verified: `grep -rn "opengraph\|og:image\|twitter:image\|ImageResponse\|next/og"` over `apps` and `packages` (excluding `node_modules`, `.next`) returns **nothing**, and `grep -rn "navigator.share\|navigator\.clipboard\|writeText\|compartilh"` likewise. #34 is greenfield on both axes.

**Governing records, read in full:** [ADR-0002](../adr/0002-plain-react-web-ui-not-universal-rn-web.md) (`:37` — *"Next.js `ImageResponse` gives per-day, per-game Open Graph share cards natively — the distribution mechanic from ADR-0001"*, the standing sanction for the mechanism; `:41` the native client needs **static instances** of Fraunces, which decision 12 turns out to need first), [ADR-0004](../adr/0004-no-unpublished-puzzle-reaches-the-client.md) (`:25` nothing unpublished reaches the client; `:13` *"There is nothing to cheat for"*), **[ADR-0010](../adr/0010-publication-is-time-driven-published-at-plus-buffer.md) `:20`** (*"**Every** read path — daily, archive, **OG images**, anything — filters `published_at <= now()`, and does so through **one shared query helper**, not a predicate re-typed per route"* — **the only rule in the corpus that names OG images, and therefore AC 3's actual governing sentence**; revisions 1 and 2 never listed it, RA10), [ADR-0006](../adr/0006-monetization-convenience-not-access.md) (`:51` not an anti-cheat system — the posture decision 3's residual is accepted on), [ADR-0013](../adr/0013-canonical-domain-and-pt-br-routes.md) (`:35-36` OG cards target `miolos.app`; **nothing hardcodes the apex outside environment config** — what `absoluteUrl()` discharges), [ADR-0014](../adr/0014-apps-web-reads-the-database-directly-for-public-pages.md) (`:18` names **"OG images"** in its scope line, already annotated by #31 with *"'cacheable' is no longer load-bearing"* — so #34 uses the clause **as amended**, not as written, RA7; `:19` every such read goes through the shared helper, *"never to raw tables"*. **`:12` classifies "OG image generation" as part of the SEO surface and is therefore in tension with ADR-0028 `:36-38`, not support for it** — §11.2(ii), RA4), [ADR-0018](../adr/0018-i18n-is-an-in-repo-typed-message-module.md) (`:15` all copy in `messages.ts`), [ADR-0028](../adr/0028-daily-play-routes-and-the-conclusion.md) (`:36-38` the daily play routes are **not an SEO surface** — decision 10 is written against that sentence; decision 2, the conclusion is a state *and* a route), [ADR-0029](../adr/0029-shared-daily-play-layer-in-apps-web-src-play.md) (decision 2, the shared/per-game seam — decision 1 is argued against it), [ADR-0031](../adr/0031-per-device-day-state-is-a-local-monotone-safe-affordance.md) (decision 2 monotone safety; **decision 6 `:84-89`** — device state *"may drive an affordance … and never an entitlement"*, the ADR that permits a share built from the local record), [ADR-0033](../adr/0033-the-nonogram-reveal-ships-no-name.md) (**Context `:23-30`** — *"`solveNonogram(clues)` recovers the picture from the published clues alone — measured over the wire projection only, 280 dailies, 0 mismatches, worst 0.338 ms"*; and **decision 2 `:49-55`**, whose first sentence at `:49-50` is *"This is a PRODUCT decision, not a security one, **and it is stated in those words wherever it is cited**"*. **Revisions 1 and 2 cited both at `:26-34`, which is Context and contains neither the decision nor that sentence** — RA9; decision 8 below is written in decision 2's actual words), [ADR-0034](../adr/0034-the-completion-celebration-renders-in-the-conclusion.md) (**decision 3** the optional plain-data prop rule; **decision 4** a celebration's design compliance is proved by file-mode checks, not by the URL scan; **consequence (c)** *"'One per game' stays the number to beat"* — decision 1 is argued in its terms), [ADR-0036](../adr/0036-aligning-numerals-use-instrument-sans-not-fraunces.md) (decision 2's single, non-aligning carve-out — why the card needs no tabular figures), [ADR-0041](../adr/0041-accents-colour-shapes-never-words.md) (decision 1 — an accent may colour a shape, never a word; the card obeys it without invoking the measured exception), [ADR-0043](../adr/0043-the-conclusion-has-a-fourth-state-and-it-is-a-loss.md) (decision 1 the fourth state; decision 5 the guess count; **decision 6 the canonical answer renders on both outcomes** — on screen, and decision 3 below says never in the share; **decision 8** `ConclusionCopy` is not widened; **consequence (a)** closes `ConclusionView`'s prop budget at two), [ADR-0045](../adr/0045-the-termo-screen-ships-no-hint-and-no-clock.md) (**`:186-191`** the **dead share button** rule — the Rejected bullet starts at `:186`; revisions 1 and 2 cited `:185`, which is the tail of the previous bullet — cited by name from `conclusion-view.tsx:72-73`, and #34 discharges it), [ADR-0046](../adr/0046-free-play-routes-levels-and-the-ephemeral-session.md) (`:31` ADR-0011's shareable-seed idea is *"noted, not scheduled"* — free play gains nothing here), [ADR-0047](../adr/0047-bundle-markers-are-route-scoped.md) (route-scoped markers, fail closed), [ADR-0051](../adr/0051-statistics-are-read-time-derivations-on-closed-contracts.md) / [ADR-0052](../adr/0052-medals-are-derived-facts-plus-curated-grants.md) (decision 3's exclusion list, and §11's threat model), [ADR-0053](../adr/0053-the-archive-is-a-public-past-only-read-and-a-late-write.md) (**decision 1** the routes and the 307; **decision 2** `force-dynamic` and its standing `revalidatePath` precondition; **decision 4** the readers; **decision 15** the deploy-ordering rule decision 14 argues has no analogue here; the *Product flags confirmed* section `:992-1038`, F1–F8, **settled — not re-asked**), `CONTEXT.md`, `DESIGN.md`, `PRODUCT.md`, `packages/ui/tokens.css`.

**Napkin, binding:** item 4 (the falsified-record standard — §11.4), Parallel-Stream item 1 (the `docs/README.md` row ships in the same PR as the artifact — *"a blocking review finding in four consecutive PRs"*), Execution items 1, 2, 7, 8, 9, 10, Domain item 3 (`/` is the un-budgeted baseline).

**Proposed ADR:** **ADR-0054** (§11.1) — the share and the card, **fifteen** decisions (revision 2 said thirteen and silently dropped D14 and D15, one of which carries a standing lint wall — RA6). It **amends three records by growing their per-route enumerations** (ADR-0028, ADR-0053, ADR-0039), carries an `Amends:` header for them, **ten** in-place annotations across five files and the reciprocal `Amended by:` line on three. **No count of `ADR-0054` hits is stated here, deliberately** — §11.2(iv) is the authority and §13 checks its **rows**, not a number (U7: `grep -rn` counts lines, so an annotation naming the ADR twice would read as a failure against any figure written down). The audit is re-derived from scratch in §11.2 and re-run at write, at commit and at exit. ADR-0055 is deliberately **not** allocated: §11.1 argues why the font decision is one decision inside 0054 rather than a record of its own.

**Branch:** `feat/34-sharing`, **one pull request** (decision 14). Conventional Commits, `TURBO_CONCURRENCY=1` on every `git commit`, files staged explicitly, pre-commit never bypassed.

**The hard parts of this ticket are not the button and not the card.** They are (a) **the font blocker** — satori cannot read woff2 and the repo has nothing else, and the variable fonts Google ships for both families *throw* rather than degrade (decision 12, verified); (b) **Trap A** — a scraper that follows the 307 on today's permalink lands on `/sudoku`, which has no metadata at all, so the OG surface is two route families and not one, **and the redirect-following majority is the population that matters** (decision 6/7/10, B1); (c) **three of the four games have no shape**, and the honest answer is to say so rather than invent one (decision 3, flag F1); and (d) **the share text is composed from a device-local record whose most interesting fields are the ones it may not use** — the Termo answer sits in the record the composer reads (`play-record.ts:341`), and the ten volume medals #31 made self-mintable become socially visible here for the first time (decision 4, §12's threat note).

---

## 1. Scope & non-goals

**In scope — `apps/web` only.**

- **`apps/web/src/play/share-text.ts`** — new. The pure composer: `PlayRecord` + `(game, date)` in, one string out. No React, no DOM, no `@miolos/db`, no `@miolos/games`.
- **`apps/web/src/play/conclusion-view.tsx`** — the `ShareButton` sub-component and its one call site, in the shared `<aside>` between the CTA and `.secondaryLink`. In-file, following `ConclusionStats` / `StreakCard` / `DayChip` (decision 1).
- **`apps/web/src/play/conclusion-view.module.css`** — `.share` and its states; the header comment at `:5-6` rewritten (§11.4).
- **`apps/web/src/i18n/messages.ts`** — a new top-level `share` block (§6.3), a new `og` block (§7.4: the two `alt` strings, the four `openGraph` title/description pairs the daily routes need, **and `siteTagline`, which revision 2 assumed already existed and does not** — RD3). **No new `meta` keys** — H1's resolution means the daily pages gain no page-level `title` or `description`, so `messages.meta` is untouched.
- **`apps/web/src/site-origin.ts`** — **doc block only** (`:5-11` names three surfaces; the share text is a fourth — §11.4).
- **`apps/web/src/og/`** — new directory: `card.tsx` (the pure card builders and the dot lattice), `handlers.ts` (the two shared route handlers), `fonts.ts` (`export const FONTS`), `tokens.ts` (the literal palette in 8-digit hex — see §7.2 on why a PNG cannot read a CSS custom property), `defaults.ts` (`OG_DEFAULTS`).
- **`apps/web/assets/fonts/`** — new: three committed static TTFs (**168,996 B**, i.e. 169.0 KB decimal / 165.0 KiB — the unit is stated because the two differ by 4 KB and the plan quotes the figure five times), two `OFL.txt` files and `SHA256SUMS` (decision 12). The Fraunces face is named **`Fraunces-36pt-500.ttf`**, with the optical size in the filename, so a swap for a different cut is visible in a diff rather than only in a digest (RB1).
- **Nine metadata-image routes** (decision 7): `app/opengraph-image.tsx` (static, reads nothing); `app/{binairo,sudoku,nonogram,termo}/opengraph-image.tsx` and `app/arquivo/[data]/{binairo,sudoku,nonogram,termo}/opengraph-image.tsx` — **eight dynamic game cards, all eight reading the wall** (decision 7, as revised at B1).
- **Metadata**: `app/layout.tsx` gains `openGraph` + `twitter` defaults (decision 11); the four `app/<jogo>/page.tsx` gain a static `export const metadata` carrying **`openGraph` only** (decision 10, H1); the four `app/arquivo/[data]/<jogo>/page.tsx` gain `openGraph` inside their existing `generateMetadata` (decision 10). Every leaf `openGraph` spreads `OG_DEFAULTS` (decision 11, B4).
- **`apps/web/app/sitemap.ts`** — **comment only**: one clause, plus the repair of its own `:28-30` citation, which is off by eight (§11.4, A7).
- **`eslint.config.mjs`** — two wall edits (decision 15): `**/play/share-text` joins the **free-play** wall, both halves; and a new **OG wall object (4)** bans `@miolos/games` from the card and the image routes, both halves (B3) — **repeating objects (1) and (2)'s arrays verbatim**, because a flat-config object *replaces* a rule's whole configuration and a wall that declares only its own arrays deletes the db wall for exactly the eight routes that read the database (RB2, measured in D15).
- **`apps/web/scripts/route-client-js.mjs`** — the four `/<jogo>/concluido` routes join `BUDGETED` (decision 15).
- **`.gitattributes`** — `*.ttf binary` (decision 12).
- **Tests**: **six** new files, one of them the repo's first node-environment suite (§9). **Four** suites are widened in place: `archive-metadata.test.ts` (a new `describe`, `T-WEB-S209` — **not** `T-WEB-S173`, which is left alone), `conclusion-view.test.tsx` (`T-WEB-S205`), `eslint-free-play-wall.test.ts` (`T-LINT-S39`/`S40`) and `eslint-db-wall.test.ts` (`T-LINT-S8a`). *(Revision 2 said "five new files" and listed six, and "two widened" and named two of four — RQ15's citation-drift class.)*
- **Docs**: this plan (040) + its `docs/README.md` row; ADR-0054 + its row; one CONTEXT.md row; `docs/agents/test-ids.md` re-derived; the falsified-record sweep (§11.4); two follow-up issues filed (§13).

**Non-goals — explicitly out, each with its reason.**

- **No share button on the archive's late-result panel.** Settled by Fernando in session on 2026-08-14. `late-result.tsx:73-76`'s deliberate absences (*"no time, no streak, no day chips, no chaining CTA, no statistics, and no link to today's dailies"*) stay intact. AC 1's *"each game"* is satisfied by the four daily conclusions. **Filed as a follow-up, not dropped** (§13). `share-text.ts` is placed in `src/play/` rather than inside `conclusion-view.tsx` precisely so that follow-up is a wiring job: `T-WEB-S183` bans `conclusion-view`, `termo-conclusion`, `nonogram-conclusion`, `readDayState` and the four `*-screen.tsx` roots from `src/archive/` — **not** `src/play/**` wholesale.
- **No OG card of its own for `/arquivo`, `/arquivo/mes/<mes>` or `/arquivo/<data>`.** They inherit the root card. The AC's words are *per-day, per-game*; the day page is per-day and not per-game. Flag F8; follow-up filed (§13).
- **No `packages/db`, `packages/core`, `packages/games`, `packages/ui` or `apps/api` change of any kind.** `git diff main -- packages apps/api` comes out **empty**, and §13 makes that an exit criterion. Both readers #34 needs are already exported from the root barrel (`packages/db/src/index.ts:20`) and already on the db wall's permitted list (`apps/web/test/eslint-db-wall.test.ts:777-786`): **`getPublishedDaily`** for the archive four and **`getTodayDaily`** for the daily four (decision 8, as revised at H2). So `T-DB-9a`, `T-DB-9b`, `T-DB-9e`, `T-DB-S5` and `T-LINT-S37` do not move. `getArchivedDaily` and `archiveDateClass` are **no longer called by #34 at all** — the three-read path they served is gone.
- **No edit to `packages/db/src/published.ts`, and specifically not to `getTodayDaily`'s TSDoc at `:116-145`.** That block is deliberately ticket-free (#31 step-6 finding F22: *"this sentence has already had its justification moved from one unshipped ticket to another (#31 → #34) and a third move would falsify it again"*). **Revision 2 removes the plan's dependence on that TSDoc entirely** (H2): with the archive four on `getPublishedDaily`, #34's `getTodayDaily` calls are the four daily image routes, each of which reads exactly what its sibling page at the same segment already reads (`app/sudoku/page.tsx:13`). There is no new argument to make about that reader, so there is nothing to record in it. **Nothing is added, including "#34".**
- **No `revalidate` anywhere.** ADR-0053 decision 2's precondition binds (decision 9).
- **No new npm dependency.** `next/og` ships inside `next@16.2.12` (`apps/web/node_modules/next/og.js`). The 7-day `minimumReleaseAge` cooldown and `trustPolicy: no-downgrade` therefore never fire on this branch.
- **No new page, so no `impeccable.yml` edit, no `route-ssr.test.tsx` row, no `sitemap.ts` entry.** A metadata image route is not a page: `app/manifest.ts:14-16` records the precedent, and `next/dist/build/route-bundle-stats.js:116-117` skips any app path not ending in `/page`, which is why `route-bundle-stats.json` holds 24 entries and none of `/manifest.webmanifest`, `/sitemap.xml`, `/robots.txt`. Adding an OG route to any of those three lists would be an active mistake.
- **No `export const runtime = "edge"`.** The archive image routes read the database through `@miolos/db` and the Neon serverless driver on node is what the rest of `apps/web` already uses. Nothing is pinned today (`grep -rn "export const runtime" apps/web` returns nothing) and nothing is pinned here; node is the default.
- **No service worker, no dark mode, no telemetry.** #32/#33/#36 own those.
- **Free play gains nothing.** It records nothing (ADR-0046 `:31`), so it has nothing to share. Decision 15 makes that mechanical rather than aspirational.

**Not touched at all:** `packages/**` (every file), `apps/api/**`, `apps/web/src/{archive,free-play,medals,stats,streak,attach,binairo,sudoku,nonogram,termo}/**`, `apps/web/src/play/**` except `share-text.ts` (new), `conclusion-view.tsx` and `conclusion-view.module.css`, `apps/web/app/{estatisticas,privacidade,vincular,modo-livre,arquivo/page.tsx,arquivo/mes,arquivo/[data]/page.tsx}/**`, `apps/web/app/robots.ts`, `apps/web/app/manifest.ts`, `apps/web/next.config.ts`, `turbo.json`, `pnpm-workspace.yaml`. **A diff in any of these at review is a finding by itself.** Three named, bounded exceptions:

- (i) `apps/web/src/site-origin.ts` — the doc block's three-surface sentence becomes four. **No code line moves.**
- (ii) `apps/web/app/sitemap.ts` — **one comment clause** in the `:32-37` exclusion block, saying that OG metadata on the daily routes is a sharing affordance and not indexation, so the exclusion stands; **plus the repair of the same block's `:28-30` citation to `:36-38`**, which is where ADR-0028's *"neither cacheable nor an SEO surface"* sentence actually is (A7 — the plan inherited the off-by-eight and would otherwise propagate it into ADR-0054). It exists to stop a later ticket "fixing" the sitemap. No code line moves.
- (iii) **There is no third exception.** Revision 1 reserved `apps/web/next.config.ts` for decision 12's `outputFileTracingIncludes` escape hatch. **That hatch does not exist** (H4): `apps/web`'s build is bare `next build`, Turbopack is the Next 16 default (`next/dist/lib/bundler.js:74-77`), and `outputFileTracingIncludes` is read **only** inside `collect-build-traces`, which `next/dist/build/index.js:1541` gates on `bundler !== Bundler.Turbopack`. Verified empirically: adding an entry and rebuilding changes nothing. Turbopack's own tracer does the job instead, and decision 12 now proves it **at I24, locally, before the preview**. If the trace ever fails, the fallback is decision 14's cut-the-OG-half, not a config line.

---

## 2. The flags, in Fernando's terms

Product-visible rulings, each one sentence plus its alternative, so the decision does not require reading the plan. He can override any of them in the PR without blocking the merge.

| # | The call | The alternative if he says no |
|---|---|---|
| **F1** | **Only Termo's share has a shape.** Binairo, Sudoku and Nonogram share a header, a time and a link, and nothing shaped — because they have no per-cell verdict to encode, and the same rule that permits Termo's squares forbids inventing squares for them (decision 3). **AC 1's word "shape" is therefore met by one game of four, deliberately.** | Manufacture a per-game glyph (a time bar, a difficulty strip). It would be decoration in a channel with no design system, encode nothing, and be the *only* thing on the share a recipient could not act on. |
| **F2** | **The share carries no hint count, no streak, no medal and no solved total** (decision 3). | Add `sem dica`. It is a virtue claim built from a user-editable `localStorage` field (ADR-0027, ADR-0031 decision 6) and it is the class of thing §12's threat note is about. |
| **F3** | **One button label, "Compartilhar", at both viewports, in the paper treatment** — third in an emphasis ladder below the ink CTA and above the `Ver estatísticas` text link (decision 13). | f5 literally: an ink-filled *"Compartilhar resultado"* on desktop and *"Compartilhar"* on mobile, paired with a paper *"Ver estatísticas"* button. That is two strings for one control and a second ink-filled full-width button stacked under the chaining CTA the shipped design made primary. |
| **F4** | **All eight game cards are dated and dynamic**, the daily four included (decision 7, revised). One card kind, one read path, and AC 2's *"per-day"* delivered on the path people actually share. Cost: **one Neon read plus one ~50–70 ms warm rasterisation per SCRAPE** — not per pageview; a metadata route is fetched once per shared link by the scraper, and `app/sudoku/page.tsx:13` already does `force-dynamic` + `getTodayDaily` on every real pageview. | Dateless and static on the daily four, as revision 1 proposed. **Rejected, and the reason is that the objection was mis-framed.** The staleness failure it names — *"a card saying 14 de agosto while the URL serves the 15th's puzzle"* — applies to a **hand-typed** `/termo` link. A link **this product emits** is `/arquivo/<data>/<jogo>`, date-stamped in the scraper's cache; on re-scrape the date is past, the 307 is gone, and the archive head plus the dated archive card serve — still correct. Meanwhile every major target (Facebook/WhatsApp, X, Slack, Discord, LinkedIn) **follows the 307** on the day of sharing and reads `/<jogo>`'s head, so a dateless daily card is the card the dominant share path actually renders. Keeping it would have made AC 2 *"per-day"* deliberately unmet on the day people share. |
| **F5** | **No OG card carries puzzle content** — no givens, no clue rails, no board, no picture. The wall read is an existence proof, not a source of pixels (decision 8). | Draw the Sudoku givens or the empty Termo board. Unreadable at thumbnail size, a spoiler argument to re-litigate per game, and for Nonogram flatly impossible (ADR-0033). |
| **F6** | **Three static font binaries are committed to the repo** (169.0 KB, OFL, with their licences, digests and provenance) because satori cannot read the woff2 the app ships and *throws* on the variable TTFs Google serves (decision 12). The Fraunces face is the **36 pt optical cut**, chosen against the size the card is *read* at rather than the size it is authored at, by a criterion §7.2a states before it applies (hero run first, wordmark inside 2.5 %); the residual is that a static instance is one point on a continuous axis, and it is measured — −0.23 % at the name, −2.22 % at the wordmark — rather than left as prose. | Accept `next/og`'s bundled Geist on every card. Off-brand against `DESIGN.md` and against `.impeccable/config.json`'s allowlist, and nothing mechanical would catch it — `impeccable detect` does not scan a PNG. |
| **F7** | **No share button on the archive's late-result panel** — recorded, not asked: he settled this in session on 2026-08-14. The follow-up issue is filed as part of this ticket's exit. | — |
| **F8** | **`/arquivo`, `/arquivo/mes/<mes>` and `/arquivo/<data>` get the generic site card**, not one of their own (decision 7). | Two more image routes. `/arquivo/<data>` is the natural *"fechei o dia"* share target and is a good follow-up; it is not what the AC asks for. |

**These eight flags go in the PR body verbatim and as a comment on #34 before step 8 closes it** (I1's fix — §13). #31's discipline was that a deliberately-unmet acceptance criterion binds **outside** the plan, and F1 is one: AC 1's word *"shape"* is met by one game of four, on purpose. The PR body says so in those words — *"this acceptance criterion is not fully met as written, and here is the accepted cost"* — and no other AC now carries a carve-out, because B1's resolution made AC 2 met.

---

## 3. Decisions register — the share text

### D1 — The share is composed inside `ConclusionView`, from the record it already reads. No fifth prop, no new wrapper.

**Decision:** `ConclusionView` gains an in-file `ShareButton` and calls a new pure module `apps/web/src/play/share-text.ts`. `ConclusionView`'s props stay at **seven** — three required (`game`, `date`, `copy`) and four optional (`result?`, `picture?`, `outcome?`, `answer?`), as the file itself declares at `conclusion-view.tsx:89-105`. Binairo and Sudoku gain **no** wrapper. `ConclusionCopy` is **not** widened. *(Revision 1 said "six" and then listed seven; the arithmetic is load-bearing to two ADR verdicts in §11.2, so it is corrected rather than glossed — A6/I6.)*

**Why this and not the two alternatives, in ADR-0034 decision 3 / ADR-0043 decision 8 terms.**

ADR-0034 decision 3 admits an optional prop under two rules: *plain data only*, and *supplied only by a client component that owns the local play record, never by a server segment* — the second because `/<jogo>/concluido` renders for players who have not solved, so a server-computed payload turns the bookmarkable conclusion into a spoiler channel. **`ConclusionView` is itself a client component that owns the local play record**: `"use client"` at `conclusion-view.tsx:1`, `useRecordSnapshot(game, date)` at `:106`. Composing there satisfies rule 2 *by construction* — there is no server segment anywhere on the path — and rule 1 is vacuous because nothing crosses a boundary at all.

**A fifth optional prop is the wrong shape, not merely one too many.** ADR-0034 consequence (c) is explicit that the count was never the load-bearing part: *"A second member is a claim about the **game's** shape, and it has to be argued in the ADR that adds it, in those terms. 'One per game' stays the number to beat."* A `share` prop would be a member **every game passes, identically** — which is the definition of shared chrome, and shared chrome in this file comes from `messages.conclusion` read directly, not from the prop channel (`messages.ts:188-197` states that rule for `stampAria` in so many words). Adding it would also falsify `types.ts:50-51` and ADR-0043 consequence (a) and require an amendment to buy nothing.

**Per-game wrappers for Binairo and Sudoku are the wrong seam.** They would be two new `"use client"` files, four new mount-site edits (`binairo-screen.tsx:51-62`, `sudoku-screen.tsx:50-61`, `app/binairo/concluido/page.tsx:29-35`, `app/sudoku/concluido/page.tsx:29-35`) and two more `useRecordSnapshot` subscribers on the same `(game, date)` key — a key whose sharing rule is spelled out twice in the tree (`termo-conclusion.tsx:56-61`, `nonogram-conclusion.tsx:39-44`: two subscribers on different keys thrash the module slot and `useSyncExternalStore` loops). All of that to deliver a payload that is the same for all four games except one field of one game's record.

**The ADR-0029 objection, answered.** ADR-0029 decision 2 puts JSX composition per game and keeps the shared conclusion game-blind, and `termo-conclusion.tsx:33-37` says so. #34 does not break it, because **the game-shaped logic is not in the view** — it is in `share-text.ts`, a pure module that narrows the `PlayRecord` discriminated union (`play-record.ts:391-398`) and returns a string. `ConclusionView` calls one function and renders one button; it does not branch on `game` for the share. The precedent that this is allowed at all is in the file already: `conclusion-view.tsx` indexes `messages.games[next.game].name` for the chaining CTA, and `DAY_GAMES` at `:29` hardcodes the four games with termo first.

**Cost, stated:** `conclusion-view.tsx` grows (**896** lines today — revision 2 said 897), and the shared play layer gains a module that knows Termo's record shape. Against: zero new props, zero new components, zero new mount points, zero new record subscriptions, no ADR amendment, and a pure function that is trivially unit-testable — which is where the interesting assertions live (§9).

**Where the button renders.** The `result` and `lost` states share **one** return (`conclusion-view.tsx:246-256` — one `return (`, one `<main>`, `data-conclusion-state={lost ? "lost" : "result"}` at `:256`), so there is exactly one insertion point: in `<aside className={styles.side}>` (`:363`), after the CTA ternary (**`:382-405`** — revision 2 said `:381-407`) and before `<Link className={styles.secondaryLink}>` (`:409-411`). It is absent from the `skeleton` (`:152`) and `empty` (`:180`) branches by construction — which is the dead-share-button rule discharged rather than restated.

### D1a — The button is present in both terminal states and **disabled until the concluded record hydrates**.

**Decision:** the button always renders in `result`/`lost` (so the box is reserved and nothing reflows), and carries `disabled` while `stored === undefined`.

**Why.** `conclusion-view.tsx:39-45` records the one-commit window: on the in-place swap *"React runs a child's mount effect BEFORE its parent's — so the record this view would otherwise read has not been written yet"*, which is why the stamp resolves as `stored ?? result` (`:132`). For Termo the grid comes from `stored.guesses[].tiles` and there is no prop fallback for it, so a click in that window would produce a share missing the one thing it exists to carry. Gating the *render* would move the layout a frame later; gating the *enabled state* does not. ADR-0034 consequence (a) measured the analogous board→conclusion swap at exactly one animation frame (median 11.7 ms), so the disabled state is not a user-visible condition in practice — it is a correctness guard.

**This is not the dead share button.** ADR-0045 `:186-191` and `conclusion-view.tsx:72-73` reject *"a dead share button"* — a control that promises an action the product does not have. A control that is momentarily not yet ready, for one commit, and then works, is the `PlaySkeleton` discipline (*reserve the boxes, blank the values*, `conclusion-view.tsx:32-34`) applied to a button.

### D2 — Coloured squares are **content in a channel with no CSS**, not decoration on a rendered page. The same test forbids inventing shapes for the other three games.

**Decision:** the Termo share grid uses 🟩 / 🟨 / ⬜ for `correct` / `present` / `absent`. Settled by Fernando on 2026-08-14 over monochrome glyphs and ASCII. The three characters live in `messages.share.tiles` (§6.3).

**The argument, written out, because four review lenses will find the tension and silence would read as an oversight.** `DESIGN.md:58` carries the brief's section-5 anti-references *verbatim, as law*, and the list contains ***"emoji decorativo"***. Five places in the tree enforce it: `apps/web/src/play/types.ts:146-149`, `conclusion-view.tsx:750` and `termo-conclusion.tsx:107` (*"no mascot and no emoji"* on the loss treatment), `apps/web/src/nonogram/controls.tsx:36` (*"Word labels, no glyphs and no emoji"*), and `apps/web/app/estatisticas/stats-view.tsx:104` + `page.module.css:101` (the decorative emoji named as a rejected medal idiom). Two mechanical tests scan for it, both scoped to medal content: `apps/web/test/medals-content.test.ts:178` and `:193`.

**Every one of those is about a rendered page** — a surface with typography, colour tokens, spacing and a stylesheet, where an emoji is a picture standing in for a word the design system could have set properly. The anti-reference's own adjective is *decorativo*.

**The share text is not that surface.** It is a plain string pasted into WhatsApp: no CSS, no fonts, no colour tokens, no design system at all. In that channel a coloured square is not a picture standing in for a word — **it is the only available encoding of a per-cell verdict**, and it is the encoding the whole Termo-like genre already uses, which is why a recipient reads it without being taught. 🟩 here carries the single fact the share exists to carry. Nothing decorative enters a rendered page: **none of the five enforcement sites is edited, and no emoji appears in any JSX, any stylesheet or any medal string.** The two mechanical scans are scoped to medal names and descriptions and are untouched.

**And the test cuts both ways, which is what makes it a rule rather than an excuse** — see decision 3.

**The rule becomes a gate (D11-design).** Revision 1's argument was right and stopped one step short. The two shipped emoji scans are scoped to medal content by **scoping, not exemption** — `medals-content.test.ts:129` defines `EMOJI = /\p{Extended_Pictographic}/u` and both uses iterate `MEDAL_IDS` over `medalCopy`, and all three squares **do** match it (🟩 U+1F7E9, 🟨 U+1F7E8, ⬜ U+2B1C). So a later ticket could render a preview of the share text on a page and nothing would stop it. **`T-WEB-S208`** scans every `.tsx` and `.css` under `apps/web` for `\p{Extended_Pictographic}` and asserts zero hits — verified currently clean (0 files). The squares live in `messages.ts`, which is neither, and that is now a *checked* boundary rather than a described one.

**The cost, accepted rather than argued away:** 🟩🟨⬜ are off-brand against Ateliê's four accents (Termo mustard `#C08A1E`, Sudoku ink-blue `#2E4E7E`, Nonogram terracotta `#B5563C`, Binairo moss-green `#4E6B52`) and emoji cannot be recoloured. There is no version of this that is on-brand; the alternatives were monochrome glyphs (unreadable as a verdict encoding) and ASCII (worse). Fernando took the trade knowing it.

### D3 — What the share may say, exhaustively — and what it may not.

**Decision.** Each game's share is:

```
Miolos · <Jogo> · <14 ago>
<result line>
                             ← Termo only: blank line, then the grid, then a blank line
https://miolos.app/arquivo/<YYYY-MM-DD>/<jogo>
```

| Game | Result line | Shape |
|---|---|---|
| Termo, won | `4/6` | the grid: one row per judged guess, five squares per row |
| Termo, lost | `X/6` | the grid: six rows |
| Binairo, Sudoku, Nonogram | `07:12` (`formatElapsed`) | **none** |

**In, and why each is honest.**

- **The game name** — `messages.games[game].name`, a constant.
- **The date** — `formatShortDate(date)` → `"14 ago"` (`apps/web/src/i18n/format.ts:78`, already shipped, pt-BR-native, built at UTC noon so no host timezone can shift it). `date` is **the server's day**, resolved from the wall by the page shell: `conclusion-view.tsx`'s own doc says *"`date` is the SERVER's day … the client clock never selects which record is read"*.
- **The elapsed time** — from the concluded record, which is the player's own record. This is the *result*; a share with no result is not a share.
- **Termo's `n/6` and its grid** — `stored.guesses` (`play-record.ts:324-339`). Every tile in it is a **server verdict**: ADR-0038 makes the guess route the judge, and the client never judges a Termo tile. This is the single most server-truthful thing on any of the four shares.
- **The URL** — decision 5.

**Out, and why each is out.**

- **"hoje", "on time", or any claim about *when* you solved it.** `completionResponseSchema` carries `onTime` (`packages/core/src/contracts/completion.ts:218-228`) and `apps/web/src/play/sync.ts:485-495` **parses it and discards it**, propagating only `elapsedMs` and `hintsUsed`, and only on the `recorded: false` branch. Restated at `late-result.tsx:88-92` and `messages.ts:461-464`, and codified as ADR-0053 decision 10 / plan 037 I42. Carrying it would be *"a versioned change to the local record schema"* (ADR-0053 `:562-564`). The date is a fact the server supplied; *hoje* would be a claim the client cannot support. **The date is in; the word is out.**
- **The answer, the canonical spelling, and every guess word.** `answer` is present in the record exactly when `concluded` is true (`play-record.ts:341`, `:361-367`) — it is one field away from the composer, on both outcomes, including the win. ADR-0043 decision 6 puts the canonical answer **on screen** on both outcomes; a share is a broadcast to people who have not played, and today's Termo answer is the one piece of content the whole of ADR-0004 exists to protect (`:11-13`: *"the threat that matters here is spoiler broadcast"*). **`T-WEB-S190` asserts the answer string is absent from the composer's output.**
- **The Nonogram bitmap.** `stored.grid` is the solved picture (`play-record.ts:176-185`), and the picture is the withheld payoff (ADR-0033, `CONTEXT.md:44`).
- **The Sudoku / Binairo board.** `entries` and `grid` are the answer.
- **Medals, and any volume-derived count.** §12's threat note: #31 made ten volume medals self-mintable and ADR-0053 `:926-928` records that *"#34 is where a self-minted volume medal first becomes socially visible."* Today medals are not in scope at conclusion time at all — grep for `medal` over `apps/web/src/{play,archive,termo,nonogram,sudoku,binairo}` returns two doc-comment mentions and no import. **The cheapest resolution is not to do it, and this is that.** `solved` totals go with them: they carry no on-time conjunct (ADR-0051 decision 6), so a shared solved count is a self-mintable number too.
- **The streak.** It is the one server-computed number that *would* be honest — `StreakCard` renders it behind `syncOutcome === "recorded"` (`conclusion-view.tsx:371`). It is still out, for a different reason: a share text whose content depends on whether a fetch resolved is a share text with two versions, one of which appears only for online players, and the cheaper answer is one version. (ADR-0006's no-ranking posture is the second reason, not the first.)

  **And this is the one exclusion whose realistic regression is an ARGUMENT, not an import** (RB8). `conclusion-view.tsx:371` already holds the server streak in scope at the call site, so the edit that breaks this rule is `buildShareText(record, { url, streak })` — which a module-graph scan over `share-text.ts` cannot see, because nothing new is imported. The guard is therefore a **source assertion on the composer's signature**: its second parameter type declares exactly one member, `url` (`T-WEB-S191`(d), the `T-WEB-S166`/`S201` idiom the plan already uses elsewhere). The module-graph scan stays for the medals/stats/day-strip half, where the regression really would be an import.
- **The hint count.** Flag F2. `hintsUsed` is client-computed and self-reported (ADR-0027) and `sem dica` is a *virtue* claim, which is exactly the class §12 is about. Omitting it costs the share nothing. The conclusion screen still renders it; the asymmetry is deliberate.
- **The day strip** (`useDayState`'s four chips, `conclusion-view.tsx:231-243`). Understating, device-local, and it turns every share into a status report on four games — including the ones you have not done.
- **The Nonogram size and the Sudoku tier.** Both are public properties of the *puzzle*, not of the *play*, and the recipient learns them by opening the link. Including them would make the share a spec sheet, and excluding them keeps the four games' shape identical modulo Termo's grid, which is what makes the omission read as a rule.

  **The two are excluded by DIFFERENT mechanisms, and revision 2 conflated them** (RB6). `size` **is** on the nonogram record (`play-record.ts:171`, a four-member literal union) — it is excluded by the composer's choice, and a differential test can prove it. **`tier` is not on the sudoku record at all**: `sudokuPlayRecordSchema` (`play-record.ts:106-118`) is a `z.strictObject` with ten members and `tier` is not one of them — it lives on the daily response and in `src/sudoku/state.ts:67,113`, never on the record the composer reads. So a fixture *"whose `tier` is a distinctive word"* is **unconstructible**: it fails Zod and it fails `pnpm typecheck`. The honest guard for `tier` is not a fixture, it is a **key-set assertion** — `T-WEB-S191`(c) pins each record member's `.shape` key set against a written-down list, so the day a later ticket puts `tier` (or anything else) on the record, the share's exclusion list gets a red test and a decision instead of a silent new field. *(Verified against the installed zod 4.4.3 that `.shape` survives `.superRefine`, which the nonogram and termo members both carry: `refined.constructor.name === "ZodObject"`, `Object.keys(refined.shape)` returns the members.)*

**Three of the four games therefore have no shape, and that is the product's asymmetry rather than a gap in this design.** Termo's grid exists because Termo's *play* is a pattern of per-cell verdicts. A Sudoku's play is a number. Manufacturing squares for it — a time bar, a difficulty strip, a row of one colour — would encode nothing, and would be **decoration in a channel with no design system**, i.e. precisely what `DESIGN.md:58` bans and precisely what decision 2's argument does *not* cover. The rule that licenses Termo's squares is the same rule that forbids the other three's. Flag F1 puts it to Fernando in one sentence.

**No gate on `syncOutcome`, and that is a decision.** A player whose sync was `rejected` can still share. The share is the player's own device's record of their own play, broadcast in a chat message — ADR-0031 decision 6 permits device state to *"drive an affordance … and never an entitlement"*, and a chat message is the purest affordance in the product. Blocking share on `rejected` would punish exactly the offline players the in-place conclusion exists for (ADR-0028's offline argument), and ADR-0004 `:13` is the standing posture: *"There is nothing to cheat for."* The conclusion screen continues to render `messages.conclusion.sync.rejected` beside the button.

### D4 — One string, two mechanisms, byte-identical.

**Decision:** on click — not on render — the handler tries `navigator.share({ text })` and falls back to `navigator.clipboard.writeText(text)`. **The same string, no `url` field, no `title` field.**

- **Feature detection happens at click time, never at render time.** `typeof navigator.share === "function"` evaluated during render is a hydration mismatch: the server has no `navigator`. Detecting in the handler also means one label, one DOM, one test.
- **`text` only, with the URL as its last line.** `navigator.share({ text, url })` behaves differently per target — WhatsApp appends the url, some targets replace the text with it, some drop one. One field means the clipboard fallback copies *the same bytes* the share sheet receives, which is a testable property (`T-WEB-S196`) rather than a hope. `title` is omitted for the same reason: several targets prepend it.
- **`AbortError` is not an error; every other rejection falls through to the clipboard** (I3/S9). `navigator.share` rejects with `AbortError` when the user dismisses the sheet — surfacing that as a failure message is the single most common bug in this feature. But it also rejects with `NotAllowedError` (no transient activation), `DataError`, `TypeError` and `AbortError`-from-the-OS, and revision 1 specified only the Abort case, which meant **every other rejection produced silent failure**: no sheet, no clipboard write, no message. The handler is therefore three-armed: `AbortError` → render nothing; any **other** rejection → fall through to `clipboard.writeText` and take that branch's own outcome; no `navigator.share` at all → clipboard directly. `T-WEB-S197` is widened to cover a non-Abort rejection reaching the clipboard.
- **The clipboard can refuse.** `navigator.clipboard` requires a secure context (`.app` is HSTS-preloaded, ADR-0013, so production and preview always are; `localhost` is a secure context too) and can still reject. On rejection the button renders `messages.share.failed`. There is no third fallback: `document.execCommand("copy")` is deprecated, needs a hidden textarea and a selection, and would be more code than the case is worth.
- **Success is announced.** The confirmation (`messages.share.copied`) renders in a `role="status" aria-live="polite"` region, cleared on a timer. A share sheet that opened needs no confirmation; a clipboard write does, because nothing visible happened.

### D5 — The share URL is `absoluteUrl(archiveGameRoute(date, game))`.

**Settled by prior record, not by this plan.** ADR-0053 decision 1 built the 307 *"because #34's AC is that a shared link lands on the exact day/game page and sharing happens right after playing"*, and **ADR-0053's** flag F2 (`:992-1038`, not this plan's §2 F2 — the two numbering spaces collide and revision 2 left them ambiguous) confirmed it on 2026-08-14. `/<jogo>` is stable but serves a different puzzle after the rollover, so it cannot be the per-day link AC 4 asks for.

**Mechanics.** `archiveGameRoute` (`apps/web/src/i18n/routes.ts:103-105`) composes it from `routeSlugs`; `absoluteUrl` (`apps/web/src/site-origin.ts:23-25`) resolves it against `NEXT_PUBLIC_SITE_URL`, which is a `NEXT_PUBLIC_` variable and is therefore inlined into the client bundle, and is already on `turbo.json`'s `build.env` allowlist. **No new environment variable.** The full `https://` scheme ships (not the bare host Fernando's reference sketch showed) because chat clients autolink a scheme reliably and a bare host inconsistently.

**This makes the share text the fourth consumer of `site-origin.ts`**, whose doc block at `:5-11` says *"Three surfaces need it and none of them may disagree"*. That sentence becomes false and is corrected in the same commit (§11.4). Nothing else in that module moves.

**No `/arquivo` literal enters the composer.** `T-WEB-S166`'s source-scan idiom applies: `T-WEB-S192` asserts the URL is built from the shipped builders.

---

## 4. Decisions register — the OG surface

### D6 — Trap A, stated precisely, because it is what makes this two route families and not one.

**The redirect lives in the page body, not in `generateMetadata`.** `app/arquivo/[data]/sudoku/page.tsx:62-79` reads, classifies and calls `redirect(routes.sudoku)`; `generateMetadata` (`:25-44`) returns title/description/canonical unconditionally for a well-formed date and never redirects. `app/arquivo/[data]/page.tsx:32-44` states the mechanism outright: *"Metadata and the page resolve independently in the App Router, so a `notFound()` below cannot un-compose a `<head>` this function has already produced."*

**So there are two scraper populations and #34 must serve both.** Probed live on 2026-08-14 by step 1:

| Behaviour | What it reads for `/arquivo/<hoje>/<jogo>` | What #34 does |
|---|---|---|
| Does **not** follow the 307; parses the 307 body | The **archive** route's `generateMetadata` head — the 307 response is `content-type: text/html` and ships a complete `<head>` | `openGraph` added to that `generateMetadata`, plus an image route at the same segment that must **resolve for today** (decision 8) |
| **Follows** the 307 (Facebook/WhatsApp, X, Slack, Discord, LinkedIn all do) | `/sudoku` → the root layout's generic title, **no `openGraph` at all** | the four daily routes gain their own `openGraph` **and their own dated card** (decision 7/10) |

**The second row is the dominant one, and revision 1 did not join that fact to its own F4.** Sharing happens right after playing; the URL on the clipboard is `/arquivo/<hoje>/<jogo>`; on that day it 307s; every major target follows. So whatever card the **daily** route serves is the card almost every share renders on day one. Revision 1 made that card dateless, which would have left AC 2's *"per-day"* unmet on exactly the path the ticket exists to serve. B1's resolution — date all eight — is what makes the two populations receive the same, correct, dated card, and it is why decision 7 no longer has two card kinds.

**Handoff 039 §5's framing of this is imprecise** — it says *"a crawler fetching today's permalink reads the daily route's metadata, not an archive page's"*, which is true only of the population that follows the redirect. A handoff is a point-in-time snapshot and is **not** edited (`docs/README.md:21`); the correction is recorded here and in ADR-0054's context.

### D7 — Nine image routes: **one** static site card and **eight** dynamic per-day-per-game cards. One card kind, one read path.

**Decision.**

| File | Reads | Card | Generation |
|---|---|---|---|
| `app/opengraph-image.tsx` | nothing | the site card: wordmark, tagline, one app-accent tape | static |
| `app/<jogo>/opengraph-image.tsx` (×4) | `getTodayDaily(db, game)` | the game card, dated with **`daily.date`** | `force-dynamic` (decision 9) |
| `app/arquivo/[data]/<jogo>/opengraph-image.tsx` (×4) | `getPublishedDaily(db, game, date)` | the game card, dated with the **URL's** date | `force-dynamic` (decision 9) |

Every route is ~18 lines: `export const dynamic`, `export const size = { width: 1200, height: 630 }`, `export const contentType = "image/png"`, `export const alt = …`, and a default export delegating to `apps/web/src/og/card.tsx` through one shared handler.

**Why all eight are dated and dynamic (flag F4, revised at B1).** Three facts revision 1 stated separately and never joined: the clipboard carries `/arquivo/<hoje>/<jogo>`; on the day of sharing that URL 307s; and D6's own table says every major target follows the 307 and therefore reads `/<jogo>`'s head. A dateless daily card is thus the card **the dominant share path renders**, and AC 2's *"per-day"* would be unmet exactly where it matters. Dating all eight collapses two card kinds into one, brings the daily four under AC 3's structural guarantee instead of leaving them outside it, and removes the asymmetry where four of the eight routes this ticket ships were the only ones not reading the wall.

**The staleness objection, answered rather than dropped.** Revision 1 was right that `/<jogo>` is not a per-day URL (ADR-0053 decision 1 `:180-183`). But the failure it named — a card saying *14 de agosto* while the URL serves the 15th's puzzle — needs a **hand-typed** `/termo` link to occur. A link **this product emits** is date-stamped: the scraper caches `/arquivo/2026-08-14/termo`'s card, and when it re-scrapes, that date is past, the 307 is gone, and the archive head and dated archive card serve. Correct forever. The residual is real and small: someone who types `miolos.app/termo` into a chat by hand gets a card that is correct at scrape time and may be a day stale in that scraper's cache afterwards. That is a strictly better trade than a card that is *never* per-day, and it is recorded in ADR-0054's consequences rather than left to be rediscovered.

**The cost, correctly framed.** Revision 1's cost line conflated **page** traffic with **scrape** traffic. A metadata image route is fetched by a scraper, once per shared link, not by a player on every pageview — and `app/sudoku/page.tsx:13` already does `force-dynamic` plus `getTodayDaily` on every real pageview of the same segment, so the daily card adds a read to a segment that already reads. Measured per scrape: **one Neon round trip + ~50–70 ms warm rasterisation** (~215 ms on the first render in a cold lambda; re-measured at revision 3 as 213–228 ms cold, 48–55 ms warm median). §14's landmine 21 and S5's denial-of-wallet note carry the figures.

**Why a root card at all.** Metadata images resolve from the nearest ancestor segment that defines one, so a single root file covers `/`, `/estatisticas`, `/privacidade`, `/modo-livre*`, `/arquivo`, `/arquivo/mes/<mes>` and `/arquivo/<data>` — every URL in the sitemap that is not one of the eight above — for one file and no runtime cost. **This inheritance is the one structural claim here I have not executed**, and §13 makes it an evidence item rather than an assumption: `curl` the preview's `/privacidade` and confirm its `og:image` resolves to `/opengraph-image`.

**Why the `concluido` routes need nothing.** `/<jogo>/concluido` is a child segment of `/<jogo>`, so it inherits that game's card. Free.

**Why nine files and not a shared dynamic route.** The repo already accepts literal-per-game duplication for exactly this reason: four literal daily pages, four literal archive play pages, four free-play routes, argued in ADR-0046 decision 1 and restated in ADR-0053 decision 1 (*"the route boundary is what carries the per-game code-splitting, and the 404 for a fifth game is by absence"*). A `[jogo]` segment would put untrusted text in front of the wall for a card.

**But the duplication is pinned, not asserted** (Q7). Revision 1 said *"all nine files delegate to one builder, so the duplication is a routing table, not logic"* and shipped no drift pin — while citing a precedent (`T-WEB-S185`, `archive-play.test.tsx:144-151`) that ships a byte-identity `it.each` **added at step 6 precisely because the claim had been proved for sudoku alone**. So:

- the eight game routes delegate to **two shared handlers** in `apps/web/src/og/handlers.ts` — `dailyCardHandler(game)` and `archiveCardHandler(game, params)` — so each route file really is the fifteen-line table this decision claims;
- **`T-WEB-S203` is an `it.each` over all four games × both families**, not a sudoku-only walk;
- **`T-WEB-S204`** adds a source-normalisation assertion: the four files in each family differ only in the game token.

### D8 — An OG route reads through the wall as an **existence proof**, never as a source of pixels. AC 3 falls out structurally.

**Decision:** each of the eight game image routes performs **exactly one wall read**, and uses the result only to decide *render or 404* plus to supply the one non-content field the card names — the date.

```
ARCHIVE  app/arquivo/[data]/<jogo>/opengraph-image.tsx
  date = parseArchiveDate(params.data)              ; malformed → 404, no read
  daily = await getPublishedDaily(db, game, date)   ; throws → log + 404
    undefined → 404          (future, unpublished, killed, or no such day)
    found     → render, longDate = formatLongDate(date)      // date from the URL

DAILY    app/<jogo>/opengraph-image.tsx
  daily = await getTodayDaily(db, game)             ; throws → log + 404
    undefined → 404          (nothing published for today)
    found     → render, longDate = formatLongDate(daily.date)  // date from the DB clock
```

**Why one read and not revision 1's three (H2).** Revision 1 ran `getArchivedDaily` → on empty `archiveDateClass` → on `"today"` `getTodayDaily`: three round trips against the DB clock, and **if the São Paulo rollover falls between them the route renders a card for date D on the strength of a row for D+1.** Nothing puzzle-derived leaks — the card is a nameplate — but AC 3's property stops being *structural*, which is this plan's own basis for satisfying it. The sibling pages get away with the shape because they **redirect** on today rather than render.

`getPublishedDaily(db, game, date)` collapses it. Verified in the source rather than assumed:

- it is on the root barrel (`packages/db/src/index.ts:20`) and on the db wall's permitted list (`apps/web/test/eslint-db-wall.test.ts:777-786`), so **no wall edit and no `packages/db` edit is owed**;
- it uses `wallPredicate(game, date)` (`published.ts:81-89`) = `game = X AND date = D AND published_at <= now() AND killed_at IS NULL`;
- and `packages/db/src/buffer.ts:106` writes `publishedAt` as `` sql`(${row.date}::date)::timestamp at time zone ${SAO_PAULO_TIME_ZONE}` `` — the date's **own São Paulo midnight**, into a `timestamptz` column (`schema.ts:201`, whose own comment at `:188` says *"`published_at` is the SP midnight of `date` as an instant"*).

So `published_at <= now()` **is** *"date ≤ today (São Paulo)"*, exactly. One round trip, no classifier, no today branch, no midnight race, future dates structurally excluded by the same predicate that excludes unpublished ones. The today case that revision 1 needed a branch for is simply inside the predicate.

**The daily four use `getTodayDaily`, and that is not a departure from H2 — it is the same call their sibling page already makes.** They have no date in the URL, so there is no argument to pass `getPublishedDaily`; and the only server-truthful source of today's São Paulo date is the DB clock, which `getTodayDaily`'s `wallPredicate(game)` interpolates as `(now() at time zone 'America/Sao_Paulo')::date`. The returned row's `date` **is** that value. `app/sudoku/page.tsx:13` does the identical thing. No client clock, no `new Date()`, one round trip, and no new claim about that reader — which is why §1 can now say `getTodayDaily`'s TSDoc is untouched *and* undepended-on.

**One field of the daily response reaches the card, and it is `date`.** Revision 1 claimed no field does; with dated daily cards that is no longer true, and the honest statement is narrower and still strong: the card receives **`date` and nothing else**, `date` is not puzzle content (it is the same value the archive URL carries in plain sight and the sitemap publishes), and the mechanism that keeps it that way is the builder's signature — `gameCard({ game: Game, longDate: string })` has no parameter a daily response can enter through. `T-WEB-S203`'s sentinel arm and `T-WEB-S201`'s source scan pin it (§9).

**A bad row must 404. A DATABASE OUTAGE must not** *(rewritten at revision 3 — RB11/RC1)*.

`getArchivedDaily`'s catch wraps **only `stripDailyContent`**, not the query (`published.ts:250-266` — read it: the `db.select()` at `:250` is outside the `try` at `:260`). Its doc block at `:236-243` argues 404-over-500 for exactly that case, *a bad row*: *"The URL is one the sitemap advertises to crawlers, and a 500 there is worse than a 404 in every dimension … The log line IS the alarm."* **`getPublishedDaily` and `getTodayDaily` deliberately do not catch** — *"on those a bad row is a live incident"* — so an image route calling them would 500 on a row whose sibling page 404s, on a surface even more crawler-facing than the page. That much revision 2 had right.

**What it got wrong is the scope of the catch.** Revision 2 wrapped the whole read *including `getDb()`*, so a Neon timeout, a pool error or a missing `DATABASE_URL` returned **404** — and for a transient outage the doc block's argument *inverts*. A 500 is retried and pages somebody; a 404 on this surface is negative-cached by the scrapers for days, there is no bad row to name in the log, and the card stays dead long after the database is back. Citing `:236-243` as sanctioning that is citing it for a case it does not discuss.

**So the catch is narrowed to the projection class, and everything else re-throws:**

```ts
/** The two throws that mean "this row is bad", not "the database is down".
 *  NEITHER CLASS CAN BE IMPORTED HERE, and that is why this matches on `name`:
 *  `DailyProjectionUnsupportedError` is on the app-wide wall's banned-name list
 *  (eslint.config.mjs `webWallImportPaths`, the `@miolos/core` entry), and a
 *  cross-package `instanceof ZodError` is an identity assumption about two
 *  node_modules trees rather than a fact. Both names are set explicitly at the
 *  source: zod 4.4.3 sets `ZodError`, and daily-content.ts:196 assigns
 *  `this.name = "DailyProjectionUnsupportedError"`. */
const PROJECTION_ERROR_NAMES = new Set([
  "ZodError",
  "DailyProjectionUnsupportedError",
]);
```

A throw whose `name` is in that set → `console.error` (the shipped `apps/web` idiom — `sync.ts:166`, `streak-client.ts:20`; there is no `no-console` rule) and a 404. **The line carries the game on both families and the date on the archive family only**, and that asymmetry is a fact about the readers rather than a choice (T3): `archiveCardHandler` has parsed its date *before* the read, so it is in scope at the catch; `dailyCardHandler` has no date anywhere — the value it would log lives on the row `getTodayDaily` threw instead of returning. Writing *"with game and date"* as one rule is how revision 3 produced a sample that does not compile for four of the eight routes and an `it.each` row asserting a fixture that cannot exist. The two lines are written out in §7.3 and `T-WEB-S203` asserts each family's own. **Anything else re-throws** and becomes a 500: `getDb()`'s own `new Error("DATABASE_URL is not set")` (`src/db.ts:24`), a connection failure, a query error. `packages/db` still does not move.

**Verified rather than assumed:** `zod@4.4.3`'s `ZodError.name === "ZodError"`, and `apps/web` and `packages/core` both resolve to the **same physical** `node_modules/.pnpm/zod@4.4.3` today — so a class check *would* work now and the name check is the version-skew-proof spelling of the same thing, failing **closed** (to 500, the live-incident behaviour) rather than open if a future skew broke it.

**`T-WEB-S203` gets three arms for this, and they are the point of the section:** a `ZodError`-named throw → 404 **with `console.error` called, its argument carrying the game on both families and the date on the archive family** (T3 — the daily handler has no date to carry, and the row is scoped rather than asserted against a fixture that cannot exist); a `DailyProjectionUnsupportedError`-named throw → 404; and a plain `Error("connect ETIMEDOUT")` → **propagates**, is not converted to a 404, and does not call `console.error`.

**And the `try`'s scope is pinned, not merely intended** (RQ7). §7.3's sample wraps the read alone, so a satori throw still surfaces as a 500 — but nothing stopped a later edit from widening the `try` to the whole handler, which converts every card-render bug into a silent 404 while S203 stays green. **`T-WEB-S203` therefore also asserts that a throw from the card builder / `ImageResponse` PROPAGATES** and is not answered with 404.

**Refuse with a `Response`, not with `notFound()`.** There is no page to render a not-found boundary into, so the handler returns `new Response(null, { status: 404 })`. **Verified empirically against a real Turbopack build**, not from the webpack loader revision 1 cited (C4): `curl -I` on a malformed segment returns `HTTP/1.1 404 Not Found`. Unambiguous, and directly assertable in a test.

**The PNG ships the same cache posture as every other public read path** (H3). `next/dist/server/og/image-response.js:37-40` defaults to `cache-control: public, max-age=0, must-revalidate` in production — and `public` is precisely the token that lets a shared intermediary hold bytes that decision 9 exists to keep un-held. `force-dynamic` governs Next's route cache, **not** the emitted header. The same file at `:41-46` merges caller headers over the defaults, so each of the nine routes passes `headers: { "cache-control": "private, no-cache, no-store, max-age=0, must-revalidate" }` in the `ImageResponse` options. **Verified on a real `opengraph-image.tsx` metadata route in a Turbopack production build:**

```
with the option     → cache-control: private, no-cache, no-store, max-age=0, must-revalidate
without it          → cache-control: public, max-age=0, must-revalidate
```

No `next.config.ts` change, so landmine 10 stays intact. §13's preview `curl` asserts the header and `T-WEB-S203` asserts it in the suite. *(The root site card reads nothing and cannot go stale; it keeps the default, and that is stated rather than overlooked.)*

**AC 3 is satisfied structurally, not procedurally, and the governing sentence is ADR-0010 `:20`** — *"**Every** read path — daily, archive, **OG images**, anything — filters `published_at <= now()`, and does so through **one shared query helper**, not a predicate re-typed per route"* (the only rule in the corpus that names OG images; revisions 1 and 2 never cited it — RA10). Both readers carry the conjuncts through the single private `publishedConjuncts()` and neither re-types them. It is also the same property `app/sitemap.ts:27-31` records for the sitemap: *"A future-dated URL is not filtered out of this list — it is never produced."* An unpublished day cannot render because the only path to a render is a returned row, and both readers carry `published_at <= now()` and `killed_at IS NULL` through the single private `publishedConjuncts()` (`packages/db/src/published.ts:47-52`). **No fallback card, ever**: a fallback would be an unpublished day rendering *something*, which is the failure the AC names.

**The one residual, and it is WIDER than revision 2 stated (A3, widened at RC8).** AC 3's structural guarantee covers the **image**: no unpublished day can render one. It does not cover the `<head>` that advertises the image, and the gap is not limited to well-formed future dates.

- **Every archive `[data]` segment, malformed included.** `app/arquivo/[data]/<jogo>/page.tsx:28-31` returns `{ robots: { index: false } }` and **no `openGraph`** on a malformed date — but the image comes from the **file convention**, not from the metadata object, so `/arquivo/lixo/sudoku` still emits an `og:image` pointing at a URL that 404s, plus root-filled `og:title`/`og:type`/`og:locale`/`og:site_name` and the full `twitter:*` set from `postProcessMetadata`. Verified on a real build. So the true statement is *"**every** archive `[data]` segment advertises an image, and the image resolves only for a published day"*, not *"a future well-formed date does"*.
- **The daily four have the same shape.** On a day with nothing published, `/sudoku` renders `DailyUnavailable` at **200** (ADR-0028 decision 4) while its `og:image` 404s.
- **The metadata OBJECT and the rendered HEAD are different surfaces, and `T-WEB-S207` asserts at the object level.** *"the hostile-segment arm still returns `{ robots: { index: false } }` with no `openGraph`"* is true of the resolved metadata object and **false of the rendered head**. §9 says which level each arm binds at, so a step-6 reviewer does not read the stronger claim.

No puzzle content leaks and ADR-0004 is untouched — the archive title is `messages.archive.meta.gameTitle(name, longDate)`, composed from a game name and a date, and the malformed case composes nothing at all. But the plan asserts AC 3 as a property of *"OG generation"*, so the carve-out is stated here in these widened words, in ADR-0054, in §13's AC 3 line, and as rows in `T-WEB-S203`'s branch table — including **"nothing published today"** on the daily family, which revision 2 omitted.

**And nothing puzzle-derived is drawn (flag F5).** The card carries the wordmark, the game's kicker, the game's name, the long date, the game's accent on a tape and a shadow. That is a *nameplate*. Three reasons, the first of which revision 1 got **wrong**:

(a) **For Nonogram it is not impossible — it is refused, and the difference is the whole point.** Revision 1 said the reveal bitmap *"is unavailable server-side by construction"*. That is false. ADR-0033's **Context at `:23-30`** measures it: *"`solveNonogram(clues)` recovers the picture from the published clues alone — measured over the wire projection only, 280 dailies, 0 mismatches, worst 0.338 ms. Withholding `reveal.solution` protects nothing about the picture's shape."* And its **decision 2 at `:49-55`** rules on it: *"This is a PRODUCT decision, not a security one, **and it is stated in those words wherever it is cited**. … Any future comment, TSDoc or PR that upgrades this to a confidentiality claim is wrong."* Revision 1 was that upgrade. So, in ADR-0033's own words: **the Nonogram picture is derivable from the published clues in under a millisecond, and #34 refuses to draw it as a product decision.** ADR-0054 states it that way too. *(Revisions 1 and 2 attributed the Context measurement to *"decision 2's words"* and cited both at `:26-34`, a range that contains neither — RA9. An ADR whose whole rule is "stated in those words wherever it is cited" being cited at the wrong lines is the A7 failure one round later, so both citations are repaired here, in the governing-records line, and in whatever ADR-0054 inherits.)*

(b) For Sudoku and Binairo the givens *are* in the published projection and drawing them leaks nothing the page does not already show, but at 1200×630 a 9×9 grid of givens is a thumbnail nobody reads and a spoiler argument to re-litigate for every future game.

(c) Drawing nothing derived makes AC 3's guarantee a property of the *card* as well as of the *route*. The mechanism is the builder's **signature** (`gameCard({ game, longDate })`), not a runtime scan; §9 pins it at the route with sentinels and at the source with a scan.

**`packages/games` gets a standing wall, not a one-time grep (B3).** Revision 1's guard was §13's exit grep, which is an exit check and not a gate — and the plan's own decision 15 argues that a one-hop-reachable module needs a wall entry rather than a grep. The reachability is real today with **zero** lint hits: `solveNonogram` is exported at `packages/games/src/nonogram/index.ts:7`, `@miolos/games` is in `transpilePackages`, and the free-play wall bans only `@miolos/games/termo` and only inside `src/free-play/**` and `app/modo-livre/**`. An OG route could feed `daily.clues` — already in hand from the reader — to `solveNonogram` and paint the exact bitmap into a chat bubble for people who have not played. That is the worst spoiler surface in the ticket, and it must be closed mechanically. So `eslint.config.mjs` gains a **third wall**, in the shape decision 15 uses:

- **files:** `apps/web/src/og/**` and `apps/web/app/**/{opengraph,twitter}-image.*`, both with `webWallExtensions`;
- **static half:** `no-restricted-imports` banning `@miolos/games` and `@miolos/games/*`;
- **dynamic half:** the `ImportExpression > Literal[value=/^@miolos\/games(\/|$)/]` selector, because `no-restricted-imports` never sees `import("@miolos/games/nonogram")`;
- **and it repeats objects (1) and (2)'s arrays verbatim, which is the half that is easy to get wrong and is written out in full in D15** (RB2).

Probes: `T-LINT-S41` (static), `T-LINT-S42` (dynamic), `T-LINT-S43` (replacement regression), `T-LINT-S44` (glob reach, including the root card) and `T-LINT-S8a` (the wall asserted from inside the new source directory, the `T-LINT-S8` precedent). D15 carries all of it.

The exit grep stays as well; it costs nothing and it catches a file the glob misses — **and its own glob is corrected** (RA3d/RQ13/RC11): `apps/web/app/*/opengraph-image.tsx` never matched the root `apps/web/app/opengraph-image.tsx`, so §13 uses a recursive `find`.

### D9 — `force-dynamic` on all eight game image routes. Only the root site card reads nothing and stays static.

**Decision:** `export const dynamic = "force-dynamic"` on `app/<jogo>/opengraph-image.tsx` and `app/arquivo/[data]/<jogo>/opengraph-image.tsx`, all eight. No `revalidate` anywhere.

**Verified mechanism, empirically and not by citation (C4).** Revision 1 cited `next-metadata-route-loader.js`'s `createReExportsCode` — a **webpack-only** loader; under Turbopack the module is generated in Rust and that file never runs, which is the #31 false-positive shape (a probe of a path that does not execute). The **conclusion** was right and is re-grounded on a real Turbopack production build: adding `export const dynamic = "force-dynamic"` to a metadata image route flips it from `○ Static` to `ƒ Dynamic` in the route table, and the emitted route answers per request. It is **not** inherited from the sibling `page.tsx` (also verified: `force-dynamic` on `page.tsx` leaves the sibling image route `○`), because route segment config comes from layouts on the path plus the leaf, and `find apps/web/app -name "layout.tsx"` returns exactly one file, the root. So the export is required on each of the eight, not decorative.

**Why.** ADR-0053 decision 2's precondition binds verbatim: *"the `killed_at` write must **first** gain a writer that calls `revalidatePath` for the affected paths (day, month, index, play, sitemap). Cache-then-invalidate is the wrong order. **No `revalidate` may be added to an archive route before that writer exists.**"* An image route at a date-bearing URL, advertised to every scraper by the page's own head, is squarely inside that family. If a killed puzzle's page 404s while its cached card still renders, the takedown is incomplete — decision 2's exact failure mode on a new surface. **ADR-0053's** flag F1 (again its numbering, not §2's) was confirmed on 2026-08-14 with the cost stated (*"every crawler hit on this surface is a live database read"*), and that confirmation extends here.

**The cost, re-measured on the card this plan actually specifies.** Revision 1's *"~10–14 ms warm"* was measured on a bare tree. The real card — **153** texture dots, a tape, four text runs, three registered faces — measures **~215 ms on the first render in a process and ~50–70 ms warm**, per scrape, plus one Neon round trip. Re-measured at revision 3 across six fresh processes: cold **213–228 ms**, warm median **48–55 ms** (min 42.6, max 73.7 over 40 interleaved iterations in two runs). The published band holds and is slightly conservative; revision 2's *"cold 126.5 ms"* figure is **refuted** and does not appear anywhere in this revision. The 215 ms is one-time WASM/engine init per lambda, not per request. The figures are published in the PR body and handed to **#37**, which already owns the p95 instrumentation for decision 2's revisit trigger.

**Denial of wallet, disclosed and not mitigated (S5).** Every valid `(game, date)` pair costs one Neon round trip, and every published one adds an unauthenticated satori+resvg rasterisation, on a path that by design must never be cached. Malformed dates are correctly cheap — Zod before any read (`parseArchiveDate`), so a hostile `[data]` costs nothing. Dating the daily four widens the surface from four routes to eight. **Nothing in this ticket's scope can fix it**, and pretending otherwise would be worse than saying so: ADR-0054's consequences carry the per-request CPU figure and the words *"unauthenticated"* and *"denial of wallet"*, and #37 gets an explicit **abuse** item rather than only a p95 trigger. H2's single read cuts the DB half 2–3× against revision 1's three-read path; the raster half is irreducible.

**The residual, which is new with #34 and must be on the record.** `force-dynamic` bounds *our own* serving. Facebook, X, WhatsApp, Slack and Discord all scrape once and cache the image on their own infrastructure for days. **A card already scraped survives a `killed_at` takedown regardless of what we do**, and so does the link itself — the kill switch was never able to reach a message already sent. This is not an argument for caching ours (that would add *our* TTL on top of theirs, for no gain, against a standing precondition); it is a fact about what the kill switch can and cannot do, and it belongs in ADR-0054 rather than being discovered at step 6.

**The root site card reads nothing**, has no dynamic segment and no dynamic API, so Next prerenders it at build — one satori render at build time, zero at runtime. Verified in a Turbopack build that a metadata image route with no dynamic export comes out `○ Static`. §13 still requires the `pnpm build` route table pasted: the expectation is **one `○` and eight `ƒ`**, and any deviation is a §14 entry.

### D10 — The four daily routes gain metadata. This does **not** make them an SEO surface.

**Decision.**

- `app/<jogo>/page.tsx` gains a **static** `export const metadata` carrying **`openGraph` and nothing else** — no page-level `title`, no page-level `description`. Static, not `generateMetadata`: nothing in it depends on a request, and a static export cannot accidentally acquire a database read. `alt` and the image come from the sibling `opengraph-image.tsx`.
- `app/arquivo/[data]/<jogo>/page.tsx`'s existing `generateMetadata` gains `openGraph` reusing the `title`/`description` strings it already composes. Canonical unchanged.
- Every leaf `openGraph` — the four static ones and the four `generateMetadata` ones — spreads `OG_DEFAULTS` (decision 11, B4).
- The four `/<jogo>/concluido` pages gain **nothing** — they inherit the game's title from the root layout's `title` and the game's card from `/<jogo>`. A conclusion is not a share target; the permalink is.

**Why `openGraph` only, and why that is stronger than revision 1 (H1).** Revision 1 also gave the daily pages a page-level `title` and `description`. `description` is the SERP snippet, not a chat bubble — so the *"not an SEO surface"* denial below argued the half it was safe on and was silent on the half it was not, and paying for it would have cost in-place annotations on **two** files (ADR-0028 `:36-38` and ADR-0053 `:977`, the second of which revision 1's amendment audit never even examined). Dropping both makes the denial literally true and the annotations unowed.

**Verified on a Turbopack production build of a throwaway Next 16.2.12 app**, because "og:title without a page title" is exactly the kind of thing that silently misbehaves:

```
route with metadata = { openGraph: { title, description } }, no page title/description
  <title>                            → "Root title"        (root layout, inherited)
  <meta name="description">          → "Root desc"         (root layout, inherited)
  <meta property="og:title">         → "OnlyOG title"      (the leaf's)
  <meta property="og:description">   → "OnlyOG desc"       (the leaf's)
  <meta name="twitter:title/description"> → derived from openGraph automatically
```

So the four daily routes' **crawl-facing metadata is byte-unchanged from today** — today they declare no metadata at all and inherit the same two strings — while the sharing channel gains a per-game title and description. That is the entire delta, and it is the smallest one that delivers AC 2/AC 4.

**Cost, stated:** the browser tab on `/sudoku` keeps saying *Miolos* rather than *Sudoku · Miolos*. That is today's behaviour, unchanged, and a page title is not something #34 was asked for. A later ticket that wants one is welcome to it — and will owe the ADR-0028 annotation this one does not.

**No `alternates.canonical` on the daily routes, and the question is real enough to answer explicitly.** Pointing it at itself is the default assumption anyway, and adding canonical tags is indexation machinery on a surface ADR-0028 `:36-38` states outright is not an indexation surface. Pointing it at `/arquivo/<hoje>/<jogo>` would be actively wrong: that URL **307s back to this one today** (ADR-0053 decision 1), so the canonical would name a redirect — a self-defeating signal, and one whose meaning changes at midnight. `openGraph.url` is likewise left unset — and the consequence is that **no `og:url` is emitted at all**, verified across five routes on a real build. Revision 2 said Next *"resolves it to the current path against `metadataBase`"*, which is wrong (RC9). Harmless, since every scraper falls back to the URL it fetched, but it was stated as a mechanism and would otherwise be re-derived.

**And this does not make the dailies an SEO surface — but the denial is narrower than revision 2 claimed, and the difference is recorded rather than argued away** (RA4). ADR-0028 `:36-38` stands unamended and takes a *"(Qualified at #34)"* note, because the byte-unchanged verification covers `<title>` and `<meta name="description">` and does **not** reach the mechanism by which `og:title` is a title-link candidate on a page whose own title is generic — which `/sudoku`'s is, by the cost line above. Nothing in the design moves; the record gets the sentence. What does stand, unqualified: The routes stay out of `sitemap.ts` (`:32-37` excludes them by name); `robots.ts` is untouched and already says absence from a sitemap is not `noindex`; no canonical is added; no `generateStaticParams` appears anywhere. **`og:` tags are a *sharing* affordance — they render a chat bubble — and the sitemap plus `robots.txt` are the crawl posture. Different mechanisms.** One clause is added to `sitemap.ts`'s exclusion comment saying so, so a later ticket does not read the new tags as an invitation to "finish the job" (§1 exception ii).

**The `T-WEB-S173` claim in revision 1 was false, and its correction is a real test rather than a widening (B6).** Revision 1 asserted that `archive-metadata.test.ts:52-56`'s `toEqual` would red when `openGraph` was added to the four per-game archive routes. It will not: that file imports **only** `../app/arquivo/page`, `../app/arquivo/mes/[mes]/page` and `../app/arquivo/[data]/page` (`:38-40`) — the three routes this decision explicitly **does not** touch. Verified by grep: the four per-game archive `generateMetadata`s are called by **no test in the repo**. Three consequences:

- **landmine 9 is deleted** — nothing reds;
- **I28 is deleted** — following it literally would push `openGraph` onto the index, month and day routes, which D7/F8 forbid;
- **Trap A's population-1 head — this plan's own load-bearing discovery — would have shipped with zero coverage**, as would ADR-0018's no-literal rule for those four functions.

So two ids are spent on them, **split by file rather than by convenience** (§9, RQ8): **`T-WEB-S207`** in `og-metadata.test.ts` takes the OG half — `openGraph` present and spreading `OG_DEFAULTS`, and the hostile-segment arm still resolving to `{ robots: { index: false } }` with no `openGraph` **in the metadata object** (at the rendered-head level that is false, RC8) — and **`T-WEB-S209`** goes into `archive-metadata.test.ts` as a new `describe` for the non-OG half: title and description distinct across games **and** across dates, canonical unchanged, and the `:135-158` literal scan extended to those four files. Putting the second half anywhere else would split one suite's own claim across two files, which is the defect Q16 was raised for and which this plan applies to S205 one section earlier. `T-WEB-S173` is left **untouched** — it is a green suite about three other routes.

### D11 — Root-layout `openGraph` and `twitter` defaults. `og:locale` is `pt_BR`, not `pt-BR`.

**Decision:** one shared constant, spread everywhere, because **Next does not deep-merge `openGraph` across segments — the nearest declaration wins whole** (B4).

`apps/web/src/og/defaults.ts`:

```ts
/** The three og: members every leaf must re-declare, because a leaf
 *  `openGraph` REPLACES the root's rather than merging into it. */
export const OG_DEFAULTS = {
  type: "website",
  locale: "pt_BR",          // underscore — see the trap below
  siteName: wordmark,
} as const;
```

`app/layout.tsx`'s `metadata` (`:36-54`) gains:

```ts
openGraph: { ...OG_DEFAULTS, title: messages.meta.title, description: messages.meta.description },
twitter: { card: "summary_large_image" },
```

and **every one of the eight leaf declarations spreads it too**.

**Why, verified rather than assumed.** Probed on a Turbopack production build of a throwaway Next 16.2.12 app with exactly this root layout:

```
/semog       (no leaf openGraph)                  → og:title og:description og:site_name og:locale og:type  ✓
/jogo        (leaf openGraph:{title,description}) → og:title og:description og:image
                                                    NO og:type, NO og:locale, NO og:site_name   ✗
/ogdefaults  (leaf openGraph:{...OG_DEFAULTS,…})  → all three restored                           ✓
```

Without the spread, the routes keeping the full card would be exactly the ones F8 says get the *generic* card, and the eight routes #34 exists for would lose it. `og:locale` is this decision's own named trap — and revision 1's `T-WEB-S199` asserted it **on the root layout, where it passes while every share target lacks it**. §9 widens `S198`/`S199` to assert `locale`, `siteName` and `type` on a **leaf route's resolved metadata**.

**The `pt_BR` trap, stated because it will otherwise be "fixed" by the first reviewer who sees it.** The Open Graph protocol's `og:locale` is `language_TERRITORY` with an **underscore**; `<html lang>` is BCP-47 with a **hyphen**. `apps/web/src/i18n/locale.ts` exports `"pt-BR"` and `layout.tsx` correctly uses it for `lang`. **The two must not share a constant**, and `T-WEB-S199` asserts the underscore form and asserts it is *not* the exported `locale`.

**`twitter.card`, and the contingency revision 1 reserved is deleted.** `twitter:image`, `twitter:image:alt`, `:type`, `:width` and `:height` are emitted **automatically** from the `opengraph-image` file convention — verified in the same probe (`/jogo` emits all five without a `twitter-image.tsx` existing). Next also derives `twitter:title` and `twitter:description` from `openGraph`. So `twitter.card: "summary_large_image"` is declared, **no `twitter-image.tsx` will ever be needed**, and revision 1's *"if the X validator refuses, add one"* deviation branch is removed rather than left as dead contingency. §13 still pastes the rendered `<head>` of one daily and one archive URL, because the tag list is cheap evidence.

`metadataBase` already resolves every relative metadata URL against `siteOrigin()` (`layout.tsx:42`), so no OG value hardcodes the apex — ADR-0013 `:36` holds.

### D12 — **Three static TTF instances are committed**, at the app's own weight, read once at module scope. This is the ticket's largest technical decision.

**The blocker, verified from the bundled source rather than from documentation.** Fonts reach the app through `next/font/google` (`app/layout.tsx:12-27`): `Fraunces` (variable, `opsz` axis, normal + italic) and `Instrument_Sans`. A repo-wide find for font binaries returns **exactly one** file and it is not ours — `next/dist/compiled/@vercel/og/Geist-Regular.ttf`. Everything else is woff2, uncommitted build output under `apps/web/.next/static/media/`. And the bundled satori accepts only TrueType, `OTTO`, `ttcf` and `wOFF` (WOFF **1**); `wOF2` hits `throw new Error("Unsupported OpenType signature " + signature)`.

**What the probes established** (run against the repo's own installed `next@16.2.12`, scratch dir only, working tree untouched):

1. **A static TTF renders correctly.** Geist-Regular.ttf → a 21,596-byte PNG in 269 ms, with `Ação: coração, pão, você, três — çÇáÁãÃêÊ` rendered accent-perfect.
2. **A variable TTF does not degrade — it throws.** `Fraunces[SOFT,WONK,opsz,wght].ttf` and `InstrumentSans[wdth,wght].ttf` both raise `TypeError: Cannot read properties of undefined (reading '256')`. Root cause in `index.node.js` ~line 11887: `parseFvarAxis` does `axis.name = names[p.parseUShort()]` and `font.names` is **never assigned anywhere in the bundle** (`grep -n 'font\.names *=' index.node.js` → nothing). Deterministic, for any font carrying an `fvar` table. **This would be an uncaught 500 on the OG route, not a fallback.** It is also why "just use the variable font" is not an option anyone can take later.
3. **Satori synthesises nothing.** With only a 400 face registered, a request for weight 700 returns a **byte-identical** PNG (md5 `d45fd987…` both). Requesting `fontStyle: "italic"` with no italic face likewise returns the byte-identical upright. **Every weight and the italic each need their own file.**
4. **Static instances honour weight.** Two faces registered under one family, `fontWeight: 400` vs `700` → different bytes, visually a real light serif and a real bold.
5. **Google Fonts `css2` with a legacy user-agent serves *static* TTFs.** `curl -A "Mozilla/4.0 (Windows NT 6.1)" 'https://fonts.googleapis.com/css2?family=Fraunces:wght@700'` yields a `format('truetype')` URL whose file dumps `fvar=false`, `OS/2 usWeightClass=700`. The `google/fonts` GitHub repo holds **only** the variable files for both families and is therefore useless here.
6. **`fs.readFile(join(process.cwd(), …))` at module scope is traced automatically — by Turbopack's tracer, which is the one that runs (H4).** Revision 1 grounded this on `@vercel/nft`'s static evaluator. That is the **wrong code path**: `apps/web`'s build is bare `next build`, Turbopack is the Next 16 default (`next/dist/lib/bundler.js:74-77`, confirmed in production by `/_next/static/chunks/turbopack-*.js`), and nft's `collect-build-traces` is gated on `bundler !== Bundler.Turbopack` at `next/dist/build/index.js:1541`. The **conclusion holds** and is now grounded on a real Turbopack build of a throwaway app with exactly this loader shape:

   ```
   .next/server/app/arq/[data]/jogo/opengraph-image/route.js.nft.json
     ../../../../../../../assets/fonts/Fraunces-600.ttf
     ../../../../../../../assets/fonts/InstrumentSans-400.ttf
     ../../../../../../../node_modules/.../@vercel/og/Geist-Regular.ttf
   ```

   *(The probe app carried a `Fraunces-600.ttf` because it was built before B11 changed the weight to 500; the trace is about the path, not the face, and the filename is pasted as it actually came out rather than adjusted.)* Both committed faces are traced into the metadata route's own `.nft.json`. **This is checkable locally at I24, before the preview** — so revision 1's *"neither can be proved locally"* was too pessimistic by half. Only the runtime value of `process.cwd()` in the deployed function stays preview-only. **No `outputFileTracingIncludes` entry is required — and it would be a no-op if it were** (verified: adding one under Turbopack changes nothing).
7. **A static `import fontData from "./x.ttf"` does not even compile.** Next defines no asset-module rule for fonts in app code (the only `asset/resource` rule in `dist/build/webpack-config.js:2169` is behind `experimental.craCompat`, off), and neither `next` nor `next/image-types/global` declares a `*.ttf` module, so `pnpm typecheck` fails.
8. **Both families are OFL 1.1** (`METADATA.pb`: `license: "OFL"` for `ofl/fraunces` and `ofl/instrumentsans`), and **neither `ofl/fraunces/OFL.txt` nor `ofl/instrumentsans/OFL.txt` declares a Reserved Font Name** (S7). Clause 3 therefore never bites — for a subset, an instance, or anything else — and clause 2 (*"each copy contains the above copyright notice and this license"*) is the whole obligation, discharged by shipping `OFL.txt` beside the binaries.
9. **`fs.readFile` costs ~0.3–0.9 ms**; the real card renders in ~215 ms cold / ~50–70 ms warm (re-measured at revision 2 on the tree §7.2 specifies). Module-scope caching is right, but it buys ~1 ms, not the 200.
10. **`ImageResponse` fails under this repo's jsdom vitest environment**, at rasterisation, not at import: the bundle does `sharp(new TextEncoder().encode(svg))` and jsdom's realm-local `TextEncoder` produces a `Uint8Array` that fails sharp's `instanceof` check in the Node realm. `// @vitest-environment node` fixes it, verified. (Incidental finding: the node build of `@vercel/og` prefers `sharp` over resvg-wasm via a try/catch dynamic import, and `sharp@0.35.3` is already an `apps/web` devDependency — `package.json:36`. Either rasteriser produces a PNG; nothing in this plan depends on which.)

**The decision, and why each part.**

- **Commit static instances, not the variable files, not a request-time fetch, not Geist.** Fetching at request time adds a third-party network dependency and its latency to a crawler-facing route that is already doing a database read, and it fails closed to a 500 the day `fonts.gstatic.com` is slow. Geist is off-brand against `DESIGN.md` and against `.impeccable/config.json`, whose only `overused-font` allowances are `fraunces` and `instrument sans` — and nothing mechanical would catch it, because `impeccable detect` does not scan a PNG. Flag F6.
- **Three faces: `Fraunces-36pt-500.ttf`, `InstrumentSans-400.ttf`, `InstrumentSans-600.ttf`.** *(Revision 1 committed Fraunces **600**; B11 is right and the fix is 500. Revision 2 committed `wght@500` with no `opsz` term, which is silently Google's **14 pt text cut**; RB1 is right that this is wrong, and §7.2a derives which cut is right and why it is neither of the two the reviewer offered.)* **The app does not render Fraunces at 600.** `packages/ui/tokens.css:25-26` sets both display sizes at **550** (`--text-card-title: 550 30px`, `--text-screen-title: 550 54px`), and every Fraunces title in the conclusion sheet is 550 (`conclusion-view.module.css:198, 618, 745, 819`). Combined with probe finding 3 — **satori synthesises nothing** — a 600-only face would make every card permanently heavier than the product it advertises, uncorrectable without a second binary.

  **`css2` cannot serve 550, probed at I12's own fetch:** `wght@550` returns **two** `@font-face` blocks declaring 500 and 600 (the legacy-UA static pipeline quantises to standard hundreds); `wght@550..550` is `400: Invalid selector`; `opsz,wght@144,550` likewise yields 500 and 600. So the choice is 500 or 600, equidistant from 550, and **500 is the editorial side** — Fraunces is the display face and the lighter instance is the one that reads as an editorial serif rather than as a bold; `DESIGN.md:26` puts the family's declared band at *"Weights 450–600"*, so 500 is inside it. Both downloads verified before committing: `fvar=false`, `OS/2 usWeightClass` 500 and 600 respectively. The card registers the face under `weight: 500` and asks for `fontWeight: 500`; §14 V8 records the −50 delta from the app.

  **The `opsz` term is the other half of the fetch, and it is not optional — §7.2a derives it.** `Fraunces:wght@500` and `Fraunces:opsz,wght@14,500` return the **same binary** (md5 `e791faf695…`, 71,596 B): the no-opsz form is not a neutral default, it is Google's **text** cut — the 13–15 bucket, which the axis default of 14 falls inside; Google's own metadata gives the axis `min 9, max 144, defaultValue 14`. #34 commits `Fraunces:opsz,wght@36,500` (71,648 B). **`css2` quantises `opsz` into buckets exactly as it quantises `wght`, and off-bucket values are served silently as a different cut.** The bucket set is **enumerated in §7.2a** — every integer 9…144 requested and the resolved gstatic URL diffed — and it is `9, 10, 11, 12, 13, 16, 17, 18, 20, 24, 28, 36, 48, 60, 72, 96, 120, 144`, **eighteen** of them, each serving every value up to the next. *(Revisions 2 and 3 quoted a made-up subset of this list and then reasoned about "neighbouring buckets" from it — T1a. The enumeration is cheap; do not recall it.)* So `opsz,wght@27,500` returns a face whose nameID 1 is `"Fraunces 24pt Medium"` with **no error**, `@30` and `@32` both return the 28 pt file, 84 and 90 return the 72 pt file, and 100 and 110 the 96 pt file. Out of range (8, 5, 145, 200) returns an HTTP error page rather than CSS. **Never request an off-bucket value**, and assert the cut you got — which `T-WEB-S202` now does (below), because three adjacent cuts are byte-for-byte the same size.

  Instrument Sans regular for the date and semibold for the kicker, whose 0.14–0.16em tracking reads thin at 400. **The card ships no italic**, and that is a decision rather than an omission: `DESIGN.md:26` makes Fraunces italic the app's human *voice*, and a card is a nameplate, not a voice. It saves an 85 KB face and — more importantly — it means nobody adds an italic line later and gets a silently upright render (finding 3). If a card ever wants italic, it adds `Fraunces-36pt-500-italic.ttf` in the same commit.
- **Unmodified, not subsetted.** The probe showed `css2`'s `&text=` subsetting works and halves the payload (26 KB vs 70 KB for Fraunces 700). It is declined: three unsubsetted faces are **168,996 B = 169.0 KB decimal / 165.0 KiB** (`Fraunces-36pt-500` 71,648 + `is400` 48,616 + `is600` 48,732 — measured, not the ~166 KB revision 1 estimated; every single-Fraunces choice lands in 168.8–169.0 KB, so the figure is insensitive to the optical cut), read once per cold lambda and never shipped to a browser, so the ~96 KB saving buys nothing measurable. **The 500 KB figure the plan used to invoke here is `@vercel/og`'s documented EDGE bundle ceiling and §1 declines Edge, so it does not bind on node** (T5) — it is quoted below only as the order of magnitude the library's own authors treat as the wall, never as this plan's budget. The budget argument that does bind is the one in §7.2a: a second Fraunces buys back 2.22 % on the secondary run for +42 % of the font payload. **The OFL argument revision 1 gave for this is deleted, because its premise was wrong** (S7): `google/fonts` holds only the variable files, so a gstatic static instance is *not* the upstream release and "unmodified" was never the distinguishing fact. It does not matter — neither family declares a Reserved Font Name, so clause 3 never bites either way, and the whole obligation is clause 2. The real reason to skip subsetting is that 96 KB read once per cold lambda, on a path that already spends ~215 ms rasterising and one Neon round trip, is not worth a build step and a second provenance record.
- **`OFL.txt` ships beside them**, one per family, as OFL 1.1 clause 2 requires.
- **Provenance is recorded and machine-checked** (S6). Committing a binary is exactly the path that sidesteps `minimumReleaseAge: 10080` and `trustPolicy: no-downgrade`; binaries are un-reviewable in a diff; and these bytes feed a server-side OpenType parser on an unauthenticated public path — the same parser probe 2 proved *crashes* on an unexpected table. So `apps/web/assets/fonts/SHA256SUMS` ships beside them, carrying for each face the **`css2` request URL including its `opsz` term**, the **resolved gstatic URL**, the **user-agent string** used to obtain the stylesheet, the **fetch date**, and the digest; and one assertion inside `T-WEB-S202` re-computes the on-disk digests and compares. The three `css2` URLs are fixed here rather than left to I12:

  ```
  https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@36,500&display=swap        → 71,648 B
  https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400&display=swap         → 48,616 B
  https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@600&display=swap         → 48,732 B
                                                                                   total  168,996 B
  ```

  All three fetched with `-A "Mozilla/4.0 (Windows NT 6.1)"`; each refetched twice with identical digests, so the URL→bytes mapping is stable and safe to checksum. **The digest assertion is necessary and not sufficient**, which is why S202 also asserts the cut intrinsically (below): a digest compares the file against a line in a file that the same commit could rewrite, so on its own it cannot tell you *which* optical instance you have.
- **They live in `apps/web/assets/fonts/`** — the Next docs' own example location, outside `app/` (nothing there can be mistaken for a route) and outside `public/` (which would publish three URLs nobody should fetch; the browser gets woff2 from `next/font`, not these).
- **Loaded at module scope in `apps/web/src/og/fonts.ts`, as `export const FONTS`, with top-level `await`** — one call shape, used identically by all nine routes (Q10/C9). Revision 1 described the module three times in two incompatible shapes (`await ogFonts()` and `FONTS`); the constant wins because it keeps the module **synchronously importable**, which matters: `og-card.test.tsx` runs in jsdom and must be able to import the card without dragging the loader in. **Blast radius, stated:** a throw at top level fails the **whole build**, not one route — verified during the probes, where an `import.meta.url` variant blew up during `/_not-found` prerender. That is the correct failure mode for a missing font (fail closed, at build, visibly) and it is why the three digests are asserted in the suite as well.

**What is an assumption and what is verified, stated where the implementer will see it.** Everything in the numbered list above is verified against this repo's installed packages, with output. **Provable locally at I24, before the preview:** the Turbopack tracer's `.nft.json` for each of the nine image routes lists the three TTFs (finding 6). **Not provable locally, and the only such claim left:** that `process.cwd()` in the deployed function resolves to the app root. §13 makes it a preview evidence item — fetch an archive card URL through the bypass, confirm `HTTP 200`, `content-type: image/png` and the `private, no-cache…` header, and confirm the type is Fraunces and not Geist. **There is no `outputFileTracingIncludes` escape hatch** (H4 — it is a no-op under Turbopack; §1 exception (iii) is deleted). If the trace ever fails, the fallback is decision 14's cut-the-OG-half.

**`.gitattributes` gains `*.ttf binary`.** Not strictly required — there is no `* text=auto` line, so git's NUL-byte heuristic already classifies them correctly, and git-lfs is not configured. It is added because the file already carries deliberate encoding pins, it is self-documenting, it survives anyone later adding `* text=auto`, and it stops GitHub attempting a diff.

**ADR-0002 `:41` gets an in-place annotation, and no `Amended by:` line.** That consequence already says *"a future native client needs static instances of Fraunces at chosen weights"*. #34 makes it true a milestone early, for a different consumer — but the reason it is annotated is **not** that a consequence came due (U5 rejected that ground, and it does not reach what §7.2a discovered). It is that the enumeration of *what must be chosen* grows from `{weight}` to `{weight, opsz}`: a request by weight alone silently returns Google's default text cut, so a native-client author following `:41` as written walks straight into landmine 25. The annotation is row 13; the header is declined because no decision moves. See §11.2(iv) and I36d, which are authoritative over this paragraph.

### D13 — The share button's placement and treatment.

**Decision:** a `<button type="button" className={styles.share}>` in `<aside className={styles.side}>`, between the CTA and `.secondaryLink`. Full width. **Paper treatment**: `background: var(--paper-card)`, `1px solid var(--line)`, `box-shadow: var(--shadow-sm) var(--line)` (hard, blur 0 — `DESIGN.md:36`), `border-radius: var(--radius)` (6), `font: var(--text-button)`, label `--ink`, `cursor: pointer`. `min-height: 52px` at mobile, matching `.cta`'s own mobile rule (`conclusion-view.module.css:1094-1097`) and clearing `DESIGN.md:40`'s 44px floor. Pressed state: the element slides 1px toward its shadow and the shadow shrinks by the same amount (`DESIGN.md:44`, `.cta:active`'s idiom at `:694-697`). No new animation name.

**Padding, and at which viewport it binds (C12).** At **desktop** the rule is non-zero padding on both axes, for the reason `.cta`'s own comment gives at `:647-657` — a filled/bordered control with `padding: Npx 0` fired `cramped-padding` on this exact card. At **mobile** the shipped `.cta` is `min-height: 52px; padding: 0` (`:1094-1097`), and it gets away with it because `min-height` plus centring is what supplies the vertical box there; `.share` matches it. So `T-WEB-S205` asserts non-zero padding on both axes **at the desktop rule** and asserts `min-height: 52px` at the mobile one — revision 1 asserted "both viewports" and would have contradicted its own D13.

**The three states revision 1 left undesigned (B12), and this matters more than usual.** `conclusion-view.module.css:36-39` states outright that *"this sheet declares no focus ring at all"* (the phrase is on `:37`) — true only because every interactive element there is an `<a>` on the UA default. `grep -c "<button" apps/web/src/play/conclusion-view.tsx` returns **0**: the share button is the conclusion's **first native button**, inheriting neither treatment. And `low-contrast` is globally ignored on scanned URLs (`.impeccable/config.json:18-28`), so nothing mechanical would catch a UA-grey disabled label on paper. The repo has the idiom twice — `app/hub-attach.module.css:170-177` and `app/privacidade/page.module.css:178-186` — and `.share` copies it:

```css
.share:disabled       { opacity: 0.55; cursor: default; }
.share:focus-visible  { outline: 2px solid var(--ink); outline-offset: 2px; }
```

All three (`cursor: pointer`, `:disabled`, `:focus-visible`) are asserted in `T-WEB-S205`. The sheet's `:36-39` comment becomes false the moment a focus ring lands there, so it is rewritten in the same commit (§11.4).

**The status region reserves its box (D9-design).** `DESIGN.md:52`'s reserve-the-dimensions rule is applied to the button by D1a and must apply to its own `aria-live` line too, or the column reflows the moment a share succeeds. The status paragraph is always rendered with a fixed `min-height` equal to one line of `var(--text-body)`; only its text content changes. `T-WEB-S205` asserts the `min-height`.

**Why paper and not f5's ink fill (flag F3) — with the true argument, not revision 1's.** Revision 1 said *"adding a second full-width ink-filled button directly under that CTA would put two primaries on one screen"* and cited f5 for it. **f5 ships exactly that stack**: `f5-conclusao-desktop.dc.html:66` is an accent-filled CTA and `:69` is the ink-filled share button immediately below it. Fernando's F3 call stands; the argument does not. The true one is about what shipped: the conclusion turned `Ver estatísticas` into a **centred text link with a rule** (`.secondaryLink:742-759`), so **f5's two-button row no longer exists to slot into**. What is left is a single-column ladder, and the paper treatment is f5's own second treatment reused for the control f5 gave the first one to — three legible levels for three levels of intent: **close the day** (accent/ink fill) → **share** (paper + hard shadow) → **statistics** (text + rule). The shipped `.secondaryLink` and `messages.conclusion.stats` are untouched.

**Two further frame deviations, recorded rather than discovered (D7-design).** (a) **The pairing is dropped**: `f5:69-70` and `f6:61-62` put share and statistics in one `flex` row at `flex:1` each; the shipped conclusion has no such row, so `.share` stacks. (b) **The mobile ladder is flattened**: `f6:61` gives the mobile primary 52px **with** a shadow and the secondary 48px **without** one, while this decision gives `.share` a shadow at both viewports and `min-height: 52px`. That is deliberate — `.share` is not f6's secondary, it is a third level whose paper-plus-shadow *is* its emphasis — but it is a deviation from the frame and it lands in §14 as **V6** and **V7** rather than being explained away in prose.

**The mobile first-viewport budget is measured before I7, not after (D10-design).** #31's `first-viewport-column-overflow` is the precedent: a control added to a column that was already at its limit. So I6a measures current 390×844 headroom on the conclusion's **worst** state — `lost`, with the streak card, the full day strip, and the 36-character `failed` message visible — and records the figure. If the button does not fit above the fold in that state, the fix is a plan revision, not an implement-step judgement call.

**One label at both viewports.** f5 says *"Compartilhar resultado"* and f6 says *"Compartilhar"*. Two strings for one control is an i18n smell and a second thing to keep in sync; the context (a conclusion screen, under a result) supplies "resultado" for free. Deviation from the reference recorded here and in §14.

**Design compliance is proved by file-mode checks, not by the URL scan, and this is claimed nowhere else.** ADR-0034 decision 4 is exact: `impeccable detect` launches a clean browser profile, so the URL scan always reaches the **empty** conclusion — `conclusion-view.module.css:647-657` says the same thing in its own words (`:652-654`). The share button renders only in `result`/`lost`, so **`npx impeccable detect` in CI can never see it**. What proves it instead, named so it is not substituted later: a **file-mode** `impeccable detect` run over the real component with its real stylesheet (CSS-module names unhashed) at both viewports, jsdom render assertions, and stylesheet-text assertions (`T-WEB-S205`). The PR body says this in those words and does not claim URL-scan coverage. `npx impeccable detect` still runs in CI and must still be green, because the conclusion's *empty* state is in the scan list and the stylesheet changed.

---

## 5. Decisions register — mechanics

### D14 — **One pull request.** ADR-0053 decision 15's rule has no analogue here, and the reasoning is written out rather than asserted.

**What decision 15 actually forbids.** *"The write window ships and DEPLOYS before the routes that produce archive writes exist."* Its mechanism is specific: the two apps deploy from the same push, the web deploy cannot be gated on the API's, the client's terminal status set contains **404**, and a terminal sync settles the record `rejected` permanently — so any window where web has routes the API refuses **silently and irreversibly discards** completions, after which the prune is entitled to delete them.

**Every one of those preconditions is absent here.**

- **#34 produces no writes at all.** No `POST`, no completion, no queue, no sync path touched. `apps/web/src/play/sync.ts` is not edited.
- **`apps/api` is not edited.** There is no second deployment to order against; `git diff main -- apps/api` is empty and §13 makes that a criterion.
- **No migration, no schema change.** `git diff main -- packages` is empty.
- **The readers the OG routes call already exist on `main` and are already deployed.** `getTodayDaily` predates #31; `getPublishedDaily` shipped with the wall and is already on the db wall's permitted list. Neither is new, and nothing in `packages/db` moves.
- **Nothing degrades irreversibly on a partial deploy.** The failure mode of an OG route that is not yet deployed is a 404 image on a page whose title and description still render. The failure mode of a rollback is the same. Nothing is written, so nothing is lost.

**Nor is there a size reason to split.** Nine ~15-line route files, one card builder, one composer, one button, three binaries and five test files is comparable to plan 037's PR 2 (seven pages, four screens, four readers, the walls and the gates) and smaller than #27's or #21's. Splitting without a mechanical reason costs a full six-lens review round for nothing.

**The stated contingency, with its trigger.** The two halves are genuinely independent — the share button needs no card, and the cards need no share text. **If decision 12's preview verification fails, the OG half is cut to a follow-up issue and the share half ships alone.** There is no intermediate escape hatch to try first — `outputFileTracingIncludes` is a no-op under Turbopack (H4) — so this contingency is the whole fallback, and its trigger is I43's `curl` returning a 500. Not the other way round: the share text is the half that discharges the *"dead share button"* debt four documents record, and the half whose product decision Fernando already made.

### D15 — Walls, budgets and the lists that grow.

**The free-play wall gains `**/play/share-text`, in both halves, with probes.** Free play must not acquire a share button: it records nothing (ADR-0046), and ADR-0011's shareable-seed idea is *"noted, not scheduled"* (ADR-0046 `:31`). The napkin's one-hop rule binds any module newly reachable from a walled value, and the cost here is two array entries and two probes. Concretely: the string `"**/play/share-text"` joins `freePlayBannedModuleGroups`' first group (`eslint.config.mjs:216-240`, beside `**/play/conclusion-view`), and `share-text` joins the `play\/(…)` alternation in `freePlayDynamicBannedModule`'s selector (`:328`). **The mechanic that matters:** flat config *replaces* a rule's configuration rather than merging it (`eslint.config.mjs:75-82`, `:509-515`), so object (3) repeats objects (1) and (2)'s arrays verbatim at `:538-553` and `T-LINT-S14`/`S15` pin that. `T-LINT-S39`/`S40` are the red-then-green probes.

**The button stays inside `conclusion-view.tsx`** — which is already banned by name in both halves — so no second free-play wall entry is needed. That is one reason not to give it its own file.

**The OG wall is new and standing (B3), and revision 2's description of it would have deleted the db wall for the eight routes that read the database (RB2).**

`eslint.config.mjs:75-82` states the mechanic in its own words: *"flat config **REPLACES** a rule's whole configuration per matching file — it never merges — so the free-play object further down has to REPEAT these verbatim or it would silently delete the db wall for exactly the free-play files (T-LINT-S14/S15 pin the repetition)."* Restated at `:509-515`: *"Proven red by T-LINT-4/4b/4c against the plan's original two-object shape; **do not 'de-duplicate' them away**."*

The OG wall's globs are **entirely inside** object (1)'s (`apps/web/**`) and object (2)'s (`apps/web/app/**` + `apps/web/src/**`), and outside object (3)'s (free play). Revision 2 said the new block *"declares its own complete arrays"* and then named only the games ban. **Measured on the real config**, with a fourth object that declares only the games ban, at `apps/web/app/opengraph-image.tsx`:

```
probe                                today   with a naive OG object
db subpath (@miolos/db/publishing)     1              0
relative into packages/db/src          1              0
root entry sql / users                 2              0
stripDailyContent from @miolos/core    1              0
table-name literal "daily_puzzles"     1              0
table-name template remote_config      1              0
computed dynamic import(s)             1              0
require("@miolos/db")                  1              0
```

**Every one of the eight probes goes from red to clean — nine lint messages in all, because the root-entry row reds twice, once for `sql` and once for `users` (V9) — and `pnpm lint` stays green.** *(A ninth probe, `import("@miolos/db")`, is clean today too — `webDynamicDbImport` bans only the server-internal subpaths — so it is not in the table.)* These are the eight files in the app that call `getDb()` on an unauthenticated crawler-facing path — the most consequential place in the repo to lose the table-name and computed-dynamic-import bans. §13's *"db wall untouched"* is a file-diff criterion and cannot see it. CLAUDE.md: *"no PR may remove or weaken one that does [exist]."*

**So the object is written out in full, in the shape `eslint.config.mjs:526-555`'s free-play object already uses, and its position in the array is stated: object (4), AFTER (1), (2) and (3)**, non-overlapping with (3):

```js
const ogBannedGameGroups = [
  {
    // ADR-0033 decision 2 :49-55 — the Nonogram picture is DERIVABLE from the
    // published clues in under a millisecond (Context :23-30: 280 dailies, 0
    // mismatches, worst 0.338 ms). Withholding it is a PRODUCT decision, and
    // this is the mechanical half of that refusal: an OG route already holds
    // `daily.clues` from its wall read, so `solveNonogram` is one import from
    // painting the exact bitmap into a chat bubble (ADR-0054 decision 8).
    group: ["@miolos/games", "@miolos/games/*", "**/packages/games/src", "**/packages/games/src/*", "**/packages/games/src/**"],
    message: "an OG card draws no puzzle content: @miolos/games is banned from the card and the image routes — `solveNonogram(clues)` recovers the Nonogram picture from the published clues, and refusing to draw it is the product decision ADR-0033 decision 2 records (ADR-0054 decision 8).",
  },
];

const ogDynamicGamesImport = {
  selector: "ImportExpression > Literal[value=/(^@miolos\\/games(\\/|$)|packages\\/games\\/src)/]",
  message: "…the same ban, dynamically — `no-restricted-imports` never sees `import(\"@miolos/games/nonogram\")`.",
};

// (4) THE OG WALL (#34, ADR-0054 decision 8/15). Placed AFTER objects (1),
// (2) and (3), and REPEATING (1)'s and (2)'s arrays: flat config replaces,
// never merges, so this object is the ENTIRE wall for the files it matches —
// and its globs are a strict subset of (1)'s and (2)'s. Measured: without the
// spreads, all eight db-wall probes that red here today lint CLEAN.
// T-LINT-S43/S44 and T-LINT-S8a are the replacement-regression controls.
{
  files: [
    `apps/web/src/og/**/*.${webWallExtensions}`,
    // `**` matches ZERO segments here, so this reaches the ROOT card
    // `apps/web/app/opengraph-image.tsx` as well as the eight nested ones —
    // verified against this repo's own eslint 10.8.0, not assumed (T-LINT-S44).
    // `twitter-image` is included although D11 proves none will ever be needed:
    // if one ever is, it must not arrive outside the wall, and the cost is one
    // token and one probe assertion.
    `apps/web/app/**/opengraph-image.${webWallExtensions}`,
    `apps/web/app/**/twitter-image.${webWallExtensions}`,
  ],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [...webWallImportPatterns, ...ogBannedGameGroups],
        paths: webWallImportPaths,
      },
    ],
    "no-restricted-syntax": [
      "error",
      webDynamicDbImport,
      webDynamicPackageSource,
      webComputedDynamicImport,
      webRequireCall,
      webTableNameLiteral,
      webTableNameTemplate,
      ogDynamicGamesImport,
    ],
  },
},
```

**Five probes, in two files, and every one of them is red-then-green** (§9): `T-LINT-S41` static games ban with a clean control at a non-OG path; `T-LINT-S42` the dynamic half; **`T-LINT-S43` the replacement regression** — the S14/S15 analogue, asserting the eight db-wall probes above still red inside the OG surface **and that the message is the app-wide wall's own** (`"wall-safe root entry"`), which is what proves the repetition carried the original rule rather than a lookalike; **`T-LINT-S44` glob reach** — the ban fires at all nine route paths *including the root card* and at `src/og/**`, and is clean at `app/sudoku/page.tsx`; and **`T-LINT-S8a`** in `eslint-db-wall.test.ts`, the sibling of the id that exists for exactly this (*"#27 adds a whole new source directory to `apps/web/src`, and every glob in the wall is written against `apps/web/src/**` … so it is asserted from the new directory itself"*) — #34 adds `apps/web/src/og/**` and owes the same assertion, in the file where that claim lives. A sibling letter rather than a fresh number because it is the same claim on a new directory, which is the rule `docs/agents/test-ids.md:16` states.

**`describe` carries the topic and NO id** in the `eslint-*-wall.test.ts` files — one id per `it`, per `test-ids.md:5` and `:85`, and because a `describe` repeating its own `it`'s id is the same-file duplicate corrected on `T-LINT-S37` at #31's verification round (RB2d).

D8 argues why this is a wall and not a grep.

**The four `/<jogo>/concluido` routes join `BUDGETED`** (`apps/web/scripts/route-client-js.mjs:152-189`). They are not there today, and #34 is the first ticket whose client JS lives primarily on the conclusion. The script's own comment at `:171-172` makes exactly this argument for the archive index: *"'ships nothing today' is precisely the route that acquires a library silently."* **Conditional, stated so it is not an implement-step surprise:** measure first. Today's figures (`pnpm bundle-check` from `apps/web`, `EXIT=0`, run at `71ef4ca`) are `/binairo/concluido` +8.9 KB, `/sudoku/concluido` +8.3 KB, `/nonogram/concluido` +8.9 KB, `/termo/concluido` +9.8 KB — all far under the 40 KB default. If any lands over after the change, it gets a `PER_ROUTE_BUDGET` entry with the measured arithmetic in a comment (the `/termo` and `/modo-livre/nonogram` idiom) and a §14 deviation entry.

**The measured slack the share path spends.** Deltas are against `/`, from the same run:

| Route | Delta today | Budget | Slack |
|---|---|---|---|
| `/binairo` | +33.5 KB | 40 | 6.5 KB |
| `/nonogram` | **+35.6 KB** | 40 | **4.4 KB** ← tightest |
| `/sudoku` | +29.7 KB | 40 | 10.3 KB |
| `/termo` | +66.9 KB | 76 | 9.1 KB |
| `/arquivo/[data]/termo` | +51.6 KB | 76 | 24.4 KB |

**What #34 adds to the client:** `share-text.ts` (a pure composer — a switch on four discriminants, a grid join, a template string), the `ShareButton` sub-component (a `useState`, a `useEffect` timer, one handler), and the `messages.share` strings. **The OG routes add exactly zero** — a metadata route ships no client chunk and never appears in `route-bundle-stats.json` at all (verified in a Turbopack build).

**The `/nonogram` headroom is measured before the commit, and the remedy branch is written down (C8).** Revision 1 guessed *"≲1 KB"* and *"≲0.7 KB"* against 4.4 KB of slack — 39 % of the tightest budget in the repo, neither figure derived — and scheduled the measurement at I32, *after* the code lands, with the only stated remedy being a `PER_ROUTE_BUDGET` entry for the four `concluido` routes. That is no remedy for `/nonogram` at all, and the doctrine forbids the obvious one (`route-client-js.mjs:130-134`: the shared constant must not be raised). So:

- **I6a measures a proxy first**: build with `share-text.ts` and a stub `ShareButton` wired into `ConclusionView`, and read `/nonogram`'s delta. That is a real number before anything is committed.
- **If `/nonogram` lands over 40 KB**, the branch is: (1) **diagnosis, not a remedy** — confirm the growth is `messages.share` on the shared baseline rather than the button; napkin Domain item 3's `/`-absolute check distinguishes them; (2) **a micro-remedy, and it is labelled one** — if it is the button, move the click handler behind a `useCallback`-free plain function and drop the timer in favour of a CSS-driven status fade. This buys **tens of bytes, not the kilobyte a real overrun needs**, and it is listed because it is free, not because it would close a gap; (3) **the real remedy** — `/nonogram` takes a `PER_ROUTE_BUDGET` entry with the measured arithmetic in a comment (the `/termo` and `/modo-livre/nonogram` idiom) plus a §14 entry, and if the branch fires it also owes the conditional annotation on ADR-0045 `:151-175` (§11.2). **`MAX_DELTA_BYTES` is not raised under any branch.**

**Two measurement traps, both from the napkin.** (a) `messages.ts` is imported by `/`, so new strings there grow the **baseline** and shrink every route's *delta* — which can mask growth. Napkin Domain item 3 requires `/`'s own absolute first-load figure published before and after, not just the deltas. (b) `rm -rf apps/web/.next` (required before typecheck) deletes the stats file, so `pnpm build` must run in `apps/web` before `pnpm bundle-check`, and `bundle-check` must be run **from `apps/web`**, never from the root (silent exit-0).

**Nothing else on any list moves.** `impeccable.yml`'s three URL lists: unchanged (no new page). `route-ssr.test.tsx`'s 23-row `ROUTES` table: unchanged (an image route has no page default export and `callPage` cannot call it). `sitemap.ts`'s path list: unchanged. `robots.ts`: unchanged. `next.config.ts`: unchanged (and `apps/web/test/next-config.test.ts:8` asserts `headers()` returns **exactly one** rule, so no PNG-specific header is added — `nosniff` is already satisfied because `ImageResponse` sets a correct `content-type`, and the CSP is `frame-ancestors 'none'` with no `img-src`, so nothing blocks the image). `turbo.json`'s `build.env` allowlist: unchanged (no new build-time variable).

---

## 6. The share text, written out

### 6.1 `apps/web/src/play/share-text.ts`

```ts
/**
 * The share text (#34, ADR-0054 decisions 2–5). PURE: a play record in, one
 * string out. No React, no DOM, no clipboard, no `@miolos/db`, no
 * `@miolos/games` — which is what lets `apps/web/test/share-text.test.ts`
 * assert the whole contract without rendering anything.
 *
 * WHAT IT MAY NOT SAY: the day's answer (it is in the record it reads,
 * `play-record.ts:341`), any guess word, the Nonogram bitmap, any board, the
 * Nonogram size, the hint count, the sync outcome, the streak, any medal, any
 * solved total, and the word "hoje" — `onTime` is parsed and DISCARDED
 * client-side (`sync.ts:485-495`), so nothing here can honestly claim when
 * the day was solved. The DATE is fine: it is the server's day, handed down
 * by the page shell.
 *
 * EACH IS GUARDED, AND BY THREE DIFFERENT MECHANISMS — which is the honest
 * statement, not "each has a test" (T-WEB-S190/S191):
 *   - fields that ARE on the record (answer, size, hintsUsed, syncOutcome,
 *     grid) → a DIFFERENTIAL: two records differing only in that field
 *     produce byte-identical output;
 *   - fields that are NOT on the record (streak, medals, solved totals, the
 *     day strip) → a module-graph scan, plus a signature assertion, because
 *     the realistic regression is a new ARGUMENT, not a new import;
 *   - fields that could BECOME on the record (the Sudoku tier is the live
 *     example) → a key-set assertion over each record member's schema.
 */
export function buildShareText(
  record: PlayRecord,
  options: { readonly url: string },
): string;
```

**The docblock names no future consumer, and that is the fix for B8.** Revision 1's version ended *"…and what will let the archive's late-result panel reuse it"*. That panel is explicitly out of scope (F7) and its issue is not filed until I41 — a hooks-of-the-future comment naming a consumer that does not exist, which this repo rejects (napkin Execution item 5). The **placement** stays: a pure composer belongs outside the view on its own merits, and it happens to make the follow-up a wiring job. That argument lives here and in the PR body; the source says only what the module *is* and what it may not say.

Implementation shape: switch on `record.game`; Termo builds `header / n-of-max / "" / grid / "" / url`, the other three build `header / elapsed / "" / url`; join with `"\n"`. The grid is `record.guesses.map(row => row.tiles.map(t => messages.share.tiles[t]).join("")).join("\n")`. `tiles` is a **5-tuple**, not an array (`packages/core/src/contracts/termo-guess.ts:62-68`), and `TERMO_MAX_GUESSES = 6` — so the grid is at most 6×5 by type.

Callers pass `url = absoluteUrl(archiveGameRoute(record.date, record.game))`. The composer takes the URL rather than building it, so it stays free of `site-origin` and of any route knowledge, and `T-WEB-S192` pins the composition at the call site.

**The answer stays in the seam, and the guard is a property test rather than one fixture (S8).** Narrowing the parameter to a projected `{ game, date, elapsedMs, tiles, outcome }` was considered and declined: the projection would have to be built somewhere, and the only place with the record is `ConclusionView`, so the answer would simply move one file over while the composer lost the discriminated union that makes its switch total. Instead `T-WEB-S190` becomes a **property test over all 400 canonicals** imported from `@miolos/games/termo` **in the test file only** — one answer per case, asserting the string never appears in the output on either outcome. `T-WEB-S206` pins that neither `share-text.ts` nor `messages.ts` imports from `@miolos/games/termo`, so the word list stays test-only.

**And S190 gains a second arm that is strictly stronger than a substring scan** (the RB6/RB7 mechanism, applied where it is sharpest): `answer` is `z.string().length(5).optional()`, constrained only by the `superRefine`'s *present-iff-concluded* rule (`play-record.ts:341`, `:361-367`), so **two concluded Termo records differing ONLY in `answer` are both valid** — and the composer must return **byte-identical** strings for them. That proves the answer cannot influence the output *at all*, where the substring scan proves only that one particular spelling did not appear in it.

**`T-WEB-S193`'s literal scan is scoped, because the shipped idiom would red on this composer (C6).** `archive-metadata.test.ts:154`'s regex is `/(["'])(?:(?!\1).){2,}\1/g` — two-or-more characters between quotes — and `"\n"` is **two** characters in source, so the scan as revision 1 wrote it reds on `join("\n")` and on the `""` blank-line entries. Decided now rather than at I3, because I3 is TDD-first: S193 scans for **user-visible text** with an explicit allowlist of structural separators (`"\n"`, `""`, `"/"`, `" · "` if it moves) and a comment saying that the allowlist is the reason no message-deck indirection is added for them (§6.3's `timeResult` argument).

### 6.2 The four outputs, verbatim

```
Miolos · Termo · 14 ago
4/6

⬜🟨⬜⬜⬜
⬜⬜🟩🟨⬜
🟨⬜🟩⬜⬜
🟩🟩🟩🟩🟩

https://miolos.app/arquivo/2026-08-14/termo
```
```
Miolos · Termo · 14 ago
X/6

⬜🟨⬜⬜⬜
… six rows …

https://miolos.app/arquivo/2026-08-14/termo
```
```
Miolos · Sudoku · 14 ago
07:12

https://miolos.app/arquivo/2026-08-14/sudoku
```
Binairo and Nonogram are the Sudoku shape with their own name.

**Deviations from Fernando's approved reference sketch, both deliberate:** `14 ago` rather than `14/08` (reuses the shipped `formatShortDate`, `format.ts:78`, which is pt-BR-native and has no host-timezone hazard — no new formatter), and the full `https://` scheme rather than a bare host (chat clients autolink a scheme reliably). The sketch was explicitly *"a reference, not a spec — exact copy, separators and ordering are the plan's to design within `messages.ts`."*

### 6.3 `messages.share` — the new top-level block

Placed **after `conclusion`** (`messages.ts:273`) and before `stats`, which is the shared-chrome position `play`, `conclusion` and `freePlay` already occupy. Imported **directly** by `ConclusionView`, never handed across the RSC boundary — the `stampAria` mechanism, stated three times in the tree (`types.ts:114-124`, `messages.ts:188-197`, `messages.ts:838-845`): a function member in a prop bundle is an HTTP 500 that only `route-ssr.test.tsx` can see.

```ts
/**
 * The share (#34, ADR-0054) — shared chrome, imported by the client
 * component rather than passed to it, exactly like `conclusion` above.
 *
 * `então`, `mamãe` and `época` are FORBIDDEN_EVERYWHERE in client chunks
 * (`scripts/route-client-js.mjs:285`) — audited: no string below uses one,
 * and T-WEB-S206 keeps it audited (it also pins that neither this module
 * nor `share-text.ts` imports from `@miolos/games/termo`).
 *
 * THE THREE SQUARES ARE CONTENT, NOT DECORATION, and they live here rather
 * than in `share-text.ts` so that every user-visible character in the app
 * keeps one auditable home. DESIGN.md:58 bans "emoji decorativo" — emoji
 * that decorate a RENDERED PAGE, where the design system could set a word
 * instead. A share text has no CSS, no fonts and no tokens; there the
 * square is the only available encoding of a per-cell verdict, and it is
 * the encoding the genre already uses. The same test forbids inventing
 * squares for the three games that have no per-cell verdict (ADR-0054
 * decisions 2 and 3).
 */
share: {
  label: "Compartilhar",
  /** After the clipboard fallback writes. Announced, because nothing visible happened. */
  copied: "Resultado copiado.",
  /** Both mechanisms refused. The only failure the player can see. */
  failed: "Não foi possível copiar o resultado.",
  tiles: { correct: "🟩", present: "🟨", absent: "⬜" },
  /** "Miolos · Termo · 14 ago" */
  header: (game: string, shortDate: string) =>
    `${wordmark} · ${game} · ${shortDate}`,
  /** Termo's result line. "4/6" won, "X/6" lost — the genre's own notation. */
  termoWon: (used: number, max: number) => `${used}/${max}`,
  termoLost: (max: number) => `X/${max}`,
},
```

There is deliberately **no** `timeResult: (elapsed) => elapsed`: the three grid games' result line is `formatElapsed(...)`'s output unchanged, and an identity function in the message deck is indirection with no reader.

---

## 7. The OG card, written out

### 7.1 `apps/web/src/og/card.tsx`

Two pure builders, both returning a React element tree and **neither** constructing an `ImageResponse` — so both are renderable in jsdom and assertable without rasterising (§9):

```ts
export function siteCard(): ReactElement;
export function gameCard(args: {
  readonly game: Game;
  /** Already formatted by `formatLongDate`. The ONLY value derived from a
   *  wall read that reaches this tree, and it is a date, not content. */
  readonly longDate: string;
}): ReactElement;
```

**`longDate` is required, not optional** — with all eight game cards dated (D7), there is no dateless variant, and the signature is what makes "no puzzle content on the card" a *type-level* property rather than a runtime scan (D8). Two strings, one of them a `Game` union member: there is no parameter a daily response can enter through.

### 7.2 Anatomy, at 1200×630 — the scale rule, then the numbers

Revision 1 specified the type as *"large"* and nothing else, which is how a card ends up with the right hex codes and none of the system (B10). Here is the derivation and every resulting value. **The GAME card was rendered against the repo's bundled `@vercel/og` 0.11.1 before these numbers were written down; the SITE card was not, and revision 2's *"all of it was rendered"* was untrue of it** (RD3). §14 batch 1 carries the game-card measurements, and **I20a renders the site card before the card work is gated** — which is also where its missing copy is settled.

**The scale rule: ×3 from the MOBILE reference frame.** An OG card is read in a chat bubble at roughly 300–500 px wide, so the 1200 px PNG is displayed at about **⅓ scale**. A card displayed at ~380 px is the size of `f6-conclusao-mobile`'s paper card (354 px in a 390 px frame), **not** `f5-conclusao-desktop`'s (703 px in a 1440 px frame). So every absolute **length** is **f6's value × 3**, and the card then *looks like the shipped mobile system at the size the recipient actually sees it*. One rule, mechanically checkable, and it is what makes `DESIGN.md:36`'s `N = 3–6` shadow range hold **at display scale** rather than being violated or ignored.

**The rule multiplies LENGTHS. Three quantities are not lengths, and each is stated rather than smuggled** (RD6):

- **Angles do not scale.** A rotation looks like itself at every scale, so the card takes **f6's −0.5 deg unchanged** — revision 2's −1.2 deg was the one table row with no derivation, and at display scale it would read as visibly *more* tilted than the frame the rule exists to reproduce. *(Round 2's associated arithmetic — that the rotation lifts a corner 10.9 px against a 15 px shadow and so varies the shadow band along the bottom edge — assumes the shadow does **not** rotate with the element, which is not how a `box-shadow` under `transform: rotate` behaves. Unverified, and −0.5 deg makes it moot; noted rather than relied on.)*
- **Optical size does not scale — it is the one property that must be divided by three, not multiplied.** §7.2a.
- **Two lengths are rounded off the ×3 value, and both roundings are declared below rather than left as arithmetic a reviewer has to catch:** the card width (1040, not 1062) and the padding (72, not 66).

| Element | f6 (mobile, 100 %) | Card (×3) | Source |
|---|---|---|---|
| Desk ground | `#F7F2E9` | same | `--paper-desk` |
| Desk dots | `rgba(33,29,25,0.06)`, r 1 px, tile 24 px | r **3 px**, tile **72 px** | `--texture-dots`, `DESIGN.md:13` (24 px is the mobile tile) |
| Card paper | `#FBF7EF` | same | `--paper-card` |
| Card width | 354 px | **1040** (×3 = 1062, **rounded down**), centred → exactly **80 px** desk margin each side | the ×3 value leaves a 69 px margin and is off the 4pt grid; 1040 is the largest 4pt width giving a whole-number margin, 2 % under |
| Card height | — | **460**, centred → **85 px** top/bottom | **content-derived, not ×3** (f6's card has no fixed height): 316 px of interior for a 262 px stack, see below |
| Card border | 1 px `#D8D0C2` | **3 px** | `--line` |
| Card radius | 6 px | **18 px** | `--radius` |
| Card shadow | `5px 5px 0 rgba(accent,0.22)` | **`15px 15px 0`**, same alpha | `f6:21`; `DESIGN.md`'s *Game card* entry is 0.22 |
| Card rotation | −0.5 deg | **−0.5 deg** — an angle is not a length | `f6`; inside `DESIGN.md:38`'s ±0.3–2.4 |
| Washi tape | 58 × 19, radius 2, −4 deg, `rgba(accent,0.32)`, `top:-10 left:30` | **174 × 57, radius 6, −4 deg**, `top:-30 left:90` | `f6:22`; `DESIGN.md:37` |
| Kicker | 11 px, 600, uppercase, ls 0.16em, `--ink-2` | **33 px**, same weight/tracking/colour | `--text-kicker`; `DESIGN.md:29`'s 0.14–0.16em; the string is `messages.games[game].kicker` (`messages.ts:741,879,937,1027` — "Palavras"/"Números"/"Imagem"/"Lógica"), looked up inside `gameCard` from its `game` argument, which is why §7.1's signature needs no `kicker` parameter |
| Game name | 27 px Fraunces 550 | **96 px Fraunces 500** | see below |
| Long date | 13 px, 400, `--ink-2`, lh 1.5 | **39 px** | f6's body size |
| Wordmark | — (no conclusion frame carries one) | **39 px Fraunces 500, `--ink`**, bottom-left | **the card's secondary type level, reused rather than invented** — revision 2's 36 px had no source at all (RD6). Upright, not italic (V5) |
| Card padding | 22 px | **72 px** (`--space-6` × 3, the 4pt-scale value nearest 66) | `DESIGN.md:40` |
| Kicker → name gap | — | **24 px** (`--space-2` × 3) | 4pt scale × 3 |
| Name → date gap | — | **12 px** (`--space-1` × 3) | 4pt scale × 3 |

**The game name at 96 px, and why not 81.** f6's 27 px × 3 is 81 px, but f6's title shares its row with a 108 px stamp ring; the card's only protagonist is the name. 96 px is `32 × 3`, on the 4pt grid, and it is the largest value at which the tallest realistic stack still clears the interior: interior 896 × 316 after padding; 33 (kicker) + 24 + 96 (name) + 12 + 58 (date at lh 1.5) + spacer + 39 (wordmark) = **262 px** of 316. **Satori overflows a fixed container silently rather than wrapping visibly**, so the longest realistic content is the case worth a raster, and `T-WEB-S202` rasterises it (D13-design).

**The longest case is *"Nonogram"* over *"22 de fevereiro de 2026"* — 23 characters, not 22** (RD5). Revision 2 wrote *"`formatLongDate` maxes at 22 characters"* and picked setembro. Enumerated over all twelve pt-BR months at `dateStyle: "long"`: fevereiro is the longest at **23** (`"22 de fevereiro de 2026"`), setembro/novembro/dezembro tie at 22, maio is the shortest at 18. Kickers max at 8 ("Palavras"), names at 8 ("Nonogram"). Width is not close either way — "Nonogram" at 96 px in the committed cut measures **480.6 px** of 896 — so this changes the fixture, not the design.

**The desk texture ships, as 153 explicit elements — and V4's justification is rewritten for the second time, because revision 2's replacement premise was also false** (RB5). `DESIGN.md:13` makes the dot texture part of the desk's definition and it is the one thing that says *Ateliê* at thumbnail size on a card that is otherwise a rectangle on flat cream, so dropping it was a real loss.

**What satori actually does, measured, and this is the sentence that goes into the ADR:** it resolves a **px**-valued radial-gradient colour stop as the fraction `value / elementWidth` of the gradient's own radius rather than as an absolute length. Inside a `background-size: 72px 72px` tile on a 1200-wide element, a `3px` stop becomes `3/1200 × 50.9 = 0.13 px` of radius — sub-pixel, at **every** output size. **Percentage stops are already fractions and tile correctly everywhere.** Verified over an eighteen-size sweep from 400×300 to 2400×1260 with an opaque red dot: px stops yield **0** saturated pixels at every size; percentage stops yield 768→18,480, scaling linearly with area. And the prediction is exact — a px stop *compensated* to `70.71px` (= 5.893 % × 1200) renders **identically** to the percentage form at 1200×630 and breaks at 600×315, which is the width-coupling made visible.

So **both of the earlier accounts were wrong**: revision 1's *"satori cannot do repeating radial gradients"* and revision 2's *"it renders at some output sizes and not at 1200×630, non-monotonically"*. The behaviour is **stop-unit-coupled and perfectly consistent**. Round 2's probe was right about the cause and this revision confirms it independently.

**A second satori trap found in the same probe, and it is a landmine rather than a footnote:** the `background` **shorthand** drops the gradient entirely as soon as it also carries a colour or a `/ <size>` component — `background: <color> <gradient> / 72px 72px repeat` renders **0** non-background pixels. Only `background: <gradient>` alone parses, and tiling still needs a separate `backgroundSize`. Use separate `backgroundColor` + `backgroundImage` + `backgroundSize`.

**The lattice still ships, and the honest reason is speed.** Re-measured on the real tree, 1200×630, 4 warmup + 20 interleaved iterations, two independent runs: **lattice median 48.3 / 50.5 ms**, **percentage-stop gradient 74.2 / 80.4 ms**, **no texture 33.7 / 35.2 ms**. ~26 ms per card, on a `force-dynamic` route with no cache, is the whole argument — plus the lattice states the 3 px dot radius in px instead of a 5.893 % figure that has to be re-derived from the tile diagonal every time the tile changes. **The colour argument revision 2 gave is DELETED**: measured at the token's real alpha, the gradient centre is `234,229,220`/`234,229,219` and the lattice centre is `233,229,220`, both at Euclidean distance **1.41** from the browser's `234,229,221`, both painting exactly 32 non-desk pixels per dot. It is a tie; revision 2's *"closer than the gradient path's `243,238,228`"* compared against the **broken px-stop** render and is not a comparison at all.

**And the count is 153, not 120** (RC5/RD4). The rule, not a literal: **`ceil(1200/72) × ceil(630/72)` = 17 × 9 = 153**. Rendered with 120 the bottom-right 80×70 desk corner holds **0** non-background pixels — the texture simply stops — and with 153 it holds **32**, one dot, which is the same per-dot footprint the colour probe measured. The last dot is index 152, so any count below 153 truncates. The published 48–55 ms warm band was measured **on the 153-element tree** and stands. The lattice is one 8-line helper in `card.tsx` deriving the count from the size, not 153 hand-written elements and not a literal anywhere.

**ADR-0041 is obeyed without invoking its exception.** Every word on the card is `--ink` or `--ink-2` — the kicker included, which is deliberate: `DESIGN.md`'s colour section says outright that *"the kicker is no longer among"* the sanctioned accent surfaces, so the reference frames' accent-coloured kickers predate ADR-0041 and are not copied. The accent appears only on the tape and the shadow, both sanctioned. No `color: var(--accent)` on text at any size, which also means Termo's mustard — 2.7311:1 on desk, 2.8501:1 on card, *"the ceiling over the whole paper family"* — is never a question.

**ADR-0036 does not bite.** The card's only figures are a date, which is a single non-aligning value, not a column — decision 2's own carve-out. So no `font-variant-numeric` is needed, which is fortunate, because satori's support for it is unverified.

**Three satori-specific constraints, each a landmine (§14).** (a) Satori requires `display: flex` on **any element with more than one child**; a plain `<div>` with two children throws at render, which is why the tree is written flex-first and why `T-WEB-S202` rasterises the real tree rather than trusting a jsdom render. (b) A repeating radial gradient is not available at this output size (above), so the texture is explicit elements. (c) Every weight and style used must have a registered face (decision 12 finding 3), so the card uses exactly the three shipped faces and nothing else.

**The site card, specified rather than sketched (D12-design) — and its copy has a SOURCE this time (RD3).** Revision 1 said *"four tapes, one per accent"*, which has no basis — `DESIGN.md:37` describes **one** tape over a card's top edge — and gave no shadow colour. `DESIGN.md`'s colour section already answers it: `#9E3B2F` (`--accent-app`, *"streak, promo"*) is the non-game surface accent. So the site card is the same paper card with **one** tape in `rgba(158,59,47,0.32)` and a `15px 15px 0 rgba(158,59,47,0.22)` shadow, carrying the wordmark at 96 px Fraunces 500 and a tagline at 39 px `--ink-2` in place of the kicker/name/date stack.

**Revision 2 said the tagline comes from `messages.meta`, and `messages.meta` has no tagline.** `messages.ts:92-96` carries exactly two keys — `title` (*"Miolos — quatro jogos por dia"*, which already contains the wordmark the card renders at 96 px, so using it would print the brand twice) and `description` (**133 characters** — measured at revision 4 off `messages.ts:95`, 133 UTF-16 units and 133 code points; revision 3 said 141 twice, once inside a docblock that ships into `messages.ts` — T4; rendered at 39 px it wraps to three lines and does not overflow, so it is not a truncation hazard — it is a wall of body copy where the spec implies a tagline). So §7.4 gains **`messages.og.siteTagline`**, written there rather than derived from `meta.title` by string surgery, and the site card is **rendered at I20a** rather than asserted.

**No CSS custom property can reach a PNG**, so `apps/web/src/og/tokens.ts` holds the literals the card needs, in one place, each with the `packages/ui/tokens.css` name it mirrors in a comment. This is the same move `app/layout.tsx:31` already makes for `themeColor` and `app/manifest.ts` for the manifest.

**The alpha literals are 8-digit hex, and that is what makes `T-WEB-S200`'s tie-back writable** (Q6/C11). The precedent tie-back is a substring match (`expect(tokensCss).toContain(themeColor)`), and `rgba(46,78,126,0.25)` is not a substring of anything in `tokens.css`. So the card writes `#2E4E7E38` (shadow, α 0.22) and `#2E4E7E52` (tape, α 0.32), and S200 asserts each literal's **leading seven characters** appear in `packages/ui/tokens.css`. **Verified that satori accepts 8-digit hex** and renders it identically to the `rgba()` form: `#2E4E7E40` and `rgba(46,78,126,0.25)` both produce pixel `199,204,210` on `#FBF7EF`.

**The card's contrast is not gate-covered by the URL scan, and there is now a file-mode substitute (A4).** ADR-0034 `:77-85` names the file-mode discipline *"so it is not substituted later"*, and revision 1 invoked it for the button while substituting a screenshot for the card. The card tree is inline-styled plain flex divs, so it renders to static HTML trivially — which is exactly what `impeccable detect file://…` takes. **I20a** writes `siteCard()` and one `gameCard()` to a 1200×630 HTML file and runs `npx impeccable detect` over it, output pasted in §13. The screenshots still go in the PR body; they are evidence, not the gate.

### 7.2a Which optical cut of Fraunces the card ships, and why it is neither 96 nor 144

**This is the one property the ×3 rule must NOT multiply** (RB1). **Revision 3 got the destination right and the argument wrong, and revision 4 replaces the argument rather than the destination** (T1): it quoted a false neighbouring-bucket set, and its three headline percentages were measured against three different references — one of them inside the very frame the section exists to reject. The cut is unchanged; every sentence justifying it is new.

**The criterion, stated BEFORE any number, because a criterion fitted to a choice is the defect T1 named.** One face has to serve both Fraunces runs on the card, so the choice is a trade and the trade is named first:

> **The committed cut is the one that minimises the deviation of the HERO run — the game name — from the app's own `font-optical-sizing: auto` rendering at the size the recipient reads it, subject to the secondary run — the wordmark — staying inside 2.5 %.**

The name is the hero by §7.2's own rule (*"the card's only protagonist is the name"*); it is set 2.5× larger than the wordmark (96 px against 39 px); and an optical-size error is a letterform property whose visible cost scales with the size of the text carrying it. **Every number below is a deviation from ONE reference — the browser's `auto` at the DISPLAY sizes, 32 px for the name and 13 px for the wordmark — measured on the two strings the card actually sets**, *"Nonogram"* (the widest game name) and *"Miolos"* (the wordmark). Where another criterion would choose differently, that is stated too, with its number, rather than left out.

**The mechanism, measured in a real browser rather than reasoned about.** `app/layout.tsx:12-18` loads Fraunces with `axes: ["opsz"]`, and CSS's default `font-optical-sizing: auto` sets **`opsz` = the font-size in px**. Re-confirmed at revision 4 in headless Chrome against the variable font served from a `data:` URI, with a serif-fallback control (`Nonogram` @32 px on the fallback alone: 136.86 px, nothing like any Fraunces cut) ruling out a substitution artefact, and DOM `getBoundingClientRect()` rather than canvas so that `font-optical-sizing` actually applies:

```
"Nonogram" @ 96px : auto = 412.766  ==  opsz96 = 412.766     (static 96pt 412.672 | opsz144 407.094)
"Nonogram" @ 36px : auto = 180.234  ==  opsz36 = 180.234
"Nonogram" @ 32px : auto = 160.797  ==  opsz32 = 160.797
"Miolos"   @ 13px : auto =  41.516  ==  opsz13 =  41.516
```

So the product renders Fraunces at `opsz` = its own CSS px size, at every size. **Satori synthesises no optical size any more than it synthesises weight or italic** (landmine 3), and unlike a missing weight there is no missing-face signal at all — it just draws the wrong cut.

**Two readings of "the size it renders at", and they disagree.**

- **(A) Author-pixel reading.** The card sets the name at 96 px, so commit `opsz,wght@96,500`. It reproduces the app exactly at 96 px.
- **(B) Display-pixel reading.** The ×3 rule (V6) exists because the card is *read* at ~⅓ scale; every length is f6's × 3 precisely so the recipient sees f6's system. Under that rule the reader sees the name at ~32 px (96 / 3) and the wordmark at ~13 px (39 / 3), so the cut must be the one the app uses at those sizes.

**(B) wins, and the deciding fact is that (A)'s premise does not survive inspection: the app has no 96 px Fraunces.** `tokens.css:25-26` tops out at `--text-screen-title: 550 54px`, and `--text-card-title` — the token the card's name actually descends from — is **30 px**. The card's 96 px is `32 × 3`, a *scaling artefact* of V6, not a type size the product has. Optically sizing against it means matching a rendering that exists nowhere. *(Revision 3 added a second, physical argument — that a display cut's hairlines land on ~⅓ px "after the 3× downscale a chat client applies". **It is deleted, not weakened** (T2): on the population that matters it is false. A 1200 px PNG in a ~380 CSS px bubble on a DPR ≥ 2 phone rasterises at ~1140 device px — essentially 1:1, no downsample at all. The perceptual argument above carries (B) on its own, and a second measured-sounding claim in this section is exactly what T1 was raised about.)*

**The `css2` opsz bucket set, ENUMERATED rather than recalled** — every integer from 9 to 144 requested at `wght 500` with the legacy UA and the resolved gstatic URL diffed. There are **eighteen** buckets and each one serves every value up to the next:

```
9  10  11  12  13(–15)  16  17  18(–19)  20(–23)  24(–27)  28(–35)  36(–47)
48(–59)  60(–71)  72(–95)  96(–119)  120(–143)  144
```

So a request for `opsz 30` or `opsz 32` silently returns the **28 pt** cut, and revision 3's *"the neighbouring buckets are 20 and 48"* was false — **the neighbours of the 32 px display size are 28 and 36**. (The plan's own probe, `@27 → "Fraunces 24pt Medium"`, should have shown that a 24 bucket existed and the claim could not hold.) The no-`opsz` default is byte-identical to the 13 bucket — `md5 e791faf695…`, 71,596 B, both — so "the default" and "the 13–15 pt text cut" are the same file under two names.

**Every candidate, against the one reference.** Advance of *"Nonogram"* at 32 px and of *"Miolos"* at 13 px, each against the browser's `auto` at that size (160.797 px and 41.516 px). The px column is the same error expressed on the surface the recipient actually looks at, which is the only place it can be seen:

| cut | name @32 px | name, px | wordmark @13 px | wordmark, px | worst, % | worst, px |
|---|---|---|---|---|---|---|
| default = 13 pt | +1.85 % | 2.97 px | −0.08 % | 0.03 px | 1.85 % | 2.97 px |
| 20 pt | +1.27 % | 2.05 px | −0.68 % | 0.28 px | 1.27 % | 2.05 px |
| 24 pt | +0.89 % | 1.44 px | −1.05 % | 0.44 px | **1.05 %** | 1.44 px |
| 28 pt | +0.52 % | 0.84 px | −1.43 % | 0.59 px | 1.43 % | **0.84 px** |
| **36 pt — committed** | **−0.23 %** | **0.38 px** | −2.22 % | 0.92 px | 2.22 % | 0.92 px |
| 48 pt | −1.48 % | 2.38 px | −3.42 % | 1.42 px | 3.42 % | 2.38 px |
| 96 pt | −14.45 % | 23.23 px | −16.48 % | 6.84 px | 16.48 % | 23.23 px |
| 144 pt | −15.61 % | 25.09 px | −17.61 % | 7.31 px | 17.61 % | 25.09 px |

**Applying the criterion: 36 pt.** It is the bucket nearest the browser's `auto` at the hero's display size — **−0.23 %, 0.38 px over the whole word** — and no other bucket is closer, because `opsz 32` interpolates nearer to the 36 cut's advances than to the 28 cut's. The wordmark's **−2.22 %** is the accepted cost: 0.92 px across the whole word at the size it is read.

**What a different criterion would choose, said plainly rather than omitted.** On **worst-case percentage** the winner is **24 pt** (1.05 % against 36 pt's 2.22 %). On **worst-case displayed pixels** it is **28 pt**, by 0.08 px. All three are imperceptible and the whole spread across 24 / 28 / 36 is 1.2 pp and 0.6 px; what selects 36 pt is the hero weighting, stated above, and nothing else. **What is NOT defensible is the 96 or 144 cut** — an order of magnitude out on both runs — and revision 2's silent default, which is the worst of the plausible four at the hero. **Cost of the choice: zero bytes.** The 24, 28 and 36 pt cuts are all **71,648 B**, so `168,996` and `169.0 KB` hold under any of them and the decision is a pure type decision.

**Three headline numbers from revision 3 are retired, because each used a different frame** (T1c). *"opsz96 is 14.1 % off at the wordmark"* was measured against the committed 36 pt cut, not against the browser: **against the browser it is −16.48 %**. *"the shipped default is 18.9 % wide at the name"* was measured at the **author** size of 96 px, inside reading (A)'s frame — the frame this section exists to reject; in reading (B)'s own frame the default is **+1.85 %**. Only *"2.2 %"* was already in this frame, and it is kept as **−2.22 %**.

**One instance, not two.** Under reading (A) the two runs want cuts 96 and 39 — 57 units apart, and committing either one costs ~15 % at the other's size (the 36 pt cut is +16.59 % at the name's 96 px; the 96 pt cut is −14.35 % at the wordmark's 39 px) — so a second face is genuinely arguable there. Under (B) they want 32 and 13, **19 units apart** (revision 3 wrote *"22 units"*; 32 − 13 = 19 — T6), and one bucket serves both inside 2.22 %. A second Fraunces costs **+71,648 B (+42 %, 169.0 → 240.6 KB)** to buy back that 2.22 % on the secondary run. **If a later ticket changes the wordmark's treatment** (I18a may), the pair to add is `opsz36 + opsz13`, or `opsz96 + opsz36` if the card is ever authored for 1:1 viewing — **never the no-opsz default plus anything**, because the default *is* the 13 pt cut under another name and a reviewer cannot tell the two requests apart in a diff.

**The residual, for the reader who opens the PNG at 1:1** — a case no chat client produces but a `curl` does: at the author sizes the committed cut sets the name **+16.59 %** wider than the app's `auto` at 96 px (481.25 px against 412.77 px) and the wordmark **+0.30 %** at 39 px. That is reading (A)'s frame, kept here as a stated residual rather than as an argument, and it is what V9 records as the deviation.

**And `T-WEB-S202` can now SEE the cut, which is the half revision 2 was missing.** Its TTF-table arm asserted `fvar` absent, the family name, and `usWeightClass` — **all three pass identically on every Fraunces cut**, so the gate was blind to exactly the regression it was added for. Two assertions fix it, both read straight from the binary and both verified distinct across all four candidate cuts:

| face | `name` ID 1 | `name` ID 16 | `usWeightClass` | `OS/2.xAvgCharWidth` | bytes |
|---|---|---|---|---|---|
| **`Fraunces-36pt-500.ttf`** | `Fraunces 36pt Medium` | `Fraunces 36pt` | 500 | **1148** | 71,648 |
| *(rejected: no-opsz default = opsz 13)* | `Fraunces Medium` | `Fraunces` | 500 | *1169* | 71,596 |
| *(rejected: opsz 24 — the neighbour a worst-%-error criterion would pick)* | `Fraunces 24pt Medium` | `Fraunces 24pt` | 500 | *1159* | 71,648 |
| *(rejected: opsz 28 — the bucket `@30`/`@32` silently resolve to)* | `Fraunces 28pt Medium` | `Fraunces 28pt` | 500 | *1155* | 71,648 |
| *(rejected: opsz 96)* | `Fraunces 96pt Medium` | `Fraunces 96pt` | 500 | *1002* | 71,460 |
| *(rejected: opsz 144)* | `Fraunces 144pt Medium` | `Fraunces 144pt` | 500 | *990* | 71,412 |
| `InstrumentSans-400.ttf` | `Instrument Sans` | **absent** | 400 | — | 48,616 |
| `InstrumentSans-600.ttf` | `Instrument Sans SemiBold` | `Instrument Sans` | 600 | — | 48,732 |

**The nameID trap, which is RC4 and which a loop would walk straight into:** `name` ID 16 (Typographic Family) is **elided on the RIBBI regular**, so `InstrumentSans-400.ttf` has no ID 16 at all. A test asserting `nameID16 === family` across three faces is **red on one of three**; revision 2's *"`name` family equal to `Fraunces` / `Instrument Sans`"* is red on **two** of three if read as ID 1. So S202 asserts the **table above, per face, literally** — ID 1 and ID 16 as written, with `toBeUndefined()` for the 400 face's ID 16 — rather than a rule with a fallback. `STAT` was checked as a candidate discriminator and **rejected**: Google's instancer keeps an opsz `AxisValue` only when the pinned coordinate equals a STAT nominal (9 / 72 / 144), so the 36 pt, 96 pt and default cuts carry **no** opsz record at all and only the 144 pt cut could be identified that way.

`xAvgCharWidth` is asserted **only on Fraunces**, and that is deliberate: it is there to pin the *optical cut*, and the two Instrument Sans faces have no optical axis, so `usWeightClass` plus the name strings are their whole discriminator.

**And the file SIZE cannot stand in for either assertion, which is the sharpest argument for both.** The 24, 28 and 36 pt cuts are **71,648 bytes each** — identical to the byte. A mistyped `opsz` term in I12's URL that lands one bucket away produces a file of exactly the expected size, whose `fvar`, family name and `usWeightClass` all match, and whose §13 byte-sum criterion (`168,996 B`) still passes. `name` ID 1 / ID 16 and `xAvgCharWidth` (1148 / 1155 / 1159) are the *only* things in the plan that can tell them apart.

### 7.3 The route files

All nine share two handlers in `apps/web/src/og/handlers.ts`, so each route file is a table entry (Q7). Archive:

```tsx
export const dynamic = "force-dynamic";       // ADR-0053 decision 2 (D9)
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = messages.og.altGame(messages.games.sudoku.name);

export default async function Image({ params }: { params: Promise<{ data: string }> }) {
  return archiveCardHandler("sudoku", (await params).data);
}
```

Daily:

```tsx
export const dynamic = "force-dynamic";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = messages.og.altGame(messages.games.sudoku.name);

export default async function Image() {
  return dailyCardHandler("sudoku");
}
```

and the two handlers, once:

```ts
const CARD_HEADERS = {
  // The PNG must not outlive a `killed_at` takedown in a shared cache.
  // `force-dynamic` governs Next's route cache, not this header (D8/H3).
  "cache-control": "private, no-cache, no-store, max-age=0, must-revalidate",
} as const;
const refuse = () => new Response(null, { status: 404 });

/** See D8: a BAD ROW 404s, a DATABASE OUTAGE 500s, and the two are told apart
 *  by `name` because neither class is importable here. */
const PROJECTION_ERROR_NAMES = new Set([
  "ZodError",
  "DailyProjectionUnsupportedError",
]);

export async function archiveCardHandler(game: ProjectedGame, segment: string) {
  const date = parseArchiveDate(segment);
  if (date === undefined) return refuse();          // Zod before any read
  let daily;
  try {
    daily = await getPublishedDaily(getDb(), game, date);
  } catch (error) {
    // NARROW ON PURPOSE. A projection failure is a bad row and 404s, because
    // the log line is the alarm and a 500 on a crawler surface pages nobody
    // (published.ts:236-243). A Neon timeout, a pool error or a missing
    // DATABASE_URL is NOT that: this route's audience negative-caches for
    // days, so an outage must stay a retryable 500 (D8, T-WEB-S203).
    if (!(error instanceof Error) || !PROJECTION_ERROR_NAMES.has(error.name)) {
      throw error;
    }
    console.error(`og archive card: unreadable row for ${game} ${date}`, error);
    return refuse();
  }
  if (daily === undefined) return refuse();          // future, unpublished, killed
  // OUTSIDE the try, and T-WEB-S203 pins that: a satori or ImageResponse throw
  // must surface as a 500, never be converted into a silent 404.
  return new ImageResponse(gameCard({ game, longDate: formatLongDate(date) }), {
    ...SIZE, fonts: FONTS, headers: CARD_HEADERS,
  });
}
```

**`dailyCardHandler` is written out rather than described as "the same shape", because in one respect it cannot be** (T3):

```ts
export async function dailyCardHandler(game: ProjectedGame) {
  let daily;
  try {
    daily = await getTodayDaily(getDb(), game);
  } catch (error) {
    if (!(error instanceof Error) || !PROJECTION_ERROR_NAMES.has(error.name)) {
      throw error;
    }
    // GAME ONLY, AND THAT IS NOT AN OVERSIGHT. There is no date in scope
    // here: this handler never parses one, and the date it would log lives
    // on the row `getTodayDaily` threw instead of returning. Naming the
    // reader is what makes the line actionable — "today" is implicit in it.
    console.error(`og daily card: unreadable today row for ${game}`, error);
    return refuse();
  }
  if (daily === undefined) return refuse();          // nothing published today
  return new ImageResponse(
    gameCard({ game, longDate: formatLongDate(daily.date) }),
    { ...SIZE, fonts: FONTS, headers: CARD_HEADERS },
  );
}
```

Everything else is the archive handler's shape: no `parseArchiveDate` and no `date` parameter, the same `PROJECTION_ERROR_NAMES` narrowing, the same `try` around the read alone, and `formatLongDate(daily.date)` — the date from the DB clock's own row, never from `new Date()`. **The two log lines differ by design and `T-WEB-S203` asserts each family's own line**; revision 3's single shared sample did not compile for four of the eight routes, because `date` is not in scope at the daily catch.

**`alt` stays dateless**, and that is a constraint rather than a choice: `alt` is a static module export on a metadata route and cannot read `params`. `messages.og.altGame(name)` → *"Cartão do Miolos — Sudoku"*. Recorded so a reviewer does not read it as an oversight.

`parseArchiveDate` (`apps/web/src/archive/parse-params.ts:30`) gains a **third** caller, joining the contract its own doc block at `:8` states (*"Both `generateMetadata` AND the page body call these"*). No change to the module; the doc sentence is not made false by a third caller of the same kind, so it is not touched.

### 7.4 `messages.og` — the new block

```ts
/**
 * Open Graph copy (#34, ADR-0054 decisions 7 and 10). Two kinds:
 * `altGame` is the image route's static `alt` export (it cannot see the
 * date — `alt` is a module export, not a function of params), and the
 * four `daily*` pairs are the ONLY metadata the daily play routes carry.
 * They are deliberately not page `title`/`description`: those stay
 * inherited from the root layout, which is what keeps ADR-0028 :36-38's
 * "not an SEO surface" literally true (ADR-0054 decision 10).
 */
og: {
  altGame: (name: string) => `Cartão do Miolos — ${name}`,
  altSite: "Cartão do Miolos",
  /**
   * The SITE card's second line, under the wordmark (§7.2). It is written
   * here rather than taken from `meta.title` or `meta.description`:
   * `meta.title` already contains the wordmark the card renders at 96px, and
   * `meta.description` is 133 characters — three wrapped lines of 39px body
   * copy where the composition wants one tagline (RD3).
   */
  siteTagline: "Quatro jogos de raciocínio por dia.",
  dailyTitle: (name: string) => `${name} de hoje — ${wordmark}`,
  dailyDescription: (name: string) => `O ${name} de hoje no Miolos: um por dia, igual para todo mundo.`,
},
```

None of the five strings contains `então`, `mamãe` or `época` (`FORBIDDEN_EVERYWHERE`, `route-client-js.mjs:285`) — audited, and **`T-WEB-S206a` keeps it audited**, in `og-metadata.test.ts` rather than in `share-text.test.ts`, because `messages.og` lands two batches after `messages.share` (RB10).

The archive routes compose theirs from the strings `messages.archive.meta` already ships (`gameTitle(name, longDate)` and its description sibling), reused verbatim inside `openGraph` — which is why the archive half adds no copy at all.

---

## 8. `apps/web` — every file that moves

| File | Change |
|---|---|
| `src/play/share-text.ts` | **new** — the pure composer (§6.1) |
| `src/play/conclusion-view.tsx` | `ShareButton` + one call site in `<aside>`; the `:72-73` comment rewritten (§11.4) |
| `src/play/conclusion-view.module.css` | `.share` + `:disabled`/`:focus-visible`/`:active`; the status line's reserved box; the `:5-6` **and** `:36-39` comments rewritten (§11.4) |
| `src/i18n/messages.ts` | `share` block (§6.3) and `og` block (§7.4, **including the `siteTagline` the site card needs and revision 2 assumed existed** — RD3). **No `meta` key moves** (H1) |
| `src/site-origin.ts` | **doc block only** — three surfaces become four (§11.4) |
| `src/og/card.tsx` | **new** — `siteCard`, `gameCard`, the **153**-element dot lattice derived from the size (§7.1, §7.2) |
| `src/og/handlers.ts` | **new** — `dailyCardHandler`, `archiveCardHandler`, `CARD_HEADERS`, `PROJECTION_ERROR_NAMES` (§7.3, D8) |
| `src/og/fonts.ts` | **new** — `export const FONTS`, top-level await, three faces (D12) |
| `src/og/tokens.ts` | **new** — the literal palette in 8-digit hex, each tied to `packages/ui/tokens.css` by name |
| `src/og/defaults.ts` | **new** — `OG_DEFAULTS` (D11) |
| `assets/fonts/{Fraunces-36pt-500,InstrumentSans-400,InstrumentSans-600}.ttf` | **new**, binary, **168,996 B** total. The Fraunces face is the **36 pt optical instance** (§7.2a), and the filename says so |
| `assets/fonts/{OFL-Fraunces,OFL-InstrumentSans}.txt` | **new** (OFL 1.1 clause 2) |
| `assets/fonts/SHA256SUMS` | **new** — digest, the `css2` request URL **including its `opsz` term**, the resolved gstatic URL, UA and fetch date per face (S6, RB1) |
| `app/layout.tsx` | `openGraph: {...OG_DEFAULTS, …}` + `twitter` in `metadata` (D11) |
| `app/opengraph-image.tsx` | **new**, static, reads nothing |
| `app/{binairo,sudoku,nonogram,termo}/opengraph-image.tsx` | **new** ×4, **`force-dynamic`**, `getTodayDaily` (D7/D8) |
| `app/{binairo,sudoku,nonogram,termo}/page.tsx` | `export const metadata` with **`openGraph` only** (D10) |
| `app/arquivo/[data]/{binairo,sudoku,nonogram,termo}/opengraph-image.tsx` | **new** ×4, `force-dynamic`, `getPublishedDaily` |
| `app/arquivo/[data]/{binairo,sudoku,nonogram,termo}/page.tsx` | `openGraph` inside the existing `generateMetadata` (D10) |
| `app/sitemap.ts` | **comments only** — one clause + the `:28-30` → `:36-38` repair (§1 exception ii, A7) |
| `scripts/route-client-js.mjs` | four `concluido` routes join `BUDGETED` (D15) |
| `../../eslint.config.mjs` | `**/play/share-text` in both free-play wall halves; the new **OG wall object (4)**, both halves, **repeating objects (1) and (2)'s arrays verbatim** (D15, B3, RB2) |
| `../../.gitattributes` | `*.ttf binary` (D12) |

---

## 9. Test plan

**Reserved ranges.** Revision 1 reserved `T-WEB-S189…S208` and `T-LINT-S39…S41`; revision 2 extended them to `T-WEB-S189…S210` and `T-LINT-S39…S43`. **Revision 3 needs three ids more, all of them lint** — `T-LINT-S43` for the replacement regression and `T-LINT-S44` for the glob reach (RB2), with `T-LINT-S45` taking over as the burned headroom — and it **spends** `T-WEB-S209` on the half of `S207` that RQ8 moves into `archive-metadata.test.ts`, so the web range extends by one to keep two headroom ids. The ranges are therefore **extended in order and the extension is stated here rather than absorbed silently**:

- **`T-WEB-S189…S211`**, with `S210`/`S211` as review-round headroom, **burned if unspent**;
- **`T-LINT-S39…S45`**, with `S45` as review-round headroom, **burned if unspent**;
- plus **three sibling letters, which consume no range number** because each is a new assertion inside a landed id's claim (`test-ids.md:16`, the `T-API-S107a` / `T-LINT-S37a` precedent): **`T-LINT-S8a`** — the wall asserted from `apps/web/src/og/**`, which is `T-LINT-S8`'s own claim (*"every glob in the wall is written against `apps/web/src/**` … so it is asserted from the new directory itself"*) on the directory #34 adds — **`T-WEB-S206a`**, the `messages.og` half of S206's accent audit, split out because `messages.og` lands two batches after `messages.share` (RB10) — and, **new at revision 4, `T-WEB-S192a`** (V2), the call-site half of S192's claim, which lands in a different file two batches later.

**Two of the three siblings are CROSS-FILE, and that is spent deliberately rather than by drift** (V10). All four shipped sibling precedents (`T-LINT-S37a`, `T-WEB-S177a`, `T-DB-S53a`/`b`, `T-API-S107a`) are same-file. `T-WEB-S206a` and `T-WEB-S192a` are not: each is the second half of one claim whose halves land in two files and two batches, and `test-ids.md:85,91` forbids the alternative outright — *"New duplicates take the sibling letter instead — and 'new' means anything not yet on `main`."* The letter is spent **to avoid a cross-file duplicate id**, not to extend a same-file claim, and I40 records it in those words so the next frontier derivation does not read it as a new precedent for splitting claims across files.

Both ranges start at the frontier recorded in `docs/agents/test-ids.md` (next free `T-WEB-S189`, `T-LINT-S39`), and I1 re-derives by grep before anything is written. **No `T-CORE`, no `T-DB`, no `T-API` ids** — `packages/**` and `apps/api/**` are untouched. The burned tails `T-WEB-S187`/`S188`, `T-CORE-S85`, `T-API-S108` and `T-LINT-S38` stay burned and are not reused. `apps/web` puts the id on `describe(...)` only (`test-ids.md:5`); the `eslint-*-wall.test.ts` files put it on `it(...)`, **one id per `it`, and their `describe`s carry a topic and NO id** (`:85` — a `describe` repeating its own `it`'s id is a same-file duplicate, the defect corrected on `T-LINT-S37` at #31's verification round).

**New files.**

| File | Env | Ids |
|---|---|---|
| `test/share-text.test.ts` | jsdom | S189, S190, S191, S192, S193, S206 |
| `test/conclusion-share.test.tsx` | jsdom | S194, S195, S196, S197, **S192a** |
| `test/og-metadata.test.ts` | jsdom | S198, S199, S207, S206a |
| `test/og-card.test.tsx` | jsdom | S200, S201, S208 |
| `test/og-image.node.test.ts` | **node** | S202, S203, S204 |
| `test/eslint-og-wall.test.ts` | node (the wall suites' own convention) | T-LINT-S41, S42, S43, S44 |

**Widened in place, four of them** — and the count is stated because revision 2 said "two" and named two of four:

| File | What it gains | Why not a new file |
|---|---|---|
| `test/conclusion-view.test.tsx` | one `describe`, **`T-WEB-S205`** | a stylesheet-text assertion on `conclusion-view.module.css`, whose existing tripwires live at `:982`; splitting one sheet's gate across two files is how the second gets forgotten (Q16). **Consequence, because I11's criterion changes: this file is no longer "green untouched"** |
| `test/archive-metadata.test.ts` | one `describe`, **`T-WEB-S209`** | RQ8 — S207's **non-OG** half (title/description distinct across games and dates, canonical unchanged, the literal scan) belongs with the suite whose `describe` already claims *"every route composes its title and description … with a self-referential canonical"* while importing three of seven. Putting it elsewhere reproduces the exact defect Q16 was raised for, one paragraph after the plan applied Q16 to S205. `og-metadata.test.ts`'s **`S207`** keeps only the `openGraph`/`OG_DEFAULTS` half |
| `test/eslint-free-play-wall.test.ts` | **`T-LINT-S39`/`S40`** | the wall those probes test lives there |
| `test/eslint-db-wall.test.ts` | **`T-LINT-S8a`** | the `T-LINT-S8` precedent: the claim *"every glob in the wall is written against `apps/web/src/**`"* lives in that file, so a new source directory is asserted there. The OG wall's own replacement-regression probes (`S43`) stay in `eslint-og-wall.test.ts`, beside the object that could delete them — the `T-LINT-S14`/`S15` placement |

**`T-WEB-S173` is not touched** (B6), and neither is `medals-content.test.ts` (its two emoji scans are medal-scoped).

**The seams, and why they are where they are.** The interesting assertions are about a *string* and about an *element tree*, and both are reachable without a browser and without a rasteriser. Only three claims genuinely need a raster, and they are quarantined in one file.

| Id | Claim |
|---|---|
| **S189** | Termo: one row per judged guess, five squares per row, `correct→🟩 present→🟨 absent→⬜`; a win's header line is `n/6` and a loss's is `X/6` with six rows |
| **S190** | **the answer never appears**, by two mechanisms. **(a)** a **property test over all 400 canonicals** imported from `@miolos/games/termo` (test file only, S8): for each, a won record and a lost record, and the canonical string is absent from both outputs. **(b)** *(new, RB6/RB7's mechanism)* a **differential**: two concluded records identical but for `answer` (`"sonho"` vs `"casal"`) produce **byte-identical** output — which proves the field cannot influence the result at all, where (a) proves only that one spelling did not surface. **(c)** the non-vacuity counter-assertion, restated as something observable (RQ11): revision 2's *"the fixture's `answer` … was read"* is not an observable of a pure function; what is asserted is that each fixture handed to the composer carries **a non-empty 5-letter canonical** at `record.answer` and parses under `termoPlayRecordSchema`, so an empty-record regression cannot pass (a) vacuously |
| **S191** | the three grid games: header, `formatElapsed` output, blank line, URL. **The exclusion list splits FOUR ways, by how each item can actually fail** — revision 2 split it two ways and one half was unconstructible (RB6) and the other vacuous (RB7). **(a) Module-graph scan** of `share-text.ts` (the `archive-day.test.tsx:310-351` walker idiom) proving nothing under `src/medals/`, `src/streak/`, `src/stats/` or `play/day-state` is reachable — the falsifiable form of "no streak, no medal, no solved total, no day strip", since none of those is a `PlayRecord` field. **Its non-vacuity twin is named, not cited** (RQ12): the same walk must reach `src/i18n/messages.ts` and `src/i18n/format.ts`, which the composer genuinely imports, so it cannot degrade into `expect(graph.length).toBeGreaterThan(0)`. **(b) Differentials**, for every excluded field that IS on the record — per game, two records differing in **exactly one** excluded field, asserting the composer returns **byte-identical** strings: `hintsUsed: 0` vs `1` (all four games), `syncOutcome` across `pending`/`recorded`/`rejected` (all four), the optional solved `grid` present vs absent (binairo, sudoku, nonogram), and nonogram `size: 5` vs `15` — which necessarily moves `entries` from 25 to 225 cells, and **both** of those are excluded fields, so the byte-identity covers them together. Fixture-arithmetic-free, and it cannot be vacuous: change the composer to print any of them and the pair diverges. **(c) Key-set assertion**, for the field that is not on the record and could become one: `Object.keys(<member>.shape)` for each of the four record members equals a written-down list (verified that `.shape` survives `.superRefine` on zod 4.4.3). The **Sudoku tier is guarded here and nowhere else** — `sudokuPlayRecordSchema` has no `tier`, so revision 2's *"a Sudoku record whose `tier` is a distinctive word"* fails Zod **and** typecheck and could never go red. **(d) Signature assertion** (RB8): a source scan of `share-text.ts` proving `buildShareText`'s second parameter type declares exactly one member, `url` — because the realistic streak regression is `buildShareText(record, { url, streak })`, an argument the module-graph scan in (a) cannot see, from a call site that already holds the server streak in scope (`conclusion-view.tsx:371`) |
| **S192** | *(in `share-text.test.ts`, at I3)* a source scan finds no `/arquivo` literal in `share-text.ts` (the `T-WEB-S166` idiom) — the composer holds no route knowledge. **Counted floor** (V5 — this is a fifth `→ toEqual([])` scan and RQ10 installed floors on three): the scan asserts the file **was read and contains `buildShareText`** before asserting the absence, because it scans a module that by construction holds no route knowledge, so an empty result proves nothing on its own |
| **S192a** | *(sibling, V2 — in `conclusion-share.test.tsx`, at I9)* the other half of S192's claim: the URL handed to the composer is `absoluteUrl(archiveGameRoute(date, game))` for all four games. **It is a sibling letter, not a range number**, because the two halves are two `describe`s in **two files** and `test-ids.md:85,91` forbids a cross-file duplicate id — *"New duplicates take the sibling letter instead — and 'new' means anything not yet on `main`."* Revision 3 listed `S192` under both files, two rows after spending `T-WEB-S206a` on precisely this shape |
| **S193** | every user-visible string comes from `messages.share`; a source scan with an explicit allowlist for structural separators (§6.1, C6). **Counted floor** (V5): the allowlist is the risk here — one notch too broad and the scan is permanently empty with nothing saying so — so the test asserts that the allowlisted separators **were found** (at minimum `"\n"`, which the composer cannot be written without) before asserting that the non-allowlisted set is `[]` |
| **S194** | the button renders in `result` and in `lost`, and **not** in `empty` or `skeleton` (the dead-share-button rule, mechanically) |
| **S195** | the button is disabled while the concluded record has not hydrated, and its box is present either way |
| **S196** | a click prefers `navigator.share({ text })`; with `navigator.share` absent it calls `clipboard.writeText`; **both receive the byte-identical string** |
| **S197** | an `AbortError` rejection renders neither an error nor a confirmation; **a non-`AbortError` rejection falls through to the clipboard** (I3/S9); a clipboard rejection renders `messages.share.failed`; a clipboard success renders `messages.share.copied` in an `aria-live` region |
| **S198** | the four daily pages export `metadata` whose `openGraph` is distinct per game, carries `locale`/`siteName`/`type` from `OG_DEFAULTS`, and **whose object has no `title`, no `description` and no `alternates`** (H1's property, asserted as an absence so a later ticket cannot add them silently) |
| **S199** | *(mechanism named, V6 — revision 3 said "a leaf route's resolved metadata" and Next exposes no public API for resolved metadata in a unit test, so the assertion had no obtainable subject)* on a **leaf** route's **declared** `metadata` object — the one B4 proved must spread `OG_DEFAULTS` or lose the root's fields — `openGraph.locale` is `"pt_BR"` and is **not** the `locale` exported from `src/i18n`; `siteName` is `messages.brand.wordmark`; `type` is `"website"`; and the root layout's `twitter.card` is `"summary_large_image"`. The **rendered-head** half of the same claim is evidence, not a unit assertion: §13's preview `curl` (c) pastes `/sudoku`'s `<head>` showing `og:locale`, `og:site_name` and `og:type` present on the leaf |
| **S200** | the card tree paints the game accent on the tape and the shadow only — a walk of the tree finds no accent value in any `color` (ADR-0041 decision 1); the kicker's `letterSpacing` is inside `DESIGN.md:29`'s 0.14–0.16em; and **every hex literal in `src/og/tokens.ts`** — not only the 8-digit ones — has its leading seven characters in `packages/ui/tokens.css` (Q6/C11; widened at V7, because the leading-seven rule covers `#F7F2E9`, `#FBF7EF`, `#D8D0C2`, `#211D19` and `#6E6659` for free and scoping it to the two alpha literals left the other five unpinned). **Counted floors** (RQ10): the literal set is asserted **non-empty**, and the accent **is** found — once on the tape and once on the shadow — so `toEqual([])` on the colour walk is a real absence rather than an empty scan. Also asserts the lattice: `card.tsx` derives its dot count from the size and a `gameCard()` tree contains **153** dot elements at 1200×630 (RC5) |
| **S201** | *(re-aimed, B5)* a **source scan** of the eight route files and the two handlers: the only argument reaching `gameCard` is `{ game, longDate }`, the only property read off the reader's return value is `.date`, and `gameCard`'s declared parameter type admits no other member. Revision 1's version — "hand the builder a complete daily response" — **could not fail**, because §7.1's signature has no parameter such a response can enter through. **Counted floor** (RQ10): the scan asserts it located **eight** route files and **two** `gameCard(` call sites before asserting anything about their contents, so a wrong root or a typo'd glob reds instead of passing on an empty set. **Written at I23, not I20** — its subject is the route files, which land at I22 |
| **S202** | *(node)* the archive card **and the site card** rasterise with the committed fonts, on the **longest realistic content** — *"Nonogram"* over *"22 de fevereiro de 2026"*, 23 characters, which is the true pt-BR maximum at `dateStyle: "long"` and not revision 2's setembro (RD5): a real PNG (magic `89 50 4E 47`), non-trivial length, `1200×630`. **Plus four gates, one of them new at revision 3 because the other three are blind to the regression they were added for (RB1):** (a) a direct read of each TTF asserting `fvar` **absent** and `OS/2.usWeightClass` equal to 500/400/600 (the `pwa-manifest.test.ts:30-40` `pngDimensions` idiom applied to a TTF) — Q5; **(a2)** *(new)* **the optical cut**, asserted per face against §7.2a's table **literally**: `name` ID 1 / ID 16 as written (`"Fraunces 36pt Medium"` / `"Fraunces 36pt"`; `"Instrument Sans"` / **`toBeUndefined()`** for the 400 face, whose ID 16 is elided as the RIBBI regular; `"Instrument Sans SemiBold"` / `"Instrument Sans"`), plus `OS/2.xAvgCharWidth === 1148` on Fraunces. **Revision 2's three assertions all pass identically on every Fraunces optical cut, so the gate could not see a swapped face at all** (RC4 also shows its "family name" reading is red on two faces of three); (b) the same tree rendered **twice**, once with `FONTS` and once with the Fraunces face removed, asserting the bytes **differ** — the only thing that catches satori's silent weight/style fallback (D4-design); (c) the three on-disk SHA-256 digests equal `assets/fonts/SHA256SUMS` (S6), whose recorded URLs carry the `opsz` term |
| **S203** | *(node)* **`it.each` over all four games, and the grid is stated PER FAMILY rather than as "both families", because the two families do not have the same rows** (Q7; T3/V11 — written literally, revision 3's uniform grid contained cells that cannot exist). **Seven rows bind on both families** (4 games × 2 = 8 cases each): (1) the reader returns a row → 200, `content-type: image/png`; (2) the reader returns `undefined` → **404** (archive: future, unpublished or killed; daily: nothing published today); (3) a throw named `ZodError` → **404** with `console.error` called; (4) a throw named `DailyProjectionUnsupportedError` → **404**; (5) a plain `Error("connect ETIMEDOUT")` → **propagates**, is not converted to 404, and does **not** call `console.error`; (6) a throw from the card builder / `ImageResponse` → **propagates**, which pins the `try` to the read and stops a later edit widening it to the whole handler while this test stays green (RQ7); (7) the response carries `cache-control: private, no-cache, no-store, max-age=0, must-revalidate` (H3). **Three rows are ARCHIVE-only:** (8) a malformed segment → 404 **with the reader never called** (the daily route has no date segment, so this cell has no daily analogue); (9) `/arquivo/<hoje>/<jogo>` → 200, the today case the same predicate covers with no branch (D8/H2); (10) row (3)'s log line **also contains the date** — `archiveCardHandler` parses it before the read. **Two rows are DAILY-only:** (11) row (3)'s log line carries the **game only**, asserted as its own written form rather than as the absence of a date, because `getTodayDaily` throws before returning the row the date lives on (T3); (12) nothing published today → `/sudoku` renders `DailyUnavailable` at **200** while its `og:image` 404s (A3, widened at RC8) — whose archive counterpart is the `/arquivo/<future>/<jogo>` row where the page's `og:title` composes and the image 404s, filed under (2). **Plus, on both families:** the mocked reader returns a daily whose every field is a distinctive sentinel (`"__GIVENS__"`, a sentinel tier, a sentinel bitmap) and **no sentinel reaches the element tree handed to `ImageResponse`** (B5) — and, by the same access, the `longDate` in that tree is `formatLongDate(row.date)` for a row carrying a distinctive published date, which is what pins the daily card's date to the DB clock's own row |
| **S204** | *(node)* the **root site card** reads no database — **as a MODULE-GRAPH scan, not an unmocked render** (RC7): S203 hoists `vi.mock("../src/db")` and `vi.mock("@miolos/db")` file-wide, so an "unmocked" arm in the same file would need `vi.doUnmock` + `vi.resetModules()` + a dynamic import, and revision 2 named no mechanism. The walker idiom S191 already uses proves the stronger property anyway — nothing under `@miolos/db` or `../src/db` is reachable from `app/opengraph-image.tsx` **transitively**, which a one-level import scan would miss if `src/og/card.tsx` ever acquired the import. **The mechanism is a source grep over each graph node, NOT path membership, and that distinction is load-bearing** (V3): the cited walker (`archive-day.test.tsx:266-289`) resolves `/(?:from\|import)\s*\(?\s*"(\.[^"]*)"/g` — **relative specifiers only** — so a bare `@miolos/db` never becomes a node and any assertion written as `graph.filter(p => p.includes("@miolos/db"))` is structurally empty, on the root card and on the eight game routes alike. The shipped suite carries the right mechanism one assertion later (`expect(readFileSync(path,"utf8")).not.toContain("readDayState")`, `:344-347`), and **both halves are written in those same terms**: no node's source contains `@miolos/db` or `"../src/db"`. An asymmetric repair — the floor via a relative `../db` path and the negative via the bare specifier — is silently vacuous, which is the failure this row exists to avoid. **Counted floor** (RQ10, restated in the same terms): the walk from each of the eight game routes reaches `src/og/handlers.ts`, whose source **does** contain `@miolos/db` (verified on `main` that this is how the shipped page reads: `app/sudoku/page.tsx:1` imports `getTodayDaily` from `"@miolos/db"` and `getDb` from `"../../src/db"`), which is what makes the root card's absence a difference rather than a broken scan. Plus: the **eight** game routes each carry `export const dynamic = "force-dynamic"` **and the root card does not** (RQ14 — revision 2 asserted the presence and never the absence); the four files in each family differ only in the game token (the `T-WEB-S185` byte-identity idiom, Q7); and for **every member of `DAY_GAMES`** a route file exists in each family and a `messages.og.altGame` call resolves (Q15) |
| **S205** | *(in `conclusion-view.test.tsx`, Q16)* stylesheet text: `.share` carries `var(--radius)`, a zero-blur hard shadow, `cursor: pointer`, a `:disabled` rule, a `:focus-visible` outline (B12), a ≥44px target at both viewports, `min-height: 52px` at the mobile rule, non-zero padding on both axes at the **desktop** rule (C12), a reserved `min-height` on the status line (D9-design), and no animation name from the banned family |
| **S206** | none of `então`, `mamãe`, `época` appears in **`messages.share`** (the `messages.og` half is `S206a`, RB10); and **neither `share-text.ts` nor `messages.ts` imports from `@miolos/games/termo`** (Q11 — revision 1's *"and no Termo answer canonical does either"* was unfalsifiable: nothing in `messages.ts` reads the word list, so no canonical could appear there) |
| **S207** | *(B6; split at RQ8)* the four **per-game archive** `generateMetadata`s, **OG half only**, in `og-metadata.test.ts`: `openGraph` present and spreading `OG_DEFAULTS`; and the hostile-segment arm still resolving to `{ robots: { index: false } }` with **no `openGraph` in the METADATA OBJECT** — asserted at the object level, and the row says so, because at the **rendered head** level it is false: the file-convention `og:image` and the root-filled `og:*`/`twitter:*` set are emitted for every `[data]` segment, malformed included (RC8) |
| **S209** | *(new at revision 3, RQ8)* the same four `generateMetadata`s, **non-OG half**, as a new `describe` in **`archive-metadata.test.ts`** — the suite that already claims *"every route composes its title and description … with a self-referential canonical"* while importing three of seven: title and description distinct across games **and** across dates; `alternates.canonical` unchanged; and `archive-metadata.test.ts:135-158`'s literal scan extended to those four files — **with the allowlist decided HERE, because the scan is RED as revision 3 wrote it** (V1). Measured on `main` with the shipped slice and regex: each of the four files yields exactly one literal, its own game token (`"binairo"` / `"sudoku"` / `"nonogram"` / `"termo"`), against `[]` on the three routes the suite already covers. The token enters through `archiveGameRoute(date, "sudoku")`: it is the `Game` **union member**, an identifier crossing a typed boundary, not copy, and ADR-0018 `:15` is about strings a translator would touch. So the allowlist is **the file's own game token and nothing else** — not the set of four in every file, which would be one notch too broad in exactly the way V5 warns about — and the assertion is three-part: the `toContain("canonical")` precondition is **kept**; the file's own token **is** found (the non-vacuity floor); the literal set with that one token removed is `[]`. Written into the plan rather than discovered at I28a, where the implementer's cheapest fix is loosening the regex — which is C6/RC4 reproduced one section after S193's allowlist was written out for the same reason |
| **S206a** | *(sibling, RB10)* none of `então`, `mamãe`, `época` appears in **`messages.og`** — S206's other half, in `og-metadata.test.ts`, because `messages.og` lands at I19 (Batch D) while `messages.share` lands at I2 (Batch A) and S206 is written at I3 |
| **S208** | *(D11-design)* a scan of **`apps/web/src/**` and `apps/web/app/**`** — the *rendered surfaces* D2's argument is about — for `.tsx` and `.css` files matching `\p{Extended_Pictographic}`, asserting **zero** hits, which turns D2's sentence into a gate. `medals-content.test.ts:129`'s `EMOJI` regex is scoped to `MEDAL_IDS` over `medalCopy`, so `messages.share.tiles` is outside it by **scoping, not exemption**, and all three squares do match it (🟩 U+1F7E9, 🟨 U+1F7E8, ⬜ U+2B1C). **Three corrections to revision 2** (RB9/RQ4/RC6): (i) the scope is `src` + `app`, **not all of `apps/web`** — the wider walk needs `node_modules`, `.next` and `.turbo` excluded (both exist in a built tree, and revision 2 stated none of them), and it also **bans the emoji from #34's own tests**, where `conclusion-share.test.tsx`'s byte-identity assertion (S196) is the natural home for a literal 🟩 and `og-card.test.tsx` is `.tsx` too; (ii) the scope is written **here**, not left to I20; (iii) it gets the **anti-vacuity twin** the plan cites two paragraphs earlier for S191 and gave S208 none of — the largest walk in the plan with the weakest failure mode, since a wrong root or an extension typo makes it green forever. **The twin names ONE FILE PER ROOT, not one file total** (V4): revision 3's twin cited only `apps/web/src/play/conclusion-view.tsx`, so a typo'd `app` root left half the scan dead with the twin still green — RB9's own failure mode, fixed by half. So: the scanned set must contain `apps/web/src/play/conclusion-view.tsx` (and `ConclusionView` must be found in it) **and** `apps/web/app/sudoku/page.tsx` (and `export const dynamic` in it), **and** #34's own two new rendered surfaces, one per root — `apps/web/src/og/card.tsx` and `apps/web/app/opengraph-image.tsx` — neither of which was represented at all. **Verified currently clean at this scope: 85 files scanned, 0 hits** (exact, reproduced byte for byte at the stated scope by two independent lenses; the number is evidence, not an assertion the test makes — a file count would red on #34's own additions) |
| **S210, S211** | reserved review-round headroom — **burned if unspent** |
| **T-LINT-S39** | `**/play/share-text` is refused from `src/free-play/**` and `app/modo-livre/**` — static import, red-then-green probe |
| **T-LINT-S40** | the same, dynamic import, against `freePlayDynamicBannedModule`'s regex |
| **T-LINT-S41** | `@miolos/games`, `@miolos/games/*` and the relative reach into `packages/games/src` are refused from `apps/web/src/og/**` and from an `opengraph-image` route — static, red-then-green, **with a clean control at `apps/web/src/play/share-text.ts`** so the ban is proved to be the directory's and not the app's (B3) |
| **T-LINT-S42** | the same, dynamic import (B3) |
| **T-LINT-S43** | *(new at revision 3, RB2)* **replacement regression** — the `T-LINT-S14`/`S15` analogue aimed at the OG surface. Inside `apps/web/app/opengraph-image.tsx`: `@miolos/db/publishing`, a relative reach into `packages/db/src`, `sql`/`users` off the root entry and `stripDailyContent` off `@miolos/core` still red on `no-restricted-imports`, **and the message is the app-wide wall's own** (`"wall-safe root entry"`), which is what proves the repetition carried the original rule rather than a lookalike; `"daily_puzzles"`, a `remote_config` template, a computed `import(s)` and `require()` still red on `no-restricted-syntax`. **The count is NINE lint messages across EIGHT probes** (V9): the root-entry probe is one line that reds twice, once for `sql` and once for `users`, and D15's table records it as `2` while §9 and §13 were carrying the row count as the assertion count. **Measured today: nine messages red now, and all nine gone against a wall object without the spreads** |
| **T-LINT-S44** | *(new at revision 3, RB2)* **glob reach** — the OG ban fires at all nine route paths **including the root `apps/web/app/opengraph-image.tsx`** (`**` matches zero segments; verified against this repo's eslint 10.8.0 rather than assumed) and at `apps/web/src/og/*`, and is clean at `apps/web/app/sudoku/page.tsx`. Also covers `apps/web/app/<jogo>/twitter-image.tsx`, which D11 proves will never exist and which must therefore not be the way in if it ever does |
| **T-LINT-S45** | reserved headroom — burned if unspent |
| **T-LINT-S8a** | *(sibling, RB2)* in **`eslint-db-wall.test.ts`**: the db wall fires from `apps/web/src/og/**`, and a clean OG file reports nothing — `T-LINT-S8`'s own claim (*"every glob in the wall is written against `apps/web/src/**` … so it is asserted from the new directory itself"*) applied to the source directory #34 adds |

**`T-WEB-S173` is NOT widened and NOT touched** — revision 1 planned to, on a premise B6 falsified (§4 D10). It covers three routes this ticket does not change.

**TDD, at two seams and not one (Q8).** Revision 1 named TDD only at I3. The second genuine candidate is **`T-WEB-S203`**: pure branch logic over mocked readers, no rasterising, and the mechanical proof of AC 3. It is written **test-first against a stub handler inside I22**, before either handler has a body. Where test-after is deliberate — `S202` (you cannot write a raster assertion before the tree exists) and `S205` (a stylesheet-text assertion) — the plan says so rather than leaving it as drift.

**Which id is written in which BATCH, because one cross-batch ordering error is a red commit** (RB10). A batch is a commit and pre-commit runs the full suite, so an assertion must not land in a batch earlier than its subject. Intra-batch ordering is free — I22 is deliberately red-then-green inside Batch D — but **cross-batch ordering is not**. The one real violation revision 2 shipped: `S206` asserts over `messages.og`, is written at I3 (Batch A), and `messages.og` lands at I19 (Batch D) — that commit fails at typecheck and at test. Fixed by splitting `S206a` out to I28 (Batch E). Everything else checks clean: `S192`'s two halves are already split across batches (I3 / I9) — and at revision 4 they are two **ids** as well, `S192` and the sibling `S192a`, because they are also two files (V2); `S208` scans `src`+`app` for emoji and `messages.ts` is neither; `S201`'s subject is the route files, so it is written at **I23**, not I20, inside the same batch.

**`// @vitest-environment node` on `og-image.node.test.ts`, and it is the repo's first.** `apps/web/vitest.config.ts` is nine lines with `environment: "jsdom"` and no `environmentMatchGlobs`, and `ImageResponse` **fails under jsdom** — verified: the bundle rasterises via `sharp(new TextEncoder().encode(svg))` and jsdom's realm-local `TextEncoder` produces a `Uint8Array` that fails sharp's `instanceof` check in the Node realm, giving `Error: Unsupported input '60,115,118,103,…' of type object`. The docblock pragma fixes it, and the default include glob already matches the filename. **The "no config change" claim is an evidence item, not an assertion** (Q14): `vitest.config.ts:8` applies `setupFiles` to *every* environment and that file imports `@testing-library/jest-dom/vitest` and calls RTL `cleanup()`, so I23 pastes the run rather than asserting the word "verified".

**Mocking patterns, copied from what ships.** `test/archive-metadata.test.ts:13-40` is the shape: a `vi.hoisted` spy bag, `vi.mock("../src/db")` + `vi.mock("@miolos/db")` + `vi.mock("next/navigation")`, then a top-level `await import(...)` of the route module *after* the mocks. **`og-metadata.test.ts` needs both mocks even though it never renders a page** (Q13): `app/sudoku/page.tsx:4` imports `getDb` from `../../src/db`, whose first line is `import "server-only"` (`src/db.ts:8`, pinned by `T-WEB-23`), and a jsdom import of that module throws. **`og-image.node.test.ts` holds no unmocked-import arm, and that is deliberate** (RC7): `vi.mock` is hoisted and file-scoped, so S203's `vi.mock("../src/db")` and S204's *"a render with `../src/db` unmocked"* cannot coexist without `vi.doUnmock` + `vi.resetModules()` + a dynamic import. S204's no-db proof is a module-graph scan instead (above) — same file, no gymnastics, and transitively stronger than the unmocked render would have been. `test/pwa-manifest.test.ts:9-17` is the metadata-route precedent and carries the font mock any test importing `app/layout.tsx` needs:

```ts
vi.mock("next/font/google", () => ({
  Fraunces: () => ({ variable: "--font-fraunces" }),
  Instrument_Sans: () => ({ variable: "--font-instrument-sans" }),
}));
```

**A fifth game gets a checklist, not a surprise (Q15) — and, at revision 4, the DOC half of the same guard.** #34 adds four per-game surfaces — a daily image route, an archive image route, page `metadata`, and a `messages.og` alt string — and none of them is `ProjectedGame`-bound, so a fifth game would gain a working page and a silently missing card. `T-WEB-S204` therefore also asserts that for **every member of `DAY_GAMES`** a route file exists in each family and a `messages.og.altGame` call resolves. The mechanical half only fires once someone writes the fifth game's `DAY_GAMES` entry; the half that reaches the author *before* they write anything is the route recipe in **ADR-0028 `:179-192` and ADR-0039 `:42-44`**, which is why both are annotated (§11.2(i), U1) rather than only the one revision 3 found.

**There are FIVE `matchAll(…) → toEqual([])` scans, not three, and every one of them carries a counted floor** (RQ10, corrected at V5), because `archive-metadata.test.ts:148-152` guards exactly this shape with a positive precondition and an empty-set assertion over an empty scan is the cheapest false green in the plan. RQ10 installed floors on `S200`, `S201` and `S204`; revision 3 then wrote *"the three"* while carrying two more. The two it missed are the ones whose failure mode is quietest: **`S193`**, whose risk is the *allowlist* — one notch too broad and the scan is permanently empty with nothing saying so — and **`S192`**, whose `/arquivo`-absence half scans a module that by construction holds no route knowledge. Both floors are now written into their rows above. **`S209`'s literal scan makes six**, and its floor is the `toContain("canonical")` precondition the shipped suite already carries plus the file's own game token being found (V1). The floors are in the rows, not in this paragraph, so an implementer reading one row gets all of it.

**Untouched and expected green:** every `packages/**` and `apps/api/**` suite (trivially — nothing there moves); `route-ssr.test.tsx`'s three `it.each` suites over its 23 rows; `next-config.test.ts`; `sitemap.test.ts`; `pwa-manifest.test.ts` (it asserts only `metadata.appleWebApp`, so adding `openGraph`/`twitter` to the layout is safe); `medals-content.test.ts` (its two emoji scans are medal-scoped and untouched); the archive suites; the free-play suites; `bundle-markers`.

**Green but NOT untouched** — four files gain a `describe` or an `it` and are green otherwise, and the distinction matters because "untouched" is what a step-6 reviewer will check with a diff: `conclusion-view.test.tsx` (S205), `archive-metadata.test.ts` (S209 — its existing `T-WEB-S173` block is byte-unmoved, B6), `eslint-free-play-wall.test.ts` (T-LINT-S39/S40) and `eslint-db-wall.test.ts` (T-LINT-S8a — its existing assertions are byte-unmoved and `getPublishedDaily` is already on `WALL_SURFACE`, so `T-LINT-S37` does not move).

**Known landmines in the test layer.** (1) `navigator.clipboard` does not exist in jsdom and is a read-only accessor — stub with `Object.defineProperty(navigator, "clipboard", { value: …, configurable: true })` and restore in `afterEach`. (2) `navigator.share` likewise; **its absence is a real test case**, so at least one test must run with the property genuinely deleted. (3) A mocked `fetch` handing out one shared `Response` poisons multi-consumer screens (napkin Shell item 3) — the conclusion mounts `useStats` and `useStreak`, so the share tests mock the client modules rather than `fetch`. (4) `use-record-snapshot.ts`'s module-level cache is keyed `{game, date}` and its `sameToTheReader` comparator (`:129-142`) compares six terms including `guesses.length`; a test that mutates a record in place without changing one of those six will read a stale snapshot. (5) `redirect()` throws by design; the image routes do not use it, but a copy-paste from the sibling page would.

---

## 10. Migration / deploy notes

**No migration. No schema change. No new dependency. No new environment variable.** `packages/db/migrations/**` and `packages/db/src/schema.ts` come out byte-identical, along with all of `packages/**` and `apps/api/**`; §13 makes that a `git diff` criterion. The napkin's apply-before-push ritual does not fire.

**No deploy ordering, and decision 14 argues why rather than asserting it.** One PR, one deployment, no cross-app window, no writes.

**Preview shares the production database** (handoff 019), so the preview's archive is the real archive and the OG routes have real rows to read. That is what makes §13's preview evidence meaningful rather than a smoke test against an empty table.

**What must be verified on the preview and cannot be verified locally** (decision 12, as narrowed at H4): **only** that `process.cwd()` resolves to the app root in the deployed function. The tracing half is provable locally at I24 from Turbopack's own `.nft.json`, so it is no longer a preview-only unknown. The remaining check is one `curl` and one look at the PNG.

**`absoluteUrl` resolves against `NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"` and is inlined into the client bundle** (S10), so I43's pasted share-text evidence will carry the **preview** origin, not `https://miolos.app`. Not a vulnerability; recorded so the evidence is not misread as proving the production URL. The origin is pasted beside the string.

---

## 11. Docs

### 11.1 ADR-0054 — one record, not two

**`docs/adr/0054-the-share-is-plain-text-and-the-card-is-a-nameplate.md`**, carrying **decisions 1–13 and 15** above, with an **`Amends:` header naming ADR-0028, ADR-0053 and ADR-0039** (§11.2(i)). Plus its `docs/README.md` row, in the same commit (napkin Parallel-Stream item 1 — *"a blocking review finding in four consecutive PRs"*).

**Which decisions go in, and why the two revision 2 dropped are not the same case** (RA6). Revision 2 said *"decisions 1–13"* against a register that runs D1…D15, with no reason for the gap.

- **D15 goes in, and it is not optional.** It contains the **standing OG wall** — a permanent lint constraint and the mechanical half of the ADR-0033 D2 refusal that B3 exists to make real. Its analogue, the free-play wall, is recorded in **ADR-0046** and cited from the config's own comment. A standing wall recorded only in a point-in-time plan (`docs/README.md:21`) is a rule with no live owner, which is precisely how a later ticket "de-duplicates" it. The bundle-budget half of D15 goes in with it, because `BUDGETED` growing is a fact about the routes this ADR creates.
- **D14 stays out, with a reason.** *"One pull request"* is a statement about how this ticket is delivered, not about the product or the code; ADR-0053 decision 15's own analogue is recorded because it constrains **future** deploys, and #34's has no forward content at all. The plan is the right home for it.
- **Three consequences that a future ticket will look for, and which revision 2's content list omitted** (RA6): the **`cache-control` override** (the standing answer to *"why is there no CDN TTL on these?"* — H3, D8), the **404-vs-500 rule and where its boundary is** (D8's `PROJECTION_ERROR_NAMES`), and the **denial-of-wallet disclosure** (S5). All three are consequences of decisions that are in the ADR, so they go in its Consequences section rather than becoming decisions of their own.

**Why the font decision is inside it and not ADR-0055.** It exists only because of #34: nothing else in the repo rasterises text server-side, and the constraint it records (*satori throws on a variable font; every weight and the italic need their own file; the binaries are committed, unmodified, with their licences*) is a property of the OG card, which is decision 7's artifact. A second record would have exactly one consumer and would have to restate decision 7 to make sense. ADR-0002 `:41`'s standing sentence — *"a future native client needs static instances of Fraunces at chosen weights"* — is the closest thing to a home for it, and that is a **consequence coming due**, not a decision changing, so it gets a citation in 0054's context and **an in-place annotation but no reciprocal header** (§11.2(ii), U5): what #34 discovered is that the choice set is `{weight, opsz}`, which a native-client author following `:41` as written cannot know. **0055 stays unallocated.**

### 11.2 The amendment audit — re-derived from scratch at revision 3, extended at revision 4. Its answer is "**three** enumerations grow, **ten** annotations are owed, and the exit count is **thirteen**."

**Why it is re-derived rather than patched.** This audit has now been wrong in two consecutive rounds, in the same direction both times: it cleared records whose *enumerations* #34 grows, because it read each record for whether a **decision moved** and stopped there. Revision 1 said *"none amended, one annotation"*; B2 found the second. Revision 2 said *"none amended, two annotations"*; RB3 and RB4 found three more, one of them a live kill-switch hole. So revision 3 re-derives it from the ADR files themselves, over all 53, with each verdict quoting the source, and **§13's exit count is computed from the result rather than asserted ahead of it.** Run at write, at commit and at exit.

**And it was wrong a THIRD time, in the same direction, which is why revision 4 changes the method as well as the answer.** Round 3 found ADR-0039 decision 2 carrying the fifth-game route recipe in forward tense inside a file this audit swept as `N/A` (U1), plus a decision of ADR-0053 that no revision ruled on at all (U2), a forward prescription in ADR-0002 declined on a ground that did not reach it (U5), and one annotation taken for a reason that is checkably false (U8). The method change: **the audit is now run by SHAPE — forward-tense prescriptions that enumerate route artifacts — and the sweep and its full hit list are recorded in (iii-b) below**, so the next round can check the hunt rather than only the verdicts. Reading each ADR for "did a decision move?" is what produced three wrong answers; reading the corpus for a grammatical shape produced the one hit those three missed.

**Baseline, measured now:** `grep -rn "ADR-0054" docs/adr/` returns **zero** hits today.

#### (i) The two records whose per-route enumerations grow — `Amends:` header owed

- **ADR-0028 decision 4 `:91-98`** — **ANNOTATION OWED, and revision 4 moves it onto the clause that is actually false** (U8). Revision 3 annotated the opening words, *"**Both segments** are `force-dynamic` async server components…"*, and wrote *"only the count is wrong"*. **That is checkable and it is false:** an `opengraph-image.tsx` is a metadata route **inside** the existing `/<jogo>` segment, not a third segment, so the daily slug still has exactly two segments and decision 4's *"both"* stays true. What grows is the number of `force-dynamic` route **modules** under the slug — `grep -rn 'export const dynamic' apps/web/app` returns two per daily slug today (`<jogo>/page.tsx:13`, `<jogo>/concluido/page.tsx:9`) and three after #34, because D9 proves the image route's `force-dynamic` is *not* inherited from its sibling page. **The clause that genuinely diverges is the closing one at `:97-98`:** *"When the helper returns nothing — no puzzle, or a killed one — **both routes render the same pt-BR unavailable screen**."* After #34 a third module under the same slug answers the same helper-returned-nothing condition with **a 404 and an empty body** — deliberately (D8: there is no page to render a boundary into, and a card is not a screen). So the annotation is taken at `:91-98` as revision 3 planned, but it says *that*: the segment count is unchanged, the `force-dynamic` module count per slug goes two → three, and the unavailable-screen clause now has one sibling that answers 404 instead. **Revision 2 did not list this record at all; revision 3 listed it for the wrong reason.**
- **ADR-0039 decision 2 `:42-44`** — **ANNOTATION OWED, and the `Amends:`/`Amended by:` pair with it. Revisions 1–3 all swept this file as `N/A`** (U1). Verbatim: *"Copying the route shape — a slug, a `routes` entry, **two `force-dynamic` segments**, a conclusion view — **is still required**; what cannot be copied is the sentence explaining why the in-place half exists."* This is not a quotation of ADR-0028 — ADR-0029 `:13-15` is one, inside quote marks and attributed — it is ADR-0039 restating the recipe as its own decision-2 claim, in a **stronger forward tense** than the ADR-0028 sentence the plan already annotates. After #34 a fifth game copying "the route shape" also needs `app/<jogo>/opengraph-image.tsx` and `app/arquivo/[data]/<jogo>/opengraph-image.tsx`, and the plan's own justification for the ADR-0028 row applies verbatim: *"this is the recipe a fifth game's author follows, so an undercount here is how a future game ships with no card."* The anti-drive-by exemption does **not** cover it: `0053:84-100` exempts only *"a sentence that merely names a now-dead identifier … without making a false forward claim"*, and `:96-98` says a **forward prescription** is not exempt — *"is still required"* is one. `grep -rn 'a slug, a \`routes\`' docs/adr/` returns **three** files (`0028:180`, `0029:14`, `0039:42`); revision 3 annotated one. **The header ruling, in writing: ADR-0039 takes the `Amended by:` line.** Three reasons. (a) It is the same enumeration-growth shape as ADR-0028 and ADR-0053, and §11.2(i)'s own precedent argument — two of three enumeration-growth precedents took headers — does not stop at the file boundary. (b) ADR-0039 `:5` **already carries an `Amended by:` line** (ADR-0053's), so the cost is one bullet on an existing list rather than a new header block, and `0014:5-7` is the shipped precedent for stacking them. (c) Without it the only pointer to #34 sits inside decision 2's paragraph, which is exactly how three consecutive audits missed the sentence. **`0053:98-100` is the lesson being applied rather than quoted:** *"clearing an ADR on one sentence is not clearing the file."*
- **ADR-0028 decision 5 `:112-123`** (the direct-read extension's per-route enumeration; **the annotation block runs to `:123`, not `:118` as revisions 1 and 2 cited**) — *"This enumeration is per-route, so it does not cover the archive by implication."* #34's eight image routes are covered only if they are named. **ANNOTATION OWED** — the one revision 2 already had, with its range corrected.
- **ADR-0028 consequence `:179-192`** — *"#23/#25/#27 add a slug, a `routes` entry, **two** `force-dynamic` server segments and a conclusion view"*, and #31's own narrowing at `:186-189`, *"the archive's four play screens add … **one** `force-dynamic` server segment each"*. Both inventories are one item short after #34: three per daily game, two per archive play screen. This is the recipe a fifth game's author follows, so an undercount here is how a future game ships with no card. **ANNOTATION OWED. Not listed by revision 2.**
- **ADR-0053 decision 2 `:207-233`**, and **this is the one that matters most**:
  - `:209-210` — *"`export const dynamic = "force-dynamic"` on **all seven pages**, on `sitemap.ts` and on `robots.ts`"*. Counted: the archive family carries **nine** `force-dynamic` route modules today (seven pages + `sitemap.ts:21` + `robots.ts:8`) and **thirteen** after #34. **ANNOTATION OWED.**
  - `:229-233` — *"**The standing precondition on any future caching of this family:** the `killed_at` write must **first** gain a writer that calls `revalidatePath` for the affected paths (**day, month, index, play, sitemap**)."* This is a **forward prescription**: a path absent from the list is a path the future writer will not invalidate. #34 adds `/arquivo/<YYYY-MM-DD>/{binairo,sudoku,nonogram,termo}/opengraph-image` — the exact surface where a stale card would outlive a takedown most visibly, and the one D9 spends three paragraphs saying must not. **ANNOTATION OWED, and it is NOT optional** (RB4): it is the difference between the kill switch working and not working on the surface #34 creates. The daily cards at `/<jogo>/opengraph-image` belong to ADR-0028 decision 4's family, not this one, and the index/month/day pages inherit the root card, which reads nothing — both stated so the list is complete rather than merely longer.
  - Its *precondition* is **obeyed, not narrowed**: no `revalidate` is added anywhere. Revision 2's verdict was right about that and wrong to stop there.
- **ADR-0053 decision 4 `:314-322`** — the 404-vs-500 rule D8 rewrites at the route layer, and **no revision of this audit ruled on decision 4 at all** (U2). *(The citation matters: round 3 gave `:47-54`, which is Context item 4, not decision 4. Decision 4 opens at `:275` and the passage is at `:314-322`, verified.)* Verbatim: *"**A bad historical row 404s; it does not 500.** … The log line *is* the alarm. **The two shipped readers keep throwing, because on those a bad row is a live incident.**"* Clause 1 holds and D8 adopts its argument wholesale. The **because** clause does not, on eight new surfaces: the two shipped readers do still throw — `packages/db` is byte-unmoved and §13 proves it with a `git diff --stat` — but on the OG routes the throw is now caught by name, logged and answered with a 404, i.e. treated exactly like the archive reader's bad row rather than like a live incident. **ANNOTATION OWED, and it is cheap:** 0053 is already being edited for two real amendments, so `:84-100`'s anti-drive-by rule is not even in play, and a fifth game's author reading decision 4 would otherwise conclude that an OG route must let those readers 500. The annotation says: the readers are unchanged, and #34's image routes narrow the *caller's* answer to a projection-class throw while everything else — outage, pool error, missing `DATABASE_URL` — still re-throws to the 500 this clause is defending.

**Header shape: `Amends:` on ADR-0054 naming ADR-0028, ADR-0053 and ADR-0039, with the reciprocal `Amended by:` on all three.** Revision 2 argued for annotation-without-header and grounded it on a **false statement** (RA5): it said the shape *"is the same shape #31 used at `:112-118`"*, and #31 in fact shipped **all three parts** — an `Amends:` bullet at `0053:11` (*"decision 5's per-route enumeration of the direct-read extension, **which grows to the archive family**"*), the reciprocal `Amended by:` at `0028:5`, and the in-place annotation. `0053:5` states the standard verbatim: *"every amended file carries the reciprocal `Amended by:` line **and an in-place annotation of the amended sentence**, because in this repo 'amended' means the file was edited (ADR-0036 consequence (b))."* Annotation-without-header **is** a real practice — the *"(Qualified at #27)"* notes at `0034:164`, `0029:79` and `0039:56`, none of whose ADRs took a header from #27 — and `0034:164` is a close analogue, a *count* growing. But the two closest **enumeration-growth** precedents both took headers: 0053 → 0028 d5, and **ADR-0048 → ADR-0041** (`0041:5`: *"**Amended by:** ADR-0048 — consequence (h)'s **enumeration grows** rows 14–15…"*, with the reciprocal *"Also amends ADR-0041"* at `0048:12`). Two of three say header; the plan has been wrong here twice; take the header. **ADR-0039 joins them at revision 4 on the same argument** (U1), and its `:5` already carries one `Amended by:` line, so the reciprocal is a second bullet on an existing list — the `0014:5-7` shape, where two amenders stack.

#### (ii) Annotations owed with no header — qualifications and citation repairs

- **ADR-0045 `:186-191`** (the `.placeholder` Rejected entry; **`:186`, not `:185` — line 185 is the tail of the previous bullet**) — **not amended.** #34 ships the live button, which **discharges** *"a dead share button is a broken promise"* rather than contradicting it, and the `.placeholder` box stays rejected on its own argument. What is affected is the **citation**: the entry names a `conclusion-view.tsx` comment that this PR rewrites. In-place annotation, **no header** — the `0034:164` shape, and this is the case that genuinely fits it. Issue #78 exists for this class.
- **ADR-0028 `:34-39`** and its echo **ADR-0053 `:974-978`** (*"neither cacheable nor an SEO surface"*) — **not amended, but revision 2's "airtight" is overstated and silence is not available** (RA4). Two things are true at once and the plan must say both. (1) The denial's *mechanism* holds: H1 verified that `<title>` and `<meta name="description">` on `/sudoku` are **byte-unchanged**, the routes stay out of `sitemap.ts`, `robots.ts` does not move, no canonical is added, no `generateStaticParams` appears. (2) The denial's *coverage* is narrower than claimed: the `<head>` of `/sudoku` gains ~15 crawl-facing tags, and **`og:title` is a documented title-link candidate when the page's own title is generic** — which `/sudoku`'s is, by D10's own cost line. So #34 plausibly changes the crawl-facing *presentation* of a page 0028 says is not a crawl surface, even though no crawl-posture file moves. **This changes no design** — `openGraph` on the dailies is load-bearing for Trap A and stays. It changes the record: both files take a *"(Qualified at #34)"* annotation stating what the denial does and does not cover, **naming the og:title-as-SERP-fallback mechanism rather than only the byte-unchanged fact**, and the PR body says the same. Revision 2's entries here asserted the opposite and are replaced.
- **ADR-0002 `:41`** — **not amended; ANNOTATION OWED at revision 4, on a ground revision 3's decline did not reach** (U5). The consequence reads *"a future native client needs static instances of Fraunces **at chosen weights**"*. Revision 3 declined it as *"a consequence coming due"*, which is true of the *timing* and misses what §7.2a discovered: a `css2` request **by weight alone silently returns an optical cut** — the 13–15 pt text one, byte-identical to the no-`opsz` default — so what must be chosen grows from `{weight}` to `{weight, opsz}`, and there is no error, no warning and no size difference to catch it. A native-client author following `:41` as written fetches a text cut for a display size and walks into landmine 3. That makes `:41` a **forward prescription that is incomplete rather than merely early**, which is precisely the class `0053:96-98` says the anti-drive-by exemption does not cover — so the annotation is owed even though nothing else in ADR-0002 moves. **No header:** ADR-0002's decision does not change, no enumeration of route artifacts grows, and the sentence gains a term rather than an item — the `0034:164` / ADR-0045 `:186-191` shape, annotation-only. One parenthetical: what must be chosen is `{weight, opsz}`, with ADR-0054 decision 12 named.
- **ADR-0014 `:12` and `:18`** — **not amended, and no annotation owed — but the plan's REASON was false** (RA4/RA7). `:12` says, verbatim: *"The pages in question — the archive index, per-day puzzle pages, **OG image generation** — are the SEO surface"*. So ADR-0014's own Context classifies OG generation as SEO surface, which revision 2 cited `:12` without noticing. That is a *description of what motivated ADR-0014*, not a rule, and the justification that actually transfers to `/<jogo>/opengraph-image` is 0028 decision 5's one-hop argument — but the plan may not cite `:12` as support while §11.2 denies the same characterisation two bullets away, and it now does not. Separately, `:18`'s scope line reads *"public, unauthenticated, **cacheable** … reads"* and **already carries #31's annotation** *"Extended twice, and 'cacheable' is no longer load-bearing"*; #34's reads are `force-dynamic` and `private, no-cache, no-store`, so revision 2's *"#34 is the clause being used **as written**, for the first time"* is false — it is used **as amended**. The verdict (NOT AMENDED, no annotation) survives, because `:18`'s members are *categories* and *"OG images"* already covers all nine files; the per-route growth is recorded at ADR-0028 decision 5, where the per-route enumeration lives.

#### (iii) Not amended, obeyed or cited — the full list, including the nine revision 2 never reached

| Record | Verdict |
|---|---|
| **ADR-0010 `:20`** | **NOT AMENDED — obeyed literally, and it is AC 3's actual governing sentence.** *"Every read path — daily, archive, **OG images**, anything — filters `published_at <= now()` … through **one shared query helper**."* Both readers spread `publishedConjuncts()`; neither re-types it. **Revisions 1 and 2 never listed the only rule in the corpus that names OG images** (RA10). |
| **ADR-0013 `:35-36`** | **NOT AMENDED** — a consequence coming due. `:35` names *"Magic links, **OG cards**, CORS config and cookie scope all target `miolos.app`"*; #34 is the first ticket to ship OG cards, and `:36`'s *"nothing hardcodes the apex outside environment config"* is obeyed via `metadataBase` / `siteOrigin()` (`layout.tsx:42`). Citation in 0054's context, no header, no annotation. (RA10 — listed as a governing record and never ruled on.) |
| **ADR-0013 `:23`** | **NOT AMENDED, and the verdict is written out because #34 brushes this clause and only this clause of 0013** (U3). Verbatim: *"**Public route segments are pt-BR**: `/arquivo/...`, not `/archive/...`. … Code identifiers stay English; route slugs are externalized alongside the i18n strings so a future locale brings its own segments."* #34 ships **nine public URLs whose terminal segment is `opengraph-image`** — the first English segments nested under pt-BR product paths, emitted into the `<head>` of every shared page. The three English URLs on `main` (`/sitemap.xml`, `/robots.txt`, `/manifest.webmanifest`) are root-level protocol-standard names and no ADR records them as an exception; swept, zero mentions across 53. The rule still does not bite, for a reason worth writing down rather than assuming: `opengraph-image` is **a Next file-convention name, not a chosen slug** — it is not externalizable through `routes.ts`, it is never typed, read or searched by a human, and a pt-BR spelling would require abandoning the file convention for a route handler, which is a decision with costs rather than a rename. Same class as `/sitemap.xml`. **No annotation:** `:23`'s subject is the slugs the audience reads, and the sentence makes no forward claim about framework-generated paths, so `0053:84-100`'s exemption applies to an untouched file. |
| **ADR-0046** | **NOT AMENDED — obeyed and mechanically strengthened.** Decision 1's literal-per-game-segment precedent is what D7 cites for nine literal files; `:31`'s *"noted, not scheduled"* stays noted and D15's `**/play/share-text` entry enforces it. Its consequence at `:70-73` describes the wall's coverage and gains a class — a description of enforcement, not a permission grant, so growing it strengthens the guarantee. (RA10.) |
| **ADR-0047** | **NOT AMENDED — obeyed, and it fails closed in #34's favour.** A metadata route ships no client chunk and never enters `route-bundle-stats.json`, so nothing enters the marker scan; consequence 2's daily-strict default is what #34 relies on. (RA10.) |
| **ADR-0001 `:30`**, **ADR-0007 `:28`**, **ADR-0005 `:13`/`:35`** | **NOT AMENDED** — consequences coming due / closed questions exercised for the first time; citations in 0054's context. |
| **ADR-0017** | **NOT AMENDED.** A per-file `// @vitest-environment node` pragma changes no config, and the decision's own wording contemplates node outside DOM tests. |
| **ADR-0024 decision 5**, **ADR-0024 `:111-114`** | **NOT AMENDED — obeyed, and the second citation is the one that matters** (U4). Decision 5 is the export-surface half: eight new `apps/web` modules import `@miolos/db`, all on the root barrel, and the db wall's permitted list is byte-unmoved. **`:111-114` is the standing obligation revision 3's row never cited** — *"The named #18 ESLint duty is extended: besides banning `@miolos/db/publishing` imports in `apps/web`, **it must flag `daily_puzzles`/`remote_config` string literals in `apps/web` source**"* — and it is exactly what D15's own defect table shows a naive OG wall **deletes** for the eight routes that read the database. So `:111-114` is the ADR that owns `T-LINT-S43` and `T-LINT-S8a`; the verdict is unchanged (obeyed, because objects (1) and (2)'s arrays are spread verbatim) but the obligation now has its source named, which is the RA7/RA9 class of repair rather than a new finding. |
| **ADR-0029 decision 2**, **ADR-0029 `:13-15`** | **NOT AMENDED**, and now on three grounds rather than two, because an omission and a clearance read alike (U6). The seam: the game-shaped logic is in a pure module, not in the view. The enumeration: the *Shared:* list at `:60-66` does not name `share-text.ts`, but it already omits `accent.ts`, `picture-path.ts` and `use-pointer-stroke.ts`, 0029's header carries **no `Amended by:` line at all**, and the list has grown silently three times. **And `:13-15`, which carries the same fifth-game recipe as ADR-0028 `:180` and ADR-0039 `:42`** — *"#23/#25/#27 add a slug, a `routes` entry, two `force-dynamic` server segments and a conclusion view"* — **is an attributed quotation**, inside quote marks, in 0029's Context, cited to ADR-0028 by name. This repo annotates at the source (`0053:979-985`), so no annotation is owed here; it is recorded rather than left silent because ADR-0039 `:42` looked identical from a distance and is **not** a quotation, which is how U1 stayed hidden for three rounds. |
| **ADR-0033** | **NOT AMENDED — obeyed and cited, with the citation repaired** (RA9). The measurement is **Context `:23-30`**; decision 2 is **`:49-55`** and its *"stated in those words wherever it is cited"* sentence is at `:49-50`. Revisions 1 and 2 cited both at `:26-34`, which contains neither, five or more times. Obeying an ADR harder is not amending it; citing it at the wrong lines, in the one ADR whose rule is about how it is cited, is the A7 failure a round later. |
| **ADR-0034 consequence (c)**, **ADR-0043 decision 8**, **ADR-0043 consequence (a)** | **NOT AMENDED.** No prop is added; `ConclusionView`'s optional members stay at four and its total at seven; `ConclusionCopy` is not widened; the share strings are shared chrome in `messages.share`, imported directly. |
| **ADR-0045 decision 7 `:151-175`** | **NOT AMENDED — with one conditional.** Its forward clause (*the shared `MAX_DELTA_BYTES` is not raised*) is honoured under every branch of D15's remedy. **If** the `/nonogram` branch fires, the literal `PER_ROUTE_BUDGET = { "/termo": 76 * 1024 }` becomes a stale quotation of live code and earns a clause — 0045 is already being annotated, so 0053 `:84-100`'s anti-drive-by rule does not exempt it. §13 carries this as a conditional tenth grep hit. |
| **ADR-0053 consequences `:964-967`** | **NOT AMENDED.** It describes what #31 shipped and is still exactly true. |
| **ADR-0002 `:37`**, **ADR-0018 `:15`**, **ADR-0031 decision 6**, **ADR-0004**, **ADR-0006**, **ADR-0036**, **ADR-0041**, **ADR-0051**, **ADR-0052** | **NOT AMENDED** — each obeyed or cited. `0002:37` (*"Next.js `ImageResponse` gives per-day, per-game Open Graph share cards natively"*) is the decision #34 executes. **`0002:41` moved out of this row at revision 4** and into §11.2(ii): it takes an annotation, no header (U5). |
| **ADR-0003, 0008, 0009, 0011, 0012, 0015, 0016, 0019–0023, 0025–0027, 0030, 0032, 0035, 0037, 0038, 0040, 0042, 0044, 0048, 0049, 0050** | **N/A** — swept, nothing #34 touches, obeys-by-omission or grows. **ADR-0039 is no longer in this list** (U1): it was inside revision 3's `0037–0040` range, which is how a forward-tense fifth-game recipe was cleared three rounds running. |

**No ADR anywhere governs committing binaries, `.gitattributes`, or server-side font rasterisation** — confirmed by keyword sweep over all 53. That is new ground, and it is decision 12 inside ADR-0054, with `0002:41` annotated for the `{weight, opsz}` growth rather than amended.

#### (iii-b) The forward-prescription sweep, run once more at revision 4 and its result recorded

U1 is the third appearance of one failure mode — *an ADR cleared as `N/A` whose forward enumeration grows* — so the corpus was swept again for that **shape** rather than for that sentence, and every hit is ruled on here rather than left to a fourth round.

| Sweep | Hits | Ruling |
|---|---|---|
| `grep -rn 'a slug, a \`routes\`' docs/adr/` | `0028:180`, `0029:14`, **`0039:42`** | 0028 annotated (row 4); 0029 is an attributed quotation, not owed (above); **0039 is U1** and is now rows 10 and 11. |
| Forward modals over route artifacts — `(is\|are) still required`, `must (also\|first)? (add\|carry\|ship\|gain\|copy\|declare\|export)`, `will (need\|add\|carry\|gain)`, `adds a (slug\|route\|segment\|file)`, `copy of this shape`, `per-route` | 18 lines | `0039:43` (U1, taken); `0028:179-192` and `0028:114` (already rows 3 and 4); `0053:11` and `0028:5` (existing `Amends:` prose, not decisions); `0045:159`/`:270` (the `PER_ROUTE_BUDGET` conditional, already row 13); `0014:5-7`/`:18` (already ruled); `0047:57` (ruled); **`0027:118`** (*"that ticket must additionally add (a) a consumption record, and (b) a server-computed granted-hint seam"* — the rewarded-ad ticket's list; #34 adds nothing to it, no hint grant, no consumption record — **N/A**); **`0043:30`** (*"#27's AC 2 adds a second thing the conclusion must carry"* — the conclusion's payload, which #34 does not widen: no prop is added, `ConclusionView` stays at seven — **N/A**, and already ruled under ADR-0043 decision 8); **`0039:230`** (`sameToTheReader` must gain the guess terms — Termo snapshot comparison, untouched — **N/A**); **`0003:33`** (the M0 `users` schema — **N/A**); **`0029:165`** (*"every future game adds a member to the discriminated union"* — the play-record union, to which #34 adds no member — **N/A**); **`0041:428`** (*"a fifth game reusing one of these modules re-opens the measurement"* — the accent contrast table, and #34 adds no accented text: ADR-0041 is obeyed without its exception — **N/A**). |
| `opengraph\|og image\|og card\|og:image` across all 53 | `0007:28`, `0010:20`, `0013:9`/`:35`, `0014:12`/`:18`, `0053:8`/`:966`, `0002:37` | all already ruled in (ii) or (iii); `0010:20` is AC 3's governing sentence, `0053:966` describes what #31 shipped and stays true. |

**One new hit, and it is U1.** That is the sweep's whole yield, and it is recorded so that a step-6 reviewer can see the shape was hunted rather than the sentence.

#### (iv) The result, as a checklist — this is what §13 checks, and the number is DERIVED from it

| # | File | Site | Kind |
|---|---|---|---|
| 1 | `docs/adr/0028-….md` | `:5` header | `**Amended by:**` — decision 4's and decision 5's per-route enumerations grow |
| 2 | `docs/adr/0028-….md` | `:91-98` | annotation — the **segment** count is unchanged; the `force-dynamic` **module** count per daily slug goes two → three, and `:97-98`'s *"both routes render the same pt-BR unavailable screen"* now has a third module under the slug answering **404** (U8) |
| 3 | `docs/adr/0028-….md` | `:112-123` | annotation — *"(Grown at #34)"*, naming **all eight** image routes |
| 4 | `docs/adr/0028-….md` | `:179-192` | annotation — the fifth-game recipe is three route modules, the archive's is two |
| 5 | `docs/adr/0028-….md` | `:34-39` | **qualification** — what the not-an-SEO-surface denial does and does not cover |
| 6 | `docs/adr/0053-….md` | `:5` header | `**Amended by:**` — decision 2's route enumeration and its `revalidatePath` path list grow |
| 7 | `docs/adr/0053-….md` | `:207-233` | annotation — thirteen route modules, and the **four image paths a future `killed_at` writer must invalidate** |
| 8 | `docs/adr/0053-….md` | `:974-978` | **qualification** — the echo of #5 |
| 9 | `docs/adr/0053-….md` | `:314-322` | annotation — the two shipped readers still throw; **#34 narrows the CALLER's answer** to a projection-class throw, and everything else still re-throws to the 500 this clause defends (U2) |
| 10 | `docs/adr/0039-….md` | `:5` header | `**Amended by:**` — decision 2's fifth-game route recipe grows; a second bullet on the line ADR-0053 already put there (U1) |
| 11 | `docs/adr/0039-….md` | `:42-44` | annotation — *"two `force-dynamic` segments"* → the recipe now also carries `app/<jogo>/opengraph-image.tsx` and `app/arquivo/[data]/<jogo>/opengraph-image.tsx` (U1) |
| 12 | `docs/adr/0045-….md` | `:186-191` | annotation — the live button discharges the rule; citation repair, **no header** |
| 13 | `docs/adr/0002-….md` | `:41` | annotation — what a native client must choose is `{weight, opsz}`, not `{weight}`: `css2` serves an optical cut silently. **No header** (U5) |
| *(14)* | `docs/adr/0045-….md` | `:151-175` | **conditional** — only if D15's `/nonogram` `PER_ROUTE_BUDGET` branch fires |

**So: `grep -rn "ADR-0054" docs/adr/` at exit reaches THIRTEEN rows outside 0054 itself — fourteen if the `/nonogram` budget branch fires.** Revision 1 said one, revision 2 said two, revision 3 said nine. **The number is DERIVED from the table and nothing else** — it was recounted from the rows after U1, U2, U5 and U8 landed, not adjusted by hand — and §13 checks the **rows**, so a miscount is visible rather than merely wrong. *(Two of the four rows added at revision 4 are in files the plan was already editing, so the cost is four lines of markdown; only ADR-0002 is opened for the first time, and §11.2(ii) states why the anti-drive-by rule does not protect it.)*

### 11.3 CONTEXT.md — one new row

| Term (code) | pt-BR (UI) | Meaning |
|---|---|---|
| **Share text** | — | The string a conclusion produces for pasting into a chat: game, date, result, the per-day permalink, and — for Termo alone — the tile grid as coloured squares. Composed on the device from the local play record ([ADR-0031](./docs/adr/0031-per-device-day-state-is-a-local-monotone-safe-affordance.md) decision 6 — an affordance, never an entitlement) and therefore never carrying the answer, any guess word, a board or a picture, nor the streak, a medal, a solved total or a hint count, nor any claim about *when* the day was solved ([ADR-0054](./docs/adr/0054-the-share-is-plain-text-and-the-card-is-a-nameplate.md)). Three of the four games have no shape, and that is the product's asymmetry rather than a gap. **It is not spoiler-free by construction and the glossary must not say it is** — a Termo grid narrows the answer measurably (§12: median 77 of 400 candidates under a consistent-play attacker, min 4; two grids median 19), which is deliberate solving against a product with no ranking rather than spoiler broadcast. |

*(RA8: revision 2 forbade ADR-0054 from recording *"spoiler-free by construction"* as an absolute in §12 and then opened this row with the bare adjective. The glossary is the more load-bearing of the two — CLAUDE.md routes every future ticket here for vocabulary — so the adjective is dropped and §12's qualification is carried, not summarised away.)*

*(A9: the pt-BR column carries the pt-BR **name of the concept**, never a button label — four existing rows use `—` where no such name exists, and this is one of them. "Compartilhar" is the label on a control, and it lives in `messages.share.label`. Both ADR links in this row are real paths, not the elided `0031-…md` revision 1 wrote: [ADR-0031](./docs/adr/0031-per-device-day-state-is-a-local-monotone-safe-affordance.md).)*

**The OG card earns no row, and that is a decision.** It is an artifact of a route, not a domain term — the same ruling ADR-0053 §11 made for the late-result panel (*"It is a screen, not a domain term"*). Recorded so the omission is deliberate.

### 11.4 The falsified-record sweep

Napkin item 4: *"any change that makes a committed document's statement false owes the correcting record in the SAME round."* Every statement #34 falsifies, and its correction:

| Statement, today | Where | Correction |
|---|---|---|
| *"The share button remains out (#34 — a dead share button is a broken promise, unlike a dead link)."* | `apps/web/src/play/conclusion-view.tsx:72-73` | Rewritten to shipped tense: the button is live, what it composes, and that the *rule* it cited is discharged rather than abandoned |
| *"only the share button remains out (#34)"* | `apps/web/src/play/conclusion-view.module.css:5-6` | Same, in the sheet's own register; `.share` named |
| *"this sheet declares no focus ring at all"* | `apps/web/src/play/conclusion-view.module.css:36-39` (**the sentence spans `:36-39`; the phrase is on `:37`. Revision 2 cited `:35-36`** — RQ15) | **New at revision 2 (B12).** True only while every interactive element was an `<a>` on the UA default; `.share:focus-visible` falsifies it. Rewritten to say the sheet declares **one**, on the one native button, in the `hub-attach`/`privacidade` idiom |
| *"Three surfaces need it and none of them may disagree"* | `apps/web/src/site-origin.ts:5-11` | Four: the share text joins `metadataBase`, `sitemap.ts` and `robots.ts` |
| The `:32-37` exclusion block explains why the daily routes are out of the sitemap | `apps/web/app/sitemap.ts` | One clause: OG metadata is a sharing affordance, not indexation; the exclusion stands (§1 exception ii) |
| The same block cites *ADR-0028 `:28-30`* for *"not an SEO surface"* — the sentence is at **`:36-38`** | `apps/web/app/sitemap.ts:35` | **New at revision 2 (A7).** Already false on `main`, and the plan inherited the off-by-eight and cited it five times. Both are corrected in this round rather than propagated into ADR-0054 |
| ADR-0028 decision 4's `:97-98` — *"**both routes render the same pt-BR unavailable screen**"* | `docs/adr/0028-…md:91-98` | **New at revision 3 (RB3), re-aimed at revision 4 (U8).** Revision 3 annotated *"Both segments"* and called the count wrong; the segment count is **unchanged** — an `opengraph-image.tsx` is a metadata route inside the existing `/<jogo>` segment. What grows is the `force-dynamic` **module** count per slug, two → three, and what genuinely diverges is `:97-98`: a third module under the same slug answers the helper-returned-nothing case with a **404 and an empty body**. Annotation; the `Amended by:` header at `:5` covers it |
| ADR-0053 decision 4's *"The two shipped readers keep throwing, because on those a bad row is a live incident"* | `docs/adr/0053-…md:314-322` (**decision 4 opens at `:275`**; round 3's `:47-54` is Context item 4, not this) | **New at revision 4 (U2).** The readers are byte-unmoved and still throw, so clause 1 holds; on eight new surfaces the **caller** now catches a projection-class throw by name, logs and 404s. Annotation naming the narrowing and what still re-throws |
| ADR-0039 decision 2's *"Copying the route shape — a slug, a `routes` entry, **two `force-dynamic` segments**, a conclusion view — **is still required**"* | `docs/adr/0039-…md:42-44` | **New at revision 4 (U1), and it is the one three consecutive audits missed** — the file was inside revision 3's `0037–0040` `N/A` range. A fifth game's author following this sentence ships with no card. Annotation, plus a second `**Amended by:**` bullet at `:5` beside ADR-0053's |
| ADR-0002 `:41`'s *"static instances of Fraunces **at chosen weights**"* | `docs/adr/0002-…md:41` | **New at revision 4 (U5).** Incomplete as a forward prescription: `css2` serves an optical cut silently, so the choice set is `{weight, opsz}`. Annotation, **no header** |
| ADR-0028 decision 5's per-route enumeration does not cover an image route | `docs/adr/0028-…md:112-123` (**the block runs to `:123`**, not `:118` as revisions 1–2 cited) | **B2.** In-place *"(Grown at #34)"* annotation naming all eight image routes |
| ADR-0028's fifth-game recipe — *"**two** `force-dynamic` server segments"*, and #31's *"**one** … each"* for the archive | `docs/adr/0028-…md:179-192` | **New at revision 3 (RB3).** Three and two. This is the sentence a future game's author follows, so the undercount is how a card goes missing |
| ADR-0028's / ADR-0053's *"not an SEO surface"*, whose coverage is narrower than the plan claimed | `docs/adr/0028-…md:34-39`, `docs/adr/0053-…md:974-978` | **New at revision 3 (RA4).** *"(Qualified at #34)"* on both, naming the og:title-as-SERP-fallback mechanism, not only the byte-unchanged fact |
| ADR-0053 decision 2's *"all seven pages"* route enumeration | `docs/adr/0053-…md:207-211` | **New at revision 3 (RB3).** Nine route modules become thirteen |
| ADR-0053 decision 2's `revalidatePath` path list — *"day, month, index, play, sitemap"* | `docs/adr/0053-…md:229-233` | **New at revision 3 (RB4), and the one that is NOT cosmetic.** A future `killed_at` writer built from this list will not invalidate the four `/arquivo/<data>/<jogo>/opengraph-image` paths, so a killed puzzle's card outlives its page's 404. The annotation names the four patterns |
| ADR-0045 `:186-191` cites a `conclusion-view.tsx` comment that this PR rewrites | `docs/adr/0045-…md:186-191` (**`:186`**, not `:185`) | In-place annotation, **no header** (§11.2) |
| The test-id frontier | `docs/agents/test-ids.md:36-42` | Re-derived by grep at the end; #34's spent range and its burned tails recorded in the file's own accounting style |
| The `docs/README.md` "Current" table | `docs/README.md:32-78` | Two rows: plan 040 and ADR-0054 |
| *"`ConclusionView`'s props … as the file itself declares at `conclusion-view.tsx:89-105`"*, *"`conclusion-view.tsx` grows (897 lines today)"*, *"the CTA ternary (`:381-407`)"* | this plan, D1 | **New at revision 3 (RQ15/RC12).** Verified: the prop block is **`:89-105`**, the file is **896** lines, the CTA ternary is **`:382-405`**. `.secondaryLink` at `:409-411` and `<aside>` at `:363` are correct. Corrected in place rather than carried into ADR-0054 |

**Explicitly NOT corrected, each for a stated reason:**

- **`docs/plans/017-issue-18-plan-play-the-daily-binairo.md:1005`** (*"'Compartilhar resultado' | omitted | … **#34**"*) — a plan is a point-in-time snapshot and its body is never rewritten (`docs/README.md:21`). It was true when written; #34 is the ticket it names.
- **`docs/handoffs/039-…md` §5's Trap A framing** — same rule. The correction lives in §4 of this plan and in ADR-0054's context.
- **`packages/db/src/published.ts:116-145`** — deliberately ticket-free per #31 step-6 F22. **Nothing is added, including "#34".** Revision 2 removes the reason anyone would want to: with the archive four on `getPublishedDaily`, #34's `getTodayDaily` calls make no new claim about that reader (§1, H2). Nothing in `packages/db` is falsified by this ticket at all.
- **`docs/adr/0053-…md` `:964-967`** — still true (§11.2).

---

## 12. The threat model #31 handed over

Recorded in two places — PR #94's body and ADR-0053 `:926-928`: *"**Ten volume medals become self-mintable**, and #34 is where a self-minted volume medal first becomes socially visible. That is a change to #34's threat model caused by #31, recorded here rather than discovered there."* The ten (ADR-0053 decision 5 `:388-393`) are `first-win`, `wins-10`, `wins-50`, `wins-100`, `wins-500`, `binairo-30`, `sudoku-30`, `nonogram-30`, `termo-30`, `all-games`, all backed by `countsAnyWon`, all counting late wins by design (ADR-0052 decision 3).

**The resolution is that #34 does not make them visible.** Verified as the current state: medals are not in scope at conclusion time at all — grep for `medal` over `apps/web/src/{play,archive,termo,nonogram,sudoku,binairo}` returns two doc-comment mentions (`play/day-state.ts:13`, `play/play-record.ts:298`) and no import of anything under `src/medals/`. Decision 3 keeps it that way and `T-WEB-S191` makes it mechanical — **as a module-graph scan, not as a substring assertion** (B7): "no streak, no medal, no solved total" cannot go red against a `PlayRecord` that has no such fields, so revision 1's version would have passed the day it was written and forever after. The scan over `share-text.ts` proving nothing under `src/medals/`, `src/streak/`, `src/stats/` or `play/day-state` is reachable is the assertion that can actually fail. The smaller sibling goes with it — `solved` carries no on-time conjunct (ADR-0051 decision 6, *"a late solve is honestly a solve"*), so a shared solved count would be a self-mintable number too.

**A second residual, measured rather than asserted (S4).** The Termo grid **does** materially narrow the answer, and ADR-0054 must not record *"spoiler-free by construction"* as an absolute, because that is the sentence a later ticket builds on. Measured over the 400-word answer pool against the 5,310-word public validation list: one grid leaves a median **329**/400 candidates under a no-assumption attacker, but a median **77** (min **4**, worst observed 18) assuming consistent play; **two** shares median 19 (min 1); three median 8; five median 3. **This does not change the design** — ADR-0004 `:11-13` scopes the threat to *spoiler broadcast*, and multi-grid intersection is deliberate solving against a product with no ranking. **It changes the claim:** ADR-0054 records the measured bound and the threat-model framing, which is exactly the discipline ADR-0033 decision 2 imposes for the same reason.

**The third residual, stated rather than dismissed.** The elapsed time in a grid game's share is client-measured and self-reportable, exactly as `hints_used` is (ADR-0027) and exactly as the conclusion screen already renders it. Nothing #34 ships makes that worse: the same number is already on the screen, in the statistics, and in the completion row. ADR-0006 `:51` is the standing posture — *"It is not an anti-cheat system, and no detection infrastructure is being built for a rank that v1 does not have"* — and ADR-0004 `:13` is why it does not matter: there is no ranking to climb, so a fabricated share cheats only its sender's friends' patience.

---

## 13. Exit criteria

Every line pasted, none asserted (CLAUDE.md's evidence rule; napkin Execution item 2).

- [ ] **AC 1** — each game produces a spoiler-free share text: `T-WEB-S189` (Termo's grid), `T-WEB-S190` (**the answer never appears**, over all 400 canonicals), `T-WEB-S191` (the three grid games, and the exclusion list as a module-graph scan), `T-WEB-S192`, `T-WEB-S193`, `T-WEB-S206` green. **Carve-out, stated here because AC 1's word is "shape":** three of the four games ship no shape, deliberately (decision 3, flag F1); `T-WEB-S191` asserts the absence rather than omitting it. **This is the one AC that is not fully met as written, and it binds OUTSIDE this plan** (I1): the eight flags go in the PR body verbatim, F1 in the words *"this acceptance criterion is not fully met as written, and here is the accepted cost"*, and the same text as a comment on #34 before step 8 closes it.
- [ ] **AC 2 — MET** (B1). Per-day, per-game OG images in the Ateliê system, generated in code: `T-WEB-S200`, `T-WEB-S201`, `T-WEB-S202` green — **including S202's optical-cut arm, which is the only assertion in the suite that can tell one Fraunces instance from another** (RB1); **all eight game cards dated**, evidenced by the two preview `curl`s below rendering different dates for the same game; **no static per-day asset exists** (`git diff main -- apps/web/public` is empty, and the only new binaries are the three fonts and `SHA256SUMS`).
- [ ] **AC 3** — OG generation is a public read path through the helper and can never render an unpublished day: `T-WEB-S203` green over **all four games × both families** (past → 200, future/unpublished/killed → 404, today → 200, malformed → 404 with no read, a throwing reader → 404); `T-WEB-S204` green; `pnpm lint` green **and the db wall proved intact rather than assumed** — `T-LINT-S43`'s replacement regression and `T-LINT-S8a` pasted, because the OG wall object *replaces* the db wall for the nine files it matches and a file diff cannot see the difference (RB2); **`git diff main -- packages` is empty**, so `T-DB-9a`/`9b`/`9e`/`S5` and `T-LINT-S37` are byte-unmoved and `packages/db/src/published.ts` is byte-identical — pasted as a `git diff --stat`. **The residual is stated in the PR body in its WIDENED form** (A3 + RC8): **every** archive `[data]` segment — malformed included, where `generateMetadata` returns no `openGraph` at all — still emits a file-convention `og:image` that 404s plus the root-filled `og:*`/`twitter:*` set; and on a day with nothing published, `/<jogo>` renders `DailyUnavailable` at 200 while its `og:image` 404s. AC 3's guarantee is about the **image**, which never renders for an unpublished day; it was never about the `<head>` that advertises it.
- [ ] **AC 4** — shared links land on the exact day/game page and the flow works on mobile: `T-WEB-S192` (the URL is the per-day permalink), `T-WEB-S196` and `T-WEB-S197` (share then clipboard, byte-identical, AbortError silent, **non-Abort falls through**) green; plus a **real device or emulated-mobile** pass recorded in the PR body — the share sheet opening on one target and the clipboard fallback on a desktop browser, with the resulting string **and the origin it resolved against** pasted (S10 — on a preview the origin is the preview's, not `miolos.app`).
- [ ] `pnpm typecheck && pnpm lint && pnpm test` green, output pasted; `pnpm build` green with **the route table pasted**, expecting **one `○ Static`** (the root site card) and **eight `ƒ Dynamic`** (decision 9). Any deviation is a §14 entry.
- [ ] **The Turbopack font trace, pasted at I24 and again here** (H4): for one route of each of the three families, the `.nft.json` lines naming `assets/fonts/*.ttf`. This is checkable locally; only `process.cwd()`'s runtime value is preview-only.
- [ ] **The three committed faces verified BEFORE they are committed** (I12) and again here: `fvar` absent; `OS/2.usWeightClass` 500 / 400 / 600; `name` ID 1 and ID 16 equal to §7.2a's table, with ID 16 **absent** on `InstrumentSans-400.ttf`; `OS/2.xAvgCharWidth === 1148` on `Fraunces-36pt-500.ttf`; the three sizes summing to **168,996 B**; and `SHA256SUMS` recording a `css2` URL that carries the `opsz` term for Fraunces. **The byte sum is NOT a discriminator and must not be read as one** (T1): the 24, 28 and 36 pt cuts are 71,648 B each, so a one-bucket typo passes it, passes `fvar`, passes the family name and passes `usWeightClass` — only `name` ID 16 and `xAvgCharWidth` 1148 tell them apart.
- [ ] `pnpm bundle-check` **run from `apps/web` after `pnpm build`**, output pasted: the four dailies, the four `concluido`, the four archive play routes, **and `/`'s own absolute first-load figure before and after** (napkin Domain item 3). `MAX_DELTA_BYTES`, `FREE_PLAY_PREFIX` and `FREE_PLAY_ROUTES` untouched; the four `concluido` routes present in `BUDGETED` and under budget, or carrying a `PER_ROUTE_BUDGET` entry with its arithmetic (decision 15). **`/nonogram`'s pre-measurement from I6a pasted beside its final figure** (C8).
- [ ] `npx impeccable detect` green at **both** viewports in CI (check both steps — napkin Execution item 9), **plus two file-mode runs**, output pasted: (a) over the concluded conclusion at both viewports (the share button — ADR-0034 decision 4); (b) over **`siteCard()` and one `gameCard()`** written to a 1200×630 HTML file (the card — A4). **The site card is rendered here for the first time** — §7.2 no longer claims it was rendered before being specified (RD3). The PR body states in these words that the CI URL scan reaches only the *empty* conclusion.
- [ ] **Preview evidence, five `curl`s, pasted:** (a) an archive card URL through the bypass → `HTTP 200`, `content-type: image/png`, **`cache-control: private, no-cache, no-store, max-age=0, must-revalidate`** (H3), plus a screenshot showing Fraunces and not Geist (decision 12's only unverifiable-locally claim); (b) **a daily card URL** → the same three, and a screenshot showing **today's date on it** (AC 2's own evidence); (c) `/sudoku` → its `<head>`'s full `og:`/`twitter:` tag list, showing `og:locale`, `og:site_name` and `og:type` **present on the leaf** (B4) and **no page `<meta name="description">` other than the root's** (H1); (d) `/arquivo/<hoje>/sudoku` → the 307's `<head>`, `og:image` present and resolving to 200; (e) `/privacidade` → `og:image` resolving to the root card (decision 7's inheritance claim).
  **`<hoje>` is DISCOVERED from the app, never computed in the shell** (A5, ADR-0053 decision 12 `:606,613-616`: *"a date computed in the shell is a client clock deciding what the São Paulo publication wall published"*). Take it from the conclusion's own share output, or from the archive index's first day path.
- [ ] **The exit greps, with the glob corrected** (RA3d/RQ13/RC11 — `apps/web/app/*/opengraph-image.tsx` never matched the **root** card, which is the one file this criterion most needs to reach):
  ```
  grep -rn "@miolos/games" apps/web/src/og $(find apps/web/app -name 'opengraph-image.*')   # nothing
  grep -rn "@miolos/db\|src/db" apps/web/app/opengraph-image.tsx                            # nothing
  find apps/web/app -name 'opengraph-image.*' | sort                                        # exactly 9, root included
  ```
  *(The eight game routes now read the wall by design, so the old blanket `@miolos/db` grep over them is replaced by `T-WEB-S204`'s scoped assertion. The grep is a belt: `T-LINT-S41`/`S42`/`S44` are the gate.)*
- [ ] `grep -rnE "^export const revalidate|generateStaticParams *\(" apps/web/app` returns nothing, **and this is the corrected grep** (C5): revision 1's `grep -rn "revalidate\|generateStaticParams" apps/web/app` returns **16 hits on `main` today**, all in the comments that *record* the absence — an unsatisfiable criterion that would be "fixed" at I45 by deleting doctrine comments. All eight game image routes carry `export const dynamic = "force-dynamic"`.
- [ ] `git diff main -- packages apps/api turbo.json pnpm-workspace.yaml apps/web/app/robots.ts apps/web/app/manifest.ts apps/web/next.config.ts` is **empty**; `git diff main -- apps/web/src/site-origin.ts apps/web/app/sitemap.ts` shows **comment lines only**; `git diff main -- apps/web/src/play` touches only `share-text.ts` (new), `conclusion-view.tsx` and `conclusion-view.module.css`.
- [ ] Wall probes red-then-green: `**/play/share-text` static and dynamic (`T-LINT-S39`/`S40`), `@miolos/games` from the OG surface static and dynamic (`T-LINT-S41`/`S42`), **the replacement regression (`T-LINT-S43`) and the glob reach including the root card (`T-LINT-S44`), and `T-LINT-S8a` from `apps/web/src/og/**`** (RB2). The replacement probes are the ones that must be *seen* to red against a wall object without the spreads, not merely to pass with them.
- [ ] **Docs:** plan 040 + ADR-0054 + **two `docs/README.md` rows** + the CONTEXT.md row + **every row of §11.2(iv)** + every §11.4 correction. The amendment audit's verdict stated in ADR-0054 with the candidate list, and re-run at exit.
- [ ] **The amendment checklist, checked as ROWS and NEVER as a count** (RB3/RB4/RA5, sharpened at U7): `grep -rn "ADR-0054" docs/adr/` pasted, and the check is **two-way — every row of §11.2(iv) has at least one hit, and every hit maps to a row** — by file and line. The rows are the `Amends:` reciprocals at `0028:5`, `0053:5` and `0039:5`; four annotations in 0028 (`:34-39`, `:91-98`, `:112-123`, `:179-192`); three in 0053 (`:207-233`, `:314-322`, `:974-978`); one in 0039 (`:42-44`); one in 0045 (`:186-191`); one in 0002 (`:41`); **plus `0045:151-175` if D15's `/nonogram` `PER_ROUTE_BUDGET` branch fired**. **Do not restate this as "expect N hits."** `grep -rn` counts **lines**, and an annotation that names ADR-0054 twice — which several of these naturally will, once for the amendment and once for the citation — returns more lines than there are rows and reads as a failure. Revision 1 expected one, revision 2 two, revision 3 nine; a bare number is what let all three pass their own check.
- [ ] **ADR-0053 `:229-233`'s annotation names the four image paths explicitly** — `/arquivo/<YYYY-MM-DD>/{binairo,sudoku,nonogram,termo}/opengraph-image` — and the PR body says in words that a future `killed_at` writer built from the un-annotated list would leave a killed puzzle's card serving after its page 404s (RB4).
- [ ] `docs/agents/test-ids.md` frontier re-derived by grep at the end; the extended ranges (`T-WEB-S189…S211`, `T-LINT-S39…S45`) recorded, the three sibling letters (`T-LINT-S8a`, `T-WEB-S206a`, `T-WEB-S192a`) recorded as siblings rather than as range members, with the cross-file reason written out for the last two, and `T-WEB-S210`/`S211` and `T-LINT-S45` recorded as **burned** if unspent.
- [ ] **Two follow-up issues filed, with their numbers in the PR body:**
  1. *"A share button on the archive's late-result panel"* — scope: `src/archive/late-result.tsx`, reusing `src/play/share-text.ts`; it must respect `:73-76`'s deliberate absences and `T-WEB-S183`'s import ban; it must decide what a *late* share may honestly say, given that `outcome` there is *"this session's board judged locally, never the server's stored row"* (`late-result.tsx:86-97`). Labelled `ready-for-agent`, blocked by nothing.
  2. *"OG cards for the archive index, month and day pages"* — `/arquivo/<data>` first, since it is the *"fechei o dia"* share target. Labelled `needs-triage`.
- [ ] Full gate output pasted; pre-commit never bypassed, **evidenced**: `git reflog show feat/34-sharing --format='%gs' | grep -c no-verify` pasted beside the other greps (#31 step-7 finding F27's standard).
- [ ] The merge evidence is **the PR's own `gate` run** — CI is `pull_request`-only since #98 and "CI green on main" no longer exists (napkin Execution item 10). A `cancelled` `gate` means superseded; read the newest run.

---

## 14. Risks, landmines & deviations register

*Empty of implementation deviations at plan time. The implement agent appends every deviation below — the section it deviates from, the cause, which lens or reviewer caught it, and its severity — as one global numbered sequence under dated batch headers. Napkin item 4 binds: a fix that changes a plan statement owes an entry here in the same round.*

**Implementation deviations — Batch A and Batch B, 2026-08-15 (step 5).**

| # | From | To | Cause, and severity |
|---|---|---|---|
| **D1** | §6.1 / §9 `S193`: the literal scan's allowlist is *"an explicit allowlist of structural separators (`"\n"`, `""`, `"/"`, `" · "` if it moves)"* | the allowlist is `"\n"` **plus the record union's two DISCRIMINANTS**, `"termo"` and `"won"` | **Low.** The composer narrows a discriminated union, so `record.game === "termo"` and `record.outcome === "won"` are unavoidable quoted literals in its body and both match the shipped regex. Every alternative that removes them is worse: a keyed dispatch table cannot narrow without a cast, and `"guesses" in record` is a quoted literal too. The plan already draws exactly this distinction one section later — **`S209`'s** allowlist is *"the file's own game token and nothing else"*, on the ground that a `Game` union member is *"an identifier crossing a typed boundary, not copy, and ADR-0018 `:15` is about strings a translator would touch."* Same rule, same two words. `""` never enters the allowlist because the regex needs two or more characters between the quotes and so cannot match it; `"/"` and `" · "` never appear, both being inside `messages.share`. The counted floor is unchanged and still asserts `"\n"` was found. |
| **D2** | §4 D13 / C12: at mobile *"the shipped `.cta` is `min-height: 52px; padding: 0` … and `.share` matches it"*, with `T-WEB-S205` asserting `min-height: 52px` at the mobile rule | `.share`'s mobile rule declares **`min-height: 52px` and nothing else** — the desktop rule's `padding: 14px var(--space-4)` carries through | **Low, and it is C12's own premise that was false.** C12 reasoned that `.cta` *"gets away with"* `padding: 0` at mobile because `min-height` plus centring supplies the vertical box. Measured at I6a with a file-mode `impeccable detect` at 390×844 over the real component and the real stylesheet, it does not: `cramped-padding` (*"0px vertical padding (need ≥4.2px for 14px text)"*) fires on the **baseline** page, before `.share` exists. The URL scan has never seen it for ADR-0034 decision 4's reason — a clean browser profile always reaches the EMPTY conclusion. Copying `padding: 0` would have added a second instance of a live finding; inheriting the desktop inset adds none, and with `box-sizing: border-box` under a 52px floor it is visually inert. **Measured both ways: 2 findings with the share block and 2 without at 390×844, 0 and 0 at 1440×900.** The pre-existing `.cta` finding is NOT fixed here — it is a shipped defect on a screen this ticket does not otherwise own, and #34 is not the ticket that re-tunes the chaining CTA. |
| **D3** | §9's *"Untouched and expected green"* / *"Green but NOT untouched"*, which name **four** widened suites | **five**: `apps/web/test/termo-conclusion.test.tsx` gains two narrowed assertions inside the existing `T-WEB-S96` block | **Medium — a shipped assertion changed, so it is written out rather than absorbed.** `T-WEB-S96` asserted `screen.queryAllByRole("status")).toEqual([])` for a game passing no `outcome`, and used a bare `getByRole("status")` for the outcome announcer. The share button's `aria-live` region is always rendered in both terminal states (D1a's reserved box), so `role="status"` is no longer unique on the conclusion and both assertions broke — the first on a false claim (*"no live region"*), the second on ambiguity. The claim S96 actually makes is about the OUTCOME announcer, and both are re-aimed at `.announcer` by class with #34 named in the comment. **The first is re-aimed with a counted floor rather than merely narrowed**: exactly one `role="status"` element survives and its text is empty, so a future ticket cannot reintroduce a chatty region under this test. Considered and rejected: dropping `role="status"` from the share region and relying on `aria-live` alone would have left the shipped test byte-identical, but it makes the new region semantically weaker than `.announcer`, the repo's own idiom, to avoid editing a test — the tail wagging the dog. |
| **D4** | *(no plan statement — a defect the plan could not have anticipated)* | `isAbortError` contains **no `instanceof`** | **This is the bug `T-WEB-S197` was written to catch, and it caught it.** The first implementation read `error instanceof Object && "name" in error`. Under jsdom `new DOMException("x", "AbortError") instanceof Object` is **`false`** — `DOMException` is constructed in the jsdom window realm and `Object` in the test module is Node's, and `instanceof` is realm-scoped. The predicate therefore returned `false` for every dismissal, routing it into the clipboard and announcing *"Resultado copiado."* for a share the player had just cancelled — landmine 5's exact failure mode, arrived at from the opposite direction. Replaced with `typeof error === "object" && error !== null && "name" in error && error.name === "AbortError"`, which is realm-independent. The measurement is in the function's own doc block, because the next reader's instinct will be to "tidy" it back into an `instanceof`. |

**Deviations from the design references, taken at plan time and recorded here so they are not rediscovered:**

| # | From | To | Why |
|---|---|---|---|
| **V1** | f5's ink-filled *"Compartilhar resultado"* / f6's *"Compartilhar"* | one paper-treatment button labelled *"Compartilhar"* at both viewports | decision 13 — the shipped conclusion already gave the ink treatment to the chaining CTA; two primaries on one screen, and two strings for one control |
| **V2** | Fernando's reference sketch `14/08` | `formatShortDate(date)` → `14 ago` | reuses the shipped formatter (`format.ts:78`); pt-BR-native; no new date arithmetic and no host-timezone hazard |
| **V3** | the sketch's bare `miolos.app/...` | the full `https://` URL | chat clients autolink a scheme reliably and a bare host inconsistently |
| **V4** | `DESIGN.md:13`'s dot-textured desk, as a repeating `radial-gradient` | the same texture, painted as **`ceil(w/72) × ceil(h/72)` = 153 explicit `borderRadius` elements** on a 72px lattice | **Rewritten a second time, because revision 2's replacement premise was also false** (RB5). The texture ships; only the mechanism deviates, and **the gradient is available** — as long as its colour stops are percentages. Satori resolves a **px** stop as `value / elementWidth` of the gradient's radius, so `3px` inside a `background-size: 72px 72px` tile on a 1200-wide element becomes a 0.13px radius **at every output size** (18-size sweep, 400×300 → 2400×1260: px stops 0 saturated pixels everywhere, percentage stops 768 → 18,480 scaling with area). It is stop-unit-coupled, not size-coupled. **The lattice ships for SPEED**: median **48.3 / 50.5 ms** against the percentage gradient's **74.2 / 80.4 ms** over two runs of 20 interleaved iterations, ~26 ms per card on an uncacheable route — and it states the 3px radius in px rather than as a 5.893 % figure re-derived from the tile diagonal. **The colour argument is deleted**: both paths land 1.41/255 from the browser's measured `234,229,221` and paint 32 pixels per dot. It is a tie, and revision 2's comparison was against the broken px-stop render |
| **V5** | `DESIGN.md:26`'s Fraunces italic as the app's voice | no italic face on the card | decision 12 — satori synthesises no oblique, so an italic line would render silently upright; the face is added the day a card wants one |
| **V6** | `DESIGN.md:36`'s `N = 3–6` hard shadow, and f5/f6's absolute px | every absolute length is the **f6 mobile frame's value × 3** — shadow `15px`, border `3px`, radius `18px`, tape `174×57`, dot tile `72px` | An OG card is read at ~⅓ scale in a chat bubble, so the reference is the **mobile** frame at ×3, not the desktop frame. At display scale the shadow is 5px and the radius 6px — **inside** `DESIGN.md`'s ranges rather than outside them. One rule, applied to every length, checkable against the table in §7.2 |
| **V7** | `f5:69-70` / `f6:61-62`'s share-and-statistics **row** (`flex:1` each), and f6's mobile ladder (primary 52px **with** shadow, secondary 48px **without**) | `.share` stacks full-width; it carries a shadow at **both** viewports and `min-height: 52px` at mobile | (a) The shipped conclusion turned `Ver estatísticas` into a text link with a rule, so the two-button row no longer exists to slot into. (b) `.share` is not f6's secondary — it is a **third** level whose paper-plus-shadow *is* its emphasis. Recorded rather than argued away (D7-design) |
| **V8** | `tokens.css:25-26`'s Fraunces **550** display weight | **Fraunces 500** on the card | `css2` cannot serve a 550 static instance — `wght@550` returns two faces declaring 500 and 600; `wght@550..550` is `400: Invalid selector` (probed, batch 1 B11). 500 and 600 are equidistant from 550 and the **lighter** side is the editorial one on a display serif; `DESIGN.md:26` puts the family's band at 450–600, so 500 is inside it. −50 from the app, on a surface with no adjacent app type to compare against |
| **V9** | the app's **continuous** `opsz` (`layout.tsx:12-18`, `axes: ["opsz"]`, `font-optical-sizing: auto` → opsz = font-size in px) | **one static instance, `opsz,wght@36,500`**, chosen against the card's DISPLAY sizes rather than its authoring pixels | **New at revision 3 (RB1); its numbers and its argument REPLACED at revision 4 (T1), the destination unchanged.** §7.2a states the criterion first — minimise the deviation of the hero run (the game name) from the browser's own `font-optical-sizing: auto` at the size it is read, the wordmark held inside 2.5 % — and then reports every delta against that one reference, the browser's `auto` at the **display** sizes (32 px name, 13 px wordmark). On it the 36 pt cut is **−0.23 %** at the name (0.38 px across the whole word) and **−2.22 %** at the wordmark (0.92 px). Revision 3's three headline figures each used a different frame and are retired: opsz96 is **−16.48 %** at the wordmark against the browser, not "14.1 % off"; the silent default is **+1.85 %** at the name in this frame, not "18.9 % wide", a figure that belonged to the author-pixel frame this deviation exists to reject. Honest alternatives, named rather than omitted: a worst-case-percentage criterion picks **24 pt** (1.05 %) and a worst-case-displayed-pixel criterion picks **28 pt** by 0.08 px; all three are imperceptible, all three are 71,648 B, and the hero weighting is what selects 36. Residual, stated because a static instance is one point on a continuous axis: viewed 1:1 the name is **+16.59 %** wider than the app's `auto` at 96 px — a size the app does not have (`--text-screen-title` tops out at 54 px). One face, not two: a second Fraunces costs **+71,648 B (+42 %)** to buy back 2.22 % on the secondary run |
| **V10** | f6's card width × 3 = **1062**, and revision 2's **−1.2 deg** rotation | **1040 wide**, **−0.5 deg** | **New at revision 3 (RD6).** Two of the ×3 table's rows had no derivation. 1040 is the largest 4pt width leaving a whole-number 80px desk margin (1062 leaves 69 and is off the grid), 2 % under the ×3 value. **An angle is not a length**: −1.2 deg would read as visibly more tilted than the frame the rule exists to reproduce, so the card takes f6's −0.5 deg unchanged. The wordmark's 36px, which had no source at all, becomes **39px**, the card's existing secondary type level |

**Landmines, specific to this work.**

1. **Satori requires `display: flex` on any element with more than one child.** A plain `<div>` with two children throws at render, and jsdom will not catch it — which is why `T-WEB-S202` rasterises the real tree.
2. **A variable font is a 500, not a fallback.** `font.names` is never assigned in the bundle, so any font with an `fvar` table throws `TypeError: Cannot read properties of undefined`. Never commit `Fraunces[SOFT,WONK,opsz,wght].ttf`.
3. **Satori synthesises no weight, no italic AND NO OPTICAL SIZE.** A missing weight or style renders byte-identically to the nearest registered face, silently, and `T-WEB-S202`'s render-twice arm is the only thing that catches it. **The optical case is worse: there is no missing-face signal at all** — a wrong `opsz` cut simply draws different letterforms, and the three TTF-table assertions revision 2 added (`fvar` absent, family, `usWeightClass`) pass identically on every Fraunces cut. S202's nameID-16 + `xAvgCharWidth` arm is what sees it (§7.2a). Use exactly the three shipped faces.
4. **`ImageResponse` fails under jsdom.** `// @vitest-environment node` on any file that rasterises.
5. **`navigator.share` rejects with `AbortError` when the user dismisses the sheet** — and with `NotAllowedError`, `DataError` or `TypeError` for real failures. Abort renders nothing; **everything else falls through to the clipboard** (D4). Silent failure on a non-Abort rejection is the second classic bug in this feature.
6. **Feature-detect at click time, not at render time** — `typeof navigator.share` during render is a hydration mismatch.
7. **`navigator.clipboard` is a read-only accessor in jsdom.** `Object.defineProperty`, and restore in `afterEach`.
8. **`og:locale` is `pt_BR` with an underscore; `<html lang>` is `pt-BR` with a hyphen.** Do not share the constant.
9. **A leaf `openGraph` REPLACES the root's — it does not merge.** Every leaf must spread `OG_DEFAULTS` or it silently loses `og:type`, `og:locale` and `og:site_name` (D11, verified). *(This replaces revision 1's landmine 9, which was false: `archive-metadata.test.ts` imports only the index, month and day routes and cannot red on a per-game change — B6.)*
10. **`next-config.test.ts:8` asserts `headers()` returns exactly one rule.** Do not add a header rule for the PNGs; the cache-control header rides in the `ImageResponse` options instead (D8/H3), which is why no config change is needed.
11. **`FORBIDDEN_EVERYWHERE` (`route-client-js.mjs:285`) scans every client chunk for `então`, `mamãe`, `época`.** A new pt-BR share string containing one fails `bundle-check`, which is not in CI and will therefore be found late.
12. **Adding strings to `messages.ts` grows `/`,** which shifts every route's measured *delta* without failing anything. Publish `/`'s absolute figure (napkin Domain item 3).
13. **`rm -rf apps/web/.next` deletes the bundle stats.** `pnpm build` in `apps/web` first, and run `bundle-check` **from `apps/web`** — from the root it exits 0 silently.
14. **The 307 on today's permalink still ships a full `<head>`,** so the archive image route *must* resolve for today — which `getPublishedDaily`'s predicate does structurally, with no branch (D8/H2). It also means the **daily** route's card is what the redirect-following majority sees, which is why all eight are dated (D7/B1).
15. **The Termo answer is one field away from the composer** (`play-record.ts:341`, present exactly when `concluded`). So is the Nonogram bitmap (`:176-185`), **and the Nonogram picture is derivable from the published clues in under a millisecond** by `solveNonogram` (ADR-0033 decision 2) — reachable from an OG route today with zero lint hits. `T-WEB-S190`, `T-WEB-S201` and the OG wall (`T-LINT-S41`/`S42`) are the guards.
16. **`process.cwd()` on Vercel is an assumption until the preview proves it — and it is the ONLY one left.** The trace itself is provable locally from Turbopack's `.nft.json` at I24. **There is no `outputFileTracingIncludes` escape hatch**: it is a no-op under Turbopack (H4). A 500 on the card route is what a failure looks like, and the fallback is decision 14's cut-the-OG-half.
17. **Read the fonts once at module scope, as `export const FONTS` with top-level await.** A throw there fails the **whole build**, not one route — the correct failure mode, and the reason the digests are asserted in the suite too.
18. **`TURBO_CONCURRENCY=1` on every commit**, and pre-commit runs `lint-staged` (prettier only) → `typecheck` → `test`. **`eslint` is NOT in pre-commit** (`.husky/pre-commit`, `package.json:33-35`), so an eslint-red tree commits cleanly and surfaces only at a gate step. Revision 1's *"every commit green on its own"* is true of types and tests, not lint — which is why `pnpm lint` is on every batch gate — I5, I11, I24, I31, **I34a and I41a** (Q12, RQ9). Batch C's I16 gate is gone with Batch C (RC10).
19. **The known `packages/games` Binairo determinism flake** (`test/binairo/generate.test.ts > P2 — determinism`, 5165 ms against vitest's 5000 ms default in CI run `31846743499`). Diagnose as unrelated, then `gh run rerun <id> --failed`.
20. **A metadata route is not a page.** Do not add one to `impeccable.yml`, `route-ssr.test.tsx`, `sitemap.ts` or `route-client-js.mjs`.
21. **The card's warm render is ~50–70 ms, not ~10–14 ms.** Revision 1's figure was measured on a bare tree; the real card carries **153** texture dots, a tape, four text runs and three faces. Re-measured across six fresh processes: cold **213–228 ms**, warm median **48–55 ms**. Use the real numbers in the PR body and in what #37 inherits, and do not reintroduce revision 2's "cold 126.5 ms", which nothing reproduces.
22. **A `getPublishedDaily`/`getTodayDaily` failure is a THROW, not `undefined` — and the two kinds of throw must NOT get the same answer.** Unlike `getArchivedDaily`, those two deliberately throw on an unparseable row (`published.ts:236-243`), which on a crawler-facing image route would be a 500 where the sibling page 404s. **But `getArchivedDaily`'s catch wraps only `stripDailyContent`, not the query** (`:250-266`), and its doc block argues 404-over-500 about a **bad row**, not an outage. A broad catch turns a Neon timeout into a 404 that social scrapers negative-cache for days. So the handlers catch **by error name** (`ZodError`, `DailyProjectionUnsupportedError`) → log + 404, and **re-throw everything else** → 500 (D8, `T-WEB-S203`).
23. **A `background` SHORTHAND drops the gradient in satori** as soon as it also carries a colour or a `/ <size>` — measured, 0 non-background pixels. Use separate `backgroundColor` + `backgroundImage` + `backgroundSize`. And a **px** colour stop inside a tiled radial gradient is resolved as `value / elementWidth` of the radius, so it renders nothing at any size; percentage stops work everywhere (V4).
24. **`name` ID 16 is elided on a RIBBI regular.** `InstrumentSans-400.ttf` has no Typographic Family record at all, so a loop asserting `nameID16 === family` across the three faces is red on one of three (and red on two of three if read as ID 1). Assert §7.2a's table per face, literally (RC4).
25. **`css2` quantises `opsz` into eighteen buckets and serves an off-bucket request silently.** The set, enumerated integer by integer over 9…144 (§7.2a): `9, 10, 11, 12, 13, 16, 17, 18, 20, 24, 28, 36, 48, 60, 72, 96, 120, 144`, each serving every value up to the next. So `@27` returns `Fraunces 24pt Medium` with no error, `@30` and `@32` return the **28 pt** file, 84 and 90 the 72 pt file; out of range (below 9, above 144) returns an HTTP error page rather than CSS. **And a one-bucket miss is invisible to every check but two:** the 24, 28 and 36 pt cuts are **71,648 B each**, with the same `fvar` absence, the same family and the same `usWeightClass`. Request an exact bucket, and assert `name` ID 16 and `xAvgCharWidth` on what came back. **Do not recall this list — re-enumerate it**; two revisions of this plan quoted a made-up subset and reasoned about neighbours from it.

**Watch items, handed forward rather than solved here:**

- **#37** inherits the p95 instrumentation for ADR-0053 decision 2's caching trigger, now over a **doubled** uncached surface (eight routes, not four), plus the ~215 ms cold / **~50–70 ms warm** rasterisation figure, plus — explicitly, not as a p95 side effect — the **denial-of-wallet abuse item** S5 names: an unauthenticated, never-cacheable, CPU-bound path with one Neon read per request.
- **The `revalidatePath`-on-`killed_at` writer** is still unwritten and is still the precondition on any TTL in this family. #34 raises its value; ADR-0053 decision 2 owns it; no issue is filed here, because filing a third follow-up for a precondition an ADR already carries is noise.
- **The two follow-ups in §13** are filed as part of this ticket's exit.

---

### Batch 1 — 2026-08-14, step-4 fix over step 3's six lenses (66 findings)

Every finding, with its disposition. **Three are dismissed, each with a reason and evidence**; everything else is fixed. Section references are to this revision.

**Blockers**

| Id | Disposition |
|---|---|
| **B1** (AC 2 unmet on the dominant path) | **FIXED** — option (a). All eight game cards dated and dynamic. F4 rewritten with the corrected trade; D7's two card kinds collapse to one; I5 dissolves; AC 2 is MET (§2, D6, D7, §13). |
| **B2** (ADR-0028 D5 owed a "Grown at #34") | **FIXED** — §11.2's verdict flips to ANNOTATED, naming all **eight** routes; I36a added; §13's exit grep expects two hits. |
| **B3** (Nonogram picture derivable; "impossible" forbidden by ADR-0033 D2) | **FIXED** — D8(a) restated in ADR-0033's own words (product decision, derivable in <1 ms); a standing OG wall bans `@miolos/games` from `src/og/**` and `app/**/opengraph-image.tsx`, both halves, with `T-LINT-S41`/`S42` probes. |
| **B4** (a leaf `openGraph` replaces the root's) | **FIXED** — `OG_DEFAULTS` spread into all nine declarations (D11). **Verified**: `/jogo` loses `og:type`/`og:locale`/`og:site_name`; `/ogdefaults` keeps all three. S198/S199 re-aimed at a leaf. |
| **B5** (`T-WEB-S201` cannot fail) | **FIXED** — S201 re-aimed at a source scan of the eight routes and two handlers; the sentinel assertion moves into S203 at the route (§9). |
| **B6** (`T-WEB-S173` does not cover the four routes D10 changes) | **FIXED** — verified: `archive-metadata.test.ts:38-40` imports only index/month/day, and no test in the repo calls the four per-game `generateMetadata`s. Landmine 9 deleted, I28 deleted, `T-WEB-S207` spent on them, `T-WEB-S173` left untouched. |
| **B7** (seven absence assertions with no anti-vacuity twin) | **FIXED** — S191's streak/medal/solved half becomes a module-graph scan with its own non-vacuity twin; numeric absences get fixtures that can red (Nonogram `size: 15` with no `15` in the elapsed; a distinctive Sudoku tier); S190 gains a fixture-was-read counter-assertion. |
| **B8** (contract comment naming a non-existent consumer) | **FIXED** — the docblock's *"…the archive's late-result panel"* clause is deleted; the placement argument moves to §6.1 prose and the PR body. |
| **B9** (the texture is dropped on a false premise) | **CONCLUSION ADOPTED — the texture ships. THIS ROW'S OWN EXPLANATION WAS WRONG TWICE AND IS SUPERSEDED BY BATCH 2 (RB5).** Revision 1 said satori cannot do repeating radial gradients; revision 2 said it renders at some output sizes and not at 1200×630, *"non-monotonically"*. **Both are false.** The construct works at every size **with percentage colour stops**; a **px** stop is resolved as `value / elementWidth` of the gradient radius and therefore collapses to sub-pixel at every size. Revision 2's probe used px stops throughout, which is why it read as size-coupled. The texture ships as **153** explicit lattice elements — not 120 — and the reason is **speed** (48–50 ms vs 74–80 ms median), not availability and not colour fidelity, which is a tie. See §7.2 and V4; do not carry this row's reasoning forward. |
| **B10** (the card has no type scale) | **FIXED** — §7.2 carries the ×3-from-f6 derivation rule and a full table: card 1040×460, padding 72, kicker 33/ls .16em, name 96 Fraunces 500, date 39, wordmark 36, shadow 15, tape 174×57, dot tile 72. Rendered before being written down. S200 asserts the kicker tracking is inside 0.14–0.16em. |
| **B11** (Fraunces 600 is not the app's weight) | **FIXED** — probed at the `css2` endpoint: **550 cannot be served** (`wght@550` → two faces at 500 and 600; `wght@550..550` → `400: Invalid selector`). Takes **500**; both candidates verified `fvar=false` with correct `usWeightClass`. Recorded as V8. |
| **B12** (no disabled state, no focus ring) | **FIXED** — `.share:disabled`, `.share:focus-visible`, `cursor: pointer` specified against `hub-attach.module.css:170-177` / `privacidade/page.module.css:178-186`; all three in S205. Verified `grep -c "<button" conclusion-view.tsx` = 0, so this really is the sheet's first native button, and `:35-36`'s "no focus ring at all" joins §11.4's sweep. |

**High**

| Id | Disposition |
|---|---|
| **H1** (the SEO denial covers `og:` but the plan ships `description`) | **FIXED, stronger than the reviewer's option (a).** The daily pages get `openGraph` and **no page-level `title`/`description` at all`**. Verified on a Turbopack build: `og:title`/`og:description` render from the leaf while `<title>` and `<meta name="description">` stay the root's, byte-unchanged. No annotation owed on ADR-0028 `:36-38` **or** ADR-0053 `:977` — and the latter is now audited, which revision 1 never did. |
| **H2** (three-read midnight race) | **FIXED** — `getPublishedDaily` for the archive four. The reviewer's reasoning was checked at source before being adopted: `buffer.ts:106` writes `publishedAt` as the date's own SP midnight into a `timestamptz` (`schema.ts:201`, comment at `:188`), so `published_at <= now()` **is** "date ≤ today (SP)". The daily four use `getTodayDaily` — no date parameter exists to pass — which is the identical call `app/sudoku/page.tsx:13` makes; that adjustment is stated in D8 rather than glossed. |
| **H3** (the PNG's cache posture is weaker than every other read path) | **FIXED** — `headers: { "cache-control": "private, no-cache…" }` in the `ImageResponse` options. **Verified on a real `opengraph-image.tsx` metadata route in a Turbopack production build**, not just on a plain `route.ts`: with the option the emitted header is `private, no-cache, no-store, max-age=0, must-revalidate`; without it, `public, max-age=0, must-revalidate`. No `next.config.ts` change; landmine 10 intact. Asserted in S203 and in §13's `curl`. |
| **H4** (nft evidence is for a path that never runs; the escape hatch is a no-op) | **FIXED** — finding 6 re-grounded on **Turbopack's** tracer, with the `.nft.json` font entries pasted; the check moves to **I24, locally**. §1 exception (iii) and D12's escape-hatch sentence are **deleted**, and D14's cut-the-OG-half becomes the sole fallback. |

**Medium**

| Id | Disposition |
|---|---|
| **A3** (AC 3 covers the image, not `og:title`) | **FIXED** — stated in D8, in §13's AC 3 line, and as a row in S203's branch table. |
| **A4** (the card has no mechanical visual gate) | **FIXED** — I20a runs `impeccable detect` in **file mode** over `siteCard()` and one `gameCard()` at 1200×630; §13 pastes it. Screenshots stay as evidence, not as the gate. |
| **A5** (`<hoje>` computed in a shell) | **FIXED** — §13 requires it **discovered from the app**, quoting ADR-0053 D12 `:606,613-616`. |
| **A8/C11/D5** (10px shadow outside N=3–6, unregistered) | **FIXED** — replaced by the ×3 medium rule with a measured derivation (f6's 5px × 3 = 15px, which is 5px at display scale, inside the range). Registered as **V6**. The reviewers' note that the 1440px frames still use 3–6px is what led to using the **mobile** frame as the reference instead of scaling the desktop one. |
| **D6-design** (D13's rationale misstates f5) | **FIXED** — verified `f5:66` is accent-filled and `:69` is ink-filled, stacked. The false argument is deleted and replaced with the true one (the shipped conclusion has no two-button row to slot into). |
| **D7-design** (two unrecorded frame deviations) | **FIXED** — registered as **V7** (the dropped pairing; the flattened mobile ladder). |
| **D9-design** (the `aria-live` region reflows) | **FIXED** — the status line reserves a fixed `min-height`; asserted in S205. |
| **D10-design** (mobile budget never measured pre-implementation) | **FIXED** — **I6a** measures 390×844 headroom on the worst state before I7. |
| **D11-design** (the emoji argument stops short of a rule) | **FIXED** — **`T-WEB-S208`** scans `apps/web`'s `.tsx` and `.css` for `\p{Extended_Pictographic}` and asserts zero. Verified currently clean (0 files). |
| **S5** (denial of wallet) | **FIXED as disclosure** — named in D9 with the CPU figure and the words *"unauthenticated"* and *"denial of wallet"*; #37 gets an explicit abuse item. Nothing in scope can mitigate it, and the plan says so. |
| **S6** (font binaries have no provenance) | **FIXED** — `assets/fonts/SHA256SUMS` with URL, UA and fetch date per face; digests asserted in S202. |
| **Q5** (`T-WEB-S202` does not prove Fraunces-not-Geist) | **FIXED** — S202 gains a direct TTF table read (`fvar` absent, family name, `usWeightClass`). |
| **D4-design** (the free version of the same gate) | **FIXED** — S202 renders the tree twice, with and without the Fraunces face, and asserts the bytes differ. |
| **Q6/C11** (S200's tie-back is unwritable) | **FIXED** — 8-digit hex (`#2E4E7E38`), test asserts the leading seven characters are in `tokens.css`. **Verified** satori renders `#2E4E7E40` identically to `rgba(46,78,126,0.25)`. |
| **Q7** (nine near-duplicate files with no drift pin) | **FIXED** — two shared handlers in `src/og/handlers.ts`; S203 becomes an `it.each` over four games × two families; S204 adds the source-normalisation assertion. |
| **Q8** (TDD named at one seam of four) | **FIXED** — S203 is test-first against a stub handler inside I22; S202 and S205 are declared deliberately test-after. |
| **Q12** (dead code at I15; eslint not in pre-commit) | **FIXED** — I15 moves into Batch D beside its importers; `pnpm lint` joins the I5, I16 and I24 gates; landmine 18 corrected. |
| **C4** (webpack loader cited for a Turbopack build) | **FIXED** — D8 and D9 now cite the empirical Turbopack results; the loader citations are gone. |
| **C5** (an exit criterion already false on `main`) | **FIXED** — verified 16 hits with revision 1's grep and **0** with `grep -rnE "^export const revalidate\|generateStaticParams *\("`; §13 uses the code grep. |
| **C6** (`T-WEB-S193` reds on `"\n"`) | **FIXED** — verified the shipped regex is `/(["'])(?:(?!\1).){2,}\1/g` and `"\n"` is two source characters. S193 is scoped to user-visible text with an explicit separator allowlist, decided now because I3 is TDD-first. |
| **C7** (`T-WEB-S192` scheduled before its subject) | **FIXED** — split: source scan at I3, `url ===` half at I9. |
| **C8** (`/nonogram` headroom is a guess with no remedy branch) | **FIXED** — I6a measures a proxy before anything is committed; D15 writes the three-step remedy branch, with `MAX_DELTA_BYTES` untouchable in all of them. |
| **Q10/C9** (`fonts.ts` in two call shapes) | **FIXED** — `export const FONTS`, top-level await, one shape for all nine routes; the whole-build blast radius stated. |
| **I3/S9** (non-Abort rejection unspecified) | **FIXED** — three-armed handler; S197 widened. |
| **I4** (the root site card is unrequested scope) | **FIXED as a declaration** — kept, because F8 leans on it and because a site-wide card is what makes `/privacidade`, `/estatisticas` and `/modo-livre*` shareable at all, but §2's F8 row and the PR body now say **in scope-terms rather than cheapness-terms** that it is deliberately beyond AC 2. *(The four daily routes' metadata and the root-layout defaults are **not** in this category — they are load-bearing for AC 2/AC 4 via Trap A.)* |
| **I1** (AC 1's partial delivery stated only inside the plan) | **FIXED** — §2 and §13 require the eight flags verbatim in the PR body and as a comment on #34 before step 8. |

**Low**

| Id | Disposition |
|---|---|
| **A6/I6** (prop count six vs seven) | **FIXED** — seven, per `conclusion-view.tsx:90-105`. |
| **A7** (ADR-0028 cited at `:28-30`, five times) | **FIXED** — verified the sentence is at `:36-38`; all five citations corrected, and `sitemap.ts:35`'s inherited off-by-eight joins §11.4. |
| **A9** (a button label in CONTEXT.md's pt-BR column; elided ADR links) | **FIXED** — `—`, real paths, and the reason stated. |
| **S4** (the Termo grid does narrow the answer) | **FIXED as a claim change** — §12 records the measured bound (median 77/400 for one grid under consistent-play assumptions, min 4, worst observed 18; two grids median 19) and forbids ADR-0054 from recording *"spoiler-free by construction"* as an absolute. The design does not change. |
| **S7** (the OFL argument's premise is wrong) | **FIXED** — the "unmodified"/"clause 3 grey area" reasoning is deleted; replaced with the verified fact that **neither family declares a Reserved Font Name**, so clause 3 never bites and clause 2 is the whole obligation. |
| **S8** (the composer takes `answer`; one fixture guards it) | **FIXED** — S190 becomes a property test over all 400 canonicals. The narrower seam was considered and declined with a reason (§6.1). |
| **S10** (`absoluteUrl` carries the preview origin) | **FIXED** — §10 and §13 require the origin pasted beside the string. |
| **Q11** (S206's Termo clause is unfalsifiable) | **FIXED** — replaced with an import assertion on `share-text.ts` and `messages.ts`. |
| **Q13** (S198 has no mock plan for `server-only`) | **FIXED** — §9 names `vi.mock("../src/db")` + `vi.mock("@miolos/db")` and why. |
| **Q14** (the pragma's "verified" has nothing pasted) | **FIXED** — I23 pastes the run; §9 names `vitest.config.ts:8`'s all-environment `setupFiles` as the reason to prove it rather than assert it. |
| **Q15** (no fifth-game checklist) | **FIXED** — S204 asserts a route file in each family and a resolving `messages.og.altGame` for every member of `DAY_GAMES`. |
| **Q16** (S205 splits one sheet's gate across two files) | **FIXED** — S205 moves into `conclusion-view.test.tsx`; I11's "green untouched" criterion is corrected. |
| **C10** (dangling §3.3/§4.5 refs; the four daily strings never written) | **FIXED** — refs corrected; the strings written out in §7.4 as `messages.og`. |
| **C12** (S205 and D13 disagree about mobile padding) | **FIXED** — the padding assertion binds at the **desktop** rule; `min-height: 52px` at mobile, matching the shipped `.cta`. |
| **D12-design** (the site card is under-specified; "four tapes" invented) | **FIXED** — one tape in `--accent-app` `#9E3B2F` with a matching shadow, and the full stack specified in §7.2. |
| **D13-design** (no longest-content case) | **FIXED** — a longest-content raster case is specified and the vertical arithmetic is written out in §7.2. *(Revision 2 picked setembro on a false "maxes at 22 characters" claim; revision 3 corrects it to fevereiro, 23 — batch 2, RD5.)* |

**Dismissed, with reasons**

| Id | Reason |
|---|---|
| **B9's mechanism** (ship `--texture-dots` as the repeating gradient) | **Superseded by batch 2 (RB5) — the stated reason was false.** The gradient *is* available with percentage stops and matches the browser's dot colour exactly as well as the lattice does. The mechanism is still replaced, on a measured ~26 ms/card saving and on stating the 3 px radius in px rather than as a re-derived percentage. |
| **D11's `twitter-image.tsx` contingency** (revision 1's own, flagged by the review as unnecessary) | Deleted. `twitter:image`, `:alt`, `:type`, `:width` and `:height` are emitted automatically from the `opengraph-image` file convention — verified. Keeping a contingency for a case that cannot arise is dead scope. |
| **Revision 1's `outputFileTracingIncludes` escape hatch** | Deleted (H4). It is read only inside `collect-build-traces`, which is gated off under Turbopack; adding an entry provably changes nothing. Retaining it would leave a fallback that cannot fire in the plan's §1, D12 and D14. |

---

### Batch 2 — 2026-08-14, step-4 fix over step 3 round 2's four lenses (~45 findings, eleven blocking)

Round 1's table above is preserved unchanged. Every round-2 finding below, with its disposition. **Three are dismissed, each with a reason and evidence; one reviewer sub-claim is refuted by re-measurement.** Section references are to this revision.

**Blockers**

| Id | Disposition |
|---|---|
| **RB1** (the committed Fraunces face is the wrong optical cut, and the font gate cannot see it) | **FIXED, and the instance is neither of the two offered.** New §7.2a derives it: `font-optical-sizing: auto` sets opsz = font-size **in px** (measured in Chrome 149: `auto@96 == opsz96` to 0.00px, `auto@36 == opsz36`), and V6's ×3 rule fixes the reader's scale at ⅓, so the cut must be chosen against the **display** sizes — 32px name, 13px wordmark — not against the authoring pixels. The card commits **`opsz,wght@36,500`**, within **2.2 %** of the browser at both sizes; opsz96 is 14.1 % off at the wordmark and the shipped default (silently the 14pt text cut) is 18.9 % off at the name. **One instance, not two** — the second would cost +71,648 B (+42 %) to buy back 2.2 %. `T-WEB-S202` gains `name` ID 1/ID 16 per face and `OS/2.xAvgCharWidth === 1148`, both verified distinct across all four candidate cuts; `STAT` was evaluated as a discriminator and **rejected** (Google's instancer keeps an opsz `AxisValue` only at a STAT nominal, so only the 144pt cut carries one). Filename carries the cut; `SHA256SUMS` carries the URL with its `opsz` term; V9 records the residual; landmines 3, 24 and 25 record the traps. |
| **RB2** (the OG wall silently deletes the db wall for the eight routes that read the database) | **FIXED, and the failure was reproduced before it was fixed.** Measured against the real config with a naive OG object at `apps/web/app/opengraph-image.tsx`: **all eight** db-wall probes that red today go clean, `pnpm lint` green. D15 now writes the object out in full in the `:526-555` shape, names its position (object (4), after (1)–(3), non-overlapping with the free-play globs), and spends **`T-LINT-S43`** (replacement regression, with the app-wide message asserted), **`T-LINT-S44`** (glob reach — verified against this repo's eslint 10.8.0 that `apps/web/app/**/opengraph-image.tsx` **does** match the root card) and the sibling **`T-LINT-S8a`** (the wall asserted from inside `apps/web/src/og/**`, `T-LINT-S8`'s own claim). The `describe`-carries-no-id rule is stated. The exit grep's own glob is corrected too. |
| **RB3** (four `force-dynamic` enumerations become false; §11.2 audits none) | **FIXED — and the audit was re-derived from scratch rather than patched.** All four confirmed against the source and counted: ADR-0028 `:91-98` (two → three per daily slug), `:179-192` (the fifth-game recipe, two → three, and #31's archive one → two), ADR-0053 `:209-210` (nine archive route modules → thirteen). §11.2(iv) is now a ten-row checklist and §13 checks **rows**, not a number. |
| **RB4** (the `revalidatePath` path list is incomplete, and it is a live kill-switch hole) | **FIXED, and promoted.** ADR-0053 `:229-233`'s annotation names the four `/arquivo/<YYYY-MM-DD>/<jogo>/opengraph-image` patterns explicitly, and §13 makes the PR body say in words what a writer built from the un-annotated list would fail to invalidate. Also stated: the daily cards belong to ADR-0028 decision 4's family and the index/month/day pages inherit the root card, so the list is complete rather than merely longer. |
| **RB5** (V4's replacement premise is false too) | **FIXED, and independently re-measured. The reviewer's cause is confirmed; one of its sub-claims is REFUTED.** Confirmed: the failure is **stop-unit-coupled**, not size-coupled — over an 18-size sweep, px stops yield 0 saturated pixels at every size and percentage stops work at every size. Mechanism read out of the bundle and verified by prediction: a px stop resolves as `value / elementWidth` of the gradient's radius, and a stop *compensated* to `70.71px` renders identically to the percentage form at 1200×630 and breaks at 600×315. **Refuted:** *"the gradient is the more faithful path"* — at the token's real alpha both land **1.41/255** from the browser's `234,229,221` and both paint 32 pixels per dot. It is a tie, so the colour argument is deleted from V4 rather than inverted. The lattice ships on **48–50 ms vs 74–80 ms**, and V4, the landmine and the batch-1 dismissal row all say so. |
| **RB6** (S191's "no Sudoku tier" fixture is unconstructible) | **FIXED, by changing the mechanism rather than the fixture.** Confirmed at source: `sudokuPlayRecordSchema` (`play-record.ts:106-118`) is a `z.strictObject` with no `tier`. The exclusion is now guarded by a **key-set assertion** over each record member's `.shape` (verified that `.shape` survives `.superRefine` on zod 4.4.3), which reds the day a later ticket adds a field to the record — which is the only way this exclusion can ever actually be violated. D3 states the two mechanisms separately. |
| **RB7** (S191's "no hint count" has no fixture and cannot get one) | **FIXED — the differential mechanism adopted wholesale.** For every excluded field that IS on the record, two records differing in exactly that field must produce **byte-identical** output: `hintsUsed` 0/1 (all four games), `syncOutcome` across all three values, the solved `grid` present/absent, and nonogram `size: 5`/`15`. S190 gains the same treatment for `answer`, which is strictly stronger than the 400-canonical substring scan. §6.1's docblock claim is corrected in the same round: three mechanisms, named, not *"each of these has a test"*. |
| **RB8** (the module-graph scan is blind to the channel the streak would arrive through) | **FIXED** — `T-WEB-S191`(d), a source assertion that `buildShareText`'s second parameter type declares exactly one member; the module-graph scan is kept for the medals/stats/day-strip half, where the regression would be an import. D3's streak bullet states the reasoning. |
| **RB9** (S208 has no anti-vacuity twin and collides with #34's own tests) | **FIXED, all three parts** — scoped to `apps/web/src/**` + `apps/web/app/**` (which also frees the test files to hold a literal 🟩), the scope written in §9 rather than left to I20, and a twin asserting the walk read `conclusion-view.tsx` and found `ConclusionView` in it. Re-verified clean at that scope: **85 files, 0 hits**. |
| **RB10** (Batch A cannot be green) | **FIXED** — `S206` keeps the `messages.share` half at I3 (Batch A) and the sibling **`S206a`** takes the `messages.og` half to I28 (Batch E), after `messages.og` lands at I19. §9 adds a paragraph stating the batch rule and re-checking every other id against it; `S201`'s write moves to I23 for the same reason, intra-batch. |
| **RB11** (the catch swallows transient database failures) | **FIXED by narrowing, not by arguing.** `getArchivedDaily`'s catch wraps only `stripDailyContent` (`published.ts:250-266`), and `:236-243` argues 404-over-500 about a bad row, so the plan stops citing it for the outage case. The handlers now match on `error.name ∈ {ZodError, DailyProjectionUnsupportedError}` → log + 404 and **re-throw everything else** → 500. The name check is not a shortcut: `DailyProjectionUnsupportedError` is on the app-wide wall's banned-import list and a cross-package `instanceof ZodError` is an identity assumption — verified that both packages resolve the same physical zod@4.4.3 today, so the check fails **closed** if that ever changes. `T-WEB-S203` gains four throw rows, including one pinning that a card-builder throw **propagates**, which is what stops a later edit widening the `try` (RQ7). |

**High**

| Id | Disposition |
|---|---|
| **RA4** (the byte-unchanged claim is narrower than "airtight", and ADR-0014 `:12` classifies OG generation as SEO surface) | **FIXED as a record change; no design changes.** §11.2 now states both halves: the mechanism holds, the coverage does not reach og:title-as-SERP-fallback on a generically-titled page. ADR-0028 `:34-39` and ADR-0053 `:974-978` take *"(Qualified at #34)"* annotations naming that mechanism; the plan stops citing `0014:12` as support for a characterisation it contradicts. |
| **RA5** (the no-header precedent claim is false) | **FIXED, and the verdict changed with it.** #31 shipped all three parts (`Amends:` at `0053:11`, `Amended by:` at `0028:5`, the annotation), and the second enumeration-growth precedent (ADR-0048 → ADR-0041 consequence (h)) also took a header pair. Annotation-without-header is real (`0034:164`, `0029:79`, `0039:56`) but is not the enumeration-growth shape. **ADR-0054 takes the `Amends:` header** for 0028 and 0053, and keeps annotation-only for 0045's citation repair. |
| **RA6** (the OG wall and the cache posture have no ADR home) | **FIXED** — §11.1 now says decisions **1–13 and 15**, with D15's inclusion argued (a standing wall recorded only in a point-in-time plan has no live owner; ADR-0046 is its analogue) and D14's exclusion argued (it has no forward content). The three consequences a future ticket needs — the `cache-control` override, the 404-vs-500 boundary, the denial-of-wallet disclosure — are named for 0054's Consequences section. |
| **RC8** (A3's residual is wider than stated) | **FIXED** — D8's residual is rewritten to "**every** archive `[data]` segment, malformed included" plus the daily nothing-published-today analogue, with the metadata-object-vs-rendered-head distinction stated and S207's row saying which level it asserts at. §13's AC 3 line carries the widened form. |

**Medium**

| Id | Disposition |
|---|---|
| **RA7** (ADR-0014 `:18` is used as amended, not as written) | **FIXED** — §11.2 says so, quoting `:18`'s own *"'cacheable' is no longer load-bearing"* annotation. The verdict (not amended, no annotation owed) survives, now for a stated reason: `:18`'s members are categories and *"OG images"* already covers all nine files; the per-route growth is recorded at ADR-0028 decision 5, where the per-route enumeration lives. |
| **RA8** (`CONTEXT.md`'s row records the absolute §12 forbids) | **FIXED** — the bare *"spoiler-free"* is dropped from the glossary row and §12's measured qualification is carried into it. |
| **RA9** (ADR-0033 decision 2 cited at the wrong lines) | **FIXED** — Context `:23-30` for the measurement, decision 2 `:49-55` (its rule sentence at `:49-50`) for the ruling, corrected in the governing-records line, in D8(a) and in what ADR-0054 inherits. |
| **RA10** (three governing records never cleared, and 0010 never reached) | **FIXED, and widened.** ADR-0013, 0046 and 0047 are ruled on; so are **ADR-0010** — whose `:20` is the only rule in the corpus that names OG images and is therefore AC 3's actual governing sentence, now cited in the governing-records line and in D8 — plus 0001, 0005, 0007, 0017, 0024 and 0029's *Shared:* enumeration. §11.2(iii) lists the swept remainder by number. |
| **RC4** (S202(a) is red as specified) | **FIXED** — §7.2a's table is asserted per face, literally, with `toBeUndefined()` for `InstrumentSans-400.ttf`'s absent ID 16. Confirmed at the binaries: ID1/ID16 are `Fraunces 36pt Medium`/`Fraunces 36pt`, `Instrument Sans`/absent, `Instrument Sans SemiBold`/`Instrument Sans`. Landmine 24. |
| **RC5 + RD4** (the lattice is 153, not 120) | **FIXED as a rule, not a literal** — `ceil(1200/72) × ceil(630/72)` = 17 × 9 = 153, stated in V4, §7.2 and S200. Re-verified: with 120 the bottom-right 80×70 corner holds **0** non-background pixels and with 153 it holds **32**; the published warm band was measured on the 153 tree and stands. |
| **RQ8** (S207 splits the archive routes' metadata gate across two files) | **FIXED** — the non-OG half becomes **`T-WEB-S209`**, a new `describe` in `archive-metadata.test.ts`; `og-metadata.test.ts`'s S207 keeps only the `openGraph`/`OG_DEFAULTS` half. Q16's rule applied where Q16 applies. |
| **RQ9** (Batches F and G have no gate item) | **FIXED** — **I34a** closes F with `pnpm typecheck && pnpm lint && pnpm test` (F edits `route-client-js.mjs`, which eslint lints at `eslint.config.mjs:372` and pre-commit does not), and **I41a** closes G with `pnpm lint && pnpm test`. |
| **RQ10** (three `toEqual([])` scans with no counted floor) | **FIXED** — floors written into S200 (the literal set is non-empty; the accent **is** found on the tape and on the shadow), S201 (eight route files, two `gameCard(` call sites) and S204 (the eight game routes **do** reach `@miolos/db`, which is what makes the root card's absence a difference). |
| **RC7** (S203 and S204 cannot coexist as written) | **FIXED by dropping the unmocked render.** S204's no-db proof becomes a module-graph scan — transitively stronger than the one-level import scan and free of the `vi.doUnmock` + `vi.resetModules()` dance a hoisted file-scoped mock would otherwise force. Stated in §9 rather than left as a mechanism the implementer has to invent. |
| **RD3** (the site card's copy has no source, and it is never rendered) | **FIXED, all three parts** — `messages.og.siteTagline` is written into §7.4 with a docblock saying why it is not `meta.title` (which already contains the wordmark) or `meta.description` (141 characters); the site card is **rendered at I20a**; and §7.2's *"all of it was rendered"* is qualified to the game card, which is the only one that was. The game card's kicker lookup is named (`messages.games[game].kicker`, `messages.ts:741,879,937,1027`), which is why §7.1's signature needs no `kicker` parameter. |
| **RC10** (Batch C commits 169 KB of binaries with nothing reading them) | **FIXED by folding C into D.** Q12's doctrine is about a *commit of dead code*; a binary asset is not code, but the distinction is not worth defending when the fold costs nothing and removes a commit no gate covers. The fonts, the licences, `SHA256SUMS`, the loader and the first reader now land in one commit, and I16's gate is absorbed into I24's. I12's pre-commit verification of the three faces is unchanged and still happens before any byte is staged. |

**Low**

| Id | Disposition |
|---|---|
| **RC9** (`og:url` is not emitted at all when unset) | **FIXED** — D10's sentence is corrected. Harmless either way, but it was stated as a mechanism and was wrong, so it would have been re-derived. |
| **RD5** (`formatLongDate` maxes at 23, not 22) | **FIXED** — enumerated over twelve months: `"22 de fevereiro de 2026"`, 23 characters. S202's longest-content fixture becomes fevereiro. |
| **RD6** (the ×3 rule is silently broken at four values) | **FIXED as declarations plus two changes** — the rule is restated as multiplying **lengths**; card width 1040 and padding 72 are declared roundings with their derivations; the wordmark's sourceless 36px becomes **39px**, the card's existing secondary level; and the rotation returns to f6's **−0.5 deg**, because an angle is not a length. Registered as **V10**. *(The associated shadow-band arithmetic assumes a `box-shadow` does not rotate with its element under `transform: rotate`, which is not how it behaves; unverified, and −0.5 deg makes it moot. Noted rather than relied on.)* |
| **RD7** (at 380px the wordmark is illegible and the right half is empty) | **PARTLY FIXED, PARTLY SCHEDULED.** The wordmark grows to 39px as part of RD6. The composition point is real and is not a rule violation, so it gets a bounded pass rather than a redesign: **I18a**, a deliberate look at the wordmark and the empty right half **before I20a**, rendered and pasted, with the ×3 rule and `DESIGN.md` as its constraints; any change to the wordmark's size or position lands in §14 as a deviation. |
| **RQ11** (S190's "was read" is not an observable) | **FIXED** — restated as *"a non-empty 5-letter canonical present at `record.answer` on a fixture that parses under `termoPlayRecordSchema`"*. |
| **RQ12** (S191's twin is cited by line number with its content unstated) | **FIXED** — the twin must find `src/i18n/messages.ts` and `src/i18n/format.ts`, named in the row. |
| **RQ14** (S204 never asserts the root card lacks `force-dynamic`) | **FIXED** — one clause added. |
| **RA3(d) / RQ13 / RC11** (the exit grep misses the root card) | **FIXED** — §13 uses `find apps/web/app -name 'opengraph-image.*'` and asserts the count is nine, root included; `T-LINT-S44` is the gate behind it. |
| **RQ15 / RC12** (citation drift) | **FIXED and verified individually** — the prop block is `:89-105`, `conclusion-view.tsx` is **896** lines, the CTA ternary is `:382-405`, the no-focus-ring sentence spans `:36-39`, ADR-0045's Rejected entry starts at `:186`, ADR-0028 decision 5's annotation runs to `:123`, `eslint.config.mjs`'s two flat-config comments are at `:75-82` and `:509-515`, and the free-play object's repeated arrays are at `:538-553`. `.secondaryLink` `:409-411` and `<aside>` `:363` were already right. §11.4 carries the plan-internal ones. |

**Dismissed, with reasons**

| Id | Reason |
|---|---|
| **RB5's "the gradient is the more faithful path"** | **Refuted by re-measurement, not declined.** At the token's real alpha both paths land 1.41/255 from the browser's measured dot colour and both paint 32 pixels per dot. Neither is more faithful; the colour argument is removed from V4 in both directions rather than reversed. |
| **RB2's implied duplicate — a full `T-LINT-S8` clone in `eslint-db-wall.test.ts` alongside the replacement probes in `eslint-og-wall.test.ts`** | The two precedents point at different files for the same assertion. Honoured by splitting them rather than duplicating: **`T-LINT-S8a`** carries the new-source-directory claim in the file where that claim lives, and **`T-LINT-S43`** carries the replacement-regression claim beside the object that could delete it (the `T-LINT-S14`/`S15` placement). Running both full probe sets twice would be coverage theatre. |
| **RA5's alternative — annotation-only, argued from `0034:164`** | Available and defensible, and **declined**: two of the three enumeration-growth precedents took a header pair, `0053:5` states the standard in the repo's own words, and this audit has been wrong twice. The cheaper error is an extra header line. |

**Sub-claims round 2 made that this revision could not confirm, recorded rather than silently adopted:** the rotation/shadow-band arithmetic in RD6 (see its row); and RA4's SERP-title-fallback mechanism, which is a documented search-engine behaviour rather than something measurable in this repo — which is exactly why it is recorded as a *qualification* on the ADRs and a sentence in the PR body rather than as a design change.

---

### Batch 3 — 2026-08-14, step-4 fix over step 3 round 3's three lenses (~25 findings, three blocking plus one medium blocking on substance)

Rounds 1 and 2 above are preserved unchanged, **including their numbers**: a figure quoted inside batch 1 or batch 2 is the figure at the revision that wrote it (RB3's *"a ten-row checklist"*, for one), and the live count is always §11.2(iv)'s table and nothing else. A disposition table is a record of what was decided when, not a section that gets re-edited. Round 3's three lenses (**T** decisions/correctness · **U** amendment audit · **V** tests/batches) all rejected **narrowly**, and all three said independently that **no product, design, route or ADR decision moves** — the work was in §7.2a, §9, §11.2 and §13. That held: revision 4 changes no destination. It replaces one argument, writes one handler out, adds four audit rows and tightens eleven test rows.

**Blockers**

| Id | Disposition |
|---|---|
| **T1** (the ⅓-scale derivation is right; the paragraph landing it is not — a false bucket set, a criterion fitted to the choice, three frame-inconsistent percentages) | **FIXED, and the destination is unchanged: the card still ships `Fraunces:opsz,wght@36,500`.** Everything justifying it is new. §7.2a now **states the criterion in one sentence before any number** — minimise the hero run's deviation from the browser's `auto` at the size it is read, wordmark inside 2.5 % — then applies it, then reports **every** delta against **one** reference (the browser's `auto` at 32 px and 13 px, on the strings the card sets, *"Nonogram"* and *"Miolos"*). The bucket set is **enumerated**, not recalled: all 136 integers 9…144 requested against live `css2` and the resolved gstatic URLs diffed → **eighteen** buckets, `9,10,11,12,13,16,17,18,20,24,28,36,48,60,72,96,120,144`, so `@30`/`@32` resolve to **28** and revision 3's *"the neighbouring buckets are 20 and 48"* was false. The three mismatched percentages are retired and replaced in-frame (**−0.23 %** name, **−2.22 %** wordmark, **−16.48 %** for opsz96, **+1.85 %** for the default). **The alternatives are named with their numbers rather than omitted**: worst-case-percentage picks 24 pt (1.05 %), worst-case-displayed-pixels picks 28 pt by 0.08 px, and the spread across 24/28/36 is 1.2 pp — the hero weighting is what selects 36, and the plan says so. **Zero bytes cost either way**: the 24, 28 and 36 pt cuts are 71,648 B each — which is also a new finding in its own right, because it means the §13 byte-sum criterion cannot see a one-bucket typo, and only `name` ID 16 + `xAvgCharWidth` (1148 / 1155 / 1159) can. D12, F6, §1, V9, landmines 3 and 25, I12 and §13 all carry it. |
| **T3** (the daily handler cannot log the date, so D8's throw row is unsatisfiable on half the surface) | **FIXED by writing the second handler out instead of describing it.** §7.3 now carries `dailyCardHandler` in full, with its own log line — `` `og daily card: unreadable today row for ${game}` ``, game only — and a comment saying why: there is no `date` in scope, because `getTodayDaily` throws before returning the row that carries it. D8's rule becomes *"the game on both families, the date on the archive family, and that asymmetry is a fact about the readers"*. `T-WEB-S203`'s date clause is scoped to the archive family, and the daily family gets its own row asserting its own written line rather than the absence of a date. **Checked for a fourth instance of the class** — every row of the rewritten S203 grid was re-derived per family and the three rows that have no counterpart on one side (malformed segment, today-via-archive, the date in the log) are marked archive-only, the two daily-only rows likewise; V11's uniformity complaint is fixed by the same rewrite. |
| **U1** (ADR-0039 decision 2 carries the fifth-game recipe in forward tense, in a file the audit swept as `N/A`) | **FIXED, and the audit's METHOD changed with it.** `0039:42-44` becomes rows 11 (annotation) and 10 (header) of §11.2(iv); the header is ruled **in writing**, on three grounds — the enumeration-growth precedent does not stop at a file boundary, `0039:5` already carries an `Amended by:` line so the reciprocal is one more bullet on the `0014:5-7` two-amender shape, and without it the only pointer sits inside a decision-2 paragraph, which is how three consecutive audits missed it. ADR-0039 is removed from (iii)'s `0037–0040` `N/A` range. **§13's count is re-derived from the table, not adjusted** — thirteen rows, fourteen conditionally — and §13 now checks the rows **both ways** and forbids restating it as a count (U7). **The sweep was then re-run for the SHAPE and recorded as §11.2(iii-b)**, with its full hit list: `grep` for the recipe returns three files (0028, 0029, 0039), the forward-modal sweep returns eighteen lines, the OG-keyword sweep nine. **One new hit, and it is U1 itself**; every other hit is ruled `N/A` with its reason in the table. |
| **V1** (the prescribed literal scan is RED as written) | **FIXED, and reproduced before fixing.** Run on `main` with the shipped slice and regex: each of the four `[data]/<jogo>/page.tsx` files yields exactly one literal, its own game token, against `[]` on the three routes the suite already covers. §9's S209 row now states the allowlist — **the file's own `Game` union member and nothing else**, because it is an identifier crossing a typed boundary, not copy — keeps the `toContain("canonical")` precondition, and adds the token-was-found floor. Decided in the plan, not at I28a, where the cheapest fix is loosening the regex (C6/RC4 again). |

**Medium**

| Id | Disposition |
|---|---|
| **U2** (ADR-0053 decision 4's 404-vs-500 rule is never ruled on) | **FIXED, annotation taken.** The citation is repaired first — decision 4 opens at `:275` and the passage is `:314-322`; round 3's `:47-54` is Context item 4. Verdict: clause 1 holds and D8 adopts it; the *because* clause (*"the two shipped readers keep throwing, because on those a bad row is a live incident"*) is weakened on eight new surfaces, where the caller catches by name and 404s. 0053 is already being edited, so the drive-by rule is not in play. Row 9. |
| **U3** (ADR-0013 `:23` is never reached) | **FIXED as a written verdict, no annotation.** #34 ships the first English segments nested under pt-BR product paths. `opengraph-image` is a **file-convention name, not a chosen slug** — not externalizable through `routes.ts`, never read or searched by a human, and a pt-BR spelling would mean abandoning the convention for a route handler. Same class as `/sitemap.xml`. The reason is written down because an unwritten verdict reads like a missed one. |
| **U4** (the ADR-0024 row cites the export-surface half, not the obligation D15's naive wall deletes) | **FIXED** — the row now cites `:111-114` verbatim and names it as the ADR that owns `T-LINT-S43` and `T-LINT-S8a`. Verdict unchanged. |
| **T2** (the ⅓-px hairline claim is false on DPR ≥ 2) | **FIXED by deletion, not by hedging.** A 1200 px PNG in a ~380 CSS px bubble on a DPR ≥ 2 phone rasterises at ~1140 device px — essentially 1:1. The perceptual argument carries reading (B) alone. I18a's 380 px view is re-labelled a **layout** check so no stroke-weight argument is rebuilt on it. |
| **V2** (`T-WEB-S192` is a cross-file duplicate id) | **FIXED** — `T-WEB-S192a` takes the `conclusion-share.test.tsx` half (a sibling letter consumes no range number); §9's file table, the batch-ordering paragraph, I9 and I40 all updated. |
| **V3** (`T-WEB-S204`'s module-graph mechanism cannot see `@miolos/db`) | **FIXED, and verified at the source.** The cited walker resolves relative specifiers only, so path-membership assertions are structurally empty on **both** sides. Both halves are rewritten as a **source grep over each graph node** — the mechanism the shipped suite uses one assertion later (`archive-day.test.tsx:344-347`) — with the floor in the same terms: the eight game routes reach `src/og/handlers.ts`, whose source contains `@miolos/db` (confirmed against `app/sudoku/page.tsx:1`, the shipped read shape). The asymmetric repair is named and forbidden. |
| **V4** (S208's twin covers one of two roots) | **FIXED** — one named file per root, plus #34's own two new rendered surfaces (`src/og/card.tsx`, `app/opengraph-image.tsx`), one per root. The 85-file figure stays as evidence and explicitly not as an assertion, since #34 adds files. |
| **V5** (five `→ toEqual([])` scans, not three) | **FIXED** — floors written into `S193` (the allowlisted separators **were** found) and `S192` (the file was read and contains `buildShareText`), and §9's paragraph corrected to five, six counting S209. |

**Low**

| Id | Disposition |
|---|---|
| **U5** (ADR-0002 `:41` declined on a ground that does not reach §7.2a's discovery) | **FIXED as an annotation, no header** (row 13). A `css2` request by weight alone silently returns the 13–15 pt cut, so what a native client must choose grows from `{weight}` to `{weight, opsz}`. That makes `:41` an **incomplete forward prescription**, which `0053:96-98` says the anti-drive-by exemption does not cover — the one file this ticket opens purely for an annotation, with the reason written out. |
| **U6** (ADR-0029 `:14` carries the recipe as a quotation) | **FIXED as a written clause.** Attributed quotation, annotated at the source per `0053:979-985`; recorded rather than silent **because `0039:42` looked identical from a distance and is not one**, which is how U1 hid for three rounds. |
| **U7** (§13 reintroduces a number, and `grep -rn` counts lines) | **FIXED** — §13 and I39 state the check as *"every row has ≥1 hit and every hit maps to a row"*, both ways, and say in words not to restate it as a count. |
| **U8** (row 2 annotates ADR-0028 for a count that is not wrong) | **FIXED in the other direction, as the finding asked.** *"Both segments"* stays true — an `opengraph-image.tsx` is a metadata route inside the existing segment. The annotation is kept and re-aimed at `:97-98`'s *"both routes render the same pt-BR unavailable screen"*, where the third module answers **404**. §11.4's row is rewritten to match. |
| **T4** (`messages.meta.description` is 133, not 141) | **FIXED, measured** — 133 UTF-16 units and 133 code points off `messages.ts:95`. Both occurrences corrected, **including the docblock that ships into `messages.ts`**. |
| **T5** (the 500 KB ceiling is `@vercel/og`'s Edge limit and §1 declines Edge) | **FIXED** — it is no longer the budget half of one-instance-not-two. It is named as Edge-documented, not binding on node, and the budget argument that does bind (+42 % of the font payload for 2.22 % on the secondary run) is stated in its place. |
| **T6** (*"22 units apart"*; 32 − 13 = 19) | **FIXED** — 19, with the author-frame figure corrected alongside it (96 and 39 are 57 apart, not 60). |
| **V6** (S199 names no obtainable mechanism) | **FIXED** — the assertion is on the **declared** metadata object's `OG_DEFAULTS` spread; the rendered head is §13's `curl` (c), as evidence. |
| **V7** (S200's tie-back is 8-digit-hex-only) | **FIXED** — widened to every hex literal in `src/og/tokens.ts`; the leading-seven rule covers the five opaque tokens free. |
| **V8** (the C→D fold note explains I16 and not I15) | **FIXED** — I15 is the loader, renumbered I17a when Q12 moved it beside its importers; I16's gate is in I24. Stated, with the reason nothing is resequenced: the ids are cited from §9, §13 and §14. |
| **V9** (`T-LINT-S43` is nine assertions, not eight) | **FIXED** — nine lint messages across eight probes, the root-entry probe redding twice for `sql` and `users`. The S43 row, D15's paragraph and I21a all say it. |
| **V10** (S206a is a cross-file sibling where all four precedents are same-file) | **FIXED** — §9 and I40 now say in words that the letter is spent **to avoid a cross-file duplicate id**, not to extend a same-file claim, so the next frontier derivation does not read it as a precedent. `S192a` rides the same sentence. |
| **V11** (S203's `it.each` grid is not uniform) | **FIXED by the T3 rewrite** — seven rows bind on both families, three are archive-only, two are daily-only, each listed. |

**Nothing dismissed at round 3.** Every finding is fixed. Two are fixed **differently from the way the reviewer proposed**, and the difference is stated rather than absorbed: **T1** keeps the 36 pt cut where the finding's own table pointed at 24 pt on min-max error — the criterion that selects it is stated first and the two rival criteria are reported with their numbers, which is what the orchestrator direction asked for and what the finding said was missing; and **U2/U5** take annotations where the finding offered *"a written verdict may be enough"*, on the ground that this audit's demonstrated failure mode is under-recording, not over-recording.

**One correction to round 3's own findings, recorded because a later round will otherwise re-derive it:** §1(b)'s table and its closing direction disagree. The table shows 24 pt best on worst-case percentage (1.15 pp there, 1.05 pp on revision 4's re-measurement) while the direction says *"if a balanced max-error criterion is chosen, 28 pt wins"*. 28 pt wins on worst-case **displayed pixels**, not on percentage. Both are in §7.2a's table now, with the criterion that separates them.

---

## 15. Execution order — the batches

Pre-commit runs the **full** suite at every commit, so every item below must land green. `source ~/.nvm/nvm.sh && nvm use default >/dev/null &&` prefixes every node/pnpm/npx command; `TURBO_CONCURRENCY=1` on every `git commit`; files staged explicitly; `--force` when turbo-cached gate output is wanted as evidence.

**Read §14's batches 1, 2 AND 3 first if you are picking this up after step 3** — together they are the disposition of all ~136 findings across three review rounds, and they explain why several sections read differently from how a step-1 exploration would leave them. Batch 2 records which reviewer claims a revision **refuted** rather than adopted, and batch 3 records the two findings fixed differently from the way they were proposed, so neither set is re-adopted at step 6.

**Read first:** CLAUDE.md; `CONTEXT.md`; `DESIGN.md`; issue #34; ADR-0002/0004/0006/**0010**/0013/0014/0018/0028/0029/0031/0033/0034/0036/0041/0043/0045/0046/0047/0051/0052/0053; `apps/web/src/play/{conclusion-view.tsx,conclusion-view.module.css,types.ts,play-record.ts,use-record-snapshot.ts,day-state.ts,sync.ts}`; `apps/web/src/i18n/{messages.ts,routes.ts,format.ts}`; `apps/web/src/site-origin.ts`; `apps/web/app/layout.tsx`; `apps/web/app/arquivo/[data]/sudoku/page.tsx`; `apps/web/app/sudoku/page.tsx`; `apps/web/app/sitemap.ts`; `apps/web/app/manifest.ts`; `apps/web/scripts/route-client-js.mjs`; `packages/db/src/published.ts` `:47-89`, `:116-195` and `:228-243`; `packages/db/src/buffer.ts:106`; `apps/web/test/eslint-db-wall.test.ts:760-800`; `eslint.config.mjs` `:75-82`, `:203-331`, `:452-491`, `:492-524` and `:525-555`; the napkin; the six reference frames in `docs/design/006-handoff-design-winner-atelie/`.

**Batch A — the share text (commit `feat(web): the spoiler-free share text (#34)`)**

| # | Item | Files |
|---|---|---|
| **I1** | Branch `feat/34-sharing` off `main` at `71ef4ca`. Re-run the test-id grep per area; confirm §9's **extended** ranges (`T-WEB-S189…S211`, `T-LINT-S39…S45`) still start at the frontier, and that the three sibling letters (`T-LINT-S8a`, `T-WEB-S206a`, `T-WEB-S192a`) are free; shift whole ranges + record in §14 if not. | — |
| **I2** | `messages.share` (§6.3), with its doc block and the `então`/`mamãe`/`época` audit stated. | `apps/web/src/i18n/messages.ts` |
| **I3** | The pure composer, TDD: write `T-WEB-S189…S193` and `S206` **first**, red, then implement. `S190` (the answer never appears) is written before any Termo code exists. | `apps/web/src/play/share-text.ts`, `apps/web/test/share-text.test.ts` |
| **I4** | `site-origin.ts`'s doc block: three surfaces → four. | `apps/web/src/site-origin.ts` |
| **I5** | Gate: `pnpm --filter @miolos/web test share-text` + `pnpm typecheck` + **`pnpm lint`**, output pasted. Lint is **not** in pre-commit (landmine 18), so without this the commit can be eslint-red (Q12). | — |

**Batch B — the button (commit `feat(web): the conclusion's share button, live at last (#34)`)**

| # | Item | Files |
|---|---|---|
| **I6a** | **Measure before building** (D10-design, C8): (a) 390×844 headroom on the conclusion's worst state — `lost` + streak card + full day strip + the 36-char `failed` message; (b) build with `share-text.ts` and a **stub** `ShareButton` wired in, and read `/nonogram`'s delta from `bundle-check`. Both figures recorded. If (a) does not fit or (b) exceeds 40 KB, stop and revise the plan — D15 carries the remedy branch. | — |
| **I6** | `ShareButton` in-file: the three-armed click handler (`navigator.share` → `AbortError` silent, **any other rejection falls through** → `clipboard.writeText`), the `aria-live` status region with its **reserved box**, the `disabled` gate on `stored === undefined`. One call site in `<aside>` (`:363`), between the CTA ternary (`:382-405`) and `.secondaryLink` (`:409-411`). | `apps/web/src/play/conclusion-view.tsx` |
| **I7** | `.share` and its states — including `:disabled`, `:focus-visible` and `cursor: pointer` (B12) — plus the status line's reserved `min-height`. **No other rule in the sheet moves.** | `apps/web/src/play/conclusion-view.module.css` |
| **I8** | Rewrite the **three** falsified comments to shipped tense. | `conclusion-view.tsx:72-73`, `conclusion-view.module.css:5-6` and `:36-39` (the no-focus-ring sentence, B12) |
| **I9** | `T-WEB-S194…S197` **and `T-WEB-S192a`, the `url ===` half of S192's claim** (C7; a sibling letter rather than a second `S192` `describe`, because this is a different file — V2). Stub `navigator.share`/`navigator.clipboard` with `Object.defineProperty`; at least one case runs with `navigator.share` genuinely deleted; one case is a **non-Abort** rejection reaching the clipboard. | `apps/web/test/conclusion-share.test.tsx` |
| **I9a** | `T-WEB-S205` — the stylesheet-text gate, in the file that already holds this sheet's tripwires (Q16). | `apps/web/test/conclusion-view.test.tsx` |
| **I10** | `**/play/share-text` into both halves of the free-play wall + `T-LINT-S39`/`S40` probes. | `eslint.config.mjs`, `apps/web/test/eslint-free-play-wall.test.ts` |
| **I11** | Gate: `pnpm typecheck && pnpm lint && pnpm test`, output pasted. **`conclusion-view.test.tsx` gains exactly one `describe` (S205) and is otherwise green untouched** — revision 1 said "untouched", which Q16's move makes literally false. | — |

**Batch C is FOLDED INTO BATCH D** (RC10). Revision 2 kept the three binaries, the two licences and `SHA256SUMS` as their own commit, with nothing in the tree reading them and no gate that could look at them — the digest assertion lands at I23. Q12 moved the *loader* out of Batch C for exactly that reason, and a binary is not code, but the distinction is not worth defending when the fold costs nothing: I12–I14a below are the first items of Batch D, I16's gate is absorbed into I24's, and **I12 still verifies every face before a single byte is staged**.

**Where I15 and I16 went, because the sequence I12, I13, I14, I14a, I17, I17a reads as two gaps and revision 3 explained one** (V8). **I15** was revision 1's font loader; Q12 moved it out of Batch C to sit beside its importers and it is the item now numbered **I17a** — the same work, renumbered so that the tokens file (I17) and the loader that the card imports alongside it land adjacent. **I16** was Batch C's gate; RC10 folded Batch C into D and absorbed it into **I24**. **No item was dropped**; the numbering is not resequenced because these ids are cited from §9, §13 and §14, and renumbering them would falsify every one of those citations.

**Batch D — the fonts and the cards (commit `feat(web): per-day, per-game Open Graph cards in the Ateliê system (#34)`)**

| # | Item | Files |
|---|---|---|
| **I12** | Fetch `Fraunces:opsz,wght@36,500`, `Instrument+Sans:wght@400` and `Instrument+Sans:wght@600` via `css2` + a legacy UA (§7.2a has the three URLs verbatim). **Verify each before committing** and paste the dump: `fvar` absent; `OS/2.usWeightClass` 500/400/600; **`name` ID 1 and ID 16 equal to §7.2a's table, with ID 16 ABSENT on the 400 face**; **`OS/2.xAvgCharWidth === 1148`** on Fraunces; sizes 71,648 / 48,616 / 48,732 summing to **168,996 B**. **Two things must not be re-attempted:** 550 is unavailable (`wght@550` returns two faces declaring 500 and 600; `wght@550..550` is `400: Invalid selector` — V8), and the **`opsz` term is not optional** — `wght@500` alone silently returns the 14 pt text cut, and an off-bucket `opsz` silently returns a neighbouring cut (V9, landmine 25). **The size check does not discriminate here** — the 24, 28 and 36 pt cuts are 71,648 B each — so the dump that matters is `name` ID 16 and `xAvgCharWidth`; a face that is the right size and the wrong cut is exactly what this item exists to catch (T1). | `apps/web/assets/fonts/*.ttf` |
| **I13** | Fetch and commit `OFL.txt` for each family (OFL 1.1 clause 2). | `apps/web/assets/fonts/OFL-*.txt` |
| **I14** | `*.ttf binary`. | `.gitattributes` |
| **I14a** | `SHA256SUMS`: digest, the **`css2` request URL including its `opsz` term**, the resolved gstatic URL, the UA used and the fetch date, per face (S6, RB1). | `apps/web/assets/fonts/SHA256SUMS` |
| **I17** | The literal palette in **8-digit hex**, each token tied to its `packages/ui/tokens.css` name in a comment (Q6/C11). | `apps/web/src/og/tokens.ts` |
| **I17a** | `export const FONTS` — top-level `await readFile(join(process.cwd(), "assets/fonts/…"))` per face, registered as `Fraunces` / `Instrument Sans` (satori matches on the name you pass, not the TTF's internal one, so the `36pt` in the filename does not reach the card). | `apps/web/src/og/fonts.ts` |
| **I18** | `siteCard()` and `gameCard({ game, longDate })` — flex-first, three faces only, accent on tape and shadow only, **§7.2's table implemented value for value**, including the dot lattice at **`ceil(w/72) × ceil(h/72)` = 153** (derived from the size; no literal). `longDate` is **required**; the kicker is looked up from `game`. `siteCard()` uses `messages.og.siteTagline`. | `apps/web/src/og/card.tsx` |
| **I18a** | **One deliberate composition pass on the wordmark and the empty right half, BEFORE I20a** (RD7). Constraints: the ×3 rule and `DESIGN.md`; the wordmark is 39 px by §7.2's table. Render at 1200×630 **and downscale to 380 px CSS**, which is the size it is read at, and paste both. **Read the 380 px view as a LAYOUT check, not a rendering one** (T2): on a DPR ≥ 2 phone the same bubble rasterises the 1200 px PNG at ~1140 device px, essentially 1:1, so nothing is lost to resampling and no stroke-weight argument may be built on the downscale. If the pass changes the wordmark's size, weight or position, it lands in §14 as a deviation with its reason. It is a pass, not a redesign: the editorial register tolerates whitespace, and nothing here is a rule violation. | `apps/web/src/og/card.tsx` |
| **I19** | `messages.og` — the `alt` strings **and** the four daily `openGraph` title/description pairs (§7.4). | `apps/web/src/i18n/messages.ts` |
| **I20** | `T-WEB-S200` and `S208`: the accent-never-on-a-word tree walk **with its counted floor** (the accent *is* found on the tape and the shadow), the kicker-tracking range, the 8-digit-hex tokens tie-back, the 153-dot assertion, and the emoji scan **scoped to `src`+`app` with its anti-vacuity twin, one named file per root** (RB9/V4). **The twin names `app/opengraph-image.tsx`, which lands at I21** — later in this batch, so the assertion is red between I20 and I21 and green at the commit, which is the same intra-batch red-then-green I22 uses deliberately. Cross-batch it would be a red commit; intra-batch it is free (RB10's rule). **`S201` is written at I23, not here** — its subject is the eight route files, which land at I22 (RB10's ordering rule, intra-batch). | `apps/web/test/og-card.test.tsx` |
| **I20a** | Write **`siteCard()` and one `gameCard()`** to a 1200×630 HTML file and run `npx impeccable detect` in **file mode** over it; output pasted (A4). **This is the first time the site card is rendered at all** (RD3), so its tagline, its single `--accent-app` tape and its two-line stack are checked here rather than assumed. The by-design ignore list is scoped to `localhost`/`vercel.app` and must **not** be widened to cover a `file://` path. | — |
| **I21** | The **root site card** (static, no `@miolos/db` import) and the two shared handlers: `dailyCardHandler` (`getTodayDaily`) and `archiveCardHandler` (`parseArchiveDate` → `getPublishedDaily`), both with the **narrowed** `try`/`catch` — `PROJECTION_ERROR_NAMES` → log + 404, **everything else re-thrown** (D8, landmine 22) — the `try` wrapping the read only, and both passing `CARD_HEADERS` (H3). | `app/opengraph-image.tsx`, `apps/web/src/og/handlers.ts` |
| **I21a** | The OG wall as **object (4)**, written out per D15: its own game bans **plus objects (1) and (2)'s arrays spread verbatim**, placed after (1)–(3). Probes `T-LINT-S41`/`S42` (the game bans, red-then-green), **`S43`** (replacement regression — run it once against a version of the object WITHOUT the spreads and paste the eight probes coming back clean, then with them and paste the **nine** messages they red with; the root-entry probe reds twice, for `sql` and for `users` — V9) and **`S44`** (glob reach, root card included); plus **`T-LINT-S8a`** in `eslint-db-wall.test.ts`. `describe` carries the topic and no id. | `eslint.config.mjs`, `apps/web/test/eslint-og-wall.test.ts`, `apps/web/test/eslint-db-wall.test.ts` |
| **I22** | **TDD** (Q8): write `T-WEB-S203` first, against a stubbed handler, red — then the eight route files, all `force-dynamic`, each delegating to its handler. | `app/{binairo,sudoku,nonogram,termo}/opengraph-image.tsx`, `app/arquivo/[data]/{binairo,sudoku,nonogram,termo}/opengraph-image.tsx`, `apps/web/test/og-image.node.test.ts` |
| **I23** | `T-WEB-S202` and `S204` alongside S203, with `// @vitest-environment node` as the file's first line — the repo's first node-environment suite. **Paste the run** rather than asserting the pragma works (Q14). `S202` = the longest-content raster (*"Nonogram"* / *"22 de fevereiro de 2026"*) **and the site card** + the TTF table reads **including the optical-cut arm** (RB1/RC4) + the render-twice arm + the digests; `S204` = the root card's no-db **module-graph** proof with its counted floor (RC7/RQ10), the eight `force-dynamic` exports **and the root card's absence of one** (RQ14), the per-family byte-identity scan and the `DAY_GAMES` coverage check. **`T-WEB-S201` is written here too** (its subject is the route files from I22). | `apps/web/test/og-image.node.test.ts`, `apps/web/test/og-card.test.tsx` |
| **I24** | Gate: `pnpm typecheck && pnpm lint && pnpm test`, output pasted; `pnpm build` in `apps/web` with the **route table** pasted (expect one `○`, eight `ƒ`) **and the `.nft.json` font entries for one route of each family** (H4 — the trace is provable here, not only at the preview). **Absorbs the deleted I16**, so `git show --stat` with the three binary sizes and digests is pasted here (RC10). | — |

**Batch E — the metadata (commit `feat(web): Open Graph metadata on the daily and archive routes (#34)`)**

| # | Item | Files |
|---|---|---|
| **I25** | `OG_DEFAULTS` (`src/og/defaults.ts`), then root-layout `openGraph: {...OG_DEFAULTS, …}` + `twitter` defaults; `pt_BR` with an underscore. | `apps/web/src/og/defaults.ts`, `app/layout.tsx` |
| **I26** | Static `export const metadata` on the four daily pages carrying **`openGraph` only** — no page `title`, no `description`, no `alternates` (H1). **No `messages.meta` key is added.** | `app/{binairo,sudoku,nonogram,termo}/page.tsx` |
| **I27** | `openGraph: { ...OG_DEFAULTS, … }` inside the four archive `generateMetadata`s, reusing the strings they already compose. Canonical unchanged. | `app/arquivo/[data]/{binairo,sudoku,nonogram,termo}/page.tsx` |
| **I28** | **`T-WEB-S207`** (the `openGraph`/`OG_DEFAULTS` half) and **`T-WEB-S206a`** (the `messages.og` accent audit, which could not live in Batch A — RB10) — for the four per-game archive `generateMetadata`s, which no test in the repo covers today (B6). `T-WEB-S173` is **not** touched: revision 1's plan to widen it rested on a false premise. | `apps/web/test/og-metadata.test.ts` |
| **I28a** | **`T-WEB-S209`** — S207's non-OG half as a new `describe` in the suite whose own `describe` already claims it (RQ8): title and description distinct across games and dates, canonical unchanged, the `:135-158` literal scan extended to the four files. The existing `T-WEB-S173` block is byte-unmoved. | `apps/web/test/archive-metadata.test.ts` |
| **I29** | `T-WEB-S198`/`S199`, asserted on a **leaf** route's resolved metadata (B4), with `vi.mock("../src/db")` + `vi.mock("@miolos/db")` (Q13). | `apps/web/test/og-metadata.test.ts` |
| **I30** | The one-clause comment addition **and** the `:28-30` → `:36-38` citation repair (A7). | `app/sitemap.ts` |
| **I31** | Gate: `pnpm typecheck && pnpm lint && pnpm test`, output pasted. | — |

**Batch F — the gates (commit `ci: the conclusion routes join the bundle budgets (#34)`)**

| # | Item | Files |
|---|---|---|
| **I32** | Measure first: `pnpm build` then `pnpm bundle-check` from `apps/web`. Add the four `/<jogo>/concluido` routes to `BUDGETED`; if any is over 40 KB, add a `PER_ROUTE_BUDGET` entry with the measured arithmetic in a comment and a §14 entry. | `apps/web/scripts/route-client-js.mjs` |
| **I33** | Publish the full figures, including **`/`'s absolute first-load before and after**. | PR body |
| **I34** | File-mode `impeccable detect` over the concluded conclusion at 1440×900 and 390×844, output pasted. (The card's file-mode run is I20a.) | — |
| **I34a** | **Gate** (RQ9 — Batch F had none, in the revision that just corrected "lint is not in pre-commit"): `pnpm typecheck && pnpm lint && pnpm test`, output pasted. This batch edits `apps/web/scripts/route-client-js.mjs`, which eslint lints (`eslint.config.mjs:372`) and pre-commit does not. | — |

**Batch G — docs (commit `docs: plan 040, ADR-0054, and the records #34 falsifies (#34)`)**

| # | Item | Files |
|---|---|---|
| **I35** | ADR-0054, **decisions 1–13 and 15** (§11.1), with an **`Amends:` header naming ADR-0028, ADR-0053 and ADR-0039** and the amendment audit's verdict and full candidate list written out (§11.2). Content that must be in it and that revision 2's list omitted: the Nonogram refusal in **ADR-0033 decision 2 `:49-55`**'s own words, with the measurement cited to **Context `:23-30`** (B3, RA9); the measured Termo-grid bound rather than *"spoiler-free by construction"* (S4); the **denial-of-wallet** consequence (S5); the third-party-scraper-cache residual; the hand-typed-`/​<jogo>`-link staleness residual (D7); **the standing OG wall** (D15, RA6); **the `cache-control` override and why there is no CDN TTL** (H3); **the 404-vs-500 boundary** (D8); **the optical-instance decision, its stated CRITERION and its residual** (§7.2a, V9) — the criterion goes in with it, because a cut recorded without the rule that chose it is a number a later ticket will re-derive from whatever rule is convenient; and **the true satori gradient constraint in the words §7.2 uses** (V4, RB5) — this is the sentence that becomes permanent, so it must be the measured one. | `docs/adr/0054-….md` |
| **I36** | The ADR-0045 **`:186-191`** in-place annotation — the live button discharges the rule, citation repaired. **No header on this one** (§11.2(ii)). | `docs/adr/0045-….md` |
| **I36a** | **ADR-0028: the `Amended by:` line at `:5` and FOUR annotations** — `:34-39` (the SEO-surface qualification, RA4), `:91-98` (**the segment count is UNCHANGED** — an `opengraph-image.tsx` is a metadata route *inside* the existing segment, so *"Both segments"* stays true; the annotation goes on decision 4's closing clause at `:97-98`, *"both routes render the same pt-BR unavailable screen"*, which the image route's 404 body genuinely diverges from — U8), **`:112-123`** (*"(Grown at #34)"*, naming all eight image routes — B2, range corrected), `:179-192` (the fifth-game recipe, RB3). | `docs/adr/0028-….md` |
| **I36b** | **ADR-0053: the `Amended by:` line at `:5` and THREE annotations** — `:207-233` (thirteen route modules, **and the four `/arquivo/<data>/<jogo>/opengraph-image` paths a future `killed_at` writer must invalidate** — RB3/RB4), `:974-978` (the SEO-surface qualification's echo, RA4) and **`:314-322`** (decision 4's 404-vs-500 rule: the two shipped readers still throw, and #34 narrows the *caller's* answer to a projection-class throw while an outage still re-throws to a 500 — U2). | `docs/adr/0053-….md` |
| **I36c** | **ADR-0039: a second `**Amended by:**` bullet at `:5`, beside ADR-0053's, and ONE annotation at `:42-44`** — decision 2's fifth-game route recipe grows by the two `opengraph-image.tsx` files (U1). The bullet stacks on the existing line rather than replacing it (`0014:5-7` is the shipped two-amender shape). **This is the record three consecutive audits cleared as `N/A`; the annotation says so, in one clause, because that is the lesson `0053:98-100` asks to be recorded.** | `docs/adr/0039-….md` |
| **I36d** | **ADR-0002: ONE annotation at `:41`, and NO header** — what a native client must choose is `{weight, opsz}`: a `css2` request by weight alone silently returns the 13–15 pt text cut, byte-identical to the no-`opsz` default, with no error and no size difference (§7.2a, U5). Cite ADR-0054 decision 12. Nothing else in ADR-0002 is touched, and the file is opened only for this. | `docs/adr/0002-….md` |
| **I37** | Two `docs/README.md` rows (plan 040, ADR-0054). | `docs/README.md` |
| **I38** | The CONTEXT.md **Share text** row (§11.3). | `CONTEXT.md` |
| **I39** | Re-run the amendment audit over all 54 ADRs; paste `grep -rn "ADR-0054" docs/adr/` and **match it BOTH ways against §11.2(iv) by file and line** — every row has at least one hit, every hit maps to a row (three headers, four annotations in 0028, three in 0053, one in 0039, one in 0045, one in 0002; `0045:151-175` too if D15's `/nonogram` branch fired). **Do not check a count** — `grep -rn` counts lines, not rows (RB3/RB4/U1/U7). **Re-run the (iii-b) shape sweep as well**, not only the file-by-file pass: it is the sweep, not the verdicts, that found the record three rounds of file-by-file reading cleared. | — |
| **I40** | Re-derive the test-id frontier by grep; record #34's spent ids (`T-WEB-S189…S209`, `T-LINT-S39…S44`), its three **sibling** letters (`T-LINT-S8a`, `T-WEB-S206a`, `T-WEB-S192a` — siblings, not range members; the last two are **cross-file** siblings spent to avoid a cross-file duplicate id, and the entry says so in those words so the next derivation does not read them as a precedent for splitting one claim across two files — V2/V10) and its burned tails (`T-WEB-S210`/`S211`, `T-LINT-S45` if unspent) in the file's own accounting style. | `docs/agents/test-ids.md` |
| **I41** | File the two follow-up issues (§13); put their numbers in the PR body. | — |
| **I41a** | **Gate** (RQ9): `pnpm lint && pnpm test`, output pasted. Docs are prettier-formatted by lint-staged at commit, and the CONTEXT.md row is user-facing vocabulary — a batch with no gate is how a malformed table lands. | — |

**Batch H — push, verify, merge**

| # | Item |
|---|---|
| **I42** | Push and open the PR. Paste the full gate: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`, then `pnpm bundle-check` from `apps/web`. |
| **I43** | Once the preview is Ready, run §13's **five** `curl`s through the bypass and paste them — **including the `cache-control` header** (H3) — plus a screenshot of one archive card and one **dated** daily card. `<hoje>` is discovered from the app, never computed in the shell (A5). **This is the only remaining proof that `process.cwd()` resolves as decision 12 assumes** (the trace itself was proved at I24). |
| **I44** | Check **both** `impeccable detect` steps in the CI job, not just the first (napkin Execution item 9). |
| **I45** | Paste the reflog `no-verify` count, the `git diff --stat` against `main` for `packages`/`apps/api` (empty), and the §13 greps. |
| **I46** | Steps 6–8 of the flow: parallel six-lens review, fix, then merge and close. Re-derive the frontier once more at step 8. |

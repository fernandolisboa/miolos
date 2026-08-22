# Implementation plan — Issue #104: OG cards for the archive index, month and day pages

**Step-2 snapshot, Tier 2.** A point-in-time document, not a living spec. Ships one PR, one new ADR (**ADR-0071**, assigned up front), and amendments to ADR-0054 and ADR-0053 in the same diff.

**Decision on the issue that this plan executes rather than reopens** (Fernando, 2026-08-20): all three routes get cards; `/arquivo/<data>` first. Whether the day card names the four games was delegated to this plan as a design call (CLAUDE.md `:172`). §3 makes it and §14 gives the sentence to post.

---

## 0. Step-3 review, and what changed

Three step-3 reviewers — correctness/architecture, citations/records, scope/issue-adherence — all returned **REJECT**. This is the step-4 revision. The shape survived all three reviews unchanged (route split, `/cartao` family, index-as-static-PNG, day-level existence, no catch); what failed was a set of localised errors. Recorded here so the fix is auditable, and so a later reader does not re-litigate what was already contested.

**Blocking, and what it did to the plan:**

1. **A fabricated quotation.** §12.1 and §14 attributed *"screenshots are evidence, the detect run is the gate"* to ADR-0034 decision 4. `grep -rn "screenshots are evidence" docs/ CLAUDE.md DESIGN.md PRODUCT.md .claude/` returns **only this plan**. D4's real words are quoted in §12.1 now, and §14 no longer cites it at all. Every other bolded quotation in this document was re-read off disk in this pass (see the closing note of §11).
2. **The composition inverted the hierarchy.** §3 put the one constant word at 96 px and the one varying string at 39 px, so ~1,096 day cards would have been visually interchangeable with the index card. §3 is rebuilt on one rule — *the display slot holds the most specific thing the URL names* — and §12.2 now **sizes** the day card rather than only picking an evidence string. The decision the issue delegated (no game names) survived review and is unchanged; its third argument is rebuilt, because the old one was false.
3. **"The handler cannot see which games the day holds" was false.** `ArchivedDay` is `{date, game}` (`packages/db/src/published.ts:309-312`), so `days[0].game` is one property access away. `limit: 1` hides the *set*, not *a* game. The structural guarantee is `archiveCard`'s signature — two formatted `string`s, `{ display, caption }` — which admits no game at all. Fixed in §3, §4, §10.1, §11.1 D5, §14 and §16 D3/D5 together, **before** §14 is posted.
4. **§14 was ~380 words with a fabricated constraint** ("four game names would need four game accents" — `DESIGN.md:20` bans the shared accent on *any* word at any size, so that composition is illegal, not merely weaker). Rewritten to ten short lines under CLAUDE.md § *Writing for Fernando*.
5. **`T-WEB-S336` was false against the shipped tree.** Four `opengraph-image.tsx` modules already live under `app/arquivo/**` (`find apps/web/app -name 'opengraph-image.*'`). The tripwire is re-scoped to the three shell segments by exact path, with a counted floor on the four that must exist.
6. **§4.2's residual may be a non-event.** `redirect()` returns a 307 with no HTML body, so a non-following scraper may read no `og:image` at all rather than a 404ing one. Step 0 now probes it and §4.2 is written from the measurement, not from the assertion. The cheaper `302`-to-the-root-card fix is named and ruled on.
7. **The amendment set was incomplete.** Six further records #104 falsifies were found and added: ADR-0028 decision 5 `:163-182`, ADR-0054 `:615-616`, `:714-718`, `:645-650`, `:940-941`, and `eslint.config.mjs:820-823` — the same sentence in source, in a file §7 already opens. ADR-0071's `Amends:` now names **three** records.
8. **Citations drifted.** `plans/040:248`→`:849`, ADR-0054 `:436`→`:431`, `eslint.config.mjs:818-827`→`:826-835`, `published.ts:310`→`:309`, ADR-0028 `:238-262`→`:242-266`, `test-ids.md:44-50`→`:43-44`, plus four quote-start lines. §5's `copy.ts:46-53` claim was rewritten (it records `siteTagline`'s reason, not the archive's) and `indexDescription` measured at **90** characters, not 94.
9. **§8's intersection reasoning was wrong** though its verdict was right — `app/cartao/**` intersects objects (1) and (2). Rewritten against ADR-0054 `:981-983`'s widened rule.
10. **Five amendment rows only gestured** where §11's own heading promises replacement text. Written out.
11. **ADR-0071's title was inaccurate** — the index card is neither dated nor at its own URL, which is decision 2's own content. Retitled.

**Should-fix, applied:** the URL family's *position* argued and `routeSlugs` given the slug a home (§2.5); `archiveTagline` replaced by the shipped `messages.archive.lead` sentence and `altArchiveMonth` composed from `messages.archive.title` (§5); hand-written route-handler context types named (§7); step 0's date discovered rather than hardcoded (§9); the `T-WEB-S201` widening made non-vacuous (§10.2); ADR-0071 trimmed toward ADR-0070's scale, the `before-day` PNG dropped, §2.6 compressed (§11.1, §12.3, §2.6); `docs/pending-fernando.md` scheduled (including the stale #64 row); #37 scheduled a comment (§11.4, §15).

**Dismissed, with reasons, in place:** each dismissal is written where it belongs — §2.5 (asking Fernando about the URL), §5 (the "puzzles" noun), §10.3 (`T-WEB-S183`), §11.4 (`CONTEXT.md` / `DESIGN.md`), §16 (the ten-row objection table's own rows). Silence is not a dismissal.

### 0.1 Corrections applied at step 5, and where

Four came out of the measured spike (`~/miolos-session/104-step5-spike.md` §11) and two out of re-reading the plan's own citations off disk. Listed here so the step-6 reviewers can check each against its source rather than re-deriving it.

| # | What was wrong | Where it is fixed |
|---|---|---|
| 1 | §9 said a current build carries **42** `.nft.json`. `main` at `ee4df9b` carries **40** (41 with the probe) | §9, criterion 1 |
| 2 | §4.2's *"if it carries no body, the residual does not exist"* branch. **FALSE** — the 307 carries a full 12,509-byte HTML `<head>` with `og:image`. Case B is a **real** one-date regression | §4.2, §16 D7, ADR-0071 consequence (c) |
| 3 | §2.2's *"≈54 MB"* was an estimate. Measured: **54.6 MB**, with 22.4 MB per card function | §2.2 |
| 4 | §2.2's four-play-route argument rested on `mergeStaticMetadata`'s ordering. The measured reason is **structural**: a `page.tsx`'s `generateMetadata` is not inherited by child segments at all | §2.2 |
| 5 | `DESIGN.md:19` is a **blank line**; the accent-may-never-colour-a-word rule is at **`:20`**. Six occurrences | §0, §3, §10.1, §11.1, §14, §16 |
| 6 | §3's ADR-0054 D1a quotation was **not verbatim**. The real sentence is at `0054:207`, inside decision 1a's #103 annotation: *"The result is a **narrower** surface than the daily's, never a wider one."* | §3 argument 3 |
| 7 | The inner width was given as **896 px**, dropping `paper()`'s 3 px border. Yoga's `width` is a border box, so it is **890 px** | §3.1, §5, §12.2 |
| 8 | §3.1's rung ladder had no verdict. **Rung 1 fails at 1111 px against 890 (25 % over) and the day card takes RUNG 2**, worst case `"20 de novembro"` at 729 px; the month card stays at rung 1 at 843 px. The worst case is `novembro`/`20`, not `fevereiro`/`22`, because Fraunces' figures are not tabular | §3.1, ADR-0071 consequence (i), `card.tsx` doc block |

---

## 1. What ships

| Artifact | Route it serves | Reads | Generation |
|---|---|---|---|
| `apps/web/app/arquivo/opengraph-image.png` + `.alt.txt` | `/arquivo` | nothing | rendered at **commit** time from `archiveCard()`, `WRITE_ARCHIVE_CARD=1` |
| `apps/web/app/cartao/[data]/route.ts` → `/cartao/<YYYY-MM-DD>` | `/arquivo/<data>`, by explicit `openGraph.images` | `listArchivedDays(db, {from, to, limit: 1})` | `force-dynamic` |
| `apps/web/app/cartao/mes/[mes]/route.ts` → `/cartao/mes/<YYYY-MM>` | `/arquivo/mes/<mês>`, by explicit `openGraph.images` | `listArchivedDays(db, monthDayBounds(month) + limit: 1)` | `force-dynamic` |

One new card kind (`archiveCard`), one new read call (an existing reader), two new route modules, one new static asset pair. The eight game image routes and the root asset pair are **byte-unmoved**.

---

## 2. Decision A — route shape, and the trace cost

### 2.1 The measurement that governs

ADR-0054 decision 9 (`docs/adr/0054-…md:562-618`) measured it and the table at `:583` names these exact three routes: `/arquivo`, `/arquivo/[data]`, `/arquivo/mes/[mes]` went **23.5–23.6 MB → 2.7 MB** when the root card stopped being a metadata *module*. A metadata module on a segment is resolved into the metadata graph of every descendant route and traces `next/og` → `@vercel/og` + `resvg.wasm` + `sharp` + libvips into functions that render no card.

Three shapes were on the table:

- **(a) segment modules** — `app/arquivo/opengraph-image.tsx`, `app/arquivo/[data]/opengraph-image.tsx`, `app/arquivo/mes/[mes]/opengraph-image.tsx`. `/arquivo` is the worst: it is an ancestor segment of both the others and of the four archive play routes, so one module there re-inflates all three shells. Even the narrow version (modules only on `[data]` and `mes/[mes]`) re-inflates two user-facing page functions from 2.7 MB to ~23 MB each.
- **(b) the relief ADR-0054 named and did not take** — `:611-613`: *"Moving the dated cards to non-segment URLs with explicit `openGraph.images` would lift that too, at the cost of the convention; it is noted for #37 rather than taken here."*
- **(c) a committed static PNG** for anything dateless — the `T-WEB-S212` / `WRITE_SITE_CARD=1` precedent. Zero read, and **no trace on any page route** — it compiles to its own static route entry, as `app/opengraph-image.png` already does at ~1.7 MB / 101 files in the tree's current build.

### 2.2 The shape taken

**Index → (c). Day and month → (b).**

- The index card is dateless and its page never 404s, so it reads nothing and can be a file. A static image asset in a segment **costs no trace on any descendant page route** — that is precisely what D9's measurement proved when the root module became a PNG. It is *not* zero trace in absolute terms: the asset compiles to `.next/server/app/arquivo/opengraph-image.png/route.js` with its own `.nft.json`, roughly the ~1.7 MB the root asset's entry already costs. That row will appear in the PR body's before/after table and the words here must not contradict it. It also *improves* the degraded paths: a malformed `[data]` or `[mes]` segment (where `generateMetadata` returns `{robots:{index:false}}` and no `openGraph`) now inherits the **archive** card by nearest ancestor instead of the root site card.
- The day and month cards are date-bearing and must read, so they must be functions. Putting those functions at their own URLs keeps `/arquivo`, `/arquivo/[data]` and `/arquivo/mes/[mes]` at 2.7 MB and puts the ~23 MB payload on the two functions that actually rasterise. What changes is **who pays the cold start** — under (a) it is three page routes a human visits, under (b) it is two routes only a scraper fetches. That is D9's own argument (`:588-591`: *"the product's front door among them, paying a ~10× cold-start artifact for a card that renders zero times at runtime"*), applied where D9 left it.
- **And the total is smaller, not merely better distributed.** Shape (a) is ~3 × 23 MB ≈ 69 MB; shape (b) is ~3 × 2.7 + 2 × 22 + 1.7 ≈ 54 MB. **Confirmed at step 5, and the estimate stands:** the measured per-function figure is **22.4 MB**, so 3 × 2.7 + 2 × 22.4 + 1.7 = **54.6 MB**. The number is now measured rather than estimated, and the win is real.

**The four archive PLAY routes, checked rather than assumed.** `app/arquivo/opengraph-image.png` puts a file-convention image on an **ancestor** of `app/arquivo/[data]/{binairo,sudoku,nonogram,termo}` — the exact mechanism ADR-0054 D8 exists to police, and a silent four-route breakage if it went the other way. It does not: each of those four segments owns its own `opengraph-image.tsx` at its own level, each `page.tsx` declares `openGraph` **without** `images`, and `mergeStaticMetadata`'s `hasOwnProperty` guard re-adds that segment's own file after the leaf `case 'openGraph'` replace (§2.4). So the game card wins at its own level and nothing regresses. This is asserted here, curled in step 0's criterion 2 (each of the four must still show its **own** `/arquivo/<data>/<jogo>/opengraph-image` URL, never `/arquivo/opengraph-image.png`), and recorded as a checked row in §11.2 beside the `:418-420` annotation.

**Strengthened at step 5, because the measurement gave a better reason than this argument does.** All four routes came back clean on the spike's criterion 2, and the reason is **structural rather than dependent on `mergeStaticMetadata`'s ordering**: a `page.tsx`'s `generateMetadata` is **not inherited by child segments at all** — only `layout.tsx` metadata is — so `app/arquivo/[data]/page.tsx`'s new `openGraph` can never reach `app/arquivo/[data]/<jogo>`, `images` entry or no `images` entry. The `hasOwnProperty`-guard argument above is true and is what protects the four against an **ancestor asset**; this one is what protects them against the day page's own leaf declaration, and it holds whatever a future Next release does to the merge order.

**This re-opens ADR-0054 decision 9 rather than merely annotating it, and the plan says so plainly.** D9 deferred this relief to #37. #104 takes it **for the three archive shells only**. The eight game cards stay on the file convention and their ~23 MB residual stays #37's, unchanged — moving them is an eight-route change with its own metadata consequences and is not in this ticket. The cost of the asymmetry is real and is named in ADR-0071's consequences: the repo will hold two card mechanisms.

### 2.3 What (b) buys beyond the trace

- **`alt` can carry the date.** `alt` on a metadata route is a module export and cannot read `params` (`src/og/copy.ts:23-26` — the claim opens at `:23`, *"`altGame` … is DATELESS by"*). An `images[].alt` composed in `generateMetadata` can. `ogCopy.altGame`'s "dateless by constraint" sentence stays true of the game family and gains a sibling that is dated for the same structural reason inverted.
- **The malformed-segment residual narrows.** ADR-0054 D8 `:521-531` records that *every* archive `[data]` segment, malformed included, emits an `og:image` that 404s, because the image comes from the file convention and not from the metadata object. Under (b) a malformed segment composes no `openGraph` at all, so it inherits a real card. D8's residual is narrowed, not widened.

### 2.4 Two Next behaviours this shape depends on — verified in the installed source, re-verified on a build

Read out of `apps/web/node_modules/next/dist/lib/metadata/resolve-metadata.js` (next@16.2.12):

1. **Two mechanisms, not one, and the landmine follows from the pair.** `mergeMetadata`'s `case 'openGraph'` (`:182-186`) **replaces** the accumulated `openGraph` wholesale — that is what kills an **ancestor's** image. `mergeStaticMetadata`'s guard (`:148-158`, comment included: *"file based metadata is specified and current level metadata openGraph.images is not specified"*) re-adds a file-convention image only `if (openGraph && !source?.openGraph?.hasOwnProperty('images'))` — and that governs the **same level's** file, because `mergeStaticMetadata` runs **last** at each level (`:311`) with `source` = that level's own metadata and `staticFilesMetadata` = that level's own image files (`collectMetadata`, `:430`). So: ancestor image + leaf `openGraph` of any shape → the ancestor image is wiped by the replace, and the leaf's `mergeStaticMetadata` returns early because the leaf owns no file. **That is the landmine:** adding `openGraph` to these `generateMetadata`s without an explicit `images` entry deletes their card. The plan never does that.
   **There is a live precedent in this repo, and it survives only by owning a file.** `app/arquivo/[data]/termo/page.tsx:54` already does `openGraph: { ...OG_DEFAULTS, title, description }` with **no `images`**, and it is safe only because that segment owns `opengraph-image.tsx`, so the guard re-adds it. Move that file and those four pages lose their card silently. The warning is not theoretical.
2. `postProcessMetadata` sets `autoFillProps.images = openGraph.images` when `twitter` carries no own `images` (`:619-654`: `const hasTwImages = Boolean(twitter?.hasOwnProperty('images') && twitter.images); … if (!hasTwImages) autoFillProps.images = openGraph.images;`), so `twitter:image` follows the explicit entry. No `twitter-image.*` is owed, and ADR-0054 D11's *"no `twitter-image.tsx` will ever be needed"* (`:729`) survives.

Both are re-verified against a real `next start` in **step 0** (§9), not taken on the source read alone.

### 2.5 The URL family — the word, and the position

`/cartao/<YYYY-MM-DD>` and `/cartao/mes/<YYYY-MM>`.

**The word.** These are **chosen slugs**, so ADR-0054's *"`opengraph-image` is a Next file-convention name, same class as `/sitemap.xml`"* excuse (`:1243-1249`) does **not** carry: ADR-0013 `:23` bites and the segment is pt-BR, unaccented, consistent with `/estatisticas` and `/modo-livre`. `cartao` is the product's own word for this artifact, already shipped — `ogCopy.altSite` is `` `Cartão do ${messages.brand.wordmark}` `` (`copy.ts:45`), which is what a screen reader speaks today. `cartaz` is a printed poster and would be wrong; `imagem` abandons the product's vocabulary. Both URLs are built by `routes.ts` builders, never typed as literals, so ADR-0013 `:36` (*"Nothing may hardcode the apex outside environment config"*) holds through `metadataBase` — the path plan 040 `:1288` already records as this repo's obedience route — and `:38` (*"Route slugs live with the i18n strings from the first route"*) is satisfied by the `routeSlugs` entry below rather than by a literal in a builder body.

**`routeSlugs` gains `card: "cartao"`**, with its own doc comment, exactly as `month: "mes"` and `terms: "termos"` have. Without that entry a pt-BR literal enters a builder body with no home, which is the thing `routes.ts`'s header comment exists to prevent. Named here because §7's Modified table would otherwise stop at the two builders.

**The position, argued rather than assumed.** The alternative is `/arquivo/cartao/<data>` and `/arquivo/cartao/mes/<mes>` — `app/arquivo/cartao/[data]/route.ts` and `app/arquivo/cartao/mes/[mes]/route.ts`. It mirrors the existing `mes` shape exactly (`routes.ts:12-17`: *"a LITERAL segment between `/arquivo` and the month, so `app/arquivo/mes/[mes]` and `app/arquivo/[data]` can coexist"*), it costs nothing on the trace argument (§2.2's measurement is about **metadata convention modules** resolved into descendants' metadata graphs; a plain `route.ts` is not one, wherever it sits), it keeps `/arquivo` with a single home in the app, and it does not put a machine-only endpoint into a namespace whose twelve entries are today every one a segment a person visits.

**Root wins anyway, on one forward argument.** ADR-0054 D9's relief is taken here for the three archive shells only; the eight game cards' ~23 MB residual stays #37's (§2.2). When #37 takes it, the family it needs is `/cartao/<data>/<jogo>` **and** the four daily game cards — and the daily four do not live under `/arquivo` at all. A nested `/arquivo/cartao/**` family could host the archive half and would leave the daily half homeless, so #37 would either mint a second family or move this one. A root family hosts all of it. That forward cost is larger than the namespace tidiness the nested shape buys, so the choice is root, recorded here with its price: `routeSlugs` becomes mixed-purpose — twelve page segments and one machine endpoint — and the doc comment on `card` says so in those words.

**Not brought to Fernando, and the reason is recorded.** `/cartao/<data>` is an `og:image` target a rasteriser answers on: not linked, deliberately out of `sitemap.ts` (§7.1), never navigated to. It is the `/sitemap.xml` / `/robots.txt` class, and CLAUDE.md's "bring him product scope" means what the product does, not the URL a scraper fetches. ADR-0013 already decided the language; #34 minted nine English-segment public URLs without asking; and "should the card endpoint be `/cartao` or `/arquivo/cartao`?" is not answerable in one line with a stated consequence per branch, which is CLAUDE.md's own test for what may be put to him.

Consequence to record: the count of public URLs ending in an English segment goes **nine → ten** (the new `/arquivo/opengraph-image.png`), and the two dynamic card URLs are pt-BR **by obedience rather than by exception** — which is a strictly better position than the one #34 had to argue for.

### 2.6 Fallback, named before it is needed

If step 0's pass criteria fail — the pages do **not** stay at ~2.7 MB, or a route handler cannot serve an `ImageResponse` cleanly under Turbopack — **stop and re-plan.** The fallback direction is **shape (a) on `[data]` and `mes/[mes]` only** (`app/arquivo/[data]/opengraph-image.tsx`, `app/arquivo/mes/[mes]/opengraph-image.tsx`), **never one on `app/arquivo/`**, which is the ancestor that re-inflates all three shells and the four play routes. The index card is (c) either way. The measured numbers and the reversal go in ADR-0071 and the PR body.

The fallback's own test and record consequences are **not specified here**. They are a branch step 0 resolves in under an hour, and writing them out now is speculative work that ages into a wrong instruction. (They are not small — `T-LINT-S44`'s path list, `T-WEB-S204`'s re-aim, the dated `alt` strings and the `revalidatePath` paths all move — which is exactly why they should be derived against the measurement rather than guessed against it.)

---

## 3. Decision B — the day card does not name the games

**It is a dated nameplate.** Three arguments, all recorded rather than aesthetic:

1. **ADR-0053 decision 3 `:303-309`: the floor is ragged.** *"The cron gained its four games on four different days with no backfill, so the archive's oldest days hold one, two or three games … the same shape any `killed_at` takedown produces."* A card naming four games is false on the archive's oldest days and false on any takedown day. A card naming *the day's actual* games is a variable-length composition whose content is derived from the read — which turns an existence proof into a source of pixels, the thing ADR-0054 D8 exists to prevent.
2. **DESIGN.md `:69` — "card dentro de card".** Four game plates inside the 1200×630 paper card is literally the anti-reference. The weaker form — four names in a row, no plates — escapes that rule and is refused on its own ground: **the four names cannot be told apart by colour at all.** `DESIGN.md:20` is absolute — *"The shared per-game accent may never colour a word — no `color: var(--accent)` on text, at any size, on any paper."* So a row of four game names is four undifferentiated words in the same ink. On the shipped `gameCard` the game is legible in a chat bubble because the **tape and shadow** carry `ACCENT_TAPE[game]` / `ACCENT_SHADOW[game]` and a recipient reads the colour before the word; a card holding four games has no fifth surface to colour and no colour to give it. At the ⅓ display scale `card.tsx:42-44` names as the governing fact of the module, four 39 px names are four 13 px words nobody reads, and the date stops being the subject.
3. **ADR-0054 D1a's principle, quoted — and the quotation is corrected at step 5.** The step-4 text put *"the archive surface is a narrower surface than the daily's, never a wider one"* inside quote marks; those are not the file's words. The verbatim sentence is at `docs/adr/0054-…md:207`, inside decision 1a's **#103 annotation**, and it reads: *"The result is a **narrower** surface than the daily's, never a wider one."* Its subject there is the archive's late-result share panel, which is the same surface relationship one layer up. The on-page archive day card is already the narrow variant — DESIGN.md `:48`, kicker + title only, no description, no duration, no pending counterpart. Widening the *share* surface past the *page* surface would invert that.

**And the mechanism is structural, not a convention — but state it exactly.** Two things do two different jobs, and conflating them produces a false claim:

- **`archiveCard({ display, caption })`'s signature is the structural guarantee.** Two `string`s, both already formatted; no parameter a `Game` or an `ArchivedDay` can enter through. That is the identical argument `card.tsx:229-243` already makes for `gameCard` — *"the absence of a fallback is what makes the signature a guarantee rather than a convention"* — and the property `T-WEB-S201`'s type-level arm already knows how to police (`og-card.test.tsx:369-378`).
- **`limit: 1` is the bound that makes the read honest**, not the guarantee. It reduces the read to an existence answer, so no game **set** is ever in scope. It does **not** prevent naming *a* game: `listArchivedDays` returns `readonly ArchivedDay[]` and `ArchivedDay` is `{date: string; game: Game}` (`packages/db/src/published.ts:309-312`, *"One archived `(date, game)` pair — no content, by construction"*), ordered `date DESC, game ASC`, so `days[0].game` is one property access away. Any sentence saying the handler "cannot see which games the day holds" is **false** and must not be written into an ADR or an issue comment.

What *is* true and worth recording: nothing puzzle-derived is in the type at all (`ArchivedDay` carries two columns and no content), the caption is composed from the **URL**, and the builder cannot take a game. Those three together are the claim.

**No kicker on any archive card.** DESIGN.md `:29`: kickers are *"a deliberate brand system, used for game categories, not as a generic section eyebrow."* "ARQUIVO" as a 33 px uppercase eyebrow would be exactly the banned use. `siteCard()` is the precedent for a non-game card: no kicker. (This does not contradict the DESIGN.md `:48` citation in argument 3 above: `:48`'s on-page card **has** a kicker, and that kicker is a **game** name — which is the sanctioned use. The OG archive card has no game, so it has nothing a kicker could legally carry. Recorded because the two paragraphs sit close together and read as a contradiction otherwise, the same job §3.2 does for the tape.)

### 3.1 The composition — the display slot holds the most specific thing the URL names

One builder, one rule, three captions:

| Route | display slot (96 px Fraunces 500, `--ink`) | caption (39 px Instrument Sans 400, `--ink-2`) | bottom |
|---|---|---|---|
| `/arquivo` | `messages.archive.title` — "Arquivo" | `ogCopy.archiveTagline` | wordmark |
| `/arquivo/mes/<mês>` | `formatMonth(\`${month}-01\`)` — "fevereiro de 2026" | `messages.archive.title` | wordmark |
| `/arquivo/<data>` | `formatLongDate(date)` — "22 de fevereiro de 2026" | `messages.archive.title` | wordmark |

```
paper(tape: ACCENT_APP_TAPE, shadow: ACCENT_APP_SHADOW)
  column, width 100%, height 100%, display:flex
    display                           displayStyle   (Fraunces 500, 96px, --ink)
    caption                           bodyStyle + marginTop 12 (Instrument Sans 400, 39px, --ink-2)
    <spacer flexGrow:1 display:flex>
    messages.brand.wordmark           wordmarkStyle  (Fraunces 500, 39px, --ink)
```

So the builder's signature is `archiveCard(args: { readonly display: string; readonly caption: string })` — two formatted strings, and nothing a `Game` or an `ArchivedDay` can enter through.

**Why this way round, and why the earlier draft was wrong.** The step-2 draft put the constant word "Arquivo" at 96 px on all three cards and the only varying string at 39 px. At ⅓ display scale that is a ~32 px constant over a ~13 px variable: ~1,096 day cards, ~36 month cards and the index card would have been the same image but for one quiet line of `--ink-2`, and sharing `/arquivo/2026-08-03` would have produced a preview interchangeable with sharing `/arquivo`. The ticket's own words are that the day URL *"is the only one of the three with a date to put on a card at all"*; a card whose date is its least prominent element is not a day card. The rule above also matches what the product's own `<title>`s already get right — `meta.dayTitle` is `` `Puzzles de ${longDate} — Miolos` `` and `meta.monthTitle` is `` `Arquivo de ${month} — Miolos` ``, both leading with the specific thing. The card should not invert the page title.

The family still reads as one family: same paper, same `ACCENT_APP_*` tape and shadow, same two faces, same four-element stack. Family comes from those, not from which string sits at 96 px.

**Sizing is measured in §12.2, not asserted here — and the measurement is load-bearing.** Inner width is **890 px** — `CARD_BOX_WIDTH − 2 × CARD_PADDING − 2 × border` = `1040 − 144 − 6` (`card.tsx:89,91`). *(**Corrected at step 5 from the harness**: the step-4 text said 896, dropping the border. Yoga's `width` is a border box, so `paper()`'s 3 px border eats 6 px of it. The correction is small and it is the direction that matters — the real box is narrower than the plan assumed, so an arithmetic that only just fitted would have been wrong.)* Satori *overflows a fixed container silently rather than wrapping visibly* (plan 040 `:847`), so an overflow is invisible until someone opens a PNG.

- The **index** is unchanged from the shipped `siteCard` shape (one short word at 96 px) and is free.
- The **month** worst case is `"fevereiro de 2026"`, 17 characters. Plan 040 `:849` measured `"Nonogram"` at 96 px in the committed cut at **480.6 px** for 8 characters, and month names run to narrower letterforms and two spaces — it very probably fits inside 890 px, and §12.2 measures it rather than taking that arithmetic. **Measured: it does** — worst case `"novembro de 2028"` at **843 px**, so the month card stays at rung 1.
- The **day** worst case is `formatLongDate` over all twelve pt-BR months. `"22 de fevereiro de 2026"` is 23 characters and plausibly does **not** fit at 96 px. §12.2's harness renders it and decides, in this order — **take the first rung that passes, and record which rung was taken in ADR-0071 and the PR body**. **Measured at step 5: rung 1 FAILS and the day card takes RUNG 2.** Enumerated over all 366 day-and-month combinations, the worst case is `"20 de novembro de 2028"` at **1111 px** against 890 — a 25 % overflow — and rung 2's `"20 de novembro"` fits at **729 px**. The worst case is `novembro`, not the longest string by character count, because Fraunces' figures are **not tabular** (`0` is 63 px, `1` is 43 px), which is also why `"20"` beats `"22"`: the ticket's own example date was not the worst case, and neither was `fevereiro`. Rung 3 is not paid.
  1. **The long date fits at 96 px** → done. No new length, no new type level, no new formatter.
  2. **It does not** → day and month at 96 px, year on the caption line: `"22 de fevereiro"` (15 chars) over `` `de 2026 · ${messages.archive.title}` `` at 39 px. One small formatter in `apps/web/src/i18n/format.ts` beside `formatLongDate`/`formatMonth`, whose output is still a **date**, so §3's "nothing but two formatted strings reaches the builder" guarantee and `T-WEB-S201` are unharmed.
  3. **A third display level (~80 px, i.e. `80 = 3 × 26.67` off the mobile scale)** is the fallback of last resort. It is a real cost under `card.tsx:40-57`'s ×3 rule — a new absolute length in a module whose doc block enumerates its exceptions — and is paid only if 1 and 2 both fail.

**The ×3-from-mobile rule is obeyed by reuse.** Every value in the stack already exists in `card.tsx`: `displayStyle` (96), `bodyStyle` (39), `wordmarkStyle` (39), `marginTop: 12` (present in both `gameCard` and `siteCard`), the `{display:flex, flexGrow:1}` spacer, and `paper()`'s angles and padding. The three documented exceptions (angles unchanged at −0.5deg / −4deg; optical size *divided* by three, i.e. the committed 36 pt Fraunces cut; and the two deliberately rounded lengths, card width 1040 not 1062 and padding 72 not 66) are inherited whole. **Under rung 1 or rung 2 no new type level, no new absolute length and no new derivation is owed.** That is a *result* of the composition, not the reason for it — the reason is the rule at the top of this section — and it is stated so the PR body can claim it once §12.2 has proved which rung was taken.

**Fonts:** Fraunces 500 and Instrument Sans 400 only. Instrument Sans 600 is unused (no kicker). All three faces are already registered; satori synthesises nothing; `assets/fonts/SHA256SUMS` is unchanged.

**Satori landmines:** `display: flex` on every multi-child node including the spacer; no `background` shorthand; no px colour stop — all inherited unchanged from `paper()` and `deskDots()`, which #104 does not touch.

### 3.2 The washi-tape tension, resolved explicitly

`app/arquivo/index-view.tsx:35-37` says the archive index carries **no** washi tape, because *"tape marks a game, and the index is not a game."* The three archive cards **do** carry one tape.

These are claims about two different objects and neither moves. `index-view.tsx` is about the archive index **page**, which has no paper card with a top edge to tape — its texture is the desk dots and the hairlines. On the **card** surface, `siteCard()` already establishes the rule and `card.tsx:267-276` writes it out: a non-game card *"is not any one game's, so it takes `--accent-app` … and `DESIGN.md:37` describes ONE tape over a card's top edge rather than four."* On this surface the tape marks *a card*; the **accent** is what marks a game, and `ACCENT_APP_*` is the non-game accent. No edit to `index-view.tsx`; the reconciliation is recorded in ADR-0071 so a reviewer does not read it as a contradiction.

---

## 4. Decision C — what "exists" means, per route

Each card's existence semantics is its page's, by construction, and the mechanism differs per route for the same reason the page's does.

| Route | The page | The card | Reader call | Refusal |
|---|---|---|---|---|
| `/arquivo` | never 404s; an empty archive renders `messages.archive.empty` | always renders | **none** | — |
| `/arquivo/mes/<mês>` | `notFound()` when `days.length === 0` (`page.tsx:68-70`) | 404 when the same read is empty | `listArchivedDays(db, {...monthDayBounds(month), limit: 1})` | bare `Response(null, {status: 404, headers: CARD_HEADERS})` |
| `/arquivo/<data>` | renders whatever games exist, ragged floor included; `notFound()` on empty | 404 when the same read is empty | `listArchivedDays(db, {from: date, to: date, limit: 1})` | same |

**Existence is the DAY, not a game's row.** A day holding one game renders a card, exactly as the page renders one game. That is ADR-0053 D3's shipped shape, and it is one of the three reasons the card names no game (§3).

**`limit: 1` earns its place on the honest ground, not the overstated one.** It is the smallest read that answers the page's own question — the month page asks `days.length === 0` (`mes/[mes]/page.tsx:68-70`) and the day page asks the same — so the card's truth value is identical to its page's by construction, and no game **set** is ever in scope. It is **not** what stops the card naming a game; `archiveCard`'s signature is (§3). Kept because a bounded read is the right read for an existence proof, and because `T-WEB-S334` can assert the bound.

**Zod before any read**, in both handlers: `parseArchiveDate` / `parseArchiveMonth` first, refuse on `undefined`, so a hostile segment costs nothing. `parseArchiveMonth` carries the year-zero floor that fixed a real unauthenticated 500 (`parse-params.ts:45-64`) — the card inherits it by calling the same parser, never a second regex.

**No fallback card, ever.** A refusal is a bare `Response`, never `notFound()` — there is no page to render a not-found boundary into.

### 4.1 The catch, and why these handlers have none

The rule carried verbatim from ADR-0054 D8: *"the catch is narrowed to the projection class and everything else re-throws"*, the boundary is the name set `{"ZodError", "DailyProjectionUnsupportedError"}`, and *"the `try` wraps the read alone"* so a satori throw is a 500.

Applied to `listArchivedDays`, that rule produces **no catch at all**, and the plan states the reasoning rather than the omission. `listArchivedDays` selects two columns — `date` and `game` — runs no projection and parses nothing (`packages/db/src/published.ts:372-396`), so no member of `PROJECTION_ERROR_NAMES` can arise from it. Every callee on the path was traced: `parseArchiveDate` / `parseArchiveMonth` use `safeParse`, never `parse` (`src/archive/parse-params.ts`), so they cannot throw a `ZodError`; `getDb()` throws a plain `Error("WEB_DATABASE_URL is not set")` (`apps/web/src/db.ts`), not a `ZodError`. A narrowed catch there would be unreachable code that re-throws everything. Every throw the handler can see — a Neon timeout, a pool error, a missing `WEB_DATABASE_URL` from `getDb()` — is the class the name set was always designed to send to a 500. The `ImageResponse` construction is outside any read for the same reason it is outside the `try` in `archiveCardHandler`: a satori throw must be a 500.

**Pinned, not asserted:** `T-WEB-S334` includes a row where the reader throws an arbitrary error and asserts it propagates, and a row where the card builder throws and asserts the same. If a step-6 reviewer prefers symmetry with the game handlers, the alternative is to add the catch; this plan declines it because dead code that looks like a policy is worse than a policy written down. (The alternative costs no export either — `isBadRow`, `refuse`, `SIZE`, `CARD_HEADERS` and `PROJECTION_ERROR_NAMES` are all module-local in `src/og/handlers.ts` and §7 puts both new handlers in that same file. The argument is won on the merits and does not need a cost it does not have.)

### 4.2 The residual class: a well-formed segment the wall refuses

`listArchivedDays` carries `archivedWallPredicate()` (`published.ts:116-123`) — the publication conjuncts **plus strictly before the DB clock's São Paulo day. So `/cartao/<hoje>` 404s**, and so does any well-formed date or month the wall refuses. Meanwhile `generateMetadata` on `app/arquivo/[data]/page.tsx` composes a full head for **any** well-formed calendar date — step-6 finding F23 already records this in its own words (*"`/arquivo/1999-01-01` answers 404 with a self-referential canonical and a title naming puzzles that do not exist"*). After #104 that head also carries an `openGraph.images` pointing at a card URL that 404s. Two cases, and they are not the same case.

**Case A — the 404 page (future dates, dates before the archive floor, fully killed days; and the same for `/arquivo/mes/<mês>` on a well-formed empty month).** The page itself answers **404**. The card URL in its head also 404s. **Accepted**, on F23's own recorded argument: the status is what scrapers act on, and a 404ing `og:image` on a 404 page is not a lie about anything. It is a change — before #104 those pages advertised the root card, which resolves 200 — and it is disclosed here rather than discovered at step 6.

**Case B — today (`/arquivo/<hoje>`).** Here the page does **not** 404: `ArchiveDayPage` calls `redirect(routes.home)` (`app/arquivo/[data]/page.tsx:87-91`), which throws and makes Next answer **307 with a `Location` header**. Whether a residual exists at all depended on one fact, which step 0 **measured** rather than assumed: does that 307 carry an HTML body?

**It does — corrected at step 5, and the step-4 text's first branch is DELETED.** That branch read *"If it carries no body, there is no `<head>` … in that case the residual does not exist"*, and it is **false**. Measured 2026-08-22 on a real `next start` (spike §9.1–9.2): the 307 answers `Content-Type: text/html; charset=utf-8` with **12,509 bytes** on disk (12,673 with the probe removed), a complete `<!DOCTYPE html>` document carrying a full `<head>` with `og:image`, `twitter:image`, `og:title`, `og:description` and a self-referential `<link rel="canonical">`, and `NEXT_REDIRECT;replace;/;307;` visible at the tail of the RSC payload. There is no `content-length` header — the response is `Transfer-Encoding: chunked` — so the byte counts are what landed on disk.

**And the corpus already knew, which is worth recording rather than glossing.** ADR-0054 `:62-63`, inside decision 1's own reasoning about the two scraper populations, says the non-following one *"parses its body, which is `text/html` and ships a complete `<head>` from the **archive** route"*. The step-4 text framed this as an open question and wrote a branch on the answer being no; a sentence in the record it was amending already said yes. Measuring it was still right — a sentence written for a different purpose is not evidence — but the branch should never have been written as though the answer were unknowable.

**So case B is a REAL, new, one-date regression on a public surface**, and it is written here, in ADR-0071's consequence (c) and in §16 D7 from that measurement rather than from an assertion. Today a non-following scraper reading `/arquivo/<hoje>` gets `og:image` = the root site card, which resolves **200**; after #104 it gets `/cartao/<hoje>`, which **404s** (the same spike confirmed `listArchivedDays({from:"2026-08-22", to:"2026-08-22", limit:1})` returns `[]` against the real database, so the handler refuses).

It is **accepted**, and bounded in this order:
- **Every scraper the repo has probed follows the 307.** ADR-0054 `:63-64`: probed on Facebook/WhatsApp, X, Slack, Discord and LinkedIn, 2026-08-14. Followers land on `/` and read the root card, exactly as today.
- The affected population is unprobed scrapers, on **one date**, and the failure self-heals at the next São Paulo midnight.
- `CARD_HEADERS` on the 404 arm is what stops that refusal being cached past midnight — step-6 finding K2's argument, verbatim: *"a refusal is exactly the response whose truth flips at São Paulo midnight."*
- The product emits `/arquivo/<data>/<jogo>` in its share text, never the bare day URL; reaching the day URL is a manual address-bar copy.

**Three fixes, all named, all ruled on:**

1. **A day-level existence read that includes today** (`wallPredicate`'s bound rather than `archivedWallPredicate`'s) in `packages/db`. **Refused:** it grows ADR-0053 D4's *"Three archive readers"* enumeration, breaks #34's `git diff main -- packages` exit criterion, and buys a card for one date for scrapers nobody has been able to observe.
2. **Reading the clock in `generateMetadata` via `todaySaoPauloDate()`.** **Refused outright:** a second clock, and ADR-0053 permits only the DB's.
3. **`302` to `/opengraph-image.png` on an empty read, instead of `404`.** Cheap, and it is the only one that fixes both cases at once: a non-following scraper gets the root site card, which is exactly today's behaviour, with no new reader, no clock and no `packages` diff. **Refused, and this is the closest call in the plan.** It costs the thing decision C exists to buy: the card stops being an existence proof, so `/cartao/9999-01-01` would answer 302→200 and a hostile or curious fetch could no longer distinguish "this day is archived" from "this day is not". §4's whole table, `T-WEB-S334`'s refusal rows and ADR-0054 D8's structural-guarantee lineage all rest on the refusal being a refusal. Trading a real structural property for a cosmetic improvement on an unobserved scraper population is the wrong direction, and CLAUDE.md's gate rule — never weaken an assertion to make something pass — points the same way. Named here rather than left for a step-6 reviewer to raise as new.

**This residual goes in the PR body**, not only inside ADR-0071: it is a knowing change on a public surface.

---

## 5. Decision D — copy

Four strings, all in `apps/web/src/og/copy.ts`'s `ogCopy` deck. None in `messages.ts`; none on the i18n barrel. `T-WEB-S206a` audits both directions and is widened in place.

```
archiveTagline:    "Todos os puzzles do dia desde o começo."
altArchiveIndex:   `Cartão do ${messages.brand.wordmark} — ${messages.archive.title}`
altArchiveDay:     (longDate) => `Cartão do ${messages.brand.wordmark} — puzzles de ${longDate}`
altArchiveMonth:   (month)    => `Cartão do ${messages.brand.wordmark} — ${messages.archive.title} de ${month}`
```

- Register matches `altGame`/`altSite` exactly; the wordmark and "Arquivo" come from `messages`, **never re-typed** — and `altArchiveMonth` obeys that bullet rather than contradicting it. The step-2 draft wrote `` — arquivo de ${month} ``, which both re-typed the word and lowercased it against the product's own mid-sentence capitalisation (`messages.archive.title` = `"Arquivo"`, `backToIndexAria` = `"Voltar para o Arquivo"`, `meta.monthTitle` = `` `Arquivo de ${month} — Miolos` ``). Composing `${messages.archive.title}` fixes both and matches `meta.monthTitle`'s register exactly.
- **`archiveTagline` is the shipped sentence, not a new one.** `messages.archive.lead` opens with **"Todos os puzzles do dia desde o começo."** — 39 characters, a tagline in form and function, already rendered on `/arquivo`, the very page this card serves. The step-2 draft minted *"Os puzzles do dia, desde o começo."* (34 characters, with a comma no other archive string uses), which would have put two spellings of one claim on one surface — the failure `messages.ts:23-25` polices in its own words (*"a second copy is how two screens drift apart"*). Reusing the shipped sentence costs the four characters and buys one source. Whether 39 characters of 39 px Instrument Sans fits the 890 px inner width is **measured in §12.2's harness**, not counted: 39 chars ≈ 760 px on a naive average, comfortably inside, but the same harness that sizes the day card sizes this.
- The **noun is `puzzles`, and the alternatives are wrong.** `CONTEXT.md`'s Daily row is *Daily | Puzzle do dia*, and four shipped strings agree: `archive.lead`, `meta.indexDescription`, `meta.monthDescription` and `meta.dayTitle` all say *puzzles do dia* / *Puzzles de …*. "quebra-cabeças" appears nowhere in the product. "jogos" means the four **games** and would collide with `ogCopy.siteTagline`'s *"Quatro jogos de raciocínio por dia."* on the sibling card. Recorded because it was contested at review, not because it was in doubt.
- **On length, `copy.ts:46-53` is an analogy and is cited as one.** That doc block records the reason for **`siteTagline`** and the number it names is **133** — `messages.meta.description`. It never mentions the archive strings. The same argument transfers: `messages.archive.meta.indexDescription` is **90** characters (measured on this branch: `"Todos os puzzles do dia do Miolos: Binairo, Sudoku, Nonogram e Termo, dia a dia, de graça."`, `messages.ts:675-676`), a wall of body copy where the composition wants a tagline. The step-2 draft said the block "already records" a fact about the archive string, and said 94. Both were wrong; a ticket that exists partly to repair a false enumeration cannot carry a loose citation.
- **No string contains `então`, `mamãe` or `época`** — `apps/web/scripts/route-client-js.mjs`'s `const FORBIDDEN_EVERYWHERE`, cited **by symbol and not by line**, which is `copy.ts:39-41`'s own instruction (*"by symbol, because the line has rotted twice"*) and is why the step-2 draft's inherited `:285` is not repeated here. "começo" is not one of the three; checked by symbol, not by eye.
- The month and day cards add **no** copy — their display line is `formatMonth` / `formatLongDate` output, their caption is `messages.archive.title`, and their `alt` composes from existing strings.

**The falsified sentence, `apps/web/src/og/copy.ts:34-36`** (the quotation's first word, *"The"*, is at `:34`):

> *"The ARCHIVE routes add no copy at all — they reuse the `messages.archive.meta` strings they already compose."*

**Replacement:**

> The archive **play** routes add no copy at all — they reuse the `messages.archive.meta` strings they already compose. The three archive **shell** cards do add copy (#104, ADR-0071): a tagline for the index card, which has no date to print, and three `alt` strings. Two of those three are **dated**, which is the mirror image of `altGame`'s constraint above rather than an exception to it: the day and month cards are referenced by an explicit `openGraph.images` entry composed inside `generateMetadata`, which *can* read `params`, so the reason `altGame` is dateless does not reach them.

---

## 6. Decision E — scope and staging

**One PR.** All three cards, the ADR, both amendments, the evidence and the records ship together.

The reasons are mechanical, not preference. The three cards share one builder, one copy-deck edit, one ESLint glob, one ADR and one set of record amendments. A three-PR sequence would amend ADR-0054's decision 7 three times, ship ADR-0071 `Proposed` and re-amend it twice, and file three `docs/README.md` rows — which is CLAUDE.md's rule 2 (*"If a ticket's process artifacts outweigh its code diff, it was the wrong tier"*) failing by construction. The code diff is roughly 250 lines across ten files.

**The ticket's "day first" is honoured as a build order inside the PR, not as a delivery boundary** (§9): the day card proves the shape end to end — spike, handler, builder, tests, preview `curl` — before the month copies it and the index is baked.

---

## 7. Files created and modified — exact paths

**Created**

| Path | What |
|---|---|
| `apps/web/src/og/images.ts` | `cardImage(url, alt)` → the `openGraph.images` entry: `{url, width: CARD_WIDTH, height: CARD_HEIGHT, alt, type: "image/png"}`. Imports `./card` for the two dimensions and nothing else. **Its whole purpose is that no string literal enters a `generateMetadata` body** — `T-WEB-S173`'s literal scan at `archive-metadata.test.ts:135` stays green without being weakened. |
| `apps/web/app/cartao/[data]/route.ts` | `export const dynamic = "force-dynamic"`; `GET` with a **hand-written** context type → `archiveDayCardHandler((await ctx.params).data)` — see the landmine below |
| `apps/web/app/cartao/mes/[mes]/route.ts` | same shape → `archiveMonthCardHandler((await ctx.params).mes)` |
| `apps/web/app/arquivo/opengraph-image.png` | the committed index card |
| `apps/web/app/arquivo/opengraph-image.alt.txt` | `ogCopy.altArchiveIndex`, one line, **no trailing newline**, byte-asserted |
| `docs/adr/0071-the-archive-cards-are-nameplates-and-two-leave-the-file-convention.md` | §11 |
| `docs/evidence/104-archive-og-cards/README.md` + PNGs | §12 |
| `docs/plans/068-issue-104-plan-archive-og-cards.md` | this file |

**Modified**

| Path | Change |
|---|---|
| `apps/web/src/og/card.tsx` | `export function archiveCard(args: { readonly display: string; readonly caption: string })`, plus a doc block naming: the display-slot rule (§3.1), no kicker and why (DESIGN.md `:29`), `ACCENT_APP_*` and the tape reconciliation (§3.2), the rung §12.2's measurement took, and that the signature admits no `Game` — the `gameCard` argument at `card.tsx:229-238`, restated for a builder that takes two formatted strings |
| `apps/web/src/og/handlers.ts` | `archiveDayCardHandler(segment)`, `archiveMonthCardHandler(segment)`; both reuse `refuse()`, `SIZE`, `CARD_HEADERS`, `FONTS`. Doc block extended with §4.1's no-catch argument |
| `apps/web/src/og/copy.ts` | four strings; the `:34-36` sentence replaced per §5 |
| `apps/web/src/i18n/routes.ts` | `routeSlugs` gains **`card: "cartao"`** with its own doc comment (§2.5); `archiveDayCardRoute(date)`, `archiveMonthCardRoute(month)` composed from it; both builders re-exported on the barrel beside `archiveDayRoute`/`archiveMonthRoute` |
| `apps/web/app/arquivo/[data]/page.tsx` | `generateMetadata` gains `openGraph: { ...OG_DEFAULTS, title, description, images: [cardImage(archiveDayCardRoute(date), ogCopy.altArchiveDay(longDate))] }` |
| `apps/web/app/arquivo/mes/[mes]/page.tsx` | the same, with `archiveMonthCardRoute(month)` and `ogCopy.altArchiveMonth(name)` |
| `eslint.config.mjs` | **two** changes: object (4)'s `files` gains `` `apps/web/app/cartao/**/*.${webWallExtensions}` ``, **and** its header comment at `:820-823` is corrected — *"These are the **eight** files in the app that call `getDb()` on an unauthenticated crawler-facing path"* becomes **ten**, naming the two `/cartao` handlers. That is the same claim §11.2 amends at ADR-0054 `:962`, living in a file this ticket already opens; growing one and leaving the other would ship a contradiction inside one diff |

`OG_DEFAULTS` **must** be spread on both — ADR-0054 D11: Next does not deep-merge, the nearest declaration wins whole, and without the spread these two routes would lose `og:type`, `og:locale` and `og:site_name`. These two are D11's **ninth and tenth** leaf declarations; `:714-718`'s count grows with them (§11.2).

**Landmine — the route handlers' context types are HAND-WRITTEN, never Next's generated ones.** Next 16's `RouteContext<'/cartao/[data]'>` lives only inside `.next/types`; `turbo.json:19` declares `"typecheck": { "dependsOn": ["^typecheck"] }` with **no `build` edge**, and the gate order wipes `.next` before typechecking — so a generated-type reference gives a green local run and a red gate with `TS2304`. The repo already documents exactly this for `PageProps` at `app/arquivo/mes/[mes]/page.tsx:18-25`, and the shipped OG routes already carry the hand-written idiom (`app/arquivo/[data]/termo/opengraph-image.tsx:14-19`). Both new files take the same shape and the same "not the generated type, and why" comment:

```ts
export async function GET(
  _request: Request,
  ctx: { readonly params: Promise<{ readonly data: string }> },
): Promise<Response> {
  return archiveDayCardHandler((await ctx.params).data);
}
```

**Landmine — `app/arquivo/opengraph-image.alt.txt` ships with NO trailing newline.** Next's `next-metadata-image-loader` reads the file with `readFile(altPath, "utf8")` and uses the bytes verbatim as `og:image:alt`. The committed root file has none (`xxd apps/web/app/opengraph-image.alt.txt` ends at `…4d 69 6f 6c 6f 73`, no `0a`), and `T-WEB-S204` asserts byte equality against the deck string. An editor or formatter adding a final newline reds that assertion, and would otherwise ship a trailing newline into a meta tag.

**`app/arquivo/page.tsx` is not modified at all.** The index card attaches by the file convention, so its `generateMetadata` stays byte-unmoved and `T-WEB-S173`'s index arm never reds.

### 7.1 Files that must NOT move, each with its reason

- `apps/web/next.config.ts` — `CARD_HEADERS` rides the `ImageResponse` options. `next-config.test.ts` asserts `headers()` returns exactly one rule.
- `apps/web/app/sitemap.ts` — all three page URLs are already there (`routes.archive`, `months.map(archiveMonthRoute)`, `archiveDayRoute(group.date)`). A card is not a page. `sitemap.ts`'s own #34 clause already says an `og:` tag is a sharing affordance and this file is the crawl posture.
- `apps/web/app/robots.ts` — the eight existing card routes are crawlable and unlisted; the two new ones are treated identically. Absence from a sitemap is not `noindex`, and `robots.ts` says so.
- `apps/web/impeccable.yml` URL lists, `apps/web/test/route-ssr.test.tsx`'s `ROUTES` table, `apps/web/scripts/route-client-js.mjs`'s `BUDGETED`/`PER_ROUTE_BUDGET` — a route handler is not a page, and it ships zero client bytes. **The citation that carries this is `next/dist/build/route-bundle-stats.js:116-117`** — `const pagePath = appPaths.find((p)=>p.endsWith('/page')); if (!pagePath) continue;` — read out of the installed source. `app/manifest.ts:14-16` (*"This is a metadata route, not a page: no React tree, no row in route-ssr's ROUTES table…"*) is the repo's own precedent for the same conclusion, but it is a **metadata route** and `/cartao/…/route.ts` is a **route handler** — a different Next construct reaching the same place, so it sits beside the `route-bundle-stats` citation rather than in front of it. Plan 040 §13's words apply verbatim: *"Adding an OG route to any of those three lists would be an active mistake."*
- `turbo.json` — **no entry of any kind is owed, and this is the row that says so** so nobody adds one the exit criteria then flag as an unexpected diff. `build.env` gains no build-time variable, and `test.env` (`["MIOLOS_FULL_PROPERTIES", "MIOLOS_TEST_DB_TIMING"]`) gains none either: `WRITE_ARCHIVE_CARD` follows `WRITE_SITE_CARD`, which is read as `process.env["WRITE_SITE_CARD"]` (`og-image.node.test.ts:741`) and documented as a direct package-script invocation (`:725`, `WRITE_SITE_CARD=1 pnpm --filter @miolos/web test og-image`), not a turbo task — which is why it appears in neither list today.
- `packages/**` and `apps/api/**` — `git diff main --stat -- packages apps/api` must come out **empty**, and it is an exit criterion. No reader is added; `listArchivedDays` is already exported from the root barrel and already permitted by the db wall.
- `assets/fonts/**` — no new face.
- `.impeccable/config.json` — see §12.
- `packages/ui/tokens.css` — no new token.

---

## 8. The ESLint wall

`apps/web/app/**/opengraph-image.*` does not match `app/cartao/**/route.ts`, so the two new card handlers would land **outside** the OG wall. One glob is added to **object (4)** — not a new object — so:

- `T-LINT-S43`'s replacement-regression control covers the new paths automatically: the object still repeats `webWallImportPatterns`, `webWallImportPaths` and the six `no-restricted-syntax` selectors verbatim. **Do not de-duplicate the spreads away** (flat config replaces a rule's whole configuration per matching file; measured at #34: without them all eight db-wall probes lint clean).
- **The intersection analysis, stated correctly.** The step-2 draft wrote *"`apps/web/app/cartao/**` intersects no earlier object's globs"*, which is **false**: it intersects object (1) (`apps/web/**/*.${webWallExtensions}`, `:717`) and object (2) (`apps/web/app/**/*.…`, `:754-755`). The verdict is unchanged and the reasoning is now the real one — the one object (4)'s own header comment at `:812-813` already uses:

  > `apps/web/app/cartao/**` is a **strict subset of (1)'s and (2)'s globs**, whose arrays object (4) already repeats verbatim, so the new files inherit both walls whole. It intersects **neither** object (3) (`apps/web/src/free-play/**` + `apps/web/app/modo-livre/**`, `:783-786`) **nor** object (5) (modo-livre OG only, `:887-890`). No new intersection object is owed. Recorded as an intersection **analysis**, not as an absence of intersection.

  This matters more than the wording: ADR-0054 `:981-983` deliberately widened the rule from *"a subset of (1)'s or (2)'s"* to **"any intersection with any earlier object"** precisely because the narrow phrasing hid finding K1. Repeating a bare "no intersection" claim re-introduces the hidden version, in a PR body and in an ADR. `T-LINT-S46` needs no edit. Object (4)'s `:812-813` subset claim is re-verified and **survives**.
- **The glob's mechanics are checked, not assumed.** `webWallExtensions` is `"{ts,tsx,mts,cts,js,jsx,mjs,cjs}"` (`eslint.config.mjs:19`), which includes `ts`, so `` `apps/web/app/cartao/**/*.${webWallExtensions}` `` matches `app/cartao/[data]/route.ts`. The `[data]` brackets live in the **subject**, not in the pattern, so they are inert — the same proof the existing `apps/web/app/**/opengraph-image.*` glob already gives by matching `app/arquivo/[data]/termo/opengraph-image.tsx`, which `T-LINT-S44` pins.
- `T-LINT-S44`'s hardcoded nine-path list and `toHaveLength(9)` stay **byte-unmoved**, because no ninth `opengraph-image.*` **module** is created — the index card is a `.png` and object (4)'s glob is `opengraph-image.${webWallExtensions}`, which matches no new path. (Under §2.6's fallback direction they would grow; step 0 decides.)

**The one-hop clause at `eslint.config.mjs:826-835` is honoured and its list does not grow.** (`:818-823` is the db-wall-probe / eight-files comment §7 amends — a different clause. The one-hop clause opens at `:826`, *"THIS WALL IS NOT TRANSITIVE, and it does not pretend to be (step-6 finding P2)"*, and its five-member set is enumerated at `:832-834`, closing at `:835` with *"A new import into `src/og/**` that does owes an entry here."*) The wall's whole one-hop set is `src/i18n`, `src/db`, `src/archive/parse-params`, `@miolos/db` and `@miolos/core`. `src/og/images.ts` is *inside* `src/og/**`, not a door into it, and it imports only `./card`. The two handlers import only modules already on that list plus `src/og/*`. **No entry is owed** — verified by reading the two handlers' intended imports against that list, and re-asserted by `T-LINT-S45`'s clean probe, whose path list gains the two card paths.

---

## 9. Build order, with blocking edges

**Step 0 — the measured spike. Blocks everything.** On a throwaway branch, no tests:

```
# on main
pnpm --filter @miolos/web build            # Turbopack production
# sum unique bytes behind each .nft.json, per route, for:
#   /arquivo   /arquivo/[data]   /arquivo/mes/[mes]
# then add ONE no-op app/cartao/[data]/route.ts returning an ImageResponse,
# add openGraph.images to app/arquivo/[data]/page.tsx, rebuild, re-sum.
```

**The date is DISCOVERED from the spike's own `/arquivo` page, never hardcoded.** ADR-0053 decision 12 binds here exactly as it binds in §12.4: `next start` reads the real `WEB_DATABASE_URL`, so a hardcoded `2026-08-03` that happens not to be an archived day in whatever database the spike points at returns 404 on criterion 3 — and the plan's rule is *"any failure → §2.6"*, which would reverse this plan's central decision on a data accident. Read `$DATE` and `$MONTH` off `/arquivo` first; read `$TODAY` off the same page's own clock surface or the DB, never off the shell.

Pass criteria:
1. **`.nft.json` sums** — the three page routes stay at ~2.7 MB and the new handler appears as its own `ƒ` entry, with its own `.nft.json`. Under this repo's Turbopack build those files exist at `apps/web/.next/server/app/**/*.js.nft.json`; a current build in the tree already carries **40** of them (**corrected at step 5 from the measured spike** — the step-4 text said 42, which is wrong for this tree: `main` at `ee4df9b` carries 40, and 41 with the probe). This is the **only data-independent criterion**.
2. **The head** — `next start` + `curl -s "$BASE/arquivo/$DATE" | grep -iE 'og:image|twitter:image|og:type|og:locale|og:site_name'` shows the explicit card URL on `og:image` **and** on `twitter:image`, with `og:image:width/height/alt/type` present and the three `OG_DEFAULTS` members intact. Assert with **`toContain` on the path, never equality on the URL** — a file-convention asset's emitted URL carries a `?<contenthash>` query (`next-metadata-image-loader.js:63,151`: `const hashQuery = contentHash ? '?' + contentHash : ''`), so `/arquivo/opengraph-image.png?<hash>` is what actually appears.
   **Same criterion, four more URLs:** curl each of `/arquivo/$DATE/{binairo,sudoku,nonogram,termo}` and assert each still shows its **own** `/arquivo/<data>/<jogo>/opengraph-image` URL, never `/arquivo/opengraph-image.png` (§2.2's ancestor check, measured rather than reasoned).
3. **The handler** — `curl -s -o /dev/null -D - "$BASE/cartao/$DATE"` returns `200`, `content-type: image/png`, `cache-control: private, no-cache, no-store, max-age=0, must-revalidate`.
4. **The today-URL probe (§4.2 case B), which decides prose rather than passing or failing** — `curl -s -D - "$BASE/arquivo/$TODAY" -o /tmp/today.html`, then: is there a body at all, and does it contain `og:image`? Record the status line, the `content-length`, and the grep result. §4.2, ADR-0071's Consequences and §16 D7 are written from this output. **This criterion cannot fail** — either answer is a fact — and it must not be skipped, because the alternative is publishing a consequence that may describe a non-event.

**An empty archive is a SKIP of criteria 2, 3 and 4, not a failure.** Only criterion 1 is data-independent, and only criterion 1 (plus a hard error on 2/3) triggers §2.6. Record which criteria were skipped and why.

Any real failure → §2.6, recorded with the numbers. **The before/after `.nft.json` table goes in the PR body**, in ADR-0054 D9's own format, and it will carry a **new row for `app/arquivo/opengraph-image.png/route`** at roughly the ~1.7 MB the root asset's entry already costs (§2.2) — expected, not a regression.

Then, on the real branch:

| # | Work | Blocked by |
|---|---|---|
| 1 | `src/og/card.tsx` — `archiveCard` + doc | 0 |
| 2 | `src/og/copy.ts` — four strings, the `:34-36` replacement | — |
| 3 | `src/og/images.ts` — `cardImage` | 1 (imports `CARD_WIDTH`/`CARD_HEIGHT`) |
| 4 | `src/i18n/routes.ts` — two builders + barrel | — |
| 5 | `src/og/handlers.ts` — the two handlers | 1, 2 |
| 6 | `app/cartao/[data]/route.ts` — **the day card, end to end** | 5 |
| 7 | `eslint.config.mjs` — the glob | 6 |
| 8 | `app/arquivo/[data]/page.tsx` — `openGraph` | 3, 4 |
| 9 | `app/cartao/mes/[mes]/route.ts`, `app/arquivo/mes/[mes]/page.tsx` | 6, 8 (copies the proven day shape) |
| 10 | `app/arquivo/opengraph-image.png` + `.alt.txt`, via `WRITE_ARCHIVE_CARD=1` | 1, 2 |
| 11 | Tests (§10) | 6–10 |
| 12 | Records (§11) | 0 (needs the measured numbers), 10 (needs the byte count) |
| 13 | Evidence + the gate (§12) | 1, 10 |

Steps 6 and 8 together are the "day first" milestone: at that point `/arquivo/<data>` has a working card, its preview `curl` evidence exists, and 9 is a copy.

---

## 10. Tests

**Ids to reserve on issue #104 before step 5** (frontier re-derived by the documented grep on 2026-08-21 and again at step 4 on 2026-08-22: `T-WEB` highest in use S330, `T-LINT` highest in use S53, both agreeing with the two frontier rows at `docs/agents/test-ids.md:43-44` — `T-WEB` next free `S333` because `S331`/`S332` are #64's burned tails, recorded at `:55-56`, and `T-LINT` next free `S54`):

- **`T-WEB-S333…S338`** — four planned, two tail headroom.
- **`T-LINT-S54…S55`** — one planned, one tail headroom.

Unspent tails are burned at step 8 and listed in the *Burned slots* table.

### 10.1 Minted

| Id | File | Claim |
|---|---|---|
| `T-WEB-S333` | `apps/web/test/og-card.test.tsx` | The archive card's composition: no kicker anywhere in its tree; **the display slot holds the most specific thing the URL names** — `messages.archive.title` for the index call, the `formatMonth` output for the month call, the `formatLongDate` output (or rung 2's day-and-month string, §3.1) for the day call, and the day call's display line is **not** `messages.archive.title`; exactly one caption line; `ACCENT_APP_TAPE`/`ACCENT_APP_SHADOW` and no other accent; **no accent-coloured word anywhere in the tree** (`DESIGN.md:20`); the wordmark is the last child; every multi-child node declares `display:flex` |
| `T-WEB-S334` | `apps/web/test/og-image.node.test.ts` | The two handlers as an existence proof — an `it.each` table: past day with a **partial** game set → 200, PNG magic bytes, IHDR 1200×630, `CARD_HEADERS`; empty day → 404 + `CARD_HEADERS`; **today → 404** (the handler's own semantics, pinned so they cannot change silently — this row is about `/cartao/<hoje>` and makes no claim about what `/arquivo/<hoje>` emits; that is §4.2 case B, which step 0 measures); malformed segment → 404 with the reader **never called**, and the malformed set includes **`"mes"`**, because `/cartao/mes` with nothing after it matches `app/cartao/[data]/route.ts` with `data = "mes"` (the `mes` node registers no handler of its own) → `parseArchiveDate("mes")` → `undefined` → `refuse()`, which is correct and is exactly the kind of cross-handler shadowing a later tidy-up changes silently; month with days → 200; empty/future month → 404; a throwing reader → propagates (500); a throwing card builder → propagates (500); the reader is called with `limit: 1` and its return is read only for `length` |
| `T-WEB-S335` | `apps/web/test/og-metadata.test.ts` | The shells' `openGraph`: month and day spread `OG_DEFAULTS` and carry exactly one `images` entry whose `url` is the card route, whose `alt` carries the date, whose `width`/`height` are `CARD_WIDTH`/`CARD_HEIGHT`; **the index arm of `archive-metadata.test.ts:51`'s `toEqual` is byte-unmoved — `app/arquivo/page.tsx`'s `generateMetadata` returns no `openGraph` key** (it returns `{title, description, alternates}` today, verified on this branch). Worded that way on purpose: the *resolved* metadata for `/arquivo` will certainly carry `openGraph`, because the file convention injects the images and the root layout supplies `OG_DEFAULTS`. The claim is about the return value, not the resolved head. Plus: a hostile segment carries no `openGraph` and no `alternates` |
| `T-WEB-S336` | `apps/web/test/og-image.node.test.ts` | **The trace-shape tripwire**, scoped by exact path rather than by a subtree glob — the step-2 draft asserted *"no `opengraph-image.*` module under `app/arquivo/**`"*, which is **false against the shipped tree** (four exist and must keep existing) and would have red on first run, inviting an implementer to weaken the glob until it protected nothing. The three negative assertions: `app/arquivo/opengraph-image.{ts,tsx,js,jsx}`, `app/arquivo/[data]/opengraph-image.{ts,tsx,js,jsx}` and `app/arquivo/mes/[mes]/opengraph-image.{ts,tsx,js,jsx}` must **not** exist — by **extension**, not by stem, because this ticket ships `app/arquivo/opengraph-image.png` and `.alt.txt` at exactly that stem. That is what stops a later ticket "simplifying" a card back into a shell segment and silently re-inflating three routes. **The counted floor**, the repo's own idiom against a typo'd path making a negative assertion pass vacuously (`og-card.test.tsx:339-341`, `expect(routeFiles.filter(existsSync)).toHaveLength(8)`): the **four** play-route modules under `app/arquivo/[data]/{binairo,sudoku,nonogram,termo}/opengraph-image.tsx` **do** exist, asserted as `toHaveLength(4)`. Plus: both handlers declare `export const dynamic = "force-dynamic"`; their module graphs reach `@miolos/db` (a second counted floor) and contain no `/src/play/`, no `/src/day/`, no `readDayState`, no `useDayTruth`; `archiveCard`'s own graph reaches no reader |
| `T-LINT-S54` | `apps/web/test/eslint-og-wall.test.ts` | The wall's globs reach `apps/web/app/cartao/[data]/route.ts` and `apps/web/app/cartao/mes/[mes]/route.ts`: the games ban fires, and so do the db-wall probes (`@miolos/db/publishing`, the relative reach into `packages/db/src`, the table-name selectors, the computed dynamic import) — with the app-wide wall's own message text, the `T-LINT-S14` idiom |

### 10.2 Widened in place — no id

Every one is the same claim about the same gate; the `T-WEB-S100` and `T-DB-9a` precedents.

| File:line today | What changes |
|---|---|
| `archive-metadata.test.ts:51` (`T-WEB-S173`) | The `toEqual` grows an `openGraph` key on the **month** and **day** arms. The index arm is byte-unmoved |
| `archive-metadata.test.ts:135` (`T-WEB-S173`) | **Unchanged and must stay green.** The literal scan over the three `generateMetadata` bodies passes by construction because `cardImage` owns `"image/png"` and `routes.ts` owns the paths. If it reds, the fix is to move a literal into a module, never to weaken the scan |
| `og-card.test.tsx:74` (`T-WEB-S200`) | The accent walk gains `archiveCard`; the counted floor holds — exactly one accent `backgroundColor`, exactly one accent `boxShadow`, no accent-coloured word |
| `og-card.test.tsx:321` (`T-WEB-S201`) | The describe is *"nothing but a game and a date reaches the **card** builder"* — quoted exactly, because the step-2 draft dropped "card" inside quote marks. It grows so that nothing but two formatted strings reaches `archiveCard`, including the type-level arm at `:369` (`archiveCard`'s declared parameter type admits no `Game` and no `ArchivedDay`), which is §3's structural guarantee. **The property-read arm at `:362-367` must be fixed, not merely described**: its regex is `` /\bdaily\.(\w+)/g ``, bound to the local variable name **`daily`** that the two shipped handlers use (`handlers.ts:124,149`). The new handlers will bind `days`, so `days.length` is invisible to it and `toEqual(["date"])` stays green whatever they do — a vacuous pass. **Take the general fix, and say so here so step 5 does not choose the cheap one:** discover the reader-bound identifiers instead of hardcoding one — match `` /(\w+)\s*=\s*await\s+(getPublishedDaily|getTodayDaily|listArchivedDays)\(/g `` over the same `handlerSource`, which finds `daily = await getPublishedDaily(` (`:124`), `daily = await getTodayDaily(` (`:149`) and the two new `const days = await listArchivedDays(`. **Counted floor first — `expect(matches).toHaveLength(4)`** — so a renamed reader or a reshaped call cannot make the scan pass over an empty set, which is the failure this row exists to close. Then assert the identifier set is exactly `{daily, days}`, scan each identifier's property accesses, and assert `daily` yields only `.date` and `days` yields only `.length`. A widening that only adds prose to the doc comment buys nothing |
| `og-image.node.test.ts:484` (`T-WEB-S202`) | The longest-realistic-card raster gains the archive worst cases (§12.2) |
| `og-image.node.test.ts:649` (`T-WEB-S204`) | *"There is no NINTH route"* is re-aimed to the full inventory: eight dated `.tsx` routes, the root asset pair, **and** the archive index asset pair; `app/opengraph-image.tsx` still absent; `app/arquivo/opengraph-image.alt.txt` byte-equal to `ogCopy.altArchiveIndex` |
| `og-image.node.test.ts:712` (`T-WEB-S212`) | Becomes a two-row table — `{app/opengraph-image.png, siteCard, WRITE_SITE_CARD}` and `{app/arquivo/opengraph-image.png, archiveCard, WRITE_ARCHIVE_CARD}` — each SHA-256-compared against its committed bytes, with the existing anti-vacuity differential extended |
| `og-metadata.test.ts:237` (`T-WEB-S206a`) | The deck audit covers the four new strings: out of `messages`, off the barrel, no forbidden token, no canonical |
| `eslint-og-wall.test.ts:311` (`T-LINT-S45`) | The clean-probe path list gains the two card paths |

`T-WEB-S208` (the emoji scan) needs no edit — it globs every `.tsx`/`.css` under `apps/web`. `T-LINT-S43` and `T-LINT-S46` need no edit — same object, no new intersection.

### 10.3 The `T-WEB-S183` decision

**The two card routes do NOT join `archive-day.test.tsx:311-319`'s seven-entry list.** Three reasons:

1. The suite's own title and its warrant are about **pages**: ADR-0053 decision 10's *"why no endpoint"* — a user-specific fragment on a public page — and the list is titled as the archive page files. The card handlers are not pages.
2. They do not live under `app/arquivo/**` at all, so adding them would put a page wall around a non-page and blur what the suite claims.
3. **The hole is closed inside the id that owns the card family instead:** `T-WEB-S336` asserts the handlers' module graphs contain no `/src/play/`, no `/src/day/`, no `readDayState` and no `useDayTruth`, which is the same protection aimed by the module that owns it. Under §2.6's fallback the routes *would* live under `app/arquivo/**`, and then they join the list.

---

## 11. Records to amend — file, line, replacement

The audit runs **twice**: file-by-file for "did a decision move?", and again **by shape** — forward-tense prescriptions that enumerate route artifacts — because that is the sweep that found ADR-0039 at #34 when three file-by-file passes had cleared it (ADR-0054 `:88-93`). The amendment checklist is checked as **rows, never as a count**, with `grep -rn "ADR-0071" docs/adr/` pasted two-way.

**The by-shape sweep's target set is named mechanically, not left to the auditor's judgement**, because the step-2 draft ran it and still missed six. It is: **every sentence in `docs/` OR IN A SOURCE COMMENT that counts image routes, card kinds, static assets, `force-dynamic` modules, `getDb()` callers, `OG_DEFAULTS` leaf declarations, wall globs, `FONTS` call sites, English-segment URLs, `cache-control`-carrying routes, or traced production functions.** Source comments are in scope: `eslint.config.mjs:820-823` is the same claim as ADR-0054 `:962`, and the step-2 draft amended the ADR and left the comment. ADR-0054 `:962`'s claim has **four** homes in this repo (the ADR, ADR-0028 decision 5, that comment, and the adjacent `sharp` sentence at `:615-616`); the sweep is what finds all four.

**A cleared ADR is cleared on the file, never on one sentence** (ADR-0053 `:99-101`, quoted twice inside ADR-0054 for exactly this lesson). The step-2 draft cleared ADR-0028 on `:242-266` and never looked at `:163-182`, where decision 5's own annotation says *"the enumeration does not cover by implication"* and then says *"Eight is the whole count"* — a sentence #104 falsifies. That miss is repaired in §11.4 and is why `Amends:` names three records.

### 11.1 A new ADR is owed — ADR-0071, not the reduced-ceremony path

#103's `**Amended at #103**` path was available because *"no decision moves"* — ADR-0054 `:4`'s own words for its own ticket. Here at least six move: the route shape leaves the file convention on three segments and takes a relief D9 deferred to #37; a new public pt-BR URL family is minted; a second card kind is added; the existence proof becomes day-level rather than per-game; the archive copy deck opens; a Rejected entry is reversed. `docs/agents/domain.md:61` names the reduced path and its limit in one breath — *"This is the exception: a new rule of any weight is an ADR (`CLAUDE.md`)"* — and each of the six is a new rule. ADR-0058 D1 (`:52`) puts a new surface at Tier 2, and Fernando has already tiered it.

**Title:** `docs/adr/0071-the-archive-cards-are-nameplates-and-two-leave-the-file-convention.md` (74 characters; ADR-0070 is 232 lines and ADR-0054 is 1,263, both measured on this branch). The step-2 draft's *"…are-dated-nameplates-at-their-own-urls"* is **false for one of the three cards it names, and that card is the subject of the ADR's own decision 2**: the index card is not dated (its caption is `ogCopy.archiveTagline`) and is not at its own URL (it attaches by the file convention at `app/arquivo/opengraph-image.png`). A filename is what a future audit greps, so it may not assert the property the ADR exists to deny. The new title is in the house style of 0060–0070 — declarative sentence, "X is Y", the shape of its direct neighbours *"The share is plain text and the card is a nameplate"* (0054) and *"The archive is a public, past-only read and a late write"* (0053) — and it covers all three cards: all are nameplates; two of them leave the convention.

**Status:** ships **`Proposed`**, flipped to **`Accepted` in this PR's own diff** (CLAUDE.md `:180`).

**`Amends:` names THREE records, not two:**
- **ADR-0054** — decision 7's route enumeration and its twelve-route inheritance block; decision 9's deferred non-segment relief, its `sharp` production-function count and its `getDb()`-caller enumeration; decision 11's leaf-declaration count; decision 15's OG-wall glob enumeration; the denial-of-wallet sizing; the Rejected entry; the index/month/day consequence.
- **ADR-0053** — decision 2's `force-dynamic` route count and its `revalidatePath` path list.
- **ADR-0028** — decision 5's #34 annotation, whose *"Eight is the whole count"* becomes ten (§11.4).

All three amended files take the reciprocal `**Amended by:** [ADR-0071]` line **and** the in-place annotations, **in the same commit** (`docs/agents/domain.md:61`; ADR-0053 `:6`, *"'amended' means the file was edited"*).

**Length target: ≲250 lines, the scale of ADR-0070 (232), not of ADR-0054 (1,263).** The code diff is ~250 lines; CLAUDE.md rule 2 is a post-hoc test and its arithmetic here is already uncomfortable. The cut is made where it costs nothing: **only what is a new decision gets a numbered decision.**

**Decisions — five, in outline:**

1. All three archive shells get a card, and the family is a **third builder** in `src/og/card.tsx`, not a new system.
2. The index card is a **committed static asset**; the day and month cards are `force-dynamic` functions. The split is the read: the index reads nothing and cannot go stale. **This decision also carries the index card's own justification**, because the issue doubted it (*"an index card is probably just the site card with extra steps"*) and Fernando overrode the doubt. The answer, written out rather than left implicit: the index card differs from the root site card in its display line and its caption, and it is what a **malformed** `[data]` or `[mes]` segment now inherits by nearest ancestor — so it is not only a share preview for `/arquivo` but the degraded-path card for the whole archive subtree, which the root card cannot be without being an ancestor of everything. Its price is a second committed binary, and `T-WEB-S212`'s SHA-256 row plus `WRITE_ARCHIVE_CARD` is exactly the guard #34 built for the first one. If a reader still finds that thin, the honest remainder is: Fernando decided it on 2026-08-20.
3. The dynamic cards live at their **own pt-BR URLs at the root**, referenced by explicit `openGraph.images` composed in `generateMetadata`. This takes ADR-0054 D9's named relief for these three routes only, with the measured `.nft.json` numbers; the eight game cards stay on the file convention and remain #37's. The nested `/arquivo/cartao/**` alternative and the forward argument that rejects it are §2.5's, carried here in two sentences.
4. **Each card's existence proof is its page's**, through one bounded call to `listArchivedDays` with `limit: 1`. The card's display line and caption come from the **URL**, never from the row.
5. **The day card does not name the games** — the ragged floor (ADR-0053 D3), "card dentro de card" plus the fact that four game names cannot be told apart by colour at all (`DESIGN.md:20`), and ADR-0054 D1a's narrower-not-wider principle. **The structural mechanism is `archiveCard`'s signature**, which admits no `Game` and no `ArchivedDay` — the same argument `gameCard` already makes for puzzle content. `limit: 1` bounds the read to an existence answer so no game *set* is in scope; it does **not** hide *a* game, because `ArchivedDay` is `{date, game}`, and this decision must not claim otherwise.

**Three things the step-2 draft numbered as decisions and this ADR does not, because they are applications of existing decisions rather than new ones.** They go in the ADR's Consequences, in the PR body, and in the `card.tsx` / `handlers.ts` doc blocks — which is where this repo already keeps that class of fact:
- `force-dynamic`, no `revalidate`, no CDN TTL, `CARD_HEADERS` on both arms. This is **ADR-0053 D2 inherited verbatim and unnarrowed**, and the step-2 draft said so in its own words. Recorded with its dated check: verified 2026-08-22 that `` grep -rn "revalidatePath" apps packages | grep -v "/\.next/" `` returns nothing — **no occurrence outside generated `.next/` output in either app**, so D2's precondition is still unmet. (The step-2 draft said "only in generated `apps/api/.next/**` type files", which is narrower than the grep proves: it also appears under `apps/web/.next/**` and in `.js.map` chunks. A dated verification going into an ADR states exactly what it measured.)
- One glob on the existing ESLint object (4). An application of ADR-0054 D15 plus the intersection rule at `:981-983`; §8 carries the analysis.
- The archive `alt` strings are dated. A Next mechanic — an `images[].alt` composed in `generateMetadata` can read `params` where a module-level `alt` export cannot — plus the copy-deck consequence. §5 carries it; ADR-0054 D8's `alt` sentence is not amended, because it is about a different carrier.

**Consequences to carry:** the denial-of-wallet sizing paragraph (§13); §4.2's residual **class**, in the shape step 0's probe measures; two card mechanisms in one repo, named as the cost of decision 3; the English-segment URL count nine → ten with the two card URLs pt-BR by obedience; the washi-tape reconciliation (§3.2); the degraded-branch improvement; the display-sizing rung §12.2 took, so a later reader knows whether the day card's date fits at 96 px or was split.

### 11.2 `docs/adr/0054-the-share-is-plain-text-and-the-card-is-a-nameplate.md`

| Line | Sentence that becomes false | Action |
|---|---|---|
| `:3-4` | header | add `**Amended by:** [ADR-0071](./0071-…md)`, listing what moves: decision 7's route enumeration and its inheritance block; decision 9's deferred relief, its `sharp` count and its denial-of-wallet sizing; decision 11's leaf-declaration count; decision 15's OG-wall glob enumeration; the `getDb()`-caller and `cache-control` counts; the `FONTS` call-site count; decision 8's *"every archive `[data]` segment"* residual, narrowed; the Rejected entry; the English-segment URL count; and the `revalidatePath` consequence. Multiple `Amended by:` lines stack — this file already carries `**Amended at #103**` at `:4`, whose *"No decision moves"* is quoted in §11.1 |
| `:373-374` | *"**Eight image routes and one static asset**: a committed site card, and eight dynamic per-day-per-game cards. **One card kind, one read path.**"* | annotate **immediately below the existing step-7 annotation at `:375-378` and above the table that opens at `:380`** — named precisely because this row carries the plan's longest replacement text and must not land in a guessed spot; `:386-387` is a following paragraph (*"Every route file is a table entry…"*), not a caption, and the step-2 draft aimed there. Text: *(**Amended at #104** — ADR-0071. **Ten image routes and two static assets, and two card kinds.** The archive shells add a committed `app/arquivo/opengraph-image.png` for `/arquivo` and two `force-dynamic` handlers at `/cartao/<YYYY-MM-DD>` and `/cartao/mes/<YYYY-MM>`, referenced by explicit `openGraph.images` rather than by the file convention — the relief decision 9 `:611-613` named and deferred, taken here for these three routes only. The second card kind is the archive nameplate: no kicker, no game, `ACCENT_APP_*`. The second read path is `listArchivedDays(db, {…, limit: 1})`, used only as `length === 0 ? 404 : render`; the eight rows above are byte-unmoved.)* The table itself is left as the shipped shape of #34 |
| `:409` | *"the single root asset covers **twelve** routes. The list is **re-derived from…"* | annotate in place: *(**Amended at #104** — ADR-0071 decisions 2 and 3. **Nine.** `/arquivo` now takes its own committed asset `app/arquivo/opengraph-image.png`, and `/arquivo/mes/<mes>` and `/arquivo/<data>` compose an explicit `openGraph.images` entry pointing at `/cartao/mes/<YYYY-MM>` and `/cartao/<YYYY-MM-DD>`. The twelve-route list at `:416-425` is re-derived below rather than restated: twelve minus those three.)* |
| `:418-420` | the `/arquivo`, `/arquivo/mes/<mes>`, `/arquivo/<data>` rows of the inheritance block | annotated below the block: `/arquivo → /arquivo/opengraph-image.png (ƒ)`; `/arquivo/mes/<mes> → /cartao/mes/<mes> (ƒ, explicit openGraph.images)`; `/arquivo/<data> → /cartao/<data> (ƒ, explicit openGraph.images)`. Plus: a **malformed** `[data]`/`[mes]` segment composes no `openGraph` and therefore inherits `/arquivo/opengraph-image.png`, not the root card |
| **`:431`** (not `:436` — the step-2 draft was off by five, the exact ADR-0070 defect this ticket exists to avoid repeating; `:436` reads *"unchanged and the claim is finally true. `/vincular` inheriting it is"*) | *"So twelve routes take the site card and the four `concluido` routes take"* — **no emphasis in the source**; the step-2 draft bolded "twelve" inside the quotation marks | annotate in place: *(**Amended at #104** — ADR-0071. **Nine.** The three archive shells leave the inheritance list, for the reason annotated at `:409`. The `concluido` half is untouched.)* |
| `:583` | the D9 measurement row for the three archive routes | annotate: still true of #34's build, and **still true after #104** — the three pages stay at ~2.7 MB because the cards moved to their own URLs. The new figures for the two card functions, and the new ~1.7 MB row for `app/arquivo/opengraph-image.png/route`, go in #104's PR body in this table's format |
| `:588-591` | *"Thirteen routes recover, five of them `ƒ` … `/arquivo`, `/arquivo/[data]`, `/arquivo/mes/[mes]`"* | annotate: **unchanged after #104**, and that is the point of ADR-0071 decision 3 |
| `:611-613` | *"Moving the dated cards to non-segment URLs with explicit `openGraph.images` would lift that too, at the cost of the convention; **it is noted for #37 rather than taken here**."* | **Taken at #104**, for the three archive shells only. The eight game cards' ~23 MB residual and the `sharp`-as-devDependency **ownership** stay #37's, unchanged — but the `sharp` sentence's own **count** moves; see the next row |
| **`:615-616`** (new row — the step-2 draft touched this decision and amended only the relief above it) | *"**`sharp` is a devDependency** (`apps/web/package.json:36`) traced into the **eight production functions that remain**."* | annotate: **ten.** Both `/cartao` handlers construct an `ImageResponse`, so both trace `next/og` → `sharp`. The item itself — a production-only install would change the trace silently — stays **#37's**, unchanged in ownership and in substance |
| **`:645-650`** (new row — §13 recomputes this number and the step-2 draft never amended it at source, the sharpest instance of the pattern in this ticket) | *"so a three-year archive offers a crawler that follows `og:image` about **4,388 card URLs** (1,096 days × 4 games, plus the four dailies), each costing one Neon read and one render, on top of the 4,384 reads the pages themselves already cost. At the warm median that is roughly **4–8 minutes of billed function time per full sweep, per crawler**."* (the paragraph opens at `:643`) | annotate: *(**Amended at #104** — ADR-0071. **5,520 card URLs**, not 4,388: `sitemap.ts` already publishes `/arquivo`, every month and every day, and after #104 each of those heads advertises a `/cartao/…` card. The three-year figure grows by ~1,096 day cards and ~36 month cards (+25.8 %); the index card adds none, being a committed asset with no function and no read. §13 of plan 068 carries the derivation and the ≈58 s of extra billed sweep time.)* Its sibling at `:1170-1175` — *"Dating the daily four widens the surface from four routes to eight … now over a doubled uncached surface"* — moves with it: **ten** routes, and the surface is a quarter larger again |
| **`:714-718`** (new row — decision 11; **a mechanic, not a count**) | *"So `OG_DEFAULTS` — `type`, `locale`, `siteName` — is one shared constant, spread by the root layout and by all **eight** leaf declarations."* | annotate: **ten.** Measured on this branch — `grep -rln "openGraph" apps/web/app` returns exactly the four `app/<jogo>/page.tsx`, the four `app/arquivo/[data]/<jogo>/page.tsx`, the root `layout.tsx` and `sitemap.ts`; `app/arquivo/[data]/page.tsx` and `app/arquivo/mes/[mes]/page.tsx` declare no `openGraph` today and #104 makes them the ninth and tenth. **This row is not bookkeeping:** D11's sentence is what an eleventh leaf's author reads, and leaving it at eight is how the next leaf ships without the spread and silently loses `og:type`, `og:locale` and `og:site_name` |
| **`:940-941`** (new row — decision 15; the ADR-0039-at-#34 failure mode exactly) | *"`@miolos/games` is banned from `apps/web/src/og/**` and from `apps/web/app/**/{opengraph,twitter}-image.*`, in both halves"* — a **two-glob** enumeration | annotate: **three globs.** `apps/web/app/**/{opengraph,twitter}-image.*` does **not** match `app/cartao/**/route.ts` — that is §8's own opening sentence — so object (4) gains `` `apps/web/app/cartao/**/*.${webWallExtensions}` ``. A future reader rebuilding the wall from this sentence would otherwise leave the two new `getDb()`-calling handlers outside it |
| `:962` | *"Those are the **eight files** in the app that call `getDb()` on an unauthenticated crawler-facing path, i.e. the most consequential place in the repo to lose those bans"* | annotate in place: *(**Amended at #104** — ADR-0071. **Ten.** `app/cartao/[data]/route.ts` and `app/cartao/mes/[mes]/route.ts` call `getDb()` on the same unauthenticated crawler-facing path, through `listArchivedDays` rather than a projected reader, and object (4)'s glob is widened to cover them. The sentence's own reasoning is unchanged: it is still the most consequential place in the repo to lose those bans, and a file-diff criterion still cannot see the loss.)* **The identical sentence in source at `eslint.config.mjs:820-823` is amended in the same diff** (§7) — one claim, two homes |
| **`:521-531`** (new row — §2.3 quotes this sentence and the step-2 draft never listed it) | *"because the image comes from the **file convention** and not from the metadata object, *every* archive `[data]` segment — malformed included, where `generateMetadata` returns no `openGraph` at all — still emits an `og:image` that 404s"* | annotate: **narrowed, not standing.** After #104 a malformed `[data]` or `[mes]` segment composes no `openGraph` and therefore inherits `app/arquivo/opengraph-image.png` — a 200. The word *"every"* is false; the residual survives only where a **well-formed** segment the wall refuses now advertises a 404ing `/cartao/…` URL, which plan 068 §4.2 accepts on this ADR's own status-is-what-scrapers-act-on ground. A residual a later ticket narrowed, left written as though it still binds, is a record that gets re-litigated |
| **`:836-839`** (new row) | *"**Loaded at module scope as `export const FONTS` with top-level `await`**, one call shape for all **eight game image routes** — the site card is a committed asset and reaches the loader only at build time, through `T-WEB-S212`"* | annotate: **ten** runtime callers (§7 has both handlers reuse `FONTS`), and **two** commit-time assets reaching the loader (§10.2 turns `T-WEB-S212` into a two-row table). `:841-842`'s *"a throw there fails the whole build, not one route"* stays true and is not annotated |
| **`:1143-1147`** (new row) | *"`force-dynamic` governs Next's **route** cache, not the emitted header, so **each of the eight routes** passes `headers: { "cache-control": … }` in the response options — **on the 404 arms as well as on the 200**"* | annotate: **ten.** The rule is obeyed and unnarrowed — §4 puts `CARD_HEADERS` on both handlers and on both 404 arms, and §4.2 leans on the K2 argument this passage records |
| `:1096` | Rejected: *"**`export const revalidate`, or a CDN TTL, on any of the eight routes.**"* | annotate in place — **this row needs prose, not a digit**, because it must say something the entry does not currently say. ADR-0053 `:262-265` is the precedent and it writes its sentence out. Text: *(**Amended at #104** — ADR-0071. **Ten routes**, the two `/cartao` card handlers included. The entry is **obeyed and not narrowed**: #104 adds no `revalidate` and no CDN TTL anywhere, and both new handlers pass `CARD_HEADERS` in the `ImageResponse` options on the 200 arm and on the 404 arm alike. The precondition this entry waits on is still unmet — verified 2026-08-22 that `revalidatePath` has no occurrence outside generated `.next/` output in either app.)* |
| `:1120-1131` | *"…per-day OG cards for `/arquivo`, `/arquivo/mes/<mes>` and `/arquivo/<data>` … **The OG-card half is still open.**"* | mark **taken up at #104**, in the shape #103 used for the share-button half: what it was (not a wiring job — three decisions had to be made: the route shape against the trace, what "exists" means on a multi-game day, and whether the card names the games), and a pointer to ADR-0071 |
| `:1243` | *"**Nine** public URLs now end in an English segment"* | **ten** (`/arquivo/opengraph-image.png` joins). Add: the two dynamic card URLs are **pt-BR**, because a chosen slug is not a file-convention name — ADR-0013 `:23` obeyed rather than excused |
| `:1250-1252` | *"The fifth game's recipe is now three route modules per daily game and two per archive play screen"* | **unchanged** — #104's cards are not per-game. Recorded as a checked row, not by silence |
| `:1253-1259` | *"…and **the index, month and day pages inherit the root card, which reads nothing** — stated so the list is complete rather than merely longer."* | **outright false.** Replacement: *…and a future writer must also invalidate `/cartao/<YYYY-MM-DD>` and `/cartao/mes/<YYYY-MM>` (#104, ADR-0071). The index card at `/arquivo/opengraph-image.png` is a committed asset that reads nothing and cannot go stale, so it stays off the list for the reason the root card does.* |

### 11.3 `docs/adr/0053-the-archive-is-a-public-past-only-read-and-a-late-write.md`

| Line | Action |
|---|---|
| `:5` | `**Amended by:**` gains ADR-0071 |
| `:210` + the `:240-245` annotation | *"all seven pages, on `sitemap.ts` and on `robots.ts`"*, grown at #34 to *"**thirteen** `force-dynamic` route modules, not nine"*. **Replacement prose, written out rather than gestured at:** *(**Grown again at #104** — [ADR-0071], decision 3. **Fifteen.** `app/cartao/[data]/route.ts` and `app/cartao/mes/[mes]/route.ts` each carry their own `export const dynamic = "force-dynamic"`, for the reason the #34 annotation already gives: the export is required per file, since segment config comes from the layouts on the path plus the leaf, and a sibling `page.tsx` does not confer it. **These two do not live under `/arquivo`, and counting them into this family is a definitional move stated out loud rather than performed silently**: they exist only to serve archive shells, they read the same wall through the same helper, and the kill switch that justifies `force-dynamic` reaches them for exactly that reason — so they belong to the family the sentence describes even though they do not match `app/arquivo/**`. A reader who counts thirteen files under `app/arquivo/**` and thinks the number rotted should read this clause. The committed `app/arquivo/opengraph-image.png` is **not** a module, carries no segment config, and does not count.)* |
| `:230-234` + the `:247-260` annotation | The path list gains **`/cartao/<YYYY-MM-DD>`** and **`/cartao/mes/<YYYY-MM>`**, on ADR-0053's own stated ground: *"the path list above is a FORWARD PRESCRIPTION, and a path absent from it is a path the future writer will not invalidate."* And the annotation's closing sentence — *"the index, month and day pages inherit the root card, which reads nothing and cannot go stale"* — is **replaced**: *the index card is a committed asset that reads nothing and cannot go stale; the day and month cards read the wall and are on the list above* |
| `:311` | decision 4's *"**Three archive readers** and one clock classifier"* — **unchanged**, and recorded as a checked row: #104 calls `listArchivedDays` and adds no reader |
| `:629-636` | decision 10's *"why no endpoint"* — **obeyed, not amended**: nothing user-specific reaches any card |

### 11.4 The rest

- **`docs/adr/0028-daily-play-routes-and-the-conclusion.md` — decision 5's #34 annotation at `:163-182` is AMENDED, and this is the step-2 draft's worst records miss.** The annotation states its own rule and then states a count:

  > *(Grown at #34 — ADR-0054 decisions 7 and 8. **The enumeration is per-route, so it does not cover a metadata image route by implication either.** It grows by **eight** files, all of them public, unauthenticated, `force-dynamic` reads through the same wall helpers … **Eight is the whole count**, and it is eight rather than nine because the site card is not a route at all …)*

  `app/cartao/[data]/route.ts` and `app/cartao/mes/[mes]/route.ts` are, by §1 and §4, public, unauthenticated, `force-dynamic` reads through a wall helper (`listArchivedDays`). They are the ADR-0014 direct-read scope extension in its purest form — and the annotation's own rule is that the enumeration **does not cover by implication**, so a route is covered only if it is **named**. *"Eight is the whole count"* becomes **ten**. Plan 040 `:1266` filed the identical duty at #34 (*"#34's eight image routes are covered only if they are named. **ANNOTATION OWED**"*), and ADR-0053 `:99-101` is quoted twice inside ADR-0054 for exactly this lesson: **clearing an ADR on one sentence is not clearing the file.** The step-2 draft cleared ADR-0028 on the fifth-game recipe and never opened decision 5.

  **What ships:** ADR-0028 takes the reciprocal `**Amended by:** [ADR-0071]` line at its header (multiple `Amended by:` lines stack — it already carries two), and decision 5 gains a **third** in-place annotation growing the count eight → ten and naming both `/cartao` handlers with their reader. ADR-0028 joins §15's `grep -rn "ADR-0071" docs/adr/` two-way check.
- **ADR-0028 `:242-266` and ADR-0039 decision 2** — the fifth-game route recipe (the range is `:242-266`, not the step-2 draft's `:238-262`: `:237-241` is a different bullet, *"The module graph is what keeps the credential server-side"*, and the #34 annotation runs to `:266`). **Not amended, obeyed.** #104 grows no per-game family: a fifth game still adds three `force-dynamic` modules per daily game and two per archive play screen. Recorded as a checked row with the shape sweep's output, because this is exactly the class three audits missed at #34. The recipe has three homes — `ADR-0028:243-262`, `ADR-0039:42-44`, `ADR-0029:12-16` — and `` rg 'a slug, a `routes`' docs/adr/ `` returns exactly those three, all clean.
- **`eslint.config.mjs:820-823`** — the eight-files comment. **Amended in §7's Modified row**, listed here so the records audit sees it in one place: it is the same claim as ADR-0054 `:962`, in source, in a file this ticket already opens.
- **`docs/plans/040-issue-34-plan-sharing.md`** — a plan's body is **never rewritten** (`docs/README.md:22`); the instrument is an **amendment table prepended to the file**, pointing at ADR-0071. It names **five** clauses, not the step-2 draft's four:
  - `:1270` — *"the index/month/day pages inherit the root card, which reads nothing."*
  - `:58` (§1's non-goal) and `:89` (flag F8) — the clauses #104 reverses.
  - `:404` — *"I28 is deleted — following it literally would push `openGraph` onto the index, month and day routes"*: #104 pushes `openGraph` onto two of the three, and the one it does not push onto is the index, by file convention.
  - **`:1092`** (new) — *"The archive routes compose theirs from the strings `messages.archive.meta` already ships … reused verbatim inside `openGraph` — **which is why the archive half adds no copy at all**."* §5 amends the *source* twin at `copy.ts:34-36`, so leaving the plan clause off the table was an inconsistency rather than an oversight of substance. §11.1's own words are that *"the archive half of the copy deck opens for the first time"*.
  - **`:1289`** (new, low stakes) — the written ADR-0013 verdict: *"#34 ships **nine public URLs whose terminal segment is `opengraph-image`** … The rule still does not bite … `opengraph-image` is **a Next file-convention name, not a chosen slug**"*. Ten after #104, and two of the new URLs are **chosen** slugs where every prior one was a file-convention name — which is §2.5's whole argument. The load-bearing half is already carried by the ADR-0054 `:1243` row; this clause is named because the table is being prepended anyway. (`:1288` is left alone and is worth reading: it records `:36`'s obedience via `metadataBase` / `siteOrigin()`, which is why §2.5 keeps `:36` and adds `:38` rather than replacing it.)
- **`docs/README.md`** — one row for `plans/068-issue-104-plan-archive-og-cards.md` and one for `adr/0071-…md`, in the same PR, in the existing register. (Verified on this branch: the register's last plan row is `plans/067-…` and its last ADR row is `adr/0070-…`, so both rows are genuinely owed.)
- **`docs/agents/test-ids.md`** — re-derived by the documented grep **after** the step-8 merge, never off the row alone; the on-issue reservation recorded; unspent tails added to *Burned slots*. **And `:155` is re-read, not just the frontier table**: it describes `T-WEB-S204` as *"there is no ninth route, and the asset pair exists"*, and under §10.2's re-aim `card.tsx` builds **three** cards and there are **two** asset pairs, so the row's description drifts.
- **Issue #37 gets a comment in this PR** (three lines, linking ADR-0071): what #104 took from ADR-0054 D9's relief (the three archive shells' non-segment card URLs), what stays #37's and unchanged (the eight game cards' ~23 MB residual, `sharp` as a devDependency, the p95/abuse item), and the new surface figure from §13 — the surface #37 must instrument is a quarter larger again. #37's scope silently shrinks and silently grows otherwise, and a decision that lives only in a document is how things get forgotten.
- **`CONTEXT.md`** — **no new row.** The Archive row already names all three routes, and CONTEXT.md carries no OG entry at all. "Share text" earned a row because it names a user-visible artifact whose *content* was contested; a card is an implementation of a surface the glossary already has. Recorded as a decision, not an omission.
- **`DESIGN.md`** — **no change.** DESIGN.md carries no OG card entry today, not even for the game card or the site card that shipped at #34; the card's design law lives in `card.tsx`'s doc block, plan 040 §7.2 and now ADR-0071. Adding a DESIGN.md entry now would be new ground #34 declined, on a surface with no browser to detect against. The `:48` archive-day-card entry is about the on-page card at a different size and is **not** falsified.
- **`docs/pending-fernando.md`** — **nothing new, but two maintenance edits, both in this PR.** The "nothing new" half is correct and verified: nothing in this plan needs a credential, a production action, a store listing, money, legal, or a product-scope call, and NOW is empty. The maintenance half is CLAUDE.md's own protocol — *"a discharged item moves to its Done table with date and evidence, never gets deleted, and is never re-asked"* — and the ledger demonstrably tracks it (the #146 row reads *"SHIPPED (plan 063, ADR-0068)"*). Two rows move:
  - **SOON, `:28`** — *"**#104** archive OG cards — decided (index + month get cards), `ready-for-agent`."* → **SHIPPED**, in the #146 row's own shape (`:26`), naming this PR and ADR-0071.
  - **SOON, `:27`** — *"**#64** Nonogram picture name — decided (ship the name, amend ADR-0033), `ready-for-agent`."* is **stale**: #64 shipped in PR #188 at commit `69e4d35` (ADR-0070). Corrected to SHIPPED in the same diff. It is live proof the ledger rots when a shipping PR does not close its own SOON row, which is why #104's is scheduled here rather than assumed.
  - The **DONE** rows at `:94` (#64) and `:95` (#104) are **not touched**: they record the discharge of Fernando's *decision*, which happened on 2026-08-20 and is correctly recorded. Nothing is deleted from either table.

**Every citation in this plan was re-verified against disk at step 4** (2026-08-22, branch `feat/104-archive-og-cards`), not carried from the step-2 draft and not taken on a reviewer's word. Method: each `<file>:<line>` was read with `sed -n '<n>p'` or a bracketing range and the quoted text compared character by character; each counted claim (`indexDescription` = 90, `archiveTagline` = 39, the four `opengraph-image.*` files under `app/arquivo/**`, the `T-WEB`/`T-LINT` frontier, `webWallExtensions`, the `revalidatePath` grep, ADR-0070's 232 lines) was re-derived by running the command rather than by reading a table. Where a reviewer's correction disagreed with disk, disk won and the disagreement is written where it lives.

---

## 12. Evidence and the gate

### 12.1 The gate

**`npx impeccable detect` in file mode**, over `archiveCard()`'s tree written to a 1200×630 HTML file with the real `tokens.css` and the committed `@font-face` files by absolute `file://` path — the plan 040 §13 / I20a idiom, run for all three cards. **ADR-0034 decision 4 governs, and it is quoted rather than paraphrased**, because the step-2 draft attributed to it a slogan (*"screenshots are evidence, the detect run is the gate"*) that appears **nowhere in this repository** — `grep -rn "screenshots are evidence" docs/ CLAUDE.md DESIGN.md PRODUCT.md .claude/` returns only the draft itself. What D4 actually says (`docs/adr/0034-…md:77-85`):

> *"**A celebration's design compliance is proved by file-mode checks, not by the URL scan** … `impeccable detect` launches a clean browser profile, so the URL scan always sees the *playing* board and the *unfinished* conclusion — neither the solved board nor the populated conclusion is reachable by it. What proves the celebration instead, named so it is not substituted later: a **file-mode** detect run, jsdom smoke tests, and stylesheet-text assertions…"*

The applicable substance is there and transfers cleanly: a card is a surface the URL scan cannot reach, so a file-mode detect run is what proves it. Cite it as **"ADR-0034 decision 4: design compliance on a surface the URL scan cannot reach is proved by a file-mode detect run"** — the paraphrase marked as a paraphrase — and never as its words.

**The by-design ignore list must not be widened to cover a `file://` path.** `.impeccable/config.json`'s two `files`-scoped entries are scoped to `http://localhost:*` and `https://miolos-*.vercel.app/**`; `git diff main -- .impeccable/config.json` must come out **empty**, and it is an exit criterion. If a rule fires on the card, the fix is the card.

**`scripts/gate-lock.sh acquire "<who>"` before ANY suite run**, `git commit` included (the pre-commit hook runs a suite). Release after.

### 12.2 The sizing harness — it decides the composition, it does not only pick a fixture

This is the step §3.1 depends on, and it runs **before** the builder's final shape is fixed. Its output chooses the day card's rung and is recorded in ADR-0071 and the PR body.

Enumerate, do not pick. And **measure pixel width in the committed 36 pt Fraunces / Instrument Sans faces, not `.length`** — the arithmetic disagrees with the ticket's example and that is the point: `"22 de fevereiro de 2026"` is **23** characters and `"30 de setembro de 2026"` is **22**, so **plan 040 `:849`**'s enumeration (fevereiro, 23) and the ticket's example (setembro) name different strings. Neither is authoritative for *width*. (`:849` is the real home of that enumeration — *"**The longest case is 'Nonogram' over '22 de fevereiro de 2026' — 23 characters, not 22**"*, restated at `:1178` and `:1721`. The step-2 draft cited `:248`, which is the word `So:` inside *"Why nine files and not a shared dynamic route"* — a dead pointer of exactly the ADR-0070 shape.)

The harness enumerates and measures, against the **890 px** inner width (`CARD_BOX_WIDTH − 2 × CARD_PADDING − 2 × border` = `1040 − 144 − 6`, `card.tsx:89,91`; corrected at step 5 — see §3.1):

- `formatLongDate` over all twelve pt-BR months × the day numbers that maximise the rendered run, **at 96 px Fraunces 500** — this is rung 1's test;
- if rung 1 fails, the rung-2 split — day-and-month at 96 px, `` `de ${year} · ${messages.archive.title}` `` at 39 px — measured the same way;
- `formatMonth` over all twelve months at 96 px (`"fevereiro de 2026"` is the longest name and the #163 evidence README already measured it as the seasonal worst case);
- `ogCopy.archiveTagline` — the shipped 39-character `messages.archive.lead` sentence (§5) — at 39 px Instrument Sans 400.

**Satori overflows a fixed container silently rather than wrapping visibly** — plan 040 `:847`'s own sentence, at the line rather than at the section, with *"longest"* where this plan writes *"widest"*, a change flagged deliberately. So the widest realistic content is the case worth a raster: the widest of each goes into `T-WEB-S202`'s raster and into the evidence PNGs, and any string that does not fit is a **failure of the composition**, not a fixture to be swapped for a shorter one.

### 12.3 `docs/evidence/104-archive-og-cards/`

House shape: a `README.md` plus PNGs embedded in the PR body by **SHA-pinned raw URL**. #104's renders are the **cards themselves at 1200×630** (plan 040's precedent), not page screenshots at 390×844/1440×900 — **no page changes visually, and the README says so** rather than shipping a pair of identical page shots.

| File | What it shows |
|---|---|
| `after-day-1200x630.png` | the day card at the measured worst-case date |
| `after-month-1200x630.png` | the month card at `fevereiro de 2026` |
| `after-index-1200x630.png` | the committed index card |

**No `before-day-1200x630.png`.** The "before" is the shipped root site card, unchanged, already rendered and evidenced at #34 — the README **links** it rather than re-rendering it. Rendering a known artifact to prove it is known is the same mistake as shipping a pair of identical page shots, which this section refuses one sentence earlier.

Plus the file-mode `impeccable detect` output, the `.nft.json` before/after table, and the preview `curl` block.

### 12.4 Preview `curl`, with the date discovered from the app

ADR-0053 decision 12 binds: **a date-bearing gate URL is DISCOVERED from the app, never hardcoded**, because a date computed in the shell is a client clock deciding what the São Paulo publication wall published. **An empty archive is a skip, not a failure.** Handoff 041 `:28-35`'s shape:

```
# discover a real archived date from the preview's own /arquivo page, then:
curl -s -o /dev/null -D - "$PREVIEW/cartao/$DATE"        | grep -iE '^HTTP|^content-type|^cache-control'
curl -s -o /dev/null -D - "$PREVIEW/cartao/mes/$MONTH"   | grep -iE '^HTTP|^content-type|^cache-control'
curl -s -o /dev/null -D - "$PREVIEW/cartao/9999-01-01"   | grep -iE '^HTTP|^cache-control'   # 404 + CARD_HEADERS
curl -s -o /dev/null -D - "$PREVIEW/cartao/nao-e-data"   | grep -iE '^HTTP|^cache-control'   # 404, no read
curl -s "$PREVIEW/arquivo/$DATE" | grep -iE 'og:image|twitter:image|og:locale|og:site_name'
```

Expected: `200` / `image/png` / `private, no-cache, no-store, max-age=0, must-revalidate` on the two live ones; `404` with the same `cache-control` on both refusals.

---

## 13. Denial of wallet — this ticket's own sizing

ADR-0054 `:643-656` sized the surface (the paragraph opens at `:643`, *"'Per scrape, not per pageview' is right for a pasted link and understates the ARCHIVE"*): a three-year archive offers a crawler that follows `og:image` about **4,388 card URLs** (1,096 days × 4 games, plus the four dailies), each one Neon read and one rasterisation, on top of the 4,384 reads the pages themselves already cost — roughly **4–8 minutes of billed function time per full sweep, per crawler**, with the effect that matters being that a sweep roughly **doubles** the request rate against Neon and keeps the compute from scaling to zero.

**#104 adds 1,132 new unauthenticated, uncacheable, CPU-bound URLs**: one day card per archived day (~1,096 over three years) and one month card per archived month (~36). The index card adds **zero** — it is a static asset with no function and no read. The card URL space goes 4,388 → **5,520 (+25.8 %)**; at #34's measured **48–55 ms warm median** (~215 ms cold, per lambda), the extra billed time is ≈ **58 s per full sweep**, on top of the 4–8 minutes already sized. Each new card is also one more Neon round trip: **+1,132 reads per sweep**, and the percentage depends entirely on which base you take, so both are shown with the derivation rather than one asserted:

| Base | Composition | After #104 | Change |
|---|---|---|---|
| Archive **page** reads only | 4,384 play pages + 1,096 day pages + 36 month pages = **5,516** | 6,648 | **+20.5 %** |
| Like-for-like — pages **and** the existing archive card reads that ADR-0054 `:648-650` counts in this same paragraph | 5,516 + 4,384 = **9,900** | 11,032 | **+11.4 %** |

The like-for-like figure is the honest one to quote against ADR-0054's own paragraph, because that paragraph counts card reads on top of page reads; the pages-only figure is the one that answers "how much more does the archive read". The step-2 draft quoted +20.5 % without showing either derivation and against a base that omitted reads the same sentence counts. The card-**URL** figures — 4,388 → 5,520, **+25.8 %** — check out exactly and are unchanged.

**All three page URLs are already in `sitemap.ts`** — `routes.archive`, every month, every day — so the pages are crawler-reachable by construction, and #104's new `og:image` tags make the cards reachable by any crawler that follows them. This ticket adds to the surface #37 measures, and says so.

**What is cheap, and stays cheap:** malformed segments are refused by Zod before any read, in both handlers, and the year-zero floor is inherited from `parseArchiveMonth` rather than re-implemented. The index card costs nothing at runtime at all.

**Nothing in #104's scope fixes any of this.** A TTL waits on ADR-0053 decision 2's precondition, whose writer still does not exist. **#37 still owns it**, as an explicit **abuse** item and not merely as a p95 side effect, alongside the p95 instrumentation for decision 2's caching trigger — now over a surface a quarter larger again.

---

## 14. The sentence to post on issue #104

**Posted at step 4, before implementation** — Fernando's words were *"decide it in-plan … and record the choice here"*, and a disagreement costs a plan edit now against a rewritten PR later.

The step-2 draft was ~380 words in one paragraph, with five ADR citations, three line references and an inline code expression, on the one artifact of this ticket he reads, on a phone. It also carried a **fabricated constraint** — that four game names in a row "would need four game accents". They would need **none, and could not have one**: `DESIGN.md:20` says *"The shared per-game accent may never colour a word — no `color: var(--accent)` on text, at any size, on any paper."* That composition is illegal, not weaker, and the real argument is the stronger one. Both are fixed below.

```
Design call (#104): the day card does NOT name the four games.

It is a dated nameplate: the date big, "Arquivo" under it, the red
app tape and shadow, "Miolos" at the bottom. The month card puts the
month where the date goes. The index card puts the word "Arquivo".

Why:
1. The archive's oldest days hold one, two or three games, not four.
   A card naming four would be wrong on exactly those days.
2. Game names on a card can never be coloured — that is a design rule
   we already have — so four names are four grey words. At the size a
   card is read in WhatsApp, nobody reads them, and the date stops
   being the subject.
3. The card builder takes a date and nothing else. It has no way to
   receive a game, so this cannot drift later.

Rendered cards: docs/evidence/104-archive-og-cards/
```

Thirteen short lines, plain words, decision first, no citations, no code, no line numbers. Nothing in it asks him for input, which is correct: this is a recorded call, not a question. The long form — the ADR references, the trace argument, the `limit: 1` bound — belongs in ADR-0071's decision 5 body, where the next agent will look for it.

---

## 15. Exit criteria

- [ ] `scripts/gate-lock.sh acquire` taken before every suite run; released after.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` green, output pasted.
- [ ] `npx impeccable detect` file-mode over the three rendered cards, output pasted; `git diff main -- .impeccable/config.json` **empty**.
- [ ] `.nft.json` before/after table in the PR body: `/arquivo`, `/arquivo/[data]`, `/arquivo/mes/[mes]` still ~2.7 MB; the two `/cartao` functions listed with their real figures. If shape (a) was taken instead, the reversal and its numbers are recorded in ADR-0071.
- [ ] `find apps/web/app -name 'opengraph-image.*' | sort` → **12** entries (was 10).
- [ ] `grep -rnE "^export const revalidate|generateStaticParams *\(" apps/web/app` → nothing.
- [ ] `` grep -rn "revalidatePath" apps packages | grep -v "/\.next/" `` → **nothing** — the precondition is still unmet, so no `revalidate` and no CDN TTL anywhere.
- [ ] `git diff main --stat -- packages apps/api` → **empty**.
- [ ] `git diff main -- apps/web/next.config.ts apps/web/app/sitemap.ts apps/web/app/robots.ts apps/web/impeccable.yml turbo.json` → **empty**.
- [ ] Step 0's **today-URL probe** (criterion 4) output pasted, and §4.2 / ADR-0071's consequence written from it rather than from an assertion.
- [ ] `xxd apps/web/app/arquivo/opengraph-image.alt.txt | tail -1` → **no trailing `0a`**.
- [ ] `T-WEB-S336`'s counted floor green: the four `app/arquivo/[data]/<jogo>/opengraph-image.tsx` exist (`toHaveLength(4)`) **and** the three shell-segment paths do not.
- [ ] `T-WEB-S201`'s reader-binding scan green with its `toHaveLength(4)` floor — proof the widening is not vacuous.
- [ ] Preview `curl` evidence, date **discovered from the app**: 200 / `image/png` / `private, no-cache, no-store, max-age=0, must-revalidate` on both live card URLs; 404 with the same `cache-control` on a future date and on a malformed segment; the day page's head showing the card URL on `og:image` **and** `twitter:image`, with `og:type`/`og:locale`/`og:site_name` intact.
- [ ] `docs/evidence/104-archive-og-cards/` in the house shape, PNGs embedded by SHA-pinned raw URL.
- [ ] ADR-0071 present, `Proposed` → `Accepted` flipped **in this PR's diff**; `**Amends:**` naming **three** records, reciprocal `**Amended by:**` on **ADR-0054, ADR-0053 and ADR-0028**, plus every in-place annotation in §11.2, §11.3 and §11.4 — same commit. ADR-0071 is **≲250 lines**.
- [ ] `grep -rn "ADR-0071" docs/adr/` pasted and checked **two-way, as rows, never as a count** — the check covers ADR-0028 as well as the other two.
- [ ] Amendment audit run twice — file-by-file **and by shape**, over §11's named mechanical target set **including source comments** — with the shape sweep's full hit list and each verdict quoting its source; ADR-0028 `:242-266` and ADR-0039 decision 2 recorded as checked-and-obeyed rows, and ADR-0028 `:163-182` recorded as **amended**.
- [ ] `eslint.config.mjs:820-823`'s eight → ten correction present in the same diff as ADR-0054 `:962`'s.
- [x] Plan 040's prepended amendment table naming `:58`, `:89`, `:404`, `:1092`, `:1270` and `:1289` — **shipped with seven rows, not six**: `:849` was added as a **not-superseded, extended** row, because #104 reuses that enumeration for a display slot the day card occupies alone and re-measures it rather than inheriting the line.
- [ ] `docs/README.md` rows for plan 068 and ADR-0071.
- [ ] `docs/pending-fernando.md`: the **#104** SOON row marked SHIPPED with this PR and ADR-0071, **and the stale #64 row corrected** (shipped in PR #188, `69e4d35`, ADR-0070). Nothing deleted from either table.
- [ ] A comment on **issue #37** naming what #104 took from ADR-0054 D9's relief, what stays #37's, and §13's new surface figure.
- [ ] Test ids `T-WEB-S333…S338` and `T-LINT-S54…S55` reserved **on issue #104 before step 5**; frontier re-derived by the documented grep **after** the step-8 merge; unspent tails recorded in *Burned slots*; `docs/agents/test-ids.md:155`'s `T-WEB-S204` description re-read under §10.2's re-aim.
- [ ] The design call posted on issue #104 (§14) — **at step 4, before implementation**.
- [ ] PR body: tier named (**Tier 2**), what changed, every command's real output inline, §4.2's residual class stated as a knowing change on a public surface, a note that **handoff 041's counts are superseded by #104** (`:45`, `:60`; their bodies are not rewritten, `docs/README.md:22`), and an explicit statement that nothing needs Fernando.

---

## 16. Decisions taken in this plan, and why — attack these

| # | Decision | The strongest objection, and the answer |
|---|---|---|
| D1 | Day and month cards live at `/cartao/…`, not in their segments | *"You are inventing a second card mechanism for a repo that has one."* Yes — and the alternative re-inflates two user-facing page functions from 2.7 MB to ~23 MB on exactly the routes ADR-0054 D9 measured and fixed. The asymmetry is recorded as a cost in ADR-0071's consequences, and step 0 measures it rather than asserting it |
| D2 | The index card is a committed PNG | *"Now the repo commits a second binary that can drift."* `T-WEB-S212` is widened to re-render it and compare SHA-256, with `WRITE_ARCHIVE_CARD=1` as the documented path — the exact guard #34 built for the root card |
| **D2b** | The display slot holds the most specific thing the URL names (§3.1) | *"You are putting a 23-character string where a shipped card puts one word, and you have not measured it."* Correct, and that is why §12.2 measures it before the builder's shape is fixed, with a three-rung ladder and a recorded verdict. The alternative — the constant at 96 px — was the step-2 draft and it made ~1,096 day cards visually interchangeable with the index card, which fails the ticket's own stated purpose |
| D3 | The day card names no game | §3, §14. The weakest link is (2): a row of four *names* without accent is not literally card-in-card. It is refused because **the accent may never colour a word at any size on any paper** (`DESIGN.md:20`), so four names cannot be told apart at all, and on ADR-0054 D1a's narrower-not-wider principle. The **structural** half is `archiveCard`'s signature, not `limit: 1` — see D5 |
| D4 | Existence = the day, via `listArchivedDays(…, limit: 1)` | *"A day with three of four games renders a card that implies four."* The card implies nothing — it names no game and no count. That is the same answer the page gives: it renders short |
| D5 | `limit: 1` | *"Premature optimisation."* It is not an optimisation: it is the smallest read that answers the page's own `days.length === 0` question, so the card's truth value is its page's by construction, and no game **set** is in scope. It is **not** what makes D3 structural — the step-2 draft claimed the handler "cannot see which games the day holds", which is **false**: `ArchivedDay` is `{date, game}` and `days[0].game` is one access away. The structural guarantee is `archiveCard`'s signature |
| D6 | No try/catch in the two new handlers | §4.1. The narrowed catch would be unreachable because `listArchivedDays` runs no projection, `parseArchive*` use `safeParse`, and `getDb()` throws a plain `Error`. Pinned by two `T-WEB-S334` rows so the absence can go red |
| D7 | `/cartao/<hoje>` 404s, and the head on `/arquivo/<hoje>` carries a real one-date residual | **Rewritten at step 5 from the measurement.** §4.2 — the handler's semantics were decided; the residual's existence was **measured**, and it is real. The 307 on `/arquivo/<hoje>` carries a full 12,509-byte HTML body with a complete `<head>`, so a non-following scraper reads a card URL that 404s where today it reads the root card at 200. **Accepted**: one date, self-healing at the next São Paulo midnight, on a URL the product never emits (share text emits `/arquivo/<data>/<jogo>`), reaching only scrapers that do not follow a 307 — and every scraper ADR-0054 `:63-64` probed does follow one — with the degradation generic-card → no-card, never to anything false. Case A (well-formed dates the wall refuses on a 404 page) is accepted on F23's own recorded ground. All three fixes are refused with reasons: a fallback card breaks D8's *"No fallback card, ever"*; suppressing `openGraph` for today needs a second clock, which ADR-0053 forbids; and the `302`-to-the-root-card fix would end the card's life as an existence proof |
| D8 | One PR | §6. Three PRs would amend ADR-0054 D7 three times for one slice |
| D9 | The new routes do not join `T-WEB-S183` | §10.3 — the protection moves into `T-WEB-S336`, which owns the card family |
| D10 | No `CONTEXT.md` row, no `DESIGN.md` entry | §11.4 — both stated as decisions with reasons, not omissions |
| **D11** | `/cartao` at the root rather than `/arquivo/cartao` | §2.5. *"The nested shape mirrors `mes`, costs nothing, and keeps the pt-BR namespace clean."* True, and refused on one forward argument: only a root family can later host **both** `/cartao/<data>/<jogo>` and the four daily game cards when #37 takes D9's remaining relief, and the daily four are not under `/arquivo`. The price — `routeSlugs` becomes mixed-purpose — is recorded on the `card` slug's own doc comment |
| **D12** | ADR-0071 carries **five** decisions, not eight | §11.1. *"You are dropping three things a future reader will need."* They are not dropped, they are re-homed: `force-dynamic`/`CARD_HEADERS`, the ESLint glob and the dated `alt` are **applications** of ADR-0053 D2, ADR-0054 D15 and a Next mechanic, and they go in Consequences, the PR body and the module doc blocks — which is where this repo already keeps that class of fact. CLAUDE.md rule 2's arithmetic on a ~250-line diff is what forces the cut |

### Assumptions, stated plainly

1. **A Next 16 route handler can serve an `ImageResponse` and is traced as its own function, leaving sibling page routes untouched.** `ImageResponse extends Response`, and the sharper question — whether `headers: CARD_HEADERS` clobbers `content-type` — is answered at source: `next/dist/server/og/image-response.js:37-45` builds `new Headers({'content-type': 'image/png', 'cache-control': …})` and then merges `options.headers` **per key**, so `CARD_HEADERS` (which carries only `cache-control`) leaves `image/png` intact. Step 0's criterion 3 confirms it on a real server rather than resting on the read.
2. **An explicit `openGraph.images` on a leaf suppresses the inherited file-convention image, and `twitter:image` follows it.** Read out of the installed `next@16.2.12` source (§2.4) and re-verified on a real build in step 0. Two mechanisms, not one: `resolve-metadata.js:182-186`'s wholesale `case 'openGraph'` replace kills an **ancestor's** image, and `:148-158`'s `hasOwnProperty('images')` guard governs the **same level's** file. The landmine follows from the pair.
3. **A static `opengraph-image.png` in a non-root segment attaches by the file convention and costs no trace on any page route**, by the same mechanism the root asset pair does — and it does compile to its own route entry (§2.2). Its URL carries a `?<contenthash>` query but **no** path hash, because `get-metadata-route.js:54-70` applies the `-<hash>` suffix only under a route group `(...)` or a parallel route `@...`, and `app/arquivo/` is neither. Confirmed by measurement in step 0's `.nft.json` sums and by criterion 2's `toContain`.
4. **No route conflict is created.** `app/cartao/[data]/route.ts` and `app/cartao/mes/[mes]/route.ts` sit under **different parents**, so Next's "different slug names for the same dynamic path" error does not fire; `/cartao/mes/2026-08` has three segments and matches only `/cartao/mes/[mes]`; `/cartao/mes` matches `/cartao/[data]` with `data = "mes"` and is refused. `T-WEB-S334` pins the last one.
5. **The frontier in `docs/agents/test-ids.md:43-44` is current** — re-derived by the documented grep on 2026-08-21 and again on 2026-08-22, agreeing in both columns. It is a snapshot; re-derive again before spending, and again after the step-8 merge.

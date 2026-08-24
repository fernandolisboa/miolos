# ADR-0071 — The archive cards are nameplates, and two of them leave the file convention

**Status:** Accepted — 2026-08-22 (issue #104, shipped in [PR #190](https://github.com/fernandolisboa/miolos/pull/190))
**Depends on:** [ADR-0002](./0002-plain-react-web-ui-not-universal-rn-web.md), [ADR-0004](./0004-no-unpublished-puzzle-reaches-the-client.md), [ADR-0010](./0010-publication-is-time-driven-published-at-plus-buffer.md), [ADR-0013](./0013-canonical-domain-and-pt-br-routes.md), [ADR-0014](./0014-apps-web-reads-the-database-directly-for-public-pages.md), [ADR-0018](./0018-i18n-is-an-in-repo-typed-message-module.md), [ADR-0024](./0024-buffer-stores-validated-content-reads-strip-inside-the-wall.md), [ADR-0028](./0028-daily-play-routes-and-the-conclusion.md), [ADR-0034](./0034-the-completion-celebration-renders-in-the-conclusion.md), [ADR-0041](./0041-accents-colour-shapes-never-words.md), [ADR-0053](./0053-the-archive-is-a-public-past-only-read-and-a-late-write.md), [ADR-0054](./0054-the-share-is-plain-text-and-the-card-is-a-nameplate.md)
**Amends:** three standing records. Every sentence quoted below was read off the file as it stands; each amended file carries the reciprocal `**Amended by:**` line **and** the in-place annotation, in this commit, because in this repo "amended" means the file was edited ([ADR-0053](./0053-the-archive-is-a-public-past-only-read-and-a-late-write.md) `:6`). **Every `:NNN` below is as of `main` at `ee4df9b`, i.e. BEFORE this commit's own annotations** — an in-place annotation moves every line under it, so a line number written after the edit is stale the moment a second annotation lands above it. Find each sentence by its quoted text; the number is a hint, not the address. This is the ADR-0070 defect (seven dead links from plausible-but-wrong pointers) closed by admitting what a line number can and cannot promise. **The one exception, stated so it is not read under the wrong base:** citations into `apps/web/**` source below — `app/arquivo/[data]/page.tsx:129` and `:139`, `app/arquivo/mes/[mes]/page.tsx:78` and `:91`, `card.tsx:229-238` — are as of **this PR's own diff**, because those files are edited here.

- **[ADR-0054](./0054-the-share-is-plain-text-and-the-card-is-a-nameplate.md)** — decision 7's *"**Eight image routes and one static asset**: a committed site card, and eight dynamic per-day-per-game cards. **One card kind, one read path.**"* (`:373-374`) and its twelve-route inheritance block (`:409`, `:418-420`, `:431`); decision 9's deferred non-segment relief (`:611-613`), its `sharp` production-function count (`:615-616`) and its denial-of-wallet sizing (`:645-650`, with its sibling at `:1170-1175`); decision 11's leaf-declaration count (`:714-718`); decision 12's `FONTS` call-site count (`:836-839`); decision 15's two-glob OG-wall enumeration (`:940-941`) and its `getDb()`-caller count (`:962`); the `cache-control`-carrying route count (`:1143-1147`); the Rejected entry at `:1096`; the English-segment URL count (`:1243`); the open OG-card follow-up (`:1120-1131`); and the `revalidatePath` consequence at `:1253-1259`, which is **false** rather than short. **One row moves the other way and is recorded as a check rather than a change:** decision 8's *"every archive `[data]` segment"* residual (`:521-531`) is **checked and UNCHANGED** — this branch's first draft claimed it was narrowed, the implementation measured that claim false, and the annotation records the check. See consequence (d).
- **[ADR-0053](./0053-the-archive-is-a-public-past-only-read-and-a-late-write.md)** — decision 2's `force-dynamic` route-module count (`:210` and the #34 annotation at `:240-245`) and its `revalidatePath` path list (`:230-234` and the annotation at `:247-260`, whose closing clause is false after #104). Decision 4's *"**Three archive readers** and one clock classifier"* (`:311`) is **unchanged**, and decision 10's *"Why no endpoint"* (`:629-636`) is obeyed: nothing user-specific reaches any card.
- **[ADR-0028](./0028-daily-play-routes-and-the-conclusion.md)** — decision 5's #34 annotation (`:163-182`), whose own rule is *"The enumeration is per-route, so it does not cover a metadata image route by implication either"* and whose *"**Eight is the whole count**, and it is eight rather than nine because the site card is not a route at all"* becomes ten. A route is covered only if it is **named**; the two `/cartao` handlers are named there in this commit.

## Context

[ADR-0054](./0054-the-share-is-plain-text-and-the-card-is-a-nameplate.md)
shipped eight dated Open Graph cards and one committed site card, and it left
two things open that #104 collects. The first is the follow-up its own
Rejected list records at `:1120-1131` — *"per-day OG cards for `/arquivo`,
`/arquivo/mes/<mes>` and `/arquivo/<data>`"* — of which *"The OG-card half is
still open"* after #103 took the share-button half. The second is decision 9's
named-and-declined relief at `:611-613`: *"Moving the dated cards to
non-segment URLs with explicit `openGraph.images` would lift that too, at the
cost of the convention; it is noted for #37 rather than taken here."*

Those two are the same question. A card for `/arquivo/<data>` cannot be an
`app/arquivo/[data]/opengraph-image.tsx` without re-inflating the exact page
functions decision 9 measured and fixed — 23.5–23.6 MB → 2.7 MB (`:583`) —
and a card on `app/arquivo/` would re-inflate all three archive shells plus
the four archive play routes at once, because a metadata module resolves into
every descendant's metadata graph. Decision 9's words for that cost: *"the
product's front door among them, paying a ~10× cold-start artifact for a card
that renders **zero times at runtime**"* (`:588-591`).

Fernando decided on 2026-08-20 (#104) that all three archive shells get
cards. So the questions here are **where the two dated cards live**, **what
"this day exists" means when a day holds one game or four**, and **whether
the day card names the games** — the last delegated to the plan as a design
call under `CLAUDE.md`, decided below and recorded on the issue.

## Decision

1. **All three archive shells get a card, and the family is a third builder
   in `apps/web/src/og/card.tsx`, not a new system.** `archiveCard()` joins
   `gameCard()` and `siteCard()`: same `paper()`, the same two of the three
   committed faces `siteCard()` uses (Fraunces 500 and Instrument Sans 400;
   Instrument Sans 600 is the kicker face, and no archive card has a kicker),
   same `×3`-from-mobile scale, same satori rules, and every length in its
   stack already exists in that module.

2. **The index card is a committed static asset; the day and month cards are
   `force-dynamic` functions. The split is the read.** `/arquivo` never 404s
   and its card names no date, so it reads nothing and cannot go stale: it
   ships as `apps/web/app/arquivo/opengraph-image.png` plus its `.alt.txt`,
   rendered at commit time under `WRITE_ARCHIVE_CARD=1` — the
   `T-WEB-S212` / `WRITE_SITE_CARD` precedent, extended to a second row with
   its own SHA-256 comparison. A static image asset in a segment costs **no
   trace on any descendant page route**; that is precisely what decision 9's
   measurement proved when the root card stopped being a module.

   **The index card's own justification, because the issue doubted it.** It
   is not "the site card with extra steps": it differs in its display line
   (`Arquivo`, not the wordmark) and in its caption (`archiveTagline`, the
   shipped `messages.archive.lead` sentence, not `siteTagline`), and `/arquivo`
   is a sitemap-published, crawler-reachable page that today advertises a card
   naming a different surface. It serves `/arquivo` **and nothing under it** —
   measured; see consequence (d) — so its whole warrant is its own page. The
   plan claimed a second warrant, that a malformed `[data]`/`[mes]` segment
   would inherit this card by nearest ancestor. That claim is false and is
   struck: see consequence (d).

3. **The dynamic cards live at their own pt-BR URLs at the root —
   `/cartao/<YYYY-MM-DD>` and `/cartao/mes/<YYYY-MM>` — referenced by an
   explicit `openGraph.images` entry composed inside `generateMetadata`.**
   This takes ADR-0054 decision 9's named relief **for these three routes
   only**. Measured on a real Turbopack build at `ee4df9b` (plan 068 §9 step
   0, evidence in the PR body): `/arquivo`, `/arquivo/[data]` and
   `/arquivo/mes/[mes]` stay at **2.7 MB** — while the new handler appears as
   its own `ƒ` entry at **22.4 MB** with its own `.nft.json`; totals go
   508.5 MB over 40 entries → 530.9 MB over 41 **with one of the two handlers
   in place**; the shipped pair plus the index asset take it to **556.1 MB
   over 43 entries**. What changes is **who pays the cold start**: under a
   segment module it is three page routes a human visits, here two routes only
   a scraper fetches. The eight game cards stay on the file convention and
   their ~23 MB residual remains #37's.

   **"Unchanged" is 2.7 MB to one decimal, not byte-for-byte, and the
   difference is stated because an earlier draft claimed exactness.** Measured
   on two full builds at step 6: `/arquivo` 2,662,386 → 2,663,607 B
   (**+1,221**), `/arquivo/[data]` 2,712,802 → 2,716,867 B (**+4,065**),
   `/arquivo/mes/[mes]` 2,703,345 → 2,707,414 B (**+4,069**) — **≤ 0.15 %**.
   The cause is the `.alt.txt` metadata module the static card brings with it
   (a 207 B chunk that enters every `app/arquivo/**` route's graph), plus
   ordinary shared-chunk churn from the new i18n strings. The substance is
   untouched: 2.7 MB against the four archive play routes' 23.6 MB in the same
   build is the load-bearing distinction, and it is unambiguous.

   **556.1 MB is a sum of per-function traces, not new deployed code.** It is
   the right figure for per-function cold-start payload, which is what this
   decision argues about. The union of unique traced files across every entry
   grew **26,380,889 → 26,492,330 B, +111,441 B** — `next/og` → `@vercel/og` +
   `resvg.wasm` + `sharp` + libvips were already deployed for the eight game
   cards, and the two new functions reference the same files. Both numbers are
   true and they answer different questions; neither is quoted alone.

   **The word.** `cartao` is a chosen slug, so ADR-0054 `:1243-1245`'s excuse
   — *"`opengraph-image` is a Next **file-convention** name, not a chosen
   slug"* — does not carry, and
   [ADR-0013](./0013-canonical-domain-and-pt-br-routes.md) `:23`'s *"Public
   route segments are pt-BR"* binds. It is the product's own word for the
   artifact (`ogCopy.altSite` is already *"Cartão do Miolos"*), externalised
   as a `routeSlugs` entry per `:38`, and both URLs are built by `routes.ts`
   builders so `:36` holds through `metadataBase`.

4. **Each card's existence proof is its page's, through one bounded call to
   `listArchivedDays` with `limit: 1`; the card's display line and caption
   come from the URL, never from the row.** The month page asks
   `days.length === 0` and the day page asks the same, so the card's truth
   value is its page's by construction. Zod parses the segment **before** any
   read — `parseArchiveDate` / `parseArchiveMonth`, never a second regex — so
   a hostile segment costs nothing and inherits `parseArchiveMonth`'s
   year-zero floor. A refusal is a bare `Response(null, {status: 404})` with
   the same `cache-control` as the 200 arm, never `notFound()`: there is no
   page to render a boundary into, and ADR-0054's *"**No fallback card,
   ever**"* (`:517-519`) binds here too.

   **Existence is the DAY, not a game's row.** A day holding one game renders
   a card, exactly as its page renders one game.

   **Neither handler carries a `try`/`catch`, and that is a decision rather
   than an omission.** ADR-0054 decision 8's rule narrows the catch to the
   projection class; applied to `listArchivedDays` it produces no catch at
   all, because that reader selects two columns, runs no projection and
   parses nothing, `parseArchive*` use `safeParse`, and `getDb()` throws a
   plain `Error`. A narrowed catch would be unreachable code that re-throws
   everything, and every throw these handlers can see is the class ADR-0053
   decision 4 sends to a 500.

   **And the "a satori throw is a 500" shorthand is narrowed rather than
   inherited.** It is true of a throw the **builder** raises — `archiveCard()`
   is a synchronous pure function called before `new ImageResponse(...)`, so it
   throws on the handler's own stack and Next answers 500; `T-WEB-S334` row (9)
   pins exactly that. It is **not** true of a throw inside satori itself. Read
   off `next/dist/server/og/image-response.js`: the body is a `ReadableStream`
   whose `async start()` constructs the real `OGImageResponse`, and
   `super(readable, { headers, status })` has already committed the **200**
   before satori runs — so a satori throw errors the stream after the status
   and headers are on the wire, producing a **truncated 200**, not a 500. This
   is pre-existing across all eight card routes and ADR-0054's *"so a satori or
   `ImageResponse` throw still surfaces as a 500"* carries the same shorthand;
   #104 neither introduces it nor fixes it, and writes it down so the next
   record does not restate it as a security property.

5. **The day card does not name the games. It is a dated nameplate.** Three
   recorded arguments, and one structural mechanism.

   - [ADR-0053](./0053-the-archive-is-a-public-past-only-read-and-a-late-write.md)
     decision 3 `:303-309`: *"The cron gained its four games on four
     different days with no backfill, so the archive's oldest days hold one,
     two or three games"* — *"the same shape any `killed_at` takedown
     produces."* A card naming four games is false on the archive's oldest
     days and on any takedown day.
   - `DESIGN.md:69` bans *"card dentro de card"*, which four game plates
     inside a 1200×630 paper card literally are. The weaker form — four names
     in a row, no plates — is refused on its own ground: `DESIGN.md:20` is
     absolute, *"The shared per-game accent may never colour a word"*, *"no
     `color: var(--accent)` on text, at any size, on any paper"*, so four
     game names are four undifferentiated words in one ink. On `gameCard` the
     game is legible in a chat bubble because the **tape and shadow** carry
     the accent; a card holding four games has no fifth surface to colour.
   - ADR-0054 `:207` — *"a **narrower** surface than the daily's, never a
     wider one"* — is written of #103's late-result panel, and it is the same
     surface relationship. Widening the share surface past the page surface
     (`DESIGN.md:48`: kicker + title only, no description, no duration) would
     invert it.

   **The structural mechanism is `archiveCard`'s signature**, which takes two
   already-formatted `string`s and admits no `Game` and no `ArchivedDay` —
   the identical argument `card.tsx:229-238` already makes for `gameCard`,
   *"the absence of a fallback is what makes the signature a guarantee rather
   than a convention."* `limit: 1` is **not** that guarantee: it bounds the
   read to an existence answer so no game *set* is in scope, but
   `ArchivedDay` is `{date, game}` and `days[0].game` is one property access
   away. Any sentence claiming the handler "cannot see which games the day
   holds" is false and is not written here.

   **No kicker on any archive card.** `DESIGN.md:29` calls kickers *"a
   deliberate brand system, used for game categories, not as a generic
   section eyebrow"*, and an archive card has no game a kicker could legally
   carry. `siteCard()` is the precedent.

## Rejected

- **Segment modules for the day and month cards.** ~3 × 23 MB ≈ 69 MB against
  the **55.6 MB** this decision ships (3 × 2.7 + 2 × 22.9 + 1.7, every term
  measured rather than estimated). The 22.9 is the **shipped** handler; the
  22.4 the step-0 spike reported is the same handler **without** the archive
  reader, which is why decision 3's 530.9 MB / 41 entries is a one-probe
  figure and 556.1 MB / 43 is the shipped one. It re-inflates two user-facing page
  functions from 2.7 MB to ~23 MB each. A module on `app/arquivo/` itself is
  worse again: it is an ancestor of both the others **and** of the four
  archive play routes.
- **`/arquivo/cartao/<data>` and `/arquivo/cartao/mes/<mes>`.** It mirrors the
  existing literal-`mes` shape, costs nothing on the trace argument, and keeps
  a machine-only endpoint out of a namespace whose entries are today every one
  a segment a person visits. Refused on one forward argument: when #37 takes
  decision 9's remaining relief it needs `/cartao/<data>/<jogo>` **and** the
  four daily game cards, which do not live under `/arquivo` at all — a nested
  family would leave the daily half homeless. The price of the root family is
  recorded: `routeSlugs` becomes mixed-purpose, twelve page segments and one
  machine endpoint, and the `card` slug's doc comment says so.
- **A day-level existence read that includes today**, i.e. `wallPredicate`'s
  bound rather than `archivedWallPredicate`'s, in `packages/db`. It grows
  ADR-0053 decision 4's *"Three archive readers"* enumeration, breaks #34's
  `git diff main -- packages` exit criterion, and buys a card for one date.
- **Reading the São Paulo clock inside `generateMetadata`.** A second clock;
  ADR-0053 permits only the database's.
- **`302` to `/opengraph-image.png` on an empty read, instead of `404`.** The
  closest call here: cheap, and the only fix that closes consequence (c)'s
  one real case, with no new reader, no clock and no `packages`
  diff. (It was written as closing *"both halves"* when the plan still believed
  in a case A; consequence (c) records why that case does not exist.) Refused
  because it costs the thing decision 4 exists to buy — the
  card stops being an existence proof, `/cartao/9999-01-01` would answer
  302 → 200, and a fetch could no longer distinguish "this day is archived"
  from "this day is not".
- **A fallback card on a refusal.** ADR-0054's *"**No fallback card, ever**"*
  is inherited unnarrowed.
- **`export const revalidate`, or a CDN TTL, on the two new routes.**
  ADR-0053 decision 2's precondition still binds and its writer still does
  not exist — verified 2026-08-22 that `` grep -rn "revalidatePath" apps packages | grep -v "/\.next/" ``
  returns nothing, i.e. no occurrence outside generated `.next/` output in
  either app.
- **A `CONTEXT.md` row and a `DESIGN.md` entry.** Choices, not omissions.
  `CONTEXT.md`'s Archive row already names all three routes and neither file
  carries an OG entry at all — not even for the game card #34 shipped. The
  card's design law lives in `card.tsx`'s doc block, plan 040 §7.2 and here.

## Consequences

- **(a) The repo now holds two card mechanisms, and that is the cost of
  decision 3.** Eight game cards attach by the Next file convention; two
  archive cards are route handlers referenced by an explicit
  `openGraph.images`. The asymmetry is bounded by the reason for it — only
  the archive shells were paying a ~10× trace for a card they never render —
  and it closes when #37 takes the rest of decision 9's relief.
- **(b) `openGraph` on a leaf without an explicit `images` entry DELETES that
  leaf's card, and #104 is where the trap becomes reachable.** Next 16.2.12's
  `mergeMetadata` replaces the accumulated `openGraph` wholesale, while
  `mergeStaticMetadata` re-adds a file-convention image only for the **same**
  level's own file. Confirmed by controlled A/B inside one real build: the
  probed day page emitted the explicit `/cartao/<data>` URL with no trace of
  the root asset, while two untouched controls in the same build emitted
  `/opengraph-image.png?<contenthash>`; `twitter:image` and its four siblings
  auto-filled from the explicit entry, so ADR-0054 decision 11's *"no
  `twitter-image.tsx` will ever be needed"* survives. `app/arquivo/[data]/termo/page.tsx`
  is the live precedent that survives only by owning a file of its own.
- **(c) A knowing, measured, one-date regression on `/arquivo/<hoje>`, and one
  case the plan invented.**
  **The case the plan invented, recorded because it was written down first.**
  Plan 068 §4.2's *"case A"* held that a well-formed date or month the
  publication wall refuses would advertise a 404ing `/cartao/…` URL. It does
  not. Such a page answers 404 through `notFound()`
  (`app/arquivo/[data]/page.tsx:139`, `app/arquivo/mes/[mes]/page.tsx:91`), and
  a `notFound()` **discards** the route's composed metadata: in Next 16.2.12
  `collectMetadata` reads the **layout**'s metadata export, never the page's,
  once an error convention is set, so `generateMetadata`'s result never reaches
  the head. `/arquivo/1999-01-01` therefore answers 404 advertising the **root**
  card, which resolves 200 — unchanged from before #104. There is no case A,
  and the residual is one case, below.
  **Case B — today.** `/arquivo/<hoje>` does not 404: it answers **307** with
  a `Location: /`. Whether that 307 carries a body decided whether a residual
  exists at all. **It does** — and worth recording, ADR-0054 `:62-63` already
  said so in decision 1's own context (*"not follow the 307 and parses its
  body, which is `text/html` and ships a complete `<head>` from the **archive**
  route"*), so this was answerable from the corpus and was measured anyway
  rather than taken from a sentence written for a different purpose.
  Measured 2026-08-22 on `next start`: 12,509
  bytes of `text/html` with a complete `<head>` carrying `og:image`,
  `twitter:image`, `og:title`, `og:description` and a self-referential
  canonical (12,673 bytes on the same URL with the probe removed, advertising
  the root card). So a non-following scraper reading `/arquivo/<hoje>` gets a
  card URL that 404s where today it gets the root site card at 200. Real, and
  **accepted**: one date; self-healing at the
  next São Paulo midnight; on a URL the product never emits, since the share
  text emits `/arquivo/<data>/<jogo>`; reaching only scrapers that do **not**
  follow a 307, and every scraper this repo has probed does follow one
  (ADR-0054 `:63-64`, 2026-08-14 — Facebook/WhatsApp, X, Slack, Discord,
  LinkedIn); and the degradation is generic-card → no-card, never to anything
  false. The 307 already carries `private, no-cache, no-store`, so nothing
  holds the stale head past midnight. The three fixes are in Rejected above.
- **(d) The malformed-segment residual is UNCHANGED, and the plan claimed
  otherwise in three places.** Plan 068 §2.2/§2.3 asserted that a malformed
  `[data]` or `[mes]` segment would inherit `app/arquivo/opengraph-image.png`
  by nearest ancestor. Measured on a real production build (step-5 evidence):
  it does not, for two independent reasons. First, such a segment answers 404
  through `notFound()` (`app/arquivo/[data]/page.tsx:129`,
  `app/arquivo/mes/[mes]/page.tsx:78`), and a `notFound()` **discards** the
  route's composed metadata in Next 16.2.12, so the head carries the root card,
  the root title and no canonical. Second, an `opengraph-image` file reaches
  descendant segments only from a segment owning a `layout.tsx`, and
  `app/arquivo/` owns none — `find apps/web/app -name layout.tsx` returns
  exactly one file, the root. So `app/arquivo/opengraph-image.png` serves
  `/arquivo` and nothing under it. ADR-0054 decision 8's residual is about the
  four archive **play** routes `/arquivo/<data>/<jogo>`, each of which owns its
  own `opengraph-image.tsx` and which #104 does not touch, so its word
  *"every"* was never within this ticket's reach and still holds. Recorded as a
  named correction rather than by silence, because the branch shipped the
  opposite claim first.
- **(e) The uncacheable card surface grows by 1,132 URLs, +25.8 %.** One day
  card per archived day (~1,096 over three years) and one month card per
  archived month (~36); the index card adds zero. ADR-0054 `:645-650`'s
  figure goes 4,388 → **5,520 card URLs**, on top of the 4–8 minutes already
  sized. On reads: pages-only 5,516 → 6,648 (**+20.5 %**); like-for-like
  against the base that paragraph itself counts — pages plus the existing
  archive card reads — 9,900 → 11,032 (**+11.4 %**). All three archive page
  URLs are already in `sitemap.ts`, so the cards are crawler-reachable by
  construction. **Nothing in #104 fixes this and #37 still owns it**, as an
  explicit abuse item over a surface a quarter larger again.

  **The billed sweep delta is ≈75–109 s, not the ≈58 s an earlier draft
  wrote.** That figure was rasterisation only, and derived off `gameCard`'s
  48–55 ms rather than off this ticket's own card. Re-derived off `archiveCard`
  as measured at step 6 (25 warm renders each, real `ImageResponse`, real
  `FONTS`: day p50 **45.9 ms**, month p50 **51.3 ms** — both cheaper than
  `gameCard`'s 49.7 ms, because an archive card draws one text run fewer):
  1,096 × 45.9 + 36 × 51.3 = **≈52 s of rasterisation**. But Vercel bills
  wall-clock GB-seconds, awaits included, so the **+1,132 Neon round trips this
  same paragraph counts are billed too**. At a 20 ms round trip the total is
  ≈75 s; at 50 ms, ≈109 s. The round trip is **unmeasured** — no production
  credential exists in a working tree — so the range is given rather than a
  point. The same omission sits upstream in ADR-0054's 4–8 minutes; the method
  is at least consistent, and naming it here is what stops the next ticket
  inheriting it a third time.

  **+25.8 % is a floor, not the figure.** The 4,384 base assumes every archived
  day holds four games. [ADR-0053](./0053-the-archive-is-a-public-past-only-read-and-a-late-write.md)
  decision 3 records that the archive's oldest days hold **one, two or three**,
  and a `killed_at` takedown produces the same shape. On a day holding `g`
  games #104 adds one day card to `g` game cards — **+1/g, i.e. +33 % to
  +100 %**. Immaterial at three years, materially wrong near launch when the
  archive is short and ragged.

  **The URL count is a CRAWLER model. Per-URL cost is unbounded.** Every figure
  above is *per full sweep* over a URL space, which implies the count bounds
  the bill. It does not: `CARD_HEADERS` is `no-store`, so nothing holds a byte;
  there is no `middleware.ts` in `apps/web`, no rate limit anywhere in the repo
  for reads, and `vercel.json` carries no firewall rule —
  [ADR-0053](./0053-the-archive-is-a-public-past-only-read-and-a-late-write.md)
  already records the last three in one clause, *"no middleware in either app,
  no firewall rules in either `vercel.json`, no rate-limit dependency
  anywhere"*. One attacker on one URL costs N Neon round trips
  and N rasterisations for N requests, with no ceiling. **This class is
  pre-existing** — the eight existing card routes and the archive pages have it
  identically — and #104 widens it by 25.8 % rather than creating it. Nothing
  in this ticket's scope fixes it; it is stated so that #37's abuse item is
  sized against an adversary and not only against a sweep.

  **The card's read rides the composite primary key, and the shipped plan on
  the production engine is unverified.** The step-6 `EXPLAIN (ANALYZE, BUFFERS)`
  ran on **PGlite 0.5.4, which reports PostgreSQL 18.3**, where `Index
  Searches: 9` on a btree whose leading column (`game`) is unconstrained is PG
  18's B-tree **skip scan**. Production is **Neon, PG 17** (plan 009 D1), which
  has no skip scan, and there is no `date`-only index: the only index on
  `daily_puzzles` is `daily_puzzles_game_date_pk (game, date)`. So on PG 17 the
  planner falls back to a full scan of a table measured at **2,048,000 B heap /
  4,384 rows / 0 B TOAST** at a three-year archive — still sub-millisecond, and
  dwarfed by the Neon round trip above. Bounded, so this is a record and not a
  code change: **no index is added at #104**, because one was measured to buy
  0.2 ms (day 0.501 → 0.275 ms, month 0.324 → 0.122 ms). `CREATE INDEX ON
  daily_puzzles (date)` is the lever if the surface grows, and it is #37's.

  **`no-store` on the 200 arm buys ~nothing for these two routes, and that is
  where a TTL should start.** The 404 arm's justification stands unchanged: a
  refusal's truth value flips at São Paulo midnight, and a negative-cached 404
  outliving that is a real dated failure. The 200 arm is different *here*: an
  archive shell card carries a date and `messages` constants and **zero puzzle
  content** by `archiveCard`'s signature, so the only thing a `killed_at`
  takedown flips is 200 ↔ 404 — a resource-existence fact `/arquivo` and
  `/arquivo/mes/<mês>` already publish to anonymous visitors in bulk. #104
  changes nothing (ADR-0053 decision 2's precondition still binds and its
  writer still does not exist), but when that precondition is met these two
  routes are the cheapest place to begin.
- **(f) Ten public URLs now end in an English segment**
  (`/arquivo/opengraph-image.png` is the tenth file-convention name), **and
  the two new card URLs are pt-BR by obedience rather than by exception** —
  a strictly better position than the one #34 had to argue for.
- **(g) The washi tape on the archive cards does not contradict
  `index-view.tsx`.** That module says the archive **index page** carries
  *"NO washi tape: tape marks a game, and the index is not a game"*; it has no
  paper card with a top edge to tape. On the **card** surface `siteCard()`
  already settled it: a non-game card takes `--accent-app`. Here the tape
  marks *a card*; the **accent** marks a game. `index-view.tsx` is not edited.
- **(h) The archive half of the OG copy deck opens for the first time.**
  `ogCopy`'s module doc block in `apps/web/src/og/copy.ts` says *"The ARCHIVE
  routes add no copy at all"*, which was true of the archive **play** routes
  and is amended in the same diff: the
  three shell cards add **five** strings — `archiveTagline`, the shipped
  `messages.archive.lead` sentence rather than a second spelling of it, for the
  index card, which has no date to print; `archiveDayCaption`, for the day
  card, which carries the year the display line dropped at rung 2 (consequence
  (i)); and three `alt` strings, two of them **dated** — the mirror image of
  `altGame`'s dateless constraint, since a module-level `alt` export cannot
  read `params` and an `images[].alt` composed in `generateMetadata` can. The
  count is five and not four because rung 2 minted `archiveDayCaption` after
  the copy deck was written; plan 068 §5 and plan 040's `:1092` row are
  corrected to match.
- **(i) The day card took sizing RUNG 2, measured, and rung 1 failed by
  25 %.** Plan 068 §12.2's harness enumerated all 366 day-and-month
  combinations at 96 px Fraunces 500 against `paper()`'s real inner width —
  **890 px**, `1040 − 2 × 72 − 2 × 3`, because yoga's `width` is a border box
  and the plan's arithmetic omitted the border. Rung 1, the full
  `formatLongDate` output, **fails**: `"20 de novembro de 2028"` measures
  **1111 px**. So the day card puts the day and month at 96 px and moves the
  year onto the caption line — worst case `"20 de novembro"` at **729 px**.
  The month card stays at rung 1: `"novembro de 2028"` at **843 px**. The
  worst case is `novembro` rather than the longest string by character count
  because Fraunces' figures are not tabular (`0` is 63 px, `1` is 43 px),
  which is also why `"20"` beats `"22"` — the ticket's own example date was
  not the worst case. Rung 2 costs no new type level, no new absolute length
  and no new derivation: one small formatter beside `formatLongDate`, whose
  output is still a **date**, so decision 5's guarantee is unharmed. Rung 3,
  a third display level, was not needed and is not paid.

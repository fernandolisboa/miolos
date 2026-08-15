# ADR-0054 — The share is plain text and the card is a nameplate

**Status:** Proposed — 2026-08-15 (issue #34)
**Depends on:** [ADR-0002](./0002-plain-react-web-ui-not-universal-rn-web.md), [ADR-0004](./0004-no-unpublished-puzzle-reaches-the-client.md), [ADR-0006](./0006-monetization-convenience-not-access.md), [ADR-0010](./0010-publication-is-time-driven-published-at-plus-buffer.md), [ADR-0013](./0013-canonical-domain-and-pt-br-routes.md), [ADR-0014](./0014-apps-web-reads-the-database-directly-for-public-pages.md), [ADR-0018](./0018-i18n-is-an-in-repo-typed-message-module.md), [ADR-0024](./0024-buffer-stores-validated-content-reads-strip-inside-the-wall.md), [ADR-0027](./0027-the-hint-is-computed-on-the-client.md), [ADR-0028](./0028-daily-play-routes-and-the-conclusion.md), [ADR-0029](./0029-shared-daily-play-layer-in-apps-web-src-play.md), [ADR-0031](./0031-per-device-day-state-is-a-local-monotone-safe-affordance.md), [ADR-0033](./0033-the-nonogram-reveal-ships-no-name.md), [ADR-0034](./0034-the-completion-celebration-renders-in-the-conclusion.md), [ADR-0036](./0036-aligning-numerals-use-instrument-sans-not-fraunces.md), [ADR-0038](./0038-termo-guesses-are-judged-by-a-stateless-server-route.md), [ADR-0039](./0039-termo-cannot-be-played-offline.md), [ADR-0041](./0041-accents-colour-shapes-never-words.md), [ADR-0043](./0043-the-conclusion-has-a-fourth-state-and-it-is-a-loss.md), [ADR-0045](./0045-the-termo-screen-ships-no-hint-and-no-clock.md), [ADR-0046](./0046-free-play-routes-levels-and-the-ephemeral-session.md), [ADR-0047](./0047-bundle-markers-are-route-scoped.md), [ADR-0051](./0051-statistics-are-read-time-derivations-on-closed-contracts.md), [ADR-0052](./0052-medals-are-derived-facts-plus-curated-grants.md), [ADR-0053](./0053-the-archive-is-a-public-past-only-read-and-a-late-write.md)
**Amends:** four standing records. Three go by one mechanism — a **per-route enumeration that #34 grows** — and the fourth, added at step 7 (finding B2/W1), is the only one where a decision's sentence is **outright false** rather than merely short. Every sentence below is quoted from the file as it stands; every amended file carries the reciprocal `**Amended by:**` line **and an in-place annotation of the amended sentence**, because in this repo "amended" means the file was edited ([ADR-0036](./0036-aligning-numerals-use-instrument-sans-not-fraunces.md) consequence (b), restated at [ADR-0053](./0053-the-archive-is-a-public-past-only-read-and-a-late-write.md) `:6`).

- **[ADR-0028](./0028-daily-play-routes-and-the-conclusion.md)** — decision 4's *"**Both segments** are `force-dynamic` async server components"* and its closing *"When the helper returns nothing — no puzzle, or a killed one — **both routes render the same pt-BR unavailable screen**."* The **segment** count is unchanged: an `opengraph-image.tsx` is a metadata route *inside* the existing `/<jogo>` segment, so *"both"* stays true. What grows is the number of `force-dynamic` route **modules** under the slug, two → three, and the unavailable-screen clause now has a sibling module that answers the same helper-returned-nothing condition with a **404 and an empty body** (decision 8). Decision 5's per-route enumeration of the ADR-0014 direct-read extension **grows** to the eight image routes; the consequence *"#23/#25/#27 add a slug, a `routes` entry, **two** `force-dynamic` server segments and a conclusion view"* and #31's own *"the archive's four play screens add … **one** `force-dynamic` server segment each"* are both one item short — three per daily game, two per archive play screen (decisions 7, 9, 10).
- **[ADR-0053](./0053-the-archive-is-a-public-past-only-read-and-a-late-write.md)** — decision 2's *"`export const dynamic = "force-dynamic"` on **all seven pages**, on `sitemap.ts` and on `robots.ts`"*: the archive family carries nine `force-dynamic` route modules today and **thirteen** after #34. **And its standing precondition's path list** — *"the `killed_at` write must **first** gain a writer that calls `revalidatePath` for the affected paths (**day, month, index, play, sitemap**)"* — grows by the four `/arquivo/<YYYY-MM-DD>/<jogo>/opengraph-image` paths. That one is not bookkeeping: a future `killed_at` writer built from the un-annotated list would leave a withdrawn puzzle's **card** serving after its page 404s, which is decision 2's own failure mode on the surface #34 creates. The precondition itself is **obeyed, not narrowed** — no `revalidate` is added anywhere (decision 9). Decision 4's *"The two shipped readers keep throwing, because on those a bad row is a live incident"* is narrowed at the **caller**: the readers are byte-unmoved and still throw, and #34's image routes answer a projection-class throw with a 404 while everything else still re-throws to the 500 that clause defends (decision 8).
- **[ADR-0039](./0039-termo-cannot-be-played-offline.md)** — decision 2's *"Copying the route shape — a slug, a `routes` entry, **two `force-dynamic` segments**, a conclusion view — **is still required**"*. This is not a quotation of ADR-0028 (ADR-0029 `:13-15` is one, inside quote marks and attributed); it is ADR-0039 restating the fifth-game recipe as its own decision-2 claim, in a **stronger forward tense**. After #34 a fifth game copying "the route shape" also needs `app/<jogo>/opengraph-image.tsx` and `app/arquivo/[data]/<jogo>/opengraph-image.tsx`. **Three consecutive audit passes cleared this file as untouched**, which is recorded here because `0053:99-101` asked for exactly that lesson: *"clearing an ADR on one sentence is not clearing the file."*
- **[ADR-0043](./0043-the-conclusion-has-a-fourth-state-and-it-is-a-loss.md)** — decision 10's closing sentence, *"Games that pass no `outcome` render no region and are unchanged."* **This one is false, not short.** The share button renders a second `role="status" aria-live="polite"` region on the `result` and `lost` branches of **all four** conclusions, gated on neither `outcome` nor game, so Binairo, Sudoku and Nonogram conclusions carry a live region and are not unchanged. Two consequences, both taken at `0043:265`: the sentence is annotated in place, and — because [ADR-0042](./0042-the-termo-board-is-read-only-output.md) decision 10 requires an explicit **disjoint-writers** rule wherever one screen carries two `role="status"` regions — the relationship between `.announcer` and `.shareStatus` is stated rather than assumed (decision 4). **Added at step 7, and the miss is worth recording:** the repo already knew. `docs/agents/test-ids.md` and plan 040 §14 D3 both say `T-WEB-S96`'s no-live-region assertion *"became false"*, and **both filed it as a test deviation rather than as a falsified record** — §11.2's sweep touched this ADR at decision 8, consequence (a) and `:30`, and never examined decision 10. That is the fourth instance of one pattern in this ticket, after U1, U2 and U8.

## Context

[ADR-0002](./0002-plain-react-web-ui-not-universal-rn-web.md) `:37` sanctions
the mechanism outright — *"Next.js `ImageResponse` gives per-day, per-game
Open Graph share cards natively — the distribution mechanic from
ADR-0001"* — and [ADR-0013](./0013-canonical-domain-and-pt-br-routes.md) `:35`
names OG cards among the surfaces that target `miolos.app`. #34 is the
first ticket to ship either. It inherits **no dormant surface**: before this
branch, `opengraph`, `og:image`, `ImageResponse`, `next/og`,
`navigator.share` and `compartilh` returned nothing anywhere in `apps` or
`packages`.

**What the ticket asks for**, in four acceptance criteria: a spoiler-free
share text per game; per-day, per-game OG images on the public URLs, in the
Ateliê system, generated in code; OG generation as a public read path through
the published-predicate helper that can never render an unpublished day; and
shared links that land on the exact day/game page, with the flow working on
mobile.

**The share's own governing permission is
[ADR-0031](./0031-per-device-day-state-is-a-local-monotone-safe-affordance.md)
decision 6 `:84-89`** — device state *"may drive an affordance … and never an
entitlement"*. A chat message composed from the device's own play record is
the purest affordance in the product, which is why no server round trip and
no new contract appear anywhere in this record.

**AC 3's actual governing sentence is
[ADR-0010](./0010-publication-is-time-driven-published-at-plus-buffer.md)
`:20`**, the only rule in the corpus that names this surface: *"**Every** read
path — daily, archive, **OG images**, anything — filters `published_at <=
now()`, and does so through **one shared query helper**, not a predicate
re-typed per route."* Everything decision 8 says about the wall is that
sentence obeyed literally.

### Trap A — why the OG surface is two route families and not one

[ADR-0053](./0053-the-archive-is-a-public-past-only-read-and-a-late-write.md)
decision 1 built a 307 on today's per-day permalink *"because #34's AC is that
a shared link lands on the exact day/game page and sharing happens right after
playing"*. That redirect lives in the **page body**, not in
`generateMetadata`: `app/arquivo/[data]/<jogo>/page.tsx` reads, classifies and
calls `redirect(...)`, while `generateMetadata` returns title, description and
canonical unconditionally for a well-formed date. `app/arquivo/[data]/page.tsx`
already states the mechanism in the tree — *"Metadata and the page resolve
independently in the App Router, so a `notFound()` below cannot un-compose a
`<head>` this function has already produced."*

So there are **two scraper populations**, and #34 must serve both. One does
not follow the 307 and parses its body, which is `text/html` and ships a
complete `<head>` from the **archive** route. The other follows it and lands
on `/<jogo>`, which before this ticket declared no metadata at all. Probed on
2026-08-14: Facebook/WhatsApp, X, Slack, Discord and LinkedIn all follow.
**That second population is the dominant one** — sharing happens right after
playing, the URL on the clipboard is `/arquivo/<hoje>/<jogo>`, and on that day
it 307s. Whatever card the **daily** route serves is therefore the card almost
every share renders on day one, which is the whole reason decision 7 dates all
eight rather than four.

*Handoff 039 §5's framing of this is imprecise* — it says *"a crawler fetching
today's permalink reads the daily route's metadata, not an archive page's"*,
which is true only of the population that follows the redirect. A handoff is a
point-in-time snapshot and is not edited (`docs/README.md:21`); the correction
lives here and in plan 040 §4.

### What #31 handed over, and the threat model it changed

ADR-0053 `:1020-1023` lists exactly three inheritances — a stable
per-day-per-game URL, a per-day URL that resolves for today too, and the same
wall readers as the single public read path — and `:982-984` records the
threat-model change: *"**Ten volume medals become self-mintable**, and #34 is
where a self-minted volume medal first becomes socially visible."* Decision 3
resolves that by not making them visible at all.

### The amendment audit, and its verdict

The audit behind the `Amends:` header above was re-derived from scratch over
all 53 prior records, and then **run again by shape** — forward-tense
prescriptions that enumerate route artifacts — because reading each file for
*"did a decision move?"* had cleared, in three consecutive rounds, records
whose **enumerations** #34 grows. The shape sweep is what found ADR-0039
decision 2; the file-by-file pass never did. Plan 040 §11.2 carries the full
candidate list with each verdict quoting its source. The load-bearing
verdicts, so this record is readable without it:

- **Amended, header and annotation:** ADR-0028 (decisions 4 and 5, and the
  fifth-game consequence), ADR-0053 (decision 2's route enumeration and its
  `revalidatePath` path list, decision 4's 404-vs-500 clause), ADR-0039
  (decision 2's fifth-game recipe), and **ADR-0043 (decision 10, whose
  *"games that pass no `outcome` render no region and are unchanged"* is not
  qualified but outright false once the share button's `role="status"`
  region renders on every conclusion — the fourth record, added at step 7,
  and the only one of the four where a sentence is contradicted rather than
  an enumeration grown)**.
- **Annotated, no header** — the sentence gains a term or a qualification, no
  decision moves and no route enumeration grows: ADR-0028 `:35-40` and its
  echo ADR-0053 `:1030-1034` (*"neither cacheable nor an SEO surface"*, which
  decision 10 qualifies rather than contradicts); ADR-0045 `:186-191` (the
  dead-share-button rule, **discharged** by the live button, with the
  `conclusion-view.tsx` comment it cites rewritten); ADR-0002 `:41` (*"static
  instances of Fraunces **at chosen weights**"* — what must be chosen is
  `{weight, opsz}`, decision 12); and **ADR-0038 consequence (a) `:316-326`
  (*"It cheats only its owner"* — a fabricated `n/6` and tile grid now reach
  an audience, though the prohibition half, never a medal and never an
  entitlement, is untouched)**.
- **Obeyed, not amended:** ADR-0010 `:20` (both readers spread
  `publishedConjuncts()`; neither re-types it); ADR-0046 (the free-play wall
  gains a class, which strengthens the guarantee it describes); ADR-0047 (a
  metadata route ships no client chunk and never enters the marker scan, so it
  fails closed); ADR-0024 decision 5 and `:111-114` (the db wall's permitted
  list is byte-unmoved and the named ESLint duty is carried into the new wall
  verbatim — decision 15); ADR-0029 decision 2 (the game-shaped logic is in a
  pure module, not in the view); ADR-0033 (obeyed harder, and cited at the
  right lines — decision 8); ADR-0041 (the accent colours a shape, never a
  word); ADR-0036 (the card's only figure is a date, decision 2's own
  non-aligning carve-out); ADR-0013 `:23` (`opengraph-image` is a Next
  file-convention name, not a chosen slug — the `/sitemap.xml` class);
  ADR-0014 `:18`, used **as amended by #31** rather than as written, since
  #34's reads are `force-dynamic` and `private, no-cache`.
- **New ground, governed by nothing:** committing font binaries,
  `.gitattributes` and server-side font rasterisation. Confirmed by keyword
  sweep over all 53. That is decision 12.

## Decision

1. **The share is composed inside `ConclusionView`, from the record it already
   reads.** `ConclusionView` gains an in-file `ShareButton` and calls a new
   pure module `apps/web/src/play/share-text.ts`. Its props stay at **seven**
   — three required (`game`, `date`, `copy`) and four optional (`result?`,
   `picture?`, `outcome?`, `answer?`). `ConclusionCopy` is **not** widened and
   Binairo and Sudoku gain no wrapper.

   ADR-0034 decision 3 admits an optional prop under two rules — plain data
   only, and supplied only by a client component that owns the local play
   record. `ConclusionView` **is** that client component (`"use client"`,
   `useRecordSnapshot(game, date)`), so composing there satisfies rule 2 by
   construction and rule 1 is vacuous because nothing crosses a boundary. A
   fifth optional prop would be the wrong *shape*, not merely one too many:
   ADR-0034 consequence (c) is explicit that *"a second member is a claim about
   the **game's** shape"*, and a `share` prop would be a member every game
   passes identically — the definition of shared chrome, which in this file
   comes from `messages` read directly.

   **ADR-0029 decision 2 is not broken**, because the game-shaped logic is not
   in the view: it is in `share-text.ts`, a pure module that narrows a
   discriminated union — `ShareSubject`, after the amendment below — and
   returns a string. The view calls one function and renders one button.

   **The button renders in both terminal states and is `disabled` until the
   concluded record hydrates.** `result` and `lost` share one return, so there
   is exactly one insertion point, in the `<aside>` between the chaining CTA
   and the statistics link; it is absent from the `skeleton` and `empty`
   branches by construction. The disabled window is the one-commit swap where
   a child's mount effect runs before its parent's. Gating the *enabled state*
   rather than the *render* keeps the box reserved, which is the
   `PlaySkeleton` discipline applied to a button.

   **AMENDED AT STEP 7 (step-6 blocker B4/K3): the gate applies to TERMO
   only, and a store-less Termo renders nothing.** The paragraph above was
   true of the swap and false of a browser with no `localStorage` — Safari
   private mode, a site-data-blocked profile — where `readPlayRecord` returns
   `undefined` forever. There the shipped control never enabled and never
   explained itself, which **is** ADR-0045 `:186-191`'s dead share button,
   reached from the other side. The composer now takes a `ShareSubject`: a
   `TermoPlayRecord`, or `{ game, date, elapsedMs }` for the three grid games,
   whose entire share is a header and an elapsed time and whose elapsed time
   `ConclusionResult` already carries. Termo genuinely cannot be composed that
   way — its grid is `guesses[].tiles`, which exists nowhere but the record —
   so it keeps the gate, and where no store exists to lift it,
   `playRecordsAvailable()` omits the control instead of showing one that can
   never work. Three states, all three written into the component's doc block:
   subject → enabled; no subject but a store → disabled for one commit; no
   subject and no store → nothing rendered.

2. **Coloured squares are content in a channel with no CSS, not decoration on
   a rendered page.** Termo's grid uses 🟩 / 🟨 / ⬜ for `correct` / `present` /
   `absent`, and the three characters live in `messages.share.tiles`.

   `DESIGN.md:58` carries the brief's anti-references verbatim as law, and the
   list contains *"emoji decorativo"*. Five places in the tree enforce it and
   two mechanical scans police it — **every one of them is about a rendered
   page**, a surface with typography, colour tokens, spacing and a stylesheet,
   where an emoji is a picture standing in for a word the design system could
   have set properly. The anti-reference's own adjective is *decorativo*. A
   plain string pasted into WhatsApp is not that surface: there a coloured
   square is **the only available encoding of a per-cell verdict**, and it is
   the encoding the whole genre already uses, which is why a recipient reads
   it without being taught. No emoji enters any JSX, any stylesheet or any
   medal string, and none of the five enforcement sites is edited.

   **The rule is now a gate rather than an argument — and the gate's reach is
   stated exactly, because the plan overstated it** (step-7 finding G6).
   `T-WEB-S208` scans every `.tsx` and `.css` under `apps/web` for
   `\p{Extended_Pictographic}`, escape-encoded spellings decoded first, and
   asserts zero hits. What that catches is an emoji **authored into** a
   rendered surface — the realistic regression, since the two shipped emoji
   scans are scoped to medal content and all three squares match their regex,
   so nothing else in the repo would stop a designer pasting 🟩 into a
   component or a stylesheet. What it does **not** catch is an emoji that
   arrives at runtime through a composed string: plan 040 `:135` justified the
   gate as closing *"a later ticket could render a preview of the share text
   on a page"*, and it does not — `<pre>{buildShareText(…)}</pre>` contains no
   literal emoji and passes green. **An import-graph ban would not work
   either, and the reason is worth writing down**: `conclusion-view.tsx` is
   itself a rendered `.tsx` that legitimately imports `share-text.ts`, so
   "no rendered surface may reach the share composer" is red on the shipped
   tree. That path is held by this decision, by `messages.share.tiles` being
   the squares' only home, and by design review — not mechanically.

   **The cost is accepted rather than argued away:** 🟩🟨⬜ are off-brand
   against Ateliê's four accents and emoji cannot be recoloured. There is no
   version of this that is on-brand.

3. **What the share may say, exhaustively — and what it may not.** Each
   game's share is a header line (`Miolos · <Jogo> · <14 ago>`), a result line,
   the grid for Termo alone, and the per-day permalink.

   | Game | Result line | Shape |
   |---|---|---|
   | Termo, won | `4/6` | the grid, one row per judged guess |
   | Termo, lost | `X/6` | the grid, six rows |
   | Binairo, Sudoku, Nonogram | `07:12` | **none** |

   **In:** the game's name (a constant); the date via the shipped
   `formatShortDate`, which is the **server's** day handed down by the page
   shell; the elapsed time, which is the result; Termo's `n/6` and its grid,
   every tile of which is a **server** verdict (ADR-0038 makes the guess route
   the judge, and the client never judges a Termo tile); and the URL.

   **Out, each for its own reason.** The answer, the canonical spelling and
   every guess word — `answer` is present in the record exactly when
   `concluded` is true, on both outcomes including the win, and today's Termo
   answer is the one piece of content the whole of ADR-0004 exists to protect
   (`:11-13`: *"the threat that matters here is spoiler broadcast"*). The
   Nonogram bitmap and the Sudoku/Binairo boards, which are the answer. The
   Nonogram size and the Sudoku tier, which are properties of the *puzzle* and
   not of the *play* — and which are excluded by **different** mechanisms:
   `size` is on the record and excluded by the composer's choice, while `tier`
   is not on the record at all, so its guard is a key-set assertion over each
   member's schema rather than a fixture. The hint count, which is
   client-computed and self-reported (ADR-0027) and is a *virtue* claim.
   Medals and any volume-derived count, including solved totals, which carry
   no on-time conjunct (ADR-0051 decision 6) and are therefore self-mintable
   after #31. The streak, which is the one server-computed number that would
   be honest, but which renders behind `syncOutcome === "recorded"` — a share
   whose content depends on whether a fetch resolved is a share with two
   versions, one of them online-only, and one version is cheaper. And **any
   claim about *when* the day was solved**: `onTime` is parsed and discarded
   client-side, so *hoje* would be a claim the client cannot support. The date
   is in; the word is out.

   **The streak exclusion's realistic regression is an ARGUMENT, not an
   import** — the call site already holds the server streak in scope, so the
   edit that breaks the rule is `buildShareText(record, { url, streak })`,
   which no module-graph scan can see. Its guard is a source assertion on the
   composer's second parameter type, which declares exactly one member.

   **Three of the four games therefore have no shape, and that is the
   product's asymmetry rather than a gap.** Termo's grid exists because
   Termo's *play* is a pattern of per-cell verdicts; a Sudoku's play is a
   number. Manufacturing squares for the other three would encode nothing and
   would be decoration in a channel with no design system — precisely what
   decision 2's own argument does *not* cover. **AC 1's word "shape" is
   therefore met by one game of four, deliberately** (flag F1).

   **No gate on `syncOutcome`.** A player whose sync was `rejected` can still
   share: ADR-0031 decision 6 permits device state to drive an affordance, and
   ADR-0004 `:13` is the standing posture — *"There is nothing to cheat
   for."* Blocking share on `rejected` would punish exactly the offline
   players the in-place conclusion exists for.

4. **One string, two mechanisms, byte-identical.** On **click**, never on
   render, the handler tries `navigator.share({ text })` and falls back to
   `navigator.clipboard.writeText(text)`. `text` only: no `url` field, no
   `title` field, because `navigator.share({ text, url })` behaves differently
   per target and one field is what makes "the clipboard copies the same bytes
   the sheet receives" a testable property rather than a hope. Feature
   detection at click time and not at render time, because
   `typeof navigator.share` during render is a hydration mismatch.

   **The handler is three-armed.** `AbortError` — the user dismissing the
   sheet — renders nothing. **Every other rejection falls through to the
   clipboard** and takes that branch's outcome; `NotAllowedError`, `DataError`
   and `TypeError` are all real, and treating only Abort would make every one
   of them a silent failure. No `navigator.share` at all goes to the clipboard
   directly. A clipboard rejection renders `messages.share.failed`; there is
   no third fallback. Success is announced in a `role="status"
   aria-live="polite"` region, because a clipboard write is invisible.

   **The abort predicate carries no `instanceof`, and that is deliberate.**
   Under jsdom `new DOMException("x", "AbortError") instanceof Object` is
   **false** — `DOMException` is constructed in the window realm and `Object`
   in the test module is Node's, and `instanceof` is realm-scoped. The check
   is `typeof error === "object" && error !== null && "name" in error &&
   error.name === "AbortError"`. The next reader's instinct will be to tidy it
   back; the measurement is in the function's own doc block for that reason.

   **THE CONCLUSION NOW CARRIES TWO `role="status"` REGIONS, and that owes an
   explicit rule** (step-7 finding B2/W1). ADR-0042 decision 10 is the
   precedent and the obligation both: it establishes that a screen with two
   status regions states **disjoint writers** rather than assuming the two
   cannot collide, and it withdrew an earlier draft that asserted disjointness
   loosely. Here the two are `.announcer`, ADR-0043 decision 10's outcome
   region, and `.shareStatus`, this decision's copy confirmation. The rule:
   `.announcer`'s text is `outcome.aria`, **a prop composed by the game before
   the view mounts** — no transition in `ConclusionView` writes it, and it is
   byte-identical for the component's whole lifetime; `.shareStatus`'s text
   derives from `status`, written **only** by the share click handler and by
   its own `[status]` timeout. No transition writes both, and the stronger
   claim is available on this screen and not on the board: **only one of the
   two can mutate at all after mount.** The board's second hazard — a repeated
   identical write being inaudible, which ADR-0042 answered with a zero-width
   nonce — does not transfer, because the click handler moves `status` through
   `idle` before dispatching (K4's fix), so a second copy really does change
   the text. And the consequence for the older record is not cosmetic:
   ADR-0043 decision 10's *"Games that pass no `outcome` render no region and
   are unchanged"* is **false** after this, on three games, which is why
   ADR-0043 takes the fourth `Amends:` bullet above.

5. **The share URL is `absoluteUrl(archiveGameRoute(date, game))`** — the
   per-day permalink, settled by ADR-0053 decision 1 and its flag F2, not by
   this record. `/<jogo>` is stable but serves a different puzzle after the
   rollover, so it cannot be the per-day link AC 4 asks for. The full `https://`
   scheme ships because chat clients autolink a scheme reliably and a bare host
   inconsistently. This makes the share text the **fourth** consumer of
   `site-origin.ts`, whose doc block said *"Three surfaces need it"*; that
   sentence is corrected in the same commit. No new environment variable:
   `NEXT_PUBLIC_SITE_URL` is already on `turbo.json`'s `build.env` allowlist,
   and no `/arquivo` literal enters the composer.

6. **The OG surface is two route families, because of Trap A.** Stated in
   Context above rather than repeated here: the redirect lives in the page
   body, `generateMetadata` runs regardless, and the redirect-following
   majority reads `/<jogo>`'s head. Both families get metadata and both get a
   dated card.

7. **Eight image routes and one static asset: a committed site card, and
   eight dynamic per-day-per-game cards. One card kind, one read path.**

   *(Amended at step 7, decision 9: the site card was an
   `app/opengraph-image.tsx` module prerendered at build, and it is now a
   committed PNG. The row below carries the amended shape.)*

   | File | Reads | Card | Generation |
   |---|---|---|---|
   | `app/opengraph-image.png` + `.alt.txt` | nothing | the site card | rendered at COMMIT time from `siteCard()`, pinned by `T-WEB-S212` |
   | `app/<jogo>/opengraph-image.tsx` (×4) | `getTodayDaily(db, game)` | the game card, dated with `daily.date` | `force-dynamic` |
   | `app/arquivo/[data]/<jogo>/opengraph-image.tsx` (×4) | `getPublishedDaily(db, game, date)` | the game card, dated with the URL's date | `force-dynamic` |

   Every route file is a table entry — the segment config, `size`,
   `contentType`, a static `alt`, and one call into a shared handler.

   **All eight are dated because of Trap A** (flag F4). A dateless daily card
   is the card the dominant share path renders, so AC 2's *"per-day"* would be
   unmet exactly where it matters. Dating all eight collapses two card kinds
   into one, brings the daily four under decision 8's structural guarantee
   instead of leaving them outside it, and removes the asymmetry where four of
   the eight routes were the only ones not reading the wall.

   **The staleness objection, answered rather than dropped.** `/<jogo>` is not
   a per-day URL, and a card saying *14 de agosto* while the URL serves the
   15th's puzzle is a real failure — but it needs a **hand-typed** `/termo`
   link to occur. A link this product **emits** is date-stamped: the scraper
   caches `/arquivo/2026-08-14/termo`'s card, and on re-scrape that date is
   past, the 307 is gone, and the archive head with its dated archive card
   serves. The residual is that someone who types `miolos.app/termo` into a
   chat by hand gets a card correct at scrape time that may be a day stale in
   that scraper's cache afterwards. That is strictly better than a card that
   is *never* per-day.

   **Why a root card at all, and exactly which routes inherit it.** Metadata
   images resolve from the nearest ancestor segment that defines one, so the
   single root asset covers **twelve** routes. The list is **re-derived from
   the shipped build at step 7** rather than restated (finding W8: the
   enumeration first written here was short by `/vincular` and `/_not-found`),
   by reading `og:image` out of the prerendered HTML for the static routes and
   off a real `next start` for the dynamic ones:

   ```
   /                     og:image → /opengraph-image.png     (ƒ, read at runtime)
   /vincular             og:image → /opengraph-image.png     (ƒ)
   /arquivo              og:image → /opengraph-image.png     (ƒ)
   /arquivo/mes/<mes>    og:image → /opengraph-image.png     (ƒ)
   /arquivo/<data>       og:image → /opengraph-image.png     (ƒ)
   /estatisticas         og:image → /opengraph-image.png     (○, baked at build)
   /privacidade          og:image → /opengraph-image.png     (○)
   /modo-livre           og:image → /opengraph-image.png     (○)
   /modo-livre/{binairo,nonogram,sudoku}  → /opengraph-image.png  (○ ×3)
   /_not-found           og:image → /opengraph-image.png     (○)
   /<jogo>/concluido     og:image → /<jogo>/opengraph-image  (its GAME's card,
                                                              same nearest-ancestor
                                                              rule — ×4)
   ```

   So twelve routes take the site card and the four `concluido` routes take
   their game's dated card; neither group needs a file of its own. **The words
   "for one file and no runtime cost" stood here and were false** — see
   decision 9: a metadata MODULE on the root segment costs every descendant
   route ~21 MB of traced payload. As a static asset the inheritance is
   unchanged and the claim is finally true. `/vincular` inheriting it is
   harmless and is stated rather than left implicit: the card is a dateless
   nameplate with no user data on it, and `robots.ts` disallows the route
   anyway.

   **Why eight literal files and not a `[jogo]` segment.** The repo already
   accepts literal-per-game duplication for exactly this reason — four literal
   daily pages, four literal archive play pages, four free-play routes, argued
   in ADR-0046 decision 1 and restated in ADR-0053 decision 1. A `[jogo]`
   segment would put untrusted text in front of the wall for a card. **The
   duplication is pinned, not asserted**: the eight game routes delegate to two
   shared handlers, `T-WEB-S203` is an `it.each` over four games × both
   families, and `T-WEB-S204` asserts the four files in each family differ only
   in the game token.

8. **An OG route reads the wall as an existence proof, never as a source of
   pixels. AC 3 falls out structurally.** Each of the eight game image routes
   performs **exactly one** wall read and uses the result only to decide
   *render or 404*, plus to supply the one non-content field the card names —
   the date.

   The archive family parses its segment first (Zod before any read, so a
   hostile `[data]` costs nothing) and then calls
   `getPublishedDaily(db, game, date)`. **One round trip, no classifier, no
   today branch, no midnight race.** Its predicate is
   `game = X AND date = D AND published_at <= now() AND killed_at IS NULL`, and
   the buffer writes `published_at` as the date's own São Paulo midnight into a
   `timestamptz`, so `published_at <= now()` **is** *"date ≤ today (São
   Paulo)"*, exactly: future dates are excluded by the same predicate that
   excludes unpublished ones, and the today case is simply inside it. A
   read-then-classify path would need three round trips, and a rollover falling
   between them renders a card for date D on the strength of a row for D+1 —
   which would make AC 3 procedural rather than structural.

   The daily family calls `getTodayDaily(db, game)`, which is the identical
   call its sibling page already makes. There is no date in the URL to pass,
   and the only server-truthful source of today's São Paulo date is the DB
   clock, which that reader's predicate interpolates. No client clock, no
   `new Date()`, and no new claim about that reader — which is why nothing in
   `packages/db` moves.

   **One field of the response reaches the card, and it is `date`.** It is not
   puzzle content — it is the value the archive URL carries in plain sight and
   the sitemap publishes — and the mechanism keeping it that way is
   `gameCard({ game, longDate })`'s **signature**, which has no parameter a
   daily response can enter through.

   **A bad row 404s. A database outage must not.** `getPublishedDaily` and
   `getTodayDaily` deliberately throw where `getArchivedDaily` catches, on the
   ground that *"on those a bad row is a live incident"* — so an image route
   calling them would 500 where the sibling page 404s, on a surface even more
   crawler-facing than the page. But `getArchivedDaily`'s catch wraps only the
   projection, not the query, and its 404-over-500 argument is about **a bad
   row**, not an outage. For a transient outage that argument *inverts*: a 500
   is retried and pages somebody, while a 404 here is negative-cached by social
   scrapers for days, names no bad row in the log, and leaves the card dead
   long after the database is back. **So the catch is narrowed to the
   projection class and everything else re-throws.** The boundary is a
   name set — `ZodError` and `DailyProjectionUnsupportedError` — because
   neither class can be imported here: one is on the app-wide wall's
   banned-name list and a cross-package `instanceof ZodError` is an identity
   assumption about two `node_modules` trees rather than a fact. The name check
   fails **closed**, to the 500, if a future version skew ever broke it.

   The log line carries the game on both families and the date on the archive
   family only, and that asymmetry is a fact about the readers rather than a
   choice: the archive handler has parsed its date before the read, and the
   daily handler has no date anywhere — the value it would log lives on the row
   `getTodayDaily` threw instead of returning.

   **The `try` wraps the read alone**, so a satori or `ImageResponse` throw
   still surfaces as a 500; `T-WEB-S203` asserts that propagation, because
   nothing else stops a later edit from widening the `try` to the whole handler
   and converting every card-render bug into a silent 404.

   **Refusal is a bare `Response`, not `notFound()`** — there is no page to
   render a not-found boundary into.

   **AC 3 is satisfied structurally, and the governing sentence is ADR-0010
   `:20`.** An unpublished day cannot render because the only path to a render
   is a returned row, and both readers carry the publication conjuncts through
   `packages/db`'s single private `publishedConjuncts()`. **No fallback card,
   ever** — a fallback would be an unpublished day rendering *something*, which
   is the failure the AC names.

   **The residual, stated in its widened form.** AC 3's guarantee covers the
   **image**. It does not cover the `<head>` that advertises it, and the gap is
   not limited to well-formed future dates: because the image comes from the
   **file convention** and not from the metadata object, *every* archive
   `[data]` segment — malformed included, where `generateMetadata` returns no
   `openGraph` at all — still emits an `og:image` that 404s, plus the
   root-filled `og:*` and `twitter:*` set. The daily four have the same shape:
   on a day with nothing published, `/<jogo>` renders its unavailable screen at
   **200** while its `og:image` 404s. No puzzle content leaks either way — the
   archive title is composed from a game name and a date, and the malformed
   case composes nothing at all.

   **And nothing puzzle-derived is drawn** (flag F5). The card carries the
   wordmark, the game's kicker, the game's name, the long date, and the game's
   accent on a tape and a shadow. That is a *nameplate*. Three reasons, and the
   first is the one that must be stated in the right words:

   (a) **For Nonogram it is not impossible — it is refused, and the difference
   is the whole point.** ADR-0033's Context `:26-30` measures it:
   *"`solveNonogram(clues)` recovers the picture from the published clues alone
   — measured over the wire projection only, 280 dailies, 0 mismatches, worst
   0.338 ms. Withholding `reveal.solution` protects nothing about the picture's
   shape."* And its decision 2 `:49-55` rules on it, in the words `:49-50`
   requires be used wherever it is cited: *"**This is a PRODUCT decision, not a
   security one, and it is stated in those words wherever it is cited.** … Any
   future comment, TSDoc or PR that upgrades this to a confidentiality claim is
   wrong."* So: **the Nonogram picture is derivable from the published clues in
   under a millisecond, and #34 refuses to draw it as a product decision.**
   Anything in this repo that upgrades that to *"impossible"* or
   *"unavailable server-side"* is wrong, and decision 15 is the mechanical half
   of the refusal.

   (b) For Sudoku and Binairo the givens are in the published projection and
   drawing them leaks nothing the page does not already show — but at 1200×630
   a 9×9 grid of givens is a thumbnail nobody reads, and a spoiler argument to
   re-litigate for every future game.

   (c) Drawing nothing derived makes AC 3's guarantee a property of the *card*
   as well as of the *route*, and the mechanism is a function signature rather
   than a runtime scan.

9. **`force-dynamic` on all eight game image routes, and no `revalidate`
   anywhere.** The root site card reads nothing, and it is not a route at all:
   it ships as `app/opengraph-image.png` plus `app/opengraph-image.alt.txt`.

   **AMENDED IN THE SAME PULL REQUEST, at step 7, on a measurement (step-6
   blocker B1/F1).** As first shipped the root card was
   `app/opengraph-image.tsx`, a file-convention metadata MODULE on the root
   segment, prerendered at build. That is not a local cost. A metadata module
   is resolved into the metadata graph of **every descendant route**, so
   `next/og` — `@vercel/og`, `resvg.wasm`, `sharp` and libvips — was traced
   into the serverless payload of routes that render no card at all. Measured
   by summing the unique bytes behind each `.nft.json` on a real Turbopack
   production build:

   | | before | after |
   |---|---|---|
   | `/` | 23.1 MB | **2.2 MB** |
   | `/privacidade` | 23.0 MB | **2.2 MB** |
   | `/estatisticas` | 23.0 MB | **2.2 MB** |
   | `/_not-found` | 22.9 MB | **2.0 MB** |
   | `/vincular` | 23.0 MB | **2.2 MB** |
   | `/arquivo`, `/arquivo/[data]`, `/arquivo/mes/[mes]` | 23.5–23.6 MB | **2.7 MB** |
   | `/modo-livre` ×4 | 23.0–23.1 MB | **2.2 MB** |
   | `/sitemap.xml` | 2.2 MB | 2.2 MB (never affected — no metadata resolution) |
   | all 39 traced entries, summed | **779.3 MB** | **508.2 MB** (−271.1) |

   Thirteen routes recover, five of them `ƒ` dynamic functions — `/`,
   `/vincular`, `/arquivo`, `/arquivo/[data]`, `/arquivo/mes/[mes]` — the
   product's front door among them, paying a ~10× cold-start artifact for a
   card that renders **zero times at runtime**. The plan's round-1
   justification for the root card, *"one file and no runtime cost"*, was
   measurably false: the argument above about a build-time prerender was true
   and beside the point, because the cost is in the trace and not in the
   render. **The step-6 finding's own "17 dynamic routes" figure is corrected
   here to five** — the daily, `concluido` and archive-game routes stay
   inflated for the structural reason below, and no fix to the ROOT card was
   ever going to reach them.

   **What the PNG costs, and what remains.** The card is still GENERATED IN
   CODE, which AC 2 requires: `T-WEB-S212` re-renders `siteCard()` through the
   same `ImageResponse` the deleted route used and compares the SHA-256
   against the committed 49,590 bytes, with `WRITE_SITE_CARD=1` as the
   documented regeneration path and a game-card differential as its
   anti-vacuity twin. `opengraph-image.alt.txt` carries `ogCopy.altSite`
   verbatim, asserted equal to the deck. The residual is structural and is
   stated rather than hidden: the eight dated card routes and the twelve pages
   that live in or under a segment owning one — `/<jogo>`, `/<jogo>/concluido`
   and `/arquivo/[data]/<jogo>` — are still ~23 MB, because a per-game card
   must live in the game's own segment for the file convention to attach it.
   Moving the dated cards to non-segment URLs with explicit
   `openGraph.images` would lift that too, at the cost of the convention; it
   is noted for #37 rather than taken here.

   **`sharp` is a devDependency** (`apps/web/package.json:36`) traced into the
   eight production functions that remain. It works today because Vercel's
   build installs dev dependencies; a production-only install would change the
   trace silently. Also noted for #37.

   ADR-0053 decision 2's precondition binds verbatim: *"the `killed_at` write
   must **first** gain a writer that calls `revalidatePath` for the affected
   paths … Cache-then-invalidate is the wrong order. No `revalidate` may be
   added to an archive route before that writer exists."* An image route at a
   date-bearing URL, advertised to every scraper by the page's own head, is
   squarely inside that family: if a killed puzzle's page 404s while its cached
   card still renders, the takedown is incomplete.

   **The export is required on each of the eight, not decorative.** Route
   segment config comes from the layouts on the path plus the leaf, and this
   app has exactly one layout, the root — verified on a real Turbopack
   production build that `force-dynamic` on `page.tsx` leaves the sibling image
   route `○ Static`.

   **The cost, measured on the card this record actually specifies:** ~215 ms
   on the first render in a process (213–228 ms across six fresh processes) and
   a **48–55 ms warm median** (min 42.6, max 73.7 over 40 interleaved
   iterations), plus one Neon round trip — **per scrape**, not per pageview. A
   metadata route is fetched once per shared link by the scraper, and
   `app/sudoku/page.tsx` already does `force-dynamic` plus `getTodayDaily` on
   every real pageview of the same segment. The 215 ms is one-time WASM/engine
   init per lambda.

   **"Per scrape, not per pageview" is right for a pasted link and understates
   the ARCHIVE, which is disclosed here rather than discovered later**
   (step-7 finding F3). `sitemap.ts` publishes every archived day **and every
   archived game route**, and each of those game pages advertises its own
   uncacheable card in its head — so a three-year archive offers a crawler
   that follows `og:image` about **4,388 card URLs** (1,096 days × 4 games,
   plus the four dailies), each costing one Neon read and one render, on top
   of the 4,384 reads the pages themselves already cost. At the warm median
   that is roughly **4–8 minutes of billed function time per full sweep, per
   crawler**. The money is small and is not the point: the effect that matters
   is that a sweep roughly **doubles** the request rate against Neon and keeps
   the compute from scaling to zero for the length of it. Nothing here is
   mitigable inside #34 — the precondition below is what a TTL waits on — and
   it is the same p95 instrumentation #37 inherits, now sized.

10. **The four daily routes gain metadata. This does not make them an SEO
    surface.** `app/<jogo>/page.tsx` gains a **static** `export const metadata`
    carrying **`openGraph` and nothing else** — no page-level `title`, no
    `description`, no `alternates`. Static rather than `generateMetadata`,
    because nothing in it depends on a request and a static export cannot
    accidentally acquire a database read. The four archive `generateMetadata`s
    gain `openGraph` reusing the strings they already compose, canonical
    unchanged. The four `/<jogo>/concluido` pages gain nothing: a conclusion is
    not a share target, the permalink is.

    **`openGraph` only, and that is stronger than carrying a description.**
    `description` is the SERP snippet, not a chat bubble. Verified on a
    Turbopack production build: with `metadata = { openGraph: {...} }` and no
    page title or description, `<title>` and `<meta name="description">` stay
    the root layout's, byte-unchanged, while `og:title`/`og:description` come
    from the leaf and `twitter:title`/`twitter:description` are derived
    automatically. So the daily routes' crawl-facing metadata is **byte-
    unchanged from today**, and the sharing channel gains a per-game title and
    description. That is the entire delta, and it is the smallest one that
    delivers AC 2 and AC 4. The cost, stated: the browser tab on `/sudoku`
    keeps saying *Miolos*. That is today's behaviour, and a page title is not
    what #34 was asked for.

    **No `alternates.canonical`.** Pointing it at itself is the default
    assumption, and adding canonical tags is indexation machinery on a surface
    ADR-0028 `:37-39` states outright is not an indexation surface. Pointing it
    at `/arquivo/<hoje>/<jogo>` would be actively wrong — that URL 307s back
    here today, so the canonical would name a redirect whose meaning changes at
    midnight. `openGraph.url` is likewise unset, and the consequence is that
    **no `og:url` is emitted at all** (verified across five routes). Harmless,
    since every scraper falls back to the URL it fetched, but it is a mechanism
    and would otherwise be re-derived.

    **The not-an-SEO-surface denial holds, and its coverage is narrower than
    it looks — both are true and both are recorded.** What stands unqualified:
    the routes stay out of `sitemap.ts`, which excludes them by name;
    `robots.ts` is untouched and already says absence from a sitemap is not
    `noindex`; no canonical is added; no `generateStaticParams` appears
    anywhere. What is qualified: the `<head>` of `/sudoku` gains ~15
    crawl-facing tags, and **`og:title` is a documented title-link candidate
    when the page's own title is generic** — which `/sudoku`'s is, by the cost
    line above. So #34 plausibly changes the crawl-facing *presentation* of a
    page ADR-0028 says is not a crawl surface, even though no crawl-posture
    file moves. **This changes no design**; it changes the record, and
    ADR-0028 `:35-40` and ADR-0053 `:1030-1034` both take a *"(Qualified at
    #34)"* note saying so. **`og:` tags are a *sharing* affordance — they
    render a chat bubble — and the sitemap plus `robots.txt` are the crawl
    posture. Different mechanisms**, and one clause is added to `sitemap.ts`'s
    exclusion comment so a later ticket does not read the new tags as an
    invitation to finish a job nobody asked for.

11. **Root-layout `openGraph` and `twitter` defaults, spread into every leaf.
    `og:locale` is `pt_BR`, not `pt-BR`.** Next does **not** deep-merge
    `openGraph` across segments — the nearest declaration wins whole. Verified
    on a real build: a leaf declaring `openGraph: { title, description }`
    emits `og:title`, `og:description` and `og:image` and **loses** `og:type`,
    `og:locale` and `og:site_name`. So `OG_DEFAULTS` — `type`, `locale`,
    `siteName` — is one shared constant, spread by the root layout and by all
    eight leaf declarations. Without it, the routes keeping the full card would
    be exactly the ones that get the *generic* card, and the eight routes #34
    exists for would lose it.

    **The `pt_BR` trap, stated because it will otherwise be "fixed" by the
    first reviewer who sees it.** The Open Graph protocol's `og:locale` is
    `language_TERRITORY` with an **underscore**; `<html lang>` is BCP-47 with a
    **hyphen**. `src/i18n/locale.ts` exports `"pt-BR"` and the layout correctly
    uses it for `lang`. **The two must not share a constant**, and
    `T-WEB-S199` asserts the underscore form *and* that it is not the exported
    locale.

    `twitter.card: "summary_large_image"` is declared and **no
    `twitter-image.tsx` will ever be needed**: `twitter:image`, `:image:alt`,
    `:type`, `:width` and `:height` are emitted automatically from the
    `opengraph-image` file convention, verified in the same probe.
    `metadataBase` already resolves every relative metadata URL against
    `siteOrigin()`, so nothing hardcodes the apex and ADR-0013 `:36` holds.

12. **Three static TTF instances are committed, at the app's own weight and at
    the optical size the card is READ at, read once at module scope.** This is
    the ticket's largest technical decision, and it exists because satori
    cannot use what the app already ships.

    **The blocker, verified from the bundled source.** Fonts reach the app as
    woff2 through `next/font/google`. The bundled satori accepts TrueType,
    `OTTO`, `ttcf` and `wOFF` (WOFF **1**) only — `wOF2` throws
    `Unsupported OpenType signature`. And **a variable TTF does not degrade,
    it throws**: `parseFvarAxis` reads `font.names`, which the bundle never
    assigns, so any face with an `fvar` table raises
    `TypeError: Cannot read properties of undefined`. That would be an uncaught
    500 on a crawler-facing route, not a fallback, which is also why *"just use
    the variable font"* is not an option a later ticket can take.

    **Satori synthesises nothing** — not weight, not italic, and **not optical
    size**. A request for an unregistered weight returns a byte-identical
    render of the nearest registered face, silently. So every weight the card
    sets needs its own file.

    **The three faces are `Fraunces-36pt-500.ttf`, `InstrumentSans-400.ttf`
    and `InstrumentSans-600.ttf`**, 168,996 B in total (169.0 KB decimal /
    165.0 KiB), fetched from `css2` with a legacy user-agent, unmodified and
    unsubsetted.

    **The weight is 500 because 550 cannot be served.** `tokens.css` sets both
    display sizes at Fraunces **550**, and `css2` quantises: `wght@550` returns
    two `@font-face` blocks declaring 500 and 600, and `wght@550..550` is
    `400: Invalid selector`. 500 and 600 are equidistant, and **500 is the
    editorial side** — the lighter instance reads as an editorial serif rather
    than as a bold, and `DESIGN.md:26` puts the family's band at 450–600. A
    600-only face would make every card permanently heavier than the product
    it advertises, uncorrectable without a second binary.

    **The optical size is 36 pt, and the criterion that chose it is recorded
    with it**, because a cut recorded without the rule that selected it is a
    number a later ticket will re-derive from whatever rule is convenient:

    > **The committed cut is the one that minimises the deviation of the HERO
    > run — the game name — from the app's own `font-optical-sizing: auto`
    > rendering at the size the recipient reads it, subject to the secondary
    > run — the wordmark — staying inside 2.5 %.**

    The name is the hero (the card's only protagonist), it is set 2.5× larger
    than the wordmark, and an optical-size error is a letterform property whose
    visible cost scales with the size of the text carrying it. Measured in
    headless Chrome against one reference — the browser's `auto` at the
    **display** sizes, 32 px for the name and 13 px for the wordmark — the
    36 pt cut is **−0.23 %** at the name (0.38 px across the whole word) and
    **−2.22 %** at the wordmark (0.92 px), against **−16.5 %** at the wordmark
    for the `opsz96` cut a naive author-pixel reading would pick. Rival
    criteria are reported rather than hidden: a worst-case-percentage criterion
    picks 24 pt (1.05 %) and a worst-case-displayed-pixel criterion picks 28 pt
    by 0.08 px. All three are imperceptible and all three are 71,648 B; the
    hero weighting is what selects 36.

    **The residual, because a static instance is one point on a continuous
    axis:** viewed 1:1 the name is **+16.59 %** wider than the app's `auto` at
    96 px — a size the app does not have, since `--text-screen-title` tops out
    at 54 px. One face and not two: a second Fraunces costs **+71,648 B
    (+42 %)** of font payload to buy back 2.22 % on the secondary run.

    **`css2` quantises `opsz` into eighteen buckets and serves an off-bucket
    request silently.** Enumerated integer by integer over 9…144:
    `9, 10, 11, 12, 13, 16, 17, 18, 20, 24, 28, 36, 48, 60, 72, 96, 120, 144`,
    each serving every value up to the next; out of range returns an HTTP error
    page rather than CSS. So `@27` returns the 24 pt cut with no error, `@30`
    and `@32` return the 28 pt file. **A request by weight alone is not a
    neutral default** — `Fraunces:wght@500` and `Fraunces:opsz,wght@14,500`
    return the same binary: Google's 13–15 pt **text** cut. **And a one-bucket
    miss is invisible to almost every check:** the 24, 28 and 36 pt cuts are
    **71,648 B each**, with the same `fvar` absence, the same family name and
    the same `usWeightClass`. Only `name` ID 16 and `OS/2.xAvgCharWidth`
    (1148 on the committed face) tell them apart, and `T-WEB-S202` asserts
    both. Do not recall the bucket list — re-enumerate it.

    **No italic ships**, and that is a decision rather than an omission:
    `DESIGN.md:26` makes Fraunces italic the app's human *voice*, and a card is
    a nameplate, not a voice. It also means nobody adds an italic line later
    and gets a silently upright render. If a card ever wants italic, it adds
    the face in the same commit.

    **Provenance is recorded and machine-checked.** Committing a binary is
    exactly the path that sidesteps `minimumReleaseAge` and
    `trustPolicy: no-downgrade`; binaries are un-reviewable in a diff; and
    these bytes feed a server-side OpenType parser on an unauthenticated public
    path — the same parser that *crashes* on an unexpected table. So
    `assets/fonts/SHA256SUMS` records, per face, the `css2` request URL
    **including its `opsz` term**, the resolved gstatic URL, the user-agent,
    the fetch date and the digest, and `T-WEB-S202` re-computes the digests
    against the files on disk. The digest assertion is **necessary and not
    sufficient** — it compares a file against a line the same commit could
    rewrite — which is why the cut is also asserted intrinsically.

    **Both families are OFL 1.1 and neither declares a Reserved Font Name**, so
    clause 3 never bites and clause 2 — *"each copy contains the above
    copyright notice and this license"* — is the whole obligation, discharged
    by shipping `OFL.txt` beside the binaries.

    **They live in `apps/web/assets/fonts/`** — outside `app/`, where nothing
    can be mistaken for a route, and outside `public/`, which would publish
    three URLs nobody should fetch. **Loaded at module scope as
    `export const FONTS` with top-level `await`**, one call shape for all eight
    game image routes — the site card is a committed asset and reaches the
    loader only at build time, through `T-WEB-S212` — keeping the module
    synchronously importable so the jsdom card suite
    can import the card without dragging the loader in. **Blast radius,
    stated:** a throw there fails the **whole build**, not one route — the
    correct failure mode for a missing font, and the reason the digests are
    asserted in the suite too.

    **`process.cwd()` and not `import.meta.url`**, and no
    `outputFileTracingIncludes`: that option is read only inside
    `collect-build-traces`, which Next gates on the bundler not being
    Turbopack, so it is a **no-op** on this app's build. Turbopack's own tracer
    does the job — each route's `.nft.json` lists all three TTFs, verified on a
    real production build. `.gitattributes` gains `*.ttf binary`: not strictly
    required today, but self-documenting, and it survives anyone later adding
    `* text=auto`.

13. **The share button's placement and treatment.** A
    `<button type="button">` in the conclusion's `<aside>`, between the CTA and
    the statistics link, full width. **Paper treatment** — `--paper-card`, a
    1px `--line` border, a hard `--shadow-sm` offset with blur 0, `--radius`,
    `--text-button`, `--ink` label, `cursor: pointer` — with `min-height: 52px`
    at mobile, clearing `DESIGN.md:40`'s 44px floor. Pressed, the element
    slides 1px toward its shadow and the shadow shrinks by the same amount; no
    new animation name.

    **Paper and not an ink fill** (flag F3), and the argument is about what
    shipped rather than about the reference frames: the conclusion turned
    *Ver estatísticas* into a centred text link with a rule, so the frames'
    two-button row no longer exists to slot into. What is left is a
    single-column ladder with three legible levels for three levels of intent —
    **close the day** (ink/accent fill) → **share** (paper + hard shadow) →
    **statistics** (text + rule). One label, *"Compartilhar"*, at both
    viewports: two strings for one control is an i18n smell, and the context
    supplies *resultado* for free.

    **This is the conclusion's first native `<button>`**, so it inherits
    neither the UA default every `<a>` there rides nor any sheet-level ring —
    the sheet's own comment said outright that it declared *no focus ring at
    all*, which was true only while every interactive element was an anchor.
    `.share:focus-visible` is a 2px `--ink` outline at 2px offset and
    `.share:disabled` is `opacity: 0.55; cursor: default`, both in the shipped
    `hub-attach` / `privacidade` idiom, because `low-contrast` is globally
    ignored on scanned URLs and nothing mechanical would catch a UA-grey
    disabled label on paper. The `aria-live` status line **reserves its box**
    with a fixed `min-height`, or the column reflows the moment a share
    succeeds.

    **Design compliance here is proved by file-mode checks, not by the URL
    scan.** ADR-0034 decision 4 is exact: `impeccable detect` launches a clean
    browser profile, so the URL scan always reaches the **empty** conclusion
    and can never see this button. What proves it instead — named so it is not
    substituted later — is a file-mode `impeccable detect` over the real
    component with its real stylesheet at both viewports, jsdom render
    assertions, and a stylesheet-text gate (`T-WEB-S205`). The CI URL scan
    still runs and must still be green, because the empty conclusion is in the
    scan list and the stylesheet changed.

**Decision 14 is deliberately absent.** Plan 040's D14 rules that #34 ships as
one pull request; that is a statement about how a ticket is delivered, not
about the product or the code, and it constrains no future deploy the way
ADR-0053 decision 15 does. The plan is its home.

**The gap stands; the reason first given for it did not** (step-7 finding W6).
That reason was that renumbering would break existing citations of *"decision
15"*. It would not have: every such citation in the tree is **authored by this
same pull request** — five in plan 040 (`:49`, `:50`, `:344`, `:1408`,
`:1474`) and two in this file's own prose — so a renumber was free at the time
and is free now. The real reason is cheaper and true: the register in plan 040 runs D1…D15
and this record carries it across **by number**, so keeping D15 ↔ decision 15
means a reader can move between the two documents without a translation table,
and the one number that does not carry across is the one that deliberately did
not come.

15. **Walls, budgets and the lists that grow.**

    **The free-play wall gains `**/play/share-text`, in both halves.** Free
    play must not acquire a share button: it records nothing (ADR-0046), and
    ADR-0011's shareable-seed idea is *"noted, not scheduled"* (ADR-0046
    `:31`). The napkin's one-hop rule binds any module newly reachable from a
    walled value. The button itself needs no entry — it lives inside
    `play/conclusion-view`, which is already banned by name, and that is one
    reason not to give it its own file.

    **The OG wall is new and standing.** `@miolos/games` is banned from
    `apps/web/src/og/**` and from `apps/web/app/**/{opengraph,twitter}-image.*`,
    in both halves — `no-restricted-imports` for the static form and an
    `ImportExpression > Literal` selector for the dynamic one, which
    `no-restricted-imports` never sees. This is the mechanical half of decision
    8(a)'s refusal: `solveNonogram` is exported from `packages/games`,
    `@miolos/games` is in `transpilePackages`, the free-play wall bans only
    `@miolos/games/termo` and only under free play, and an OG route already
    holds `daily.clues` from its wall read. The reachability is real **today,
    with zero lint hits**, and it is the worst spoiler surface in the ticket. A
    standing wall, not an exit grep: an exit grep is not a gate, and a
    one-hop-reachable module needs a wall entry.

    **The wall object REPEATS the app-wide wall's arrays verbatim, and that is
    the half that is easy to get wrong.** Flat config **replaces** a rule's
    whole configuration per matching file — it never merges — so an object
    declaring only its own games ban would be the entire wall for the files it
    matches. Measured on the real config, against a version without the
    spreads: **all eight db-wall probes that red at the root-card path lint
    clean**, and `pnpm lint` stays green. *(That path holds no file since
    decision 9's amendment; the wall's globs still cover it, because a
    rewritten root module must not arrive outside the wall — and the probes
    are `lintText` calls, which need no file on disk.)* Those are the eight files in the app that call `getDb()` on an
    unauthenticated crawler-facing path — the most consequential place in the
    repo to lose the table-name and computed-dynamic-import bans, and the
    obligation ADR-0024 `:111-114` names by hand. A file-diff criterion cannot
    see the loss, which is why `T-LINT-S43` runs the object without its spreads
    and asserts the probes come back clean, then with them and asserts the
    messages are the app-wide wall's own. **Do not "de-duplicate" the spreads
    away.**

    **AND THE SAME FAILURE ONE WALL OVER, missed until step 7 (finding K1).**
    The OG object's globs intersect not only the app-wide wall's but the
    FREE-PLAY object's: a future `app/modo-livre/<x>/opengraph-image.tsx`
    matches `apps/web/app/modo-livre/**` and `apps/web/app/**/opengraph-image.*`
    both, the OG object is later, and free play's bans vanish — including the
    ones **stricter** than the app-wide wall, since object (3) bans
    `@miolos/db`'s root entry outright where `webWallImportPatterns` permits
    it. Measured on the shipped config: five probes clean at the card path and
    red at the `page.tsx` control. `eslint.config.mjs`'s **object (5)** is the
    intersection, repeating both parents; `T-LINT-S46` is its regression
    control; and the constants' header comment is corrected from *"a subset of
    (1)'s or (2)'s"* to **any intersection with any earlier object**, which is
    the rule the narrow phrasing was hiding.

    **The four `/<jogo>/concluido` routes join `BUDGETED`.** #34 is the first
    ticket whose client JS lives primarily on the conclusion, and the script's
    own comment makes the argument for the archive index in the same words:
    *"'ships nothing today' is precisely the route that acquires a library
    silently."* `MAX_DELTA_BYTES` is not raised, and no `PER_ROUTE_BUDGET`
    entry is owed. **The OG routes add exactly zero client bytes** — a metadata
    route ships no client chunk and never appears in `route-bundle-stats.json`
    at all, which is also why ADR-0047's marker scan fails closed in #34's
    favour.

    **`/nonogram` is down to 2.4 KB of slack, and the relief is named here so
    that the next author has somewhere to go that is not the constant**
    (step-7 finding F4). Not raising `MAX_DELTA_BYTES` is right — it is what
    arms the motif tripwire, and a motif leak is ~35 KB, so the instrument is
    still fully able to see what it exists to see. But #34 established a
    coupling that was not visible before: **a conclusion-only feature costs
    the three daily grid routes ~2.0 KB each**, because `/<jogo>` carries the
    conclusion tree in its own first-load set. One more feature of this size
    reds `/nonogram` for a reason unrelated to a motif leak, and the pressure
    at that moment will be to raise the number. The structural relief is
    proved by this very build: the four archive play routes compose the same
    hooks and the same play views but **exclude the conclusion tree**, and
    they land ~17 KB lower (`/arquivo/[data]/nonogram` +20.9 against
    `/nonogram` +37.6). The conclusion only renders after the grid closes,
    which is a natural `next/dynamic` boundary rather than a refactor —
    that is the move, and it belongs to the ticket that first needs it.

    **Nothing else on any list moves.** No new page, so `impeccable.yml`'s URL
    lists, `route-ssr.test.tsx`'s `ROUTES` table, `sitemap.ts`'s path list and
    `robots.ts` are all unchanged. `next.config.ts` is unchanged — the
    cache-control override rides in the `ImageResponse` options, so no header
    rule is added. `turbo.json`'s `build.env` allowlist is unchanged: no new
    build-time variable.

## Rejected

- **A fifth `ConclusionView` prop, or per-game share wrappers.** The prop would
  be shared chrome arriving through the per-game channel, falsifying
  `types.ts`'s declaration and ADR-0043 consequence (a) to buy nothing. The
  wrappers would be two new client files, four mount-site edits and two more
  `useRecordSnapshot` subscribers on the same `(game, date)` key — a key whose
  sharing hazard is documented twice in the tree — to deliver a payload
  identical across all four games but one field of one game's record.
- **Manufacturing a shape for Binairo, Sudoku and Nonogram** — a time bar, a
  difficulty strip, a row of one colour. It would encode nothing, it would be
  the only thing on the share a recipient could not act on, and it is
  decoration in a channel with no design system, which is exactly what
  decision 2's argument does not license.
- **`sem dica`, the streak, a solved total or a medal in the share.** Each is
  either a self-mintable number after #31 or a virtue claim built from a
  user-editable `localStorage` field. The cheapest resolution to a threat model
  is not to build the surface.
- **`navigator.share({ text, url })`, or a `title` field.** Per-target
  behaviour diverges — some append the URL, some replace the text with it, some
  drop one, several prepend the title — and one field is what makes the
  clipboard fallback byte-identical by construction.
- **`document.execCommand("copy")` as a third fallback.** Deprecated, needs a
  hidden textarea and a selection, and would be more code than the case is
  worth.
- **Dateless, static cards on the daily four.** The objection it answered was
  mis-framed: the staleness it names needs a hand-typed link, while the
  redirect-following majority is the population that actually renders the daily
  card. Keeping it would have made AC 2's *"per-day"* deliberately unmet on the
  day people share.
- **Drawing puzzle content on the card** — the Sudoku givens, the clue rails,
  the Nonogram picture. Unreadable at thumbnail size, a spoiler argument to
  re-litigate per game, and for Nonogram the thing decision 8(a) refuses as a
  product decision.
- **A `[jogo]` dynamic image segment instead of eight literal files.** It would
  put untrusted text in front of the wall for a card, against the
  literal-per-game precedent the repo already accepts for three route families.
- **A broad `try`/`catch` around the whole read.** It returns 404 for a Neon
  timeout, a pool error or a missing `DATABASE_URL`, and the doc block usually
  cited for it discusses a bad row, not an outage. On this surface a 404 is
  negative-cached for days.
- **`export const revalidate`, or a CDN TTL, on any of the eight routes.**
  ADR-0053 decision 2's precondition binds and its writer does not exist.
- **A page-level `title` or `description` on the daily routes.** It would move
  the SERP snippet on a surface ADR-0028 says is not an SEO surface, and would
  buy nothing AC 2 or AC 4 needs.
- **`alternates.canonical` on the daily routes.** Self-canonical is the default
  assumption; pointing at the permalink would name a redirect whose meaning
  changes at midnight.
- **A `twitter-image.tsx`.** Verified unnecessary: the five `twitter:image*`
  tags are emitted from the `opengraph-image` convention automatically.
- **The variable fonts, a request-time fetch, subsetting, or `next/og`'s
  bundled Geist.** The variable files *throw*; a request-time fetch adds a
  third-party network dependency and its latency to a crawler-facing route that
  is already doing a database read, and fails closed to a 500 the day
  `fonts.gstatic.com` is slow; subsetting saves ~96 KB read once per cold
  lambda and buys a build step and a second provenance record; Geist is
  off-brand against `DESIGN.md` and `.impeccable/config.json`, and nothing
  mechanical would catch it because `impeccable detect` does not scan a PNG.
- **A repeating radial gradient for the desk texture.** Not because it does not
  work — see the consequence below, it does. It is ~26 ms per card slower on an
  uncacheable route.
- **An `outputFileTracingIncludes` escape hatch for the fonts.** Verified a
  no-op under Turbopack. If the trace ever fails, the fallback is cutting the
  OG half to a follow-up, not a config line.
- **A share button on the archive's late-result panel, and per-day OG cards for
  `/arquivo`, `/arquivo/mes/<mes>` and `/arquivo/<data>`.** Both are good and
  both are out of #34's acceptance criteria — the AC's words are *per-day,
  per-game*, and the day page is per-day and not per-game. Filed as follow-ups
  rather than dropped, and `share-text.ts` is placed in `src/play/` precisely
  so the first is a wiring job.

## Consequences

- **The dead-share-button debt is discharged, not abandoned.** ADR-0045
  `:186-191` rejects *"a dead share button"* — a control that promises an
  action the product does not have. #34 ships the action. The `.placeholder`
  box that entry also rejects stays rejected on its own argument.
- **The `cache-control` override is the standing answer to "why is there no CDN
  TTL on these?"** Next's `ImageResponse` defaults to
  `public, max-age=0, must-revalidate` in production, and `public` is precisely
  the token that lets a shared intermediary hold bytes the kill switch must be
  able to reach. `force-dynamic` governs Next's **route** cache, not the
  emitted header, so each of the eight routes passes
  `headers: { "cache-control": "private, no-cache, no-store, max-age=0,
  must-revalidate" }` in the response options — **on the 404 arms as well as
  on the 200** (step-6 finding K2: a refusal is the response whose truth flips
  at São Paulo midnight, and it shipped with no header at all). Verified on a real
  `opengraph-image.tsx` metadata route in a Turbopack production build: with
  the option, `private, no-cache, no-store, max-age=0, must-revalidate`;
  without it, `public, max-age=0, must-revalidate`. No `next.config.ts` change,
  so the *"`headers()` returns exactly one rule"* tripwire stays intact. *(The
  root site card is a static asset since decision 9's amendment; Next serves it
  with its own immutable-asset headers, and it cannot go stale because it
  reads nothing.)*
- **The 404-vs-500 boundary is a name set, and it is where a future reader will
  look.** `ZodError` and `DailyProjectionUnsupportedError` → log and 404;
  everything else → re-throw and 500. The two shipped readers are unchanged and
  still throw; what #34 narrows is the **caller's** answer, and only for the
  projection class. An outage, a pool error and a missing `DATABASE_URL` still
  reach the 500 that ADR-0053 decision 4 is defending.
- **Denial of wallet, disclosed and not mitigated.** Every valid `(game, date)`
  pair costs one Neon round trip, and every published one adds an
  **unauthenticated** satori+resvg rasterisation on a path that by design must
  never be cached — ~50–70 ms of CPU warm, ~215 ms cold. Malformed dates are
  correctly cheap (Zod before any read). Dating the daily four widens the
  surface from four routes to eight. **Nothing in this ticket's scope can fix
  it**, and pretending otherwise would be worse than saying so. #37 inherits it
  as an explicit **abuse** item, not merely as a p95 side effect, alongside the
  p95 instrumentation for ADR-0053 decision 2's caching trigger — now over a
  doubled uncached surface.
- **The third-party scraper cache is outside the kill switch, and always
  was.** `force-dynamic` bounds *our own* serving. Facebook, X, WhatsApp, Slack
  and Discord scrape once and hold the image on their own infrastructure for
  days, so **a card already scraped survives a `killed_at` takedown regardless
  of what we do** — and so does the link itself, since a message already sent
  was never reachable. This is not an argument for caching ours; it is a fact
  about what the kill switch can and cannot do, recorded here rather than
  discovered at a review.
- **A hand-typed `/<jogo>` link can carry a stale date in a scraper's cache.**
  Correct at scrape time, possibly a day old afterwards. Links this product
  emits are date-stamped and do not have the problem.
- **The Termo grid is NOT spoiler-free by construction, and this record must
  not be read as saying it is.** Measured over the 400-word answer pool against
  the 5,310-word public validation list: one grid leaves a median **329**/400
  candidates under a no-assumption attacker, but a median **77** (min **4**,
  worst observed 18) assuming consistent play; **two** shares median 19
  (min 1); three median 8; five median 3. **This changes no design** —
  ADR-0004 `:11-13` scopes the threat to *spoiler broadcast*, and
  multi-grid intersection is deliberate solving against a product with no
  ranking (ADR-0006 `:51`: *"It is not an anti-cheat system, and no detection
  infrastructure is being built for a rank that v1 does not have"*). **It
  changes the claim**, which is exactly the discipline ADR-0033 decision 2
  imposes for the same reason: the measured bound is on the record, and
  *"spoiler-free by construction"* is not available to a later ticket as a
  premise.
- **The elapsed time in a grid game's share is client-measured and
  self-reportable**, exactly as `hints_used` is. Nothing #34 ships makes that
  worse — the same number is already on the screen, in the statistics and in
  the completion row — and ADR-0004 `:13` is why it does not matter: there is
  no ranking to climb, so a fabricated share cheats only its sender's friends'
  patience.
- **The satori gradient constraint, in the measured words, because this is the
  sentence that becomes permanent.** Satori resolves a **px**-valued
  radial-gradient colour stop as the fraction `value / elementWidth` of the
  gradient's own radius rather than as an absolute length. Inside a
  `background-size: 72px 72px` tile on a 1200-wide element, a `3px` stop
  becomes `3/1200 × 50.9 = 0.13 px` of radius — sub-pixel, at **every** output
  size. **Percentage stops are already fractions and tile correctly
  everywhere.** Verified over an eighteen-size sweep from 400×300 to 2400×1260:
  px stops yield **0** saturated pixels at every size, percentage stops yield
  768 → 18,480, scaling with area; and a px stop *compensated* to `70.71px`
  renders identically to the percentage form at 1200×630 and breaks at
  600×315, which is the width-coupling made visible. The behaviour is
  **stop-unit-coupled, not size-coupled**, and the two earlier accounts — *"it
  cannot do repeating radial gradients"* and *"it renders at some output sizes
  and not others, non-monotonically"* — are both refuted. The desk texture
  therefore ships as **153** explicit lattice elements, derived as
  `ceil(1200/72) × ceil(630/72)` and never as a literal, **for speed** (median
  48.3 / 50.5 ms against the percentage gradient's 74.2 / 80.4 ms over two runs
  of 20 interleaved iterations) — not for availability and not for colour
  fidelity, which is a tie at 1.41/255 from the browser's own render.
  A second trap found in the same probe: the `background` **shorthand** drops
  the gradient entirely as soon as it carries a colour or a `/ <size>`
  component, so the card uses separate `backgroundColor`, `backgroundImage` and
  `backgroundSize`.
- **`apps/web` now commits binaries, which it did not before.** The rule that
  makes that safe is the one decision 12 states: digest, request URL with its
  `opsz` term, resolved URL, user-agent and fetch date in `SHA256SUMS`, the
  licence beside the file, and a test that re-computes the digests. A face
  added later without that record is a review finding.
- **Nine public URLs now end in an English segment**, nested under pt-BR
  product paths and emitted into the `<head>` of every shared page. ADR-0013
  `:23` does not bite: `opengraph-image` is a Next **file-convention** name,
  not a chosen slug — it is not externalizable through `routes.ts`, it is never
  typed, read or searched by a human, and a pt-BR spelling would mean
  abandoning the file convention for a route handler. Same class as
  `/sitemap.xml`.
- **The fifth game's recipe is now three route modules per daily game and two
  per archive play screen**, and the three records that enumerate it say so.
  An undercount there is how a future game ships with no card.
- **A future `killed_at` `revalidatePath` writer must invalidate the four
  `/arquivo/<YYYY-MM-DD>/{binairo,sudoku,nonogram,termo}/opengraph-image`
  paths.** Without them a withdrawn puzzle's card keeps serving after its page
  404s. The daily cards at `/<jogo>/opengraph-image` belong to ADR-0028
  decision 4's family rather than this one, and the index, month and day pages
  inherit the root card, which reads nothing — stated so the list is complete
  rather than merely longer.
- **Two follow-ups are filed as part of this ticket's exit**, and one
  precondition is not: the `revalidatePath`-on-`killed_at` writer stays owned by
  ADR-0053 decision 2, because filing an issue for a precondition an ADR already
  carries is noise.

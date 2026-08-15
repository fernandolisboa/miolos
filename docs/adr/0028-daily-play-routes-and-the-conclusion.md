# ADR-0028 — Daily play lives at `/<jogo>`, the conclusion at `/<jogo>/concluido`

**Status:** Accepted — 2026-08-01
**Depends on:** [ADR-0002](./0002-plain-react-web-ui-not-universal-rn-web.md), [ADR-0004](./0004-no-unpublished-puzzle-reaches-the-client.md), [ADR-0007](./0007-separate-web-and-api-apps.md), [ADR-0013](./0013-canonical-domain-and-pt-br-routes.md), [ADR-0014](./0014-apps-web-reads-the-database-directly-for-public-pages.md), [ADR-0018](./0018-i18n-is-an-in-repo-typed-message-module.md)
**Amended by:** [ADR-0053](./0053-the-archive-is-a-public-past-only-read-and-a-late-write.md) — decision 2's route half is **narrowed to the daily play routes**. Its reason — *"without the route the screen has no URL, and a screen with no URL cannot be scanned by the visual gate"* — is load-bearing for the daily and does not transfer to the archive: an archive play URL is **itself** permanent and re-renders the stored result on reload, so the bookmark and back-button cases are already served, and the visual gate would only ever reach the empty branch, which for the archive is a screen no real user sees. `/arquivo/<data>/<jogo>/concluido` therefore does not exist; the late result renders in place on the same URL (ADR-0053 decision 9). The universality this ADR claims in Context — *"the shape all four dailies — and later the archive — will inherit"* — and in its consequence *"**Every future game screen is a copy of this shape**, not a new decision"* narrows with it: the archive copies the route family and the `force-dynamic` posture, not the conclusion sibling. Decision 5's per-route enumeration of the ADR-0014 direct-read extension **grows** to the seven archive routes plus `sitemap.ts` and `robots.ts`, and decision 6's prohibition on `generateStaticParams` over dates is obeyed, not amended. *(ADR-0053 landed in #31's first pull request, which shipped the write window and no route. Every archive surface named on this line was built by its second pull request and is live.)*
**Amended by:** [ADR-0054](./0054-the-share-is-plain-text-and-the-card-is-a-nameplate.md) — **the per-route enumerations grow again, in three places, and the segment count is NOT one of them.** #34 adds `app/<jogo>/opengraph-image.tsx` beside each daily play route. That is a **metadata route inside the existing `/<jogo>` segment**, so decision 4's *"Both segments"* stays literally true; what grows is the number of `force-dynamic` route **modules** under the slug, two → three, and it is not inherited from the sibling `page.tsx` (verified: `force-dynamic` on a page leaves the sibling image route `○ Static`). Decision 4's closing clause is the one that genuinely diverges — see the annotation there. Decision 5's per-route enumeration of the ADR-0014 direct-read extension grows to the **eight** image routes (four daily, four archive), and the fifth-game consequence's *"two `force-dynamic` server segments"* — with #31's *"one … each"* for the archive — becomes three per daily game and two per archive play screen. Decision 6's prohibition on `generateStaticParams` is obeyed, not amended, and no `revalidate` is added. *(Reciprocal line added at #34, alongside ADR-0053's; multiple `Amended by:` lines stack.)*
**Amends:** the scope edge of [ADR-0014](./0014-apps-web-reads-the-database-directly-for-public-pages.md) — *"Scope: public, unauthenticated, cacheable server-rendered reads"* — by extending it to the public, unauthenticated but `force-dynamic` and interactive daily play route; see Decision 5.

## Context

[ADR-0013](./0013-canonical-domain-and-pt-br-routes.md) settled that public
route segments are pt-BR and that slugs live with the i18n strings, but the
only URL it named was `/arquivo/...`. Issue #18 ships the first play screen
and therefore chooses the shape all four dailies — and later the archive —
will inherit. Three questions came with it, and each is expensive to
revisit once links exist in the wild:

*(Narrowed at #31 —
[ADR-0053](./0053-the-archive-is-a-public-past-only-read-and-a-late-write.md)
decision 9. The archive inherits this shape in part, not whole: the route
family, the `force-dynamic` posture and the server-supplied date carry over;
the conclusion **sibling route** does not. This sentence is where decision 2
below gets its universality, so it is annotated with it rather than left to
imply a rule the archive breaks.)*

- **What the daily play URL is**, and what the post-completion screen is.
- **Whether the conclusion is a navigation or a state.** A completed puzzle
  has to be reachable by bookmark, reload and back button, and it has to be
  scannable by `impeccable detect`, which takes URLs. It also has to appear
  the instant a player finishes **offline** — ADR-0004's one supported
  offline scenario is *mid-puzzle*, and #18 requires that finishing there
  works. A `force-dynamic` route with no service worker is unreachable
  offline, so "navigate on completion" and "works offline" are in direct
  conflict.
- **How the page gets today's puzzle.**
  [ADR-0014](./0014-apps-web-reads-the-database-directly-for-public-pages.md)
  permits `apps/web` to read `packages/db` directly for *public pages*, but
  its scope line says **cacheable**, and this page is neither cacheable nor
  an SEO surface. Reading it as sanctioned without saying so would be
  scope creep by silence.

  *(Qualified at #34 —
  [ADR-0054](./0054-the-share-is-plain-text-and-the-card-is-a-nameplate.md)
  decision 10. The denial's **mechanism** holds and nothing about the crawl
  posture moves: the four daily routes stay out of `sitemap.ts`, `robots.ts`
  is untouched, no canonical is added, no `generateStaticParams` appears, and
  `<title>` and `<meta name="description">` on `/<jogo>` are verified
  **byte-unchanged** — #34 gives those routes `openGraph` and nothing else.
  The denial's **coverage** is narrower than it reads, and that is stated
  rather than left to be discovered: the `<head>` of `/<jogo>` now carries
  ~15 crawl-facing tags, and `og:title` is a documented title-link candidate
  when a page's own title is generic — which `/<jogo>`'s is, since it
  inherits the root's. So #34 plausibly changes the crawl-facing
  *presentation* of a page this sentence says is not a crawl surface, even
  though no crawl-posture file moves. The distinction that keeps the design
  unchanged: an `og:` tag is a **sharing** affordance — it renders a chat
  bubble — while the sitemap and `robots.txt` are the crawl posture.
  Different mechanisms.)*

## Decision

1. **`/<jogo>` is the daily play route; `/<jogo>/concluido` is its
   conclusion.** `/binairo` ships now; `/sudoku`, `/nonogram` and `/termo`
   follow with #23/#25/#27 under the identical shape. Game names are proper
   product nouns and stay untranslated (`CONTEXT.md`); `concluido` is the
   pt-BR segment ADR-0013 requires, unaccented as a URL segment.

2. **The conclusion is both an in-place state and a real route.** The play
   screen swaps its body from the play view to the conclusion view when the
   local state reaches `solved` — **no navigation, no RSC fetch** — which is
   what makes finishing offline work with no service worker.
   `/<jogo>/concluido` renders the *same* conclusion view under its own
   server segment, and is what a bookmark, a reload, the back button and
   `impeccable detect` reach. Neither half is redundant: without the state
   the offline finish is impossible; without the route the screen has no
   URL, and a screen with no URL cannot be scanned by the visual gate.

   **Narrowed at #31 — this holds for the DAILY play routes, and not for the
   archive
   ([ADR-0053](./0053-the-archive-is-a-public-past-only-read-and-a-late-write.md)
   decision 9).** Neither half of the sentence transfers. An archive play URL
   is itself permanent and re-renders the stored result from the local record
   on reload, so the completed archive screen already has a URL — its own —
   and the bookmark, reload and back-button cases are served without a
   sibling route. And the visual gate would only ever reach the *empty*
   branch of such a route, because the scanner launches a clean profile;
   for the archive that is a screen no real user ever sees, so the route
   would buy no coverage. An archived board that closes therefore swaps to a
   late-result panel **in place**, and `/arquivo/<data>/<jogo>/concluido`
   does not exist. The daily's own dual nature is untouched.

   **Qualified at #27 — the MECHANISM holds for Termo, the RATIONALE does
   not.** *"Which is what makes finishing offline work with no service
   worker"* becomes false for one of the four games: Termo's guesses are
   judged on the server, so a Termo board cannot be finished offline at all
   (see [ADR-0039](./0039-termo-cannot-be-played-offline.md)). Nothing in
   this decision is amended, and the in-place swap still ships for Termo and
   still works — the response that closes the board has already arrived by
   the time the board is closed. What no longer generalises is the sentence
   explaining *why* the in-place half exists. (The gate is also
   `status !== "playing"` rather than `solved` alone, because Termo is the
   first game with a second terminal state.)

3. **Route slugs and composed paths live in `apps/web/src/i18n/routes.ts`.**
   `routeSlugs` keeps ADR-0018's English-identifier → pt-BR-slug map, and a
   sibling `routes` object composes the literal path strings so Next's typed
   routes accept them. Both are re-exported from the `src/i18n` barrel —
   ADR-0018's single import surface — so no component ever writes a path.

4. **Both segments are `force-dynamic` async server components, and the
   day always comes from the database clock.** `export const dynamic =
   "force-dynamic"` on each, no `revalidate`, no `generateStaticParams`, no
   `fetch` on the server path. Each page resolves today through the
   published-predicate helper and passes the **server's** date string into
   the client tree; the client clock never selects which record is read
   (`CONTEXT.md` **Rollover**). When the helper returns nothing — no puzzle,
   or a killed one — both routes render the same pt-BR unavailable screen.

   *(Grown at #34 —
   [ADR-0054](./0054-the-share-is-plain-text-and-the-card-is-a-nameplate.md)
   decisions 7, 8 and 9, **and the SEGMENT COUNT is not what changed.** An
   `opengraph-image.tsx` is a metadata route **inside** the existing
   `/<jogo>` segment, so *"both segments"* above stays true. Two things do
   move. First, the number of `force-dynamic` route **modules** under a daily
   slug goes two → three, and the third one declares its own
   `export const dynamic`: segment config comes from the layouts on the path
   plus the leaf, and `force-dynamic` on `page.tsx` leaves the sibling image
   route `○ Static` (verified on a Turbopack production build). Second, and
   this is the clause that genuinely diverges: **the closing sentence's
   *"both routes render the same pt-BR unavailable screen"* now has a sibling
   module under the same slug that answers the identical helper-returned-
   nothing condition with a 404 and an EMPTY BODY.** Deliberately — there is
   no page to render a not-found boundary into, and a card is not a screen.
   The consequence is stated at ADR-0054 decision 8: on a day with nothing
   published, `/<jogo>` renders the unavailable screen at 200 while its
   `og:image` 404s.)*

5. **ADR-0014's scope is extended, explicitly.** `apps/web` reads
   `packages/db` directly for `/<jogo>` and `/<jogo>/concluido`. Those pages
   are public, unauthenticated, non-user-specific and helper-gated —
   ADR-0014's substance — but `force-dynamic` and interactive rather than
   cacheable and SEO-facing, which its scope line did not cover. The
   extension is deliberate: one hop instead of two on the ritual's critical
   path, and ADR-0004's guarantee keeps **one** enforcement point (the
   helper) instead of two. The unchanged half of ADR-0014 stays unchanged:
   anything authenticated or user-specific, and **all writes**, go through
   `apps/api` — which is where the completion POST lives
   ([ADR-0026](./0026-completions-are-write-once-rows-on-time-is-derived.md)).

   *(Grown at #31 —
   [ADR-0053](./0053-the-archive-is-a-public-past-only-read-and-a-late-write.md)
   decision 2. This enumeration is per-route, so it does not cover the
   archive by implication. It grows to the seven `/arquivo/…` pages plus
   `sitemap.ts` and `robots.ts`, on the same terms and for a **different**
   reason: those pages are the SEO surface ADR-0014 was written for, and they
   are `force-dynamic` because of the kill switch rather than the rollover.
   The one-enforcement-point argument is what carries over intact, and #31
   strengthens it — both wall predicates spread a single spelling of the
   publication conjuncts. Those routes and that second
   predicate landed in #31's second pull request, not the first one this
   annotation shipped in.)*

   *(Grown at #34 —
   [ADR-0054](./0054-the-share-is-plain-text-and-the-card-is-a-nameplate.md)
   decisions 7 and 8. The enumeration is per-route, so it does not cover a
   metadata image route by implication either. It grows by **eight** files,
   all of them public, unauthenticated, `force-dynamic` reads through the
   same wall helpers: `app/{binairo,sudoku,nonogram,termo}/opengraph-image.tsx`
   on `getTodayDaily`, and
   `app/arquivo/[data]/{binairo,sudoku,nonogram,termo}/opengraph-image.tsx`
   on `getPublishedDaily`. **Eight is the whole count, and it is eight rather
   than nine because the site card is not a route at all**: it ships as the
   committed asset `app/opengraph-image.png`, which reads nothing and runs
   nothing. *(This sentence named a ninth `app/opengraph-image.tsx` module
   until step 7 of the same pull request, when finding B1 deleted it — a
   metadata module on the root segment was traced into every descendant
   route's serverless payload. ADR-0054 decision 9 carries the measurement.)*
   These eight are one hop further from the scope line than
   anything before them, because their audience is a social scraper rather
   than a browser, which is why ADR-0054 decision 8 makes the read an
   existence proof and gives the response a `private, no-cache` header
   instead of the framework default.)*

6. **`generateStaticParams` over dates is prohibited, standing.** No dynamic
   segment exists in #18, and the future archive route (#31) must never
   enumerate dates into a build-time param list: a future-dated param is a
   future-dated RSC payload, which is precisely what ADR-0004 forbids. The
   archive inherits the published predicate, never a params array.

## Rejected

- **Conclusion as an in-place state only.** Cheapest, offline-correct, and
  it leaves the completed screen with no URL — unbookmarkable, lost on
  reload, and invisible to the `impeccable detect` gate, which takes URLs
  and does not crawl. A screen the visual gate cannot see is a screen whose
  quality is an aspiration.
- **Conclusion as a navigation only** (`router.push` on completion). The
  clean Next idiom, and it breaks the offline acceptance criterion outright:
  a `force-dynamic` segment with no service worker cannot be fetched with
  the network down, so the player who just solved the puzzle offline gets a
  navigation error instead of a stamp.
- **A service worker to make the navigation work offline.** The real fix for
  the previous option, and out of scope by ADR-0001, which pairs the service
  worker with push in M3. Building it here to enable a navigation that the
  in-place state makes unnecessary is a milestone's worth of work for a
  transition.
- **English segments (`/binairo/completed`).** Consistent with the code
  language rule, and ADR-0013 already decided against it for the only
  audience v1 has.
- **A query parameter or hash (`/binairo?concluido`) instead of a segment.**
  Not a route as far as Next's segment config, metadata or the typed-route
  checker is concerned, and a weaker thing to bookmark.
- **Routing the read through `apps/api`** (`GET /daily/binairo` from the
  server component). It keeps ADR-0014 literally intact at the cost of a
  second network hop on the ritual's critical path — and it gives ADR-0004
  two enforcement points to keep honest instead of one. The gateway boundary
  this project needs is *writes and identity in one place*, and that
  survives intact (decision 5).

## Consequences

- **`apps/web` now holds a `DATABASE_URL`.** ADR-0014 already flagged that
  two apps would hold Neon connections; this is the ticket where the second
  one starts. Both use the serverless HTTP driver, so the cost is
  per-request, not pooled sockets. The credential is currently the same
  integration-managed connection string the rest of the project uses; a
  **least-privilege `miolos_web` role** (`usage on schema public` +
  `select on daily_puzzles`, nothing else) is designed and **filed as a
  follow-up issue**, not shipped by #18 — see
  [ADR-0026](./0026-completions-are-write-once-rows-on-time-is-derived.md)'s
  Consequences for why, and for the fact that the module-graph wall is
  currently the single enforcement point.
- **The module graph is what keeps the credential server-side.**
  `apps/web/src/db.ts` carries `import "server-only"` as its first line, so
  a `"use client"` module importing it is a build error rather than a review
  duty; the ESLint bans on the server-internal `@miolos/db` subpaths and on
  table-name literals sit alongside it (ADR-0024's named #18 duty).
- **Every future game screen is a copy of this shape**, not a new decision:
  #23/#25/#27 add a slug, a `routes` entry, two `force-dynamic` server
  segments and a conclusion view. The conclusion's dual nature is the part
  most likely to be "simplified" into one half by a later contributor, so it
  is recorded here rather than only in code.
  *(Narrowed at #31 —
  [ADR-0053](./0053-the-archive-is-a-public-past-only-read-and-a-late-write.md)
  decision 9. "Every future game screen" reads as universal and is not: the
  archive's four play screens add a slug pattern, `routes` builders and one
  `force-dynamic` server segment each, and **no conclusion view and no
  conclusion segment**. The warning this consequence carries still binds
  where it was aimed — the daily's dual nature must not be simplified into
  one half — and #31's departure is a decision with its own argument, not
  the simplification it warns about.)*
  *(Grown at #34 —
  [ADR-0054](./0054-the-share-is-plain-text-and-the-card-is-a-nameplate.md)
  decision 7. **Both inventories on this bullet are one item short.** A
  fifth game now adds a slug, a `routes` entry, **three** `force-dynamic`
  server modules — `page.tsx`, `concluido/page.tsx` and
  `opengraph-image.tsx` — and a conclusion view; and its archive play screen
  adds **two**, `page.tsx` and `opengraph-image.tsx`, still with no
  conclusion view and no conclusion segment. This is the sentence a future
  game's author follows, so an undercount here is precisely how a game ships
  with no card. The same recipe is restated as its own claim at ADR-0039
  decision 2, which is annotated there.)*
- **`impeccable detect` scans `/`, `/<jogo>` and `/<jogo>/concluido`** at
  both viewports in CI. Only the *unfinished* state of the conclusion is
  URL-scannable — the populated card renders from a solved local record, and
  the scanner launches a clean browser profile — so that state carries a
  full visual specification of its own, and the populated composition is
  covered by a file-mode run plus jsdom smoke tests.
- **The preview deployment must be able to render `/<jogo>` before the scan
  runs.** Without a working `DATABASE_URL` on the web project the page
  server-errors and the scanner reports green against an error page. The
  PR's evidence therefore includes an HTTP 200 from `<preview>/binairo`
  pasted **before** the detect output.

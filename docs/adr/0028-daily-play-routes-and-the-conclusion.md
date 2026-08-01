# ADR-0028 — Daily play lives at `/<jogo>`, the conclusion at `/<jogo>/concluido`

**Status:** Accepted — 2026-08-01
**Depends on:** [ADR-0002](./0002-plain-react-web-ui-not-universal-rn-web.md), [ADR-0004](./0004-no-unpublished-puzzle-reaches-the-client.md), [ADR-0007](./0007-separate-web-and-api-apps.md), [ADR-0013](./0013-canonical-domain-and-pt-br-routes.md), [ADR-0014](./0014-apps-web-reads-the-database-directly-for-public-pages.md), [ADR-0018](./0018-i18n-is-an-in-repo-typed-message-module.md)
**Amends:** the scope edge of [ADR-0014](./0014-apps-web-reads-the-database-directly-for-public-pages.md) — *"Scope: public, unauthenticated, cacheable server-rendered reads"* — by extending it to the public, unauthenticated but `force-dynamic` and interactive daily play route; see Decision 5.

## Context

[ADR-0013](./0013-canonical-domain-and-pt-br-routes.md) settled that public
route segments are pt-BR and that slugs live with the i18n strings, but the
only URL it named was `/arquivo/...`. Issue #18 ships the first play screen
and therefore chooses the shape all four dailies — and later the archive —
will inherit. Three questions came with it, and each is expensive to
revisit once links exist in the wild:

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

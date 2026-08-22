# Handoff 070 — #104 shipped: the archive gets its own OG cards

Session of 2026-08-22. The newest handoff; start here.
Supersedes handoff 063, and follows handoff 069 (#64). Nothing pends on Fernando; `docs/pending-fernando.md`
NOW is still empty.

**State at close:** `main` = `4ae6212`. #104 closed via PR #190. No open PRs.
Frontier: **#149 → #155 → #106 → #74**, plus #32's email-hedge slice.

## What shipped

`/arquivo`, `/arquivo/mes/<mês>` and `/arquivo/<data>` stop inheriting the
root site card. **ADR-0071** records the semantics and amends ADR-0054,
ADR-0053 and ADR-0028. Plan: `docs/plans/068-issue-104-plan-archive-og-cards.md`.

The ticket looked like three route files and was not. ADR-0054 decision 9 had
measured that an `opengraph-image` **module** on a segment joins the metadata
graph of every descendant route and drags `next/og` + `sharp` into their
traced payloads — these exact three segments went 23.5 MB → 2.7 MB at #34
when the root card became a committed PNG. So:

- the dateless **index card is a committed PNG** (`app/arquivo/opengraph-image.png`,
  zero read, zero function);
- the two dated cards are **`force-dynamic` route handlers** at
  `/cartao/<YYYY-MM-DD>` and `/cartao/mes/<YYYY-MM>`, referenced by an
  explicit `openGraph.images` composed in `generateMetadata`.

That takes D9's deferred relief for these three routes only; the eight game
cards stay on the file convention and remain #37's, which has been told.
Measured with both sides built from source: the three page routes hold at
2.7 MB (+1.2–4.1 KB, ≤0.15 %), the two handlers carry 22.9 MB each.

## What to read first, in order

1. `docs/adr/0071-…-two-leave-the-file-convention.md` — decisions, the
   accepted residual, the sizing.
2. `apps/web/src/og/card.tsx` and `handlers.ts` — `archiveCard` is a third
   builder beside `gameCard`/`siteCard`.
3. `docs/evidence/104-archive-og-cards/README.md` — the cards at their
   measured worst case, and what they do **not** prove.

## Non-negotiables this surface carries

- **Zod before any read**; refusal is a bare `Response` with `CARD_HEADERS`,
  never `notFound()`; the `ImageResponse` construction stays outside any try.
- **No catch in the two new handlers** — `listArchivedDays` runs no
  projection, so a narrowed catch would be unreachable. Argued in the doc
  block, not omitted.
- **`CARD_HEADERS` on the 404 arm too.** A refusal is the response whose
  truth flips at São Paulo midnight.
- **The OG ESLint wall's repeated arrays must never be de-duplicated**
  (`T-LINT-S43`). Flat config replaces a rule's whole configuration per file.
- **No `revalidate`, no CDN TTL** anywhere on this family until ADR-0053
  decision 2's `revalidatePath` writer exists. It still does not.

## Landmines

- **`archiveCard({display, caption})` takes two arbitrary strings**, so "no
  game reaches the card" is enforced by `T-WEB-S334`, **not** by the
  signature. My first design call on #104 claimed the opposite; a reviewer's
  mutation disproved it and the issue carries a correction. Do not restate
  the structural version.
- **The one accepted residual:** `/arquivo/<hoje>` 307s to `/` with a **full
  12.5 KB HTML body** carrying `og:image`, so a scraper that does not follow
  the redirect reads a `/cartao/<hoje>` URL that 404s. One date, self-healing
  at midnight, on a URL the product never emits, degrading generic-card →
  no-card and never to anything false. Three fixes named and refused in
  ADR-0071 (a fallback card breaks ADR-0054 D8; suppressing `openGraph` needs
  a second clock; a 302 ends the card's life as an existence proof).
- **A metadata file is inherited only from a segment owning a `layout.tsx`**,
  and this app has exactly one, at the root — so `app/arquivo/opengraph-image.png`
  serves `/arquivo` **and nothing under it**. Next also discards a page's
  `generateMetadata` on `notFound()`. Both were measured only after the plan
  asserted their opposite.
- **Denial of wallet is on #37 as an explicit abuse item.** The sizing models
  a *crawler*, not an adversary: with `no-store` and no middleware, one
  attacker on one URL costs N rasterisations for N requests, unbounded.
  Pre-existing on the eight existing card routes; #104 widened it 25.8 %.
- **`conclusion-lazy.test.tsx`'s `T-WEB-S289` flaked again** on a docs-only
  PR, same shape as #163. Napkin § Execution 3 owns it; the fix belongs in
  **#145**, never in the PR whose gate surfaced it.
- `Explore` and `Plan` subagents are **read-only** — they cannot write their
  own report files, whatever the brief says. Persist their output yourself.
- Live test-id maxima: `T-CORE-S114`, `T-DB-S87`, `T-API-S179`,
  **`T-WEB-S336`**, **`T-LINT-S54`**. `T-WEB-S337`/`S338`, `T-LINT-S55`
  burned unspent — both step-7 test changes widened landed ids in place.

## The one lesson worth carrying

**An unmeasured claim about framework behaviour propagates into every record
before anyone measures it.** Four of six step-6 lenses rejected, and every
blocking finding traced to one plan sentence — that a malformed segment would
inherit the new index card. False twice over. By the time it was measured it
sat in **eleven places across four records**, including a shipped ADR's
decision justification and an annotation that turned a *true standing
residual* into a *false repair*. Napkin § Execution 10 carries it, with its
corollary: **run the mutation.** Ten were run, nine guards held, and the one
that slipped was a scan whose comment confidently claimed to stop an access
its regex could not see.

Three smaller ones, all in the napkin: a **`:NNN` written into a file the
same PR edits is stale before merge** (ADR-0054's lines moved three times
inside this PR — cite by quoted text); **widest ≠ longest**, since Fraunces'
figures are not tabular, and yoga's `width` is a border box so the card's
inner width is **890 px**, not 896; and **parallel code + records halves at
step 5 cost a review round**, because the records half wrote three claims the
code half then measured false. Land the measurement first.

---

## Kickoff prompt for the next session

```
Read docs/handoffs/070-issue-104-handoff-archive-og-cards.md, then
docs/pending-fernando.md. Check live state with gh/git and trust
that over anything written here.

Nothing pends on Fernando — do not offer him credential work.
Frontier: #149, #155, #106, #74, plus #32's email-hedge slice.
scripts/gate-lock.sh acquire "<who>" before ANY suite run, git commit
included; release after. Reserve test ids on the ISSUE before step 5.
Cite records by quoted text, never by line number alone.
Measure any claim about framework behaviour before it enters a record.
Update docs/pending-fernando.md in the same PR on any Fernando item.
Close the session with its OWN numbered handoff in docs/handoffs/,
not an addendum to an older one — an addendum is only for correcting
what that handoff already says.
```

# ADR-0033 — The Nonogram reveal ships no name; the picture is its own payoff

**Status:** Accepted — 2026-08-01
**Depends on:** [ADR-0004](./0004-no-unpublished-puzzle-reaches-the-client.md), [ADR-0019](./0019-per-game-subpath-exports-in-packages-games.md), [ADR-0021](./0021-nonogram-pictures-are-a-curated-motif-library.md), [ADR-0024](./0024-buffer-stores-validated-content-reads-strip-inside-the-wall.md), [ADR-0026](./0026-completions-are-write-once-rows-on-time-is-derived.md), [ADR-0027](./0027-the-hint-is-computed-on-the-client.md)

## Context

A stored nonogram daily carries a `reveal` — `{motifId, name, mirrored,
solution}` — and `name` is the one field in the whole payload a human
wrote. [ADR-0021](./0021-nonogram-pictures-are-a-curated-motif-library.md)
makes the motif library curated content with a pt-BR name per motif, so
the obvious product move is to end the game with *"você desenhou: Gato"*.

The question this ADR answers is not whether that would be nice. It is
whether the name may ride any of the three paths that could carry it, and
the argument has to be made in the right register, because the wrong one
is already forbidden.
[ADR-0027](./0027-the-hint-is-computed-on-the-client.md):125-131 is
explicit: *"The published payload's strip is not a confidentiality
boundary for a published puzzle, and must never be argued as one."* And
for this game the point is sharper than for any other:
[ADR-0021](./0021-nonogram-pictures-are-a-curated-motif-library.md)
decision 3 makes line-solvability *to the exact bitmap* a binary
mechanical gate over every motif and every mirrored variant, so
`solveNonogram(clues)` recovers the picture from the published clues alone
— measured over the wire projection only, **280 dailies, 0 mismatches,
worst 0.338 ms**. Withholding `reveal.solution` protects nothing about the
picture's *shape*, and a document claiming otherwise would be building on
a premise ADR-0027 has already refuted.

What is left, once the security framing is off the table, is a real and
much narrower thing. The **name** is not derivable from the clues by any
amount of client compute, and casual inspection of the rest — which
ADR-0027:127 names as a legitimate function of the strip — is worth
keeping. So the question becomes a product one: is a named reveal worth
what it costs to deliver, on each of the three paths available?

## Decision

1. **The daily Nonogram's public projection is `{game, date, size,
   clues}` and nothing else.** `reveal.motifId`, `reveal.name` and
   `reveal.mirrored` never reach the client in v1 — not in the daily
   payload, not in the completion response, and not by shipping the motif
   library into the bundle. `seed` and `weekday` are out for the reasons
   the two shipped games already record: a seed *is* the solution, and the
   weekday is derivable from the date.

2. **This is a PRODUCT decision, not a security one, and it is stated in
   those words wherever it is cited.** The picture's shape is
   client-derivable in under a millisecond by construction; what the strip
   preserves is the curated **name**, which is genuinely not derivable,
   plus casual inspection of the rest. Any future comment, TSDoc or PR
   that upgrades this to a confidentiality claim is wrong under
   ADR-0027:125-131.

3. **`FORBIDDEN_DAILY_KEYS` gains `"motifId"`, `"name"` and
   `"mirrored"`** — the mechanical proof, rather than a rule kept by
   discipline. Adding only `"reveal"` would be vacuous: `reveal` is
   already listed, so a projection that flattened the identity to
   top-level keys would pass every scan, which is exactly the mistake
   `"clueCount"` was added to prevent one ticket ago.

4. **No future daily payload may carry a field named `name` without
   amending that list with a written reason.** `"name"` is a *generic*
   key, so adding it is a standing constraint on every game's projection,
   not a nonogram-local one. A payload that genuinely needs a name renames
   its field or amends the list on the record.

5. **A named reveal, if it is ever wanted, is an authenticated
   post-completion server read** — the same shape ADR-0027 already
   specifies for granted hints. It is owed as its own feature ticket, not
   built here, and it is not blocked by anything in this decision.

## Rejected

- **The name in the daily payload.** ADR-0027's own Rejected list already
  refused shipping a *derivable-anyway* value there; the name is a
  **stronger** case against, because it is not derivable at all, so
  putting it on the wire is the one way to hand it over for free before
  the player has done anything.
- **The name on the completion response.** It widens the object whose
  TSDoc calls it "the last place a solution could leak"; it breaks the
  offline finish, which
  [ADR-0028](./0028-daily-play-routes-and-the-conclusion.md) makes a
  requirement; it does not survive a reload — `acceptResponse` copies only
  `elapsedMs`/`hintsUsed`, and only on the `recorded: false` branch, and
  `settle` writes `{...record, pendingSync, syncOutcome}`, so a name on
  the response is discarded before any reload could show it; and it is
  **structurally broken on the replay path**, which returns before the
  wall read by
  [ADR-0026](./0026-completions-are-write-once-rows-on-time-is-derived.md)'s
  design, so the second visit gets a response with no content to name
  from.
- **Shipping the motif tables to the client so the name can be derived
  locally.** It costs **+5 036 B gzip** (measured), a widened
  `packages/games` barrel exporting the content library against
  [ADR-0019](./0019-per-game-subpath-exports-in-packages-games.md)'s
  one-subpath-per-game surface, a new reverse-lookup engine surface
  (bitmap → motif) that exists for nothing else, and the loss of the only
  bundle tripwire this route has: "no motif name appears in
  `apps/web`'s built chunks" is a one-line grep today and would become
  unassertable.
- **Withholding the reveal on confidentiality grounds and saying so.** The
  outcome is identical and the reasoning is false, which makes it worse
  than useless: the next feature that assumes "the client does not have
  today's picture" would inherit a premise ADR-0027 already refuted.

## Consequences

- **(a) A screen-reader user gets a *described* figure, not a named one,
  and that cost is stated rather than hidden.** The reveal is announced
  through a composed pt-BR label describing what was revealed; it cannot
  say *what* it is. If a step-6 accessibility review rules a `role="img"`
  with a non-naming label a WCAG 1.1.1 failure, the pre-agreed remedy is
  to drop the `role="img"` claim — `aria-hidden` on the figure plus a
  visible pt-BR line stating the picture was revealed — rather than invent
  a name the curated library owns.
- **(b) `"name"` is simultaneously a key ban and a substring ban, and the
  second one will fire for an unrelated reason one day.** Three of the ten
  consumers of `FORBIDDEN_DAILY_KEYS` — `apps/web/test/binairo-page.test.tsx`,
  `sudoku-page.test.tsx` and `nonogram-page.test.tsx` — run
  `expect(markup).not.toContain(forbidden)` over `renderToStaticMarkup`
  output *as well as* scanning payload keys. So a future `<meta name>`,
  `<input name>` or a lowercase `name*` CSS-module local on a scanned play
  page reds those suites for a reason that has nothing to do with a leak.
  The author who meets that failure should find it written down here
  rather than have to deduce it, and the correct response is to rename the
  markup, not to weaken the scan.
- **(c) The strip's argument is recorded in the code it governs.** The
  strip table's nonogram row, the `case "nonogram"` branch that implements
  it and `dailyNonogramResponseSchema`'s own TSDoc all carry
  the product-not-security wording, so a reader of either arrives at
  ADR-0027's rule rather than at a plausible-sounding security story.
- **(d) The bundle tripwire stays meaningful for as long as this holds.**
  Because no motif name may reach `apps/web`, a string grep over the built
  client chunks is a real check on the engine barrel's tree-shaking. It is
  `apps/web/scripts/route-client-js.mjs`, and it exits non-zero rather than
  printing a number for a reviewer to eyeball. **It is run by hand** —
  `pnpm --filter @miolos/web build && pnpm --filter @miolos/web bundle-check`,
  at step 8, pasted in the PR. Nothing in CI invokes it, so a green pipeline
  is not evidence that no motif name shipped; see
  [ADR-0027](./0027-the-hint-is-computed-on-the-client.md) for why it is
  deliberately manual. Its five motif markers are pinned from the other side
  by `packages/games/test/nonogram/bundle-markers.test.ts`, so a grep for a
  renamed motif cannot pass vacuously. That check dies the day a name ships —
  **#64** — which is a cost the named-reveal ticket inherits.
- **(e) Nothing here decides anything for Termo.** Its public projection
  is `game, date` only and its answer is judged server-side; the questions
  this ADR answers do not arise there.

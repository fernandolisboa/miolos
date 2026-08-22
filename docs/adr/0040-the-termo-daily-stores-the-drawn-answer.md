# ADR-0040 — The Termo daily stores the drawn answer, and no answer is ever drawn twice

**Status:** Accepted — 2026-08-02
**Depends on:** [ADR-0004](./0004-no-unpublished-puzzle-reaches-the-client.md), [ADR-0010](./0010-publication-is-time-driven-published-at-plus-buffer.md), [ADR-0015](./0015-termo-word-list-is-ai-curated-under-mechanical-constraints.md), [ADR-0023](./0023-proved-not-sampled-property-testing.md), [ADR-0024](./0024-buffer-stores-validated-content-reads-strip-inside-the-wall.md), [ADR-0025](./0025-remote-config-is-a-database-table.md)

## Context

Three games publish through the same machinery: a fresh `randomUint32()`
seed, an engine call, a validator, a strict content parse, `INSERT … ON
CONFLICT DO NOTHING`. `apps/api/src/publishing/service.ts` says in its own
TSDoc that the fourth will not fit — *"Termo draws from a curated word list
(ADR-0015), which is not a seed → generate → weekday-validate loop"* — and
leaves what replaces it open.

What replaces it is a **draw from a finite curated pool**, and that changes
three things the grid games never had to decide.

**The pool can run out.**
[ADR-0015](./0015-termo-word-list-is-ai-curated-under-mechanical-constraints.md)
sets the target at 400 answers, *"13+ months of dailies"*. A generator is
inexhaustible; a list is not, and the code has to do something defined on
the day it empties.

**A draw repeats where a generator does not.** Under uniform independent
picks over 400 answers, the probability of at least one repeat first
exceeds ½ at **24 days** — `1 − ∏(400−i)/400`, computed rather than
recalled. So "the list lasts 13 months" is a statement about the list's
size, not about what a naive picker does with it. Avoiding repeats requires
knowing which answers are spent, which requires reading stored `content`
back — something no top-up has ever done. `listBufferedDates`
(`packages/db/src/buffer.ts:35-45`) reads dates; `bufferDepth` (`:79-91`)
counts.

**The row is immutable and long-lived.** ADR-0024's operational semantics
make a buffer row permanent once written and the buffer up to 30 days deep
(`remoteConfigSchema`'s clamp,
[ADR-0025](./0025-remote-config-is-a-database-table.md)), so what `content`
holds is a decision that cannot be revised for rows that already exist. The
tempting compact encoding — store the **index** into `TERMO_ANSWERS`, whose
order `packages/games/src/termo/word-list.ts:9-15` calls contractual —
interacts with that badly, and ADR-0015's own remedy for a defective list
is *"tightening a constraint and regenerating"*.

## Decision

1. **`daily_puzzles.content` for termo is `{canonical, normalized}` — the
   drawn `TermoAnswer`, field for field, and nothing else.** `canonical` is
   the accented spelling the conclusion reveals and the only value in the
   runtime from which it can be recovered; `normalized` is the ASCII form
   the no-repeat rule keys on and the form the judge feeds `evaluateGuess`
   ([ADR-0038](./0038-termo-guesses-are-judged-by-a-stateless-server-route.md)
   decision 4). The schema is `termoDailyContentSchema` in
   `packages/core/src/contracts/daily-content.ts`, `z.strictObject`, parsed
   before every insert. `canonical` carries `.length(5)` — the dimension
   check, matching `WORD_LENGTH` (`packages/games/src/termo/evaluate.ts:13`)
   — and `normalized` carries `/^[a-z]{5}$/`, which is exactly what
   `evaluateGuess` demands, so a drifted stored value fails closed at insert
   instead of raising a `RangeError` inside the judge.

2. **The word is stored; its index never is.** The order of `TERMO_ANSWERS`
   is contractual and the harness pins it, but what the harness pins is
   that the array matches today's `answers.csv` — not that `answers.csv`
   never changes, which ADR-0015 explicitly expects it to. With an index in
   an immutable row, one regeneration commit silently rewrites up to 30 days
   of unpublished answers and retroactively changes what every archived row
   meant, with every gate green. With the word stored, a regeneration is a
   no-op for every existing row — which is ADR-0024 decision 1's *"an engine
   redeploy must never change a published puzzle mid-day"*, applied to
   content instead of to code.

3. **No `seed` in `content`, and the `seed` column reproduces nothing.** The
   other three store a seed because their engines emit one and it
   regenerates the puzzle. Termo's pick is a draw over a run-scoped eligible
   pool, so the same uint32 against a different pool yields a different
   word. The `daily_puzzles.seed` column — `notNull` — receives the accepted
   draw as the entropy the row was written from, and its TSDoc says it
   reproduces nothing, so nobody tries.

4. **No answer is ever drawn twice, and "used" means every row that has
   ever existed.** `listUsedTermoAnswers(db)` on `@miolos/db/publishing`
   selects `content ->> 'normalized'` for `game = 'termo'` with **no date
   filter and no `killed_at` filter**. A past date's answer reached players;
   a killed date's may have; a future date's is committed. Spent is spent.
   This is the first top-up read-back of stored content in the repo, and it
   keys on `normalized` rather than `canonical` because `normalized` is
   `^[a-z]{5}$` by the word-list harness, so the comparison is pure ASCII
   and no Unicode round-trip can defeat it.

5. **The eligible pool is built once per run and shrinks on every write.**
   The used-set is read before the first insert, so a per-date recheck would
   not see this run's own writes. Two dates in one run therefore cannot draw
   the same answer. An answer is removed only when `insertDailyPuzzle`
   reports a real insert: a lost `ON CONFLICT` race means another writer
   covered the date with its own answer, and ours was never used.

6. **The draw is uniform by construction: rejection sampling, not modulo.**
   `drawUniformIndex(n)` accepts only draws below `floor(2³²/n) · n`, so
   every residue has exactly `floor(2³²/n)` preimages. The modulo
   alternative's bias is measurably nothing — for n = 400 the worst residue
   is 7.08 × 10⁻⁸ too likely, total variation distance 1.12 × 10⁻⁸ — and
   the reason to reject it anyway is
   [ADR-0023](./0023-proved-not-sampled-property-testing.md)'s register:
   with rejection, uniformity is a construction-backed invariant that needs
   no measurement and no distributional test. Rejection costs 1.0000000224
   expected draws at n = 400.

7. **Exhaustion fails closed. There is no recycling branch.** When the pool
   empties, every remaining uncovered date lands in `failures` with a
   self-explanatory reason, nothing is inserted, `depths.termo` drains one
   per day, `shallow` flips and `buffer-alert.yml` opens the issue. The
   runway that gives is **~3 days** — `effectiveThreshold` is
   `min(4, bufferDepth)` (`effectiveThreshold` in `apps/api/src/publishing/service.ts`) and
   the poller runs daily at 07:30 UTC — which is not enough to regenerate a
   word list, so the top-up additionally logs
   `{"event":"termo-answer-pool-low"}` at 30 remaining, roughly 30 days'
   notice. **That log line is not an alert and is labelled as one nowhere.**
   A real exhaustion alert is filed as a follow-up issue with this ADR's PR.

8. **`topUpTermoBuffer` has no seed-retry budget, and the absence is part of
   the decision.** There is no generator that can fail, no validator that
   can reject and no weekday ramp; the only non-throwing failure is
   deterministic schema drift, which retrying cannot fix. The three existing
   per-date seed-retry constants — `MAX_SEED_RETRIES_PER_DATE`
   (module-private and unprefixed, in `apps/api/src/publishing/service.ts`),
   `MAX_SUDOKU_SEED_RETRIES_PER_DATE` and
   `MAX_NONOGRAM_SEED_RETRIES_PER_DATE` — get no termo analogue, and one
   added later "for symmetry" would guard nothing. `failures[].reason` for
   termo has exactly two values: the exhaustion string and `content schema
   rejected: …`. `drawUniformIndex`'s 64-attempt cap is a draw-termination
   bound, not a retry budget.

## Rejected

- **Storing the index into `TERMO_ANSWERS`.** The compact, apparently safe
  encoding, and the one failure mode in this ticket that no gate catches: a
  list regeneration silently rewrites the answer of every immutable row that
  stores a position, while the harness passes (it pins the new CSV), the
  content schema passes (an integer is an integer) and the strip passes.
  Rejected for the buffer and rejected as redundant provenance too — it is
  the one field that can become a permanent lie.
- **Recycling the oldest answers when the pool empties.** It ships a branch
  that is dead for 13+ months and then runs unattended against production
  for the first time; it puts a duplicate answer into an archive whose
  premise is *"every archive date was genuinely the shared daily"*
  ([ADR-0010](./0010-publication-is-time-driven-published-at-plus-buffer.md));
  and ADR-0015's own remedy for the list is a **content** action —
  regenerate — not a code fallback. If recycling is ever the product answer,
  it is a ticket with its own ADR, not a branch nobody decided to write.
- **A partial unique index on `(content ->> 'normalized') where game =
  'termo'`.**
  [ADR-0026](./0026-completions-are-write-once-rows-on-time-is-derived.md)
  decision 1's principle is right in general — *"the write-once rule
  ADR-0008 states in prose becomes a constraint the database enforces"* —
  and it loses here on cost. It needs a migration applied to Neon by hand
  (nothing in CI or Vercel runs them), it would be `daily_puzzles`' first
  index beyond the primary key and the repo's first expression index, and it
  converts a rare duplicate into a hard failure: `insertDailyPuzzle`'s
  `onConflictDoNothing` targets `(game, date)` only, so a unique violation
  would throw, abort the termo top-up and 500 the cron. The residual it
  would close needs two concurrent writers *and* a colliding draw; the
  realistic instance is a manual seeding run racing the 06:00 UTC cron,
  whose mitigation is not seeding in that window. If it ever bites, this
  index is the sanctioned fix, with its own ticket.
- **A `(game, date)`-derived seed for the pick.** Directly forbidden by
  ADR-0024 decision 1 — *"a derivable seed would make future dailies
  precomputable"* — and worse for Termo than for any grid game, because the
  derivation would be a total function from a date to the one thing
  [ADR-0004](./0004-no-unpublished-puzzle-reaches-the-client.md) calls
  *"fatal"* to leak early.
- **`createSeededRandom(randomUint32()).nextInt(n)`.** It is
  `Math.floor(next() * n)` — the same granularity bias as modulo — wrapped
  in a splitmix32 round that adds nothing to CSPRNG output, and it puts a
  *deterministic* generator in the one place that must not be deterministic.
- **A generic `listBufferedContents(db, game)` instead of the narrow
  reader.** It would widen `@miolos/db/publishing` with a helper that hands
  back solution-bearing jsonb for any game and pulls whole rows across the
  wire, where the narrow one projects a six-byte string server-side.
  ADR-0024 decision 5 makes every name on that entry a pinned surface.
- **A `game: z.literal("termo")` field in `content`.** Nonogram's exists
  only because its engine writes one; binairo's and sudoku's do not, and the
  termo "engine output" is a frozen `TermoAnswer` with no such key. Every
  read is already keyed by `game` in SQL (`wallPredicate`,
  `packages/db/src/published.ts:35-44`).
- **A charset regex on `canonical`.** Today's 400 use
  `abcdefghijlmnopqrstuvxzáãçéêíóú`, but the engine's own test domain
  (`packages/games/test/termo/arbitraries.ts:9`) declares `à`, `ô`, `õ` and
  `â` as legal pt-BR letters. A regeneration introducing one would fail
  every insert and drain the buffer for a benign content change.
  `.length(5)` is the dimension check; membership in `TERMO_ANSWERS` is
  enforced at the single write site and pinned by a test over all 400.
- **A chi-squared or frequency test of the draw.** ADR-0023 reserves
  "prove" for construction-backed invariants and requires sampled claims to
  be labelled. A distribution test would sample what decision 6 proves,
  carry a flake budget, and mostly test the platform's CSPRNG. What ships
  instead is a unit test of the accept-region arithmetic.

## Consequences

- **(a) The public projection is `{game, date}` and the strict schema is
  what enforces it.** `dailyTermoResponseSchema` is a `z.strictObject` with
  exactly two keys, parsed at the wall by `stripDailyContent` and again at
  the HTTP boundary by `GET /daily/termo`
  ([ADR-0038](./0038-termo-guesses-are-judged-by-a-stateless-server-route.md)
  decision 7). The strip table's *"the answer word, in any field"*
  (`packages/core/src/contracts/daily-content.ts:146`) stops being prose.
  **This is not a confidentiality boundary and must never be argued as one**
  — [ADR-0027](./0027-the-hint-is-computed-on-the-client.md):125-131
  forecloses it, and ADR-0004 already states that today's answer
  *"necessarily reaches the client at midnight"*. The answer is absent from
  the projection because a Termo player has no use for it, not because it is
  being defended.
- **(b) The termo arm parses `content` and throws away the result, and that
  is deliberate.** With an empty projection the HTTP 200 is the entire
  message, so it has to mean *playable* rather than *a row exists*. A
  drifted or hand-inserted row 500s at the wall instead of serving a date
  the game cannot be played on — which is also the mechanism that makes a
  post-seeding schema change loud rather than silent.
- **(c) `DailyProjectionUnsupportedError` becomes unreachable.** It stays
  exported: it is in the `apps/web` ESLint ban list and in `T-LINT-S7`'s
  derived name set, both of which would fail on its removal. Its own TSDoc
  is now false and is corrected in the same commit.
- **(d) `FORBIDDEN_DAILY_KEYS` gains `"canonical"` and `"normalized"`, and
  `"canonical"` will fire for an unrelated reason one day.** That list is
  two bans in one array (`packages/core/src/testing.ts:18-42`): a key scan
  in its consumers *and* a rendered-markup **substring** ban in the page
  suites. `alternates: { canonical }` is how Next renders `<link
  rel="canonical">` — which
  [ADR-0013](./0013-canonical-domain-and-pt-br-routes.md)'s canonical domain
  makes a plausible future SEO ticket. Verified clean today:
  `apps/web/app/layout.tsx` sets only `metadataBase`, `title` and
  `description`. The author who meets that failure should find it written
  here rather than deduce it, and the correct response is to rename the
  markup or amend the list with a written reason, never to weaken the scan.
  Extending the list with `"answer"` alone — which has been a member since
  #25 (`testing.ts:33`) and so is not an extension at all — would have been
  the vacuous ban
  [ADR-0033](./0033-the-nonogram-reveal-ships-no-name.md) decision 3
  refused.
- **(e) Termo runs FIRST in the cron, and the measurement backs the rule
  rather than the rule backing itself.** A cold week is **0.019 ms** of CPU
  and the absolute worst run — depth 30 at the clamp ceiling with 370
  answers spent — is **0.057 ms**, against binairo's ~7 ms, nonogram's
  ~34–80 ms and sudoku's ~150 ms. Measured locally on Node v24.18.1, not on
  a Vercel runner; CI runners are 3–4× slower, which still leaves the worst
  run at ~0.23 ms. The honest asymmetry: termo adds one Neon round-trip the
  others do not have, so it is +1 round-trip and −7 ms of CPU.
  Cost-ascending orders by generation cost so a CPU overrun cannot starve a
  cheaper game, and on that rule termo is first.
- **(f) `shallow` now goes true for a content reason.** Every other game's
  drain is an infrastructure fact; termo's canonical drain mode is a list
  running out. The alert issue will read like a cron failure, so
  `failures[].reason` is written for an operator reading a phone at 07:30
  UTC.
- **(g) The no-repeat read is bounded by the word list, forever.** The
  exhaustion rule stops writing at 400 answers, so `listUsedTermoAnswers`
  scans at most ~400 rows of ~50-byte content and returns ~2.4 KB. No index
  is owed on `daily_puzzles`, which has none beyond its primary key
  (`packages/db/src/schema.ts:110`). Revisit only if a second game needs a
  content read-back, or if `daily_puzzles` exceeds ~10⁵ rows.
- **(h) `topUpTermoBuffer` owes no fast-check properties, and adding them
  would breach a decision.** It lives in `apps/api`, where
  [ADR-0017](./0017-vitest-and-fast-check-are-the-test-stack.md) confines
  fast-check out. ADR-0023's three layers translate to: construction-level
  proof for the four invariants above, the existing ADR-0015 word-list
  harness as the independent instrument, and table-driven re-proof over the
  enumerated 400. **Determinism is not among the invariants** — the pick is
  deliberately irreproducible; what replaces it is "the answer stored is the
  answer served, forever", carried by row immutability and by decision 1.

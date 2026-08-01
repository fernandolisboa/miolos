# ADR-0027 — The hint is computed on the client; only the accounting is server-side

**Status:** Accepted — 2026-08-01
**Depends on:** [ADR-0004](./0004-no-unpublished-puzzle-reaches-the-client.md), [ADR-0005](./0005-all-content-is-free.md), [ADR-0006](./0006-monetization-convenience-not-access.md), [ADR-0019](./0019-per-game-subpath-exports-in-packages-games.md), [ADR-0020](./0020-binairo-ruleset.md), [ADR-0024](./0024-buffer-stores-validated-content-reads-strip-inside-the-wall.md)
**Amends:** the medal line of [ADR-0006](./0006-monetization-convenience-not-access.md) — *"Server-side matters if any curated medal ever depends on 'solved without hints'."* — by narrowing what `hints_used` is allowed to back; see Consequences.

## Context

[ADR-0006](./0006-monetization-convenience-not-access.md) fixed the hint
economy: one free hint, extras by rewarded ad, *"batched and day-scoped:
one ad grants three hints, valid for that day, expiring at the
`America/Sao_Paulo` midnight rollover. No wallet, no balance, no ledger."*
It also required grants to be *"recorded **server-side** against user and
day"*. Issue #18 ships the first hint, and had to answer three questions
ADR-0006 left open because they are implementation-shaped:

- **Where the hint is computed.** A hint reveals a cell of the solution.
  [ADR-0024](./0024-buffer-stores-validated-content-reads-strip-inside-the-wall.md)
  strips `solution` from every client-facing projection, so the naive
  reading is that a hint must be a server call.
- **Whether the free hint is a grant.** Modelling "one free hint" as "a
  grant of one" is the tidy-looking option and reintroduces exactly the
  balance ADR-0006 forbids.
- **What the dormant grant schema has to contain** to be activatable by the
  rewarded-ad ticket rather than decorative — v1 ships no ads SDK at all, so
  nothing writes a row.

There is a fourth thread: plan 010 §8 deferred *"engine-level hints (next
forced deduction)"* to this ticket.

## Decision

1. **The free hint is computed on the client.** `apps/web` calls
   `solveBinairo(givens)` from `@miolos/games/binairo` — memoized once per
   page, measured at 0.04–0.16 ms — and reveals one cell: the first player
   entry that contradicts the solution in row-major order (corrected), or
   else the first empty non-given cell. **No hint endpoint exists.**

   The reasoning, recorded so nobody rebuilds it wrong: today's board is
   *published*, its givens are legitimately in the client's hands, and a
   daily is uniquely solvable **by construction**
   ([ADR-0020](./0020-binairo-ruleset.md),
   [ADR-0023](./0023-proved-not-sampled-property-testing.md)). The solution
   is therefore client-recoverable in a fraction of a millisecond no matter
   where the hint runs. A server round-trip would buy **zero**
   confidentiality and would break the hint offline — which ADR-0004's
   *"Offline support covers the scenario that actually exists: mid-puzzle"*
   makes a requirement, not a nicety.

2. **The free hint is not a grant.** It is per-puzzle, capped at one, held
   in the local play record while the puzzle is in progress, and recorded
   server-side as `completions.hints_used` when the completion is written.
   No row, no balance, no expiry — the puzzle is the scope.

3. **`hint_grants` ships dormant, as an append-only record of grant
   events.** Columns are exactly `id`, `user_id`, `date`, `source`, `hints`,
   `granted_at`. Nothing decrements. The reader is
   `grantedHintsToday(db, userId)` =
   `sum(hints) where user_id = ? and date = (now() at time zone 'America/Sao_Paulo')::date`,
   so **the day key *is* the expiry**: a grant stops counting when the date
   falls behind, with no job, no TTL column, no update and no carry-over.
   This is what ADR-0006's "expiring at the rollover" costs when it is not
   modelled as a balance.

4. **v1 deliberately models no *consumption* of granted hints.**
   `completions.hints_used` is written only at completion, so a granted hint
   used mid-puzzle — or in a puzzle never finished — has nowhere to live.
   The reader is therefore named `grantedHintsToday`, for what it actually
   computes, and never `availableHintsToday`.

5. **`nextBinairoDeduction` is deferred.** The reasoning-naming hint the
   design frames describe ("highlights the reasoning") requires the tier-1
   and tier-2 techniques in `packages/games/src/binairo/techniques.ts` to
   report their *witness cells* — a real engine refactor with hand-verified
   fixtures and its own property test, for an acceptance criterion that asks
   only that one free hint works. A follow-up issue carries it.

## Rejected

- **A server-side hint endpoint** (`POST /hint`, returning one revealed
  cell). It reads as the secure option and is not: it protects nothing a
  client-side solver cannot recover from the givens it already holds, it
  costs a round-trip on the ritual's critical path, and it makes the hint
  fail exactly when ADR-0004 promises play keeps working. It is the right
  shape for *granted* hints — see the seam below — and the wrong shape for
  the free one.
- **Shipping `solution` in the daily payload** "since the client can derive
  it anyway". The strip is ADR-0024's mechanism for keeping *unpublished*
  content unreachable and for blocking casual devtools reads; weakening the
  projection for a published board would weaken it for every board.
- **Modelling the free hint as a grant of 1.** One table, one code path,
  and a persisted per-user quantity that decrements — which is a balance
  under a different name, and ADR-0006 vetoes balances by name.
- **A `hints_remaining` / `credits` / `balance` column on `hint_grants`.**
  Same veto. The table's column set is pinned by an `information_schema`
  tripwire test precisely so this is a failing suite rather than a review
  conversation.
- **Shipping a consumption record now**, speculatively, alongside the grant
  table. It would be a second dormant table designed for a ticket that does
  not exist. Naming the gap costs nothing and keeps the reader's name honest.
- **Server-enforcing the one-free-hint cap.** See Consequences: there is
  nothing to cheat for, and the enforcement would cost a write per hint.

## Consequences

- **`completions.hints_used` is self-reported, and therefore can never back
  a "sem dicas" medal.** The cap lives in a user-editable `localStorage`
  record; the completion POST reports what the client says. This narrows
  ADR-0006's *"Server-side matters if any curated medal ever depends on
  'solved without hints'"*: server-side recording exists for *grants*, but
  the **free** hint has no server-side path, so a medal ticket that depends
  on hint-free solving must build the server-computed path **first** rather
  than reading this column. The posture is deliberate and sits inside
  ADR-0004's *"There is nothing to cheat for"*: all content is free
  (ADR-0005), there is no ranking and no currency, so a tampered counter
  buys a worse game and nothing else.
- **The rewarded-ad ticket owes two things, not one.** The grant *table*
  attaches (decision 3), but that ticket must additionally add (a) a
  consumption record, and (b) a **server-computed granted-hint seam** — a
  call that checks `grantedHintsToday` minus consumption and returns the
  revealed cell. The granted path is server-computed even though the free
  path is not, because a granted hint is the thing an ad was watched for and
  its accounting has to be authoritative. The dormant table is
  activatable, not decorative.
- **The published payload's strip is not a confidentiality boundary for a
  published puzzle, and must never be argued as one.** It protects
  unpublished content (ADR-0004's actual scope) and casual inspection. Any
  future feature whose security rests on "the client does not have today's
  solution" is built on a false premise — including any Termo design that
  assumes the same for the answer word, where ADR-0004 already states the
  answer *"necessarily reaches the client at midnight"*.
- **The client bundle ships the solver.** `@miolos/games/binairo` is
  imported by the play screen for `solveBinairo`, `findBinairoViolations`
  and `isValidBinairoSolution`; ADR-0019 fixes one subpath per game, so the
  generator rides the same barrel and must tree-shake. The route's First
  Load JS is measured and recorded in the PR; if generation code lands in
  the bundle, the sanctioned fix is to make the existing barrel
  tree-shakeable, never a new sub-barrel and never a deep import.
- **The hint works offline**, which is what makes issue #18's offline
  acceptance criterion true end to end alongside local validation and the
  in-place conclusion
  ([ADR-0028](./0028-daily-play-routes-and-the-conclusion.md)).
- **Storing the solved grid in the local play record is inside this ADR's
  own argument.** The offline sync queue persists the completed board so a
  flush needs no givens and no mounted play screen; it is a published
  puzzle's solution, which the client could recompute in ~0.1 ms anyway.

# ADR-0052 — Medals are derived facts plus curated grants

**Status:** Proposed — 2026-08-14 (issue #30)
**Depends on:** [ADR-0006](./0006-monetization-convenience-not-access.md), [ADR-0008](./0008-completion-and-streak-semantics-across-play-modes.md), [ADR-0009](./0009-account-merge-recomputes-from-the-union-of-completions.md), [ADR-0015](./0015-termo-word-list-is-ai-curated-under-mechanical-constraints.md), [ADR-0018](./0018-i18n-is-an-in-repo-typed-message-module.md), [ADR-0026](./0026-completions-are-write-once-rows-on-time-is-derived.md), [ADR-0027](./0027-the-hint-is-computed-on-the-client.md), [ADR-0031](./0031-per-device-day-state-is-a-local-monotone-safe-affordance.md), [ADR-0034](./0034-the-completion-celebration-renders-in-the-conclusion.md), [ADR-0041](./0041-accents-colour-shapes-never-words.md), [ADR-0046](./0046-free-play-routes-levels-and-the-ephemeral-session.md), [ADR-0048](./0048-the-streak-is-a-client-fetched-server-computed-value.md), [ADR-0049](./0049-account-merge-one-pure-function-one-idempotent-operation.md), [ADR-0051](./0051-statistics-are-read-time-derivations-on-closed-contracts.md)

## Context

The founding handoff gives medals three sentences; issue #30's body adds the
acceptance criteria (20–30 curated medals from real feats, recompute for
rule-derived medals with union-and-dedupe for curated grants, no
wallet/ledger/XP/ranking table, restrained display); ADR-0006 names exactly
one curated-grant example (the caught cheater) and vetoes every accumulable;
ADR-0008 rule 2 lists what late completions never feed; ADR-0009 promises
"rule-derived medals recomputed, curated grants unioned and deduplicated" for
a merge; ADR-0049 decision 6 reserved the extension point in `mergeAccounts`;
ADR-0051 decision 3 ordered medals onto "their own endpoint and contract".
What no record settles: what a curated grant *is* and how one is written in a
product with no admin surface; which completion facts a rule may consume;
what travels on the wire; how a 20–30-threshold catalog is defended from
being an XP-levels system in disguise; and where the mechanical teeth for
"no wallet table" live.

**Amendment audit — this ADR amends nothing** (audited at write, at commit
and at exit). It *executes* standing records rather than changing them:
ADR-0006's no-wallet consequence gains its tripwires and its cheater medal
stays available exactly as written; ADR-0008's exclusion list is obeyed
sentence by sentence (decision 3 below); ADR-0009's union-and-dedupe sentence
becomes code in the earliest-wins posture its completions rule already set;
ADR-0015's method is reused with the scaling argument recorded (decision 7),
not weakened; ADR-0049 decision 6's reserved extension point is consumed
exactly as reserved; ADR-0051 decision 3's "own endpoint" instruction is
followed and its read-side trigger restated in place, not moved (decision 10);
ADR-0027 and ADR-0031 decision 6 hold (`hintsUsed` and `elapsedMs` back no
medal — handoff 034 §5's binding sentence, made structural); ADR-0048
decision 3 is applied precisely rather than stretched (decision 5 argues the
reading). One reading is recorded rather than left ambiguous: ADR-0008
rule 2's "archive-specific curated medals (e.g. 'solved 100 archive
puzzles')" is read as *rule-derived-over-late-rows* — a definition #31 may
add — not as hand-granted rows; that phrase's "curated" refers to the
catalog's curation (every medal is curated content), not to the grant
mechanism, so no sentence of ADR-0008 is contradicted. No `Amends:` header
exists and no reciprocal `Amended by:` line is owed anywhere.

## Decision

1. **Two medal kinds, one catalog.** A medal is either **rule-derived** —
   earned iff a pure rule over completion rows says so — or **curated** — a
   `rule.kind === "curated"` definition earned only via an explicit
   `medal_grants` row. A curated grant is **a medal whose earning is not
   computable from completion rows**: the ADR-0006 cheater class, plus
   human-judgment classes (launch-window founder, bug reporter). It is *not*
   "a medal a human awards for a computable feat": rule-derived medals are
   never stored, and a `medal_grants` row bearing a rule-derived id is
   **ignored at read time** — storing one could fake an uncomputed feat or
   desync from a recompute. Curated medals count toward the 20–30 (the AC
   counts definitions; v1 ships 23, of which one — `founder` — is curated).

2. **Rule-derived medals recompute on every read; nothing is stored.**
   `earnedMedals` (`packages/core/src/medals/derive.ts`) is pure over the
   same `listCompletionsForStats` projection ADR-0051 decision 1 established,
   plus the grant-id list and the DB clock's SP day (`todaySaoPaulo` — never
   the client clock; rows dated after `today` are excluded before any rule
   runs, mirroring `computeStreak`'s own guard). No `earned_medals` cache, no
   counter, no stored aggregate — so a merge needs zero medal-specific code
   beyond the curated-grants union (decision 4), ADR-0009 kept true by
   construction. Recompute honesty: a future late row (#31) may **newly earn**
   a medal — history can grow backward — and nothing is ever un-earned by
   adding rows (monotonicity, pinned by T-CORE-S75).

3. **The sanctioned rule inputs are a closed list, and the closure is
   structural.** Rules may consume, exclusively: won totals per-game and
   all-games (**late wins included** — ADR-0008 rule 2 names distributions,
   time stats, streak medals and Dia Perfeito, not totals, and a late solve
   is honestly a solve); streak milestones **via `computeStreak`, reused and
   never re-derived** (monotone "reached N" — a later break never un-earns);
   Dia Perfeito counts via `perfectDays` (**no consecutive-perfect-days
   arithmetic exists or can be expressed** — ADR-0051's rejection stands; the
   streak is the product's one run); Termo guess feats over **on-time won
   rows only** (guess facts are distribution-class, rule 2 bars late rows
   from the distribution), `guesses ∈ {1, 2, 6}` only; and breadth (each
   game won at least once). Forbidden and **inexpressible in the `MedalRule`
   union** — no variant has a field to carry them: `hintsUsed`, `elapsedMs`
   (handoff 034 §5), device/client state (ADR-0031 decision 6), free play
   (records no rows — ADR-0008 rule 5), time-of-day/day-of-week (not in
   `StatsRow`), account age (not a completion fact — hence the founder medal
   is *curated*), lost-row feats (a medal never rewards losing).
   T-CORE-S70 pins the discriminant set, so widening the union is a
   deliberate, ADR-touching act. **No archive-volume medal ships in v1**
   (it would be provably-always-zero until #31 writes late rows — fake UI in
   definition form); #31 may add late-row definitions by **appending to the
   catalog**, which is genuinely additive content under decision 5 — no
   schema, engine or contract change.

4. **`medal_grants`: three columns, composite PK, a shape CHECK, an operator
   write path, and a one-statement earliest-wins merge.** The table is
   `user_id` (uuid, FK users ON DELETE CASCADE), `medal_id` (text),
   `granted_at` (timestamptz, DEFAULT now()); PRIMARY KEY
   `(user_id, medal_id)` — exactly the union-dedupe key. No `id`, no
   `source`, no `reason` column (a reason is operator context that belongs in
   the grant's paper trail, not in a schema column with no reader);
   `granted_at` never crosses the wire — its named readers are the merge's
   `least()` and the operator's audit queries. **No CHECK ties `medal_id` to
   the known id set**: definitions live in code (decision 7), so a membership
   CHECK would need a migration per new curated medal and would turn
   catalog/DB drift into an insert-time production failure instead of a
   read-time no-op — the wrong failure mode for content. A **shape** CHECK
   (lowercase slug, ≤ 64 chars) catches typo'd garbage without coupling to
   the catalog. **The v1 write path is a documented operator ritual, not
   code**: no `grantMedal` export, no POST endpoint, no admin surface — a
   grant is inserted via the serverless-script pattern (`vercel env pull` to
   an absolute path outside the repo; a temp script over
   `@neondatabase/serverless` running
   `insert into medal_grants (user_id, medal_id) values ($1, $2) on conflict (user_id, medal_id) do nothing`;
   verification via the user's own `GET /medals`; script and pulled env
   deleted). On merge, the grants move in **one statement** where completions
   needed two: `insert … select` from the loser with
   `on conflict (user_id, medal_id) do update set granted_at =
   least(medal_grants.granted_at, excluded.granted_at)` — `granted_at`
   **copied, never re-stamped**, the earliest grant date winning whichever
   side carried it (ADR-0009's earliest-wins posture; a grant has exactly one
   merge-relevant column, so the conflict arm can compute the union's
   earliest directly) — then the loser's rows are deleted. Both statements
   are individually idempotent (`least` is stable under reapplication), the
   `mergeAccounts` law.

5. **`GET /medals` carries the earned id set only, strict on shape, additive
   on content.** The contract (`packages/core/src/contracts/medals.ts`) is
   `{ medals: [id, …] }` — `z.strictObject`, no request parameters,
   `Cache-Control: no-store`, the ADR-0048 authenticated-read template.
   Three deliberate choices:
   - **No names or descriptions on the wire.** The client owns them:
     `medalCopy` lives in its own module, `apps/web/src/medals/copy.ts`,
     imported only by the medal section — deliberately **not** a
     `messages.ts` export and **never re-exported by the i18n barrel**,
     because measurement showed the barrel/messages home carried the ~2 KB of
     medal prose into every route's first-load chunk (plan 035 §14
     deviation 3; the module is still the ADR-0018 contract — typed, in-repo,
     composed — and `satisfies Record<MedalId, …>` makes exhaustiveness a
     two-directional typecheck). Copy fixes are a client deploy; the payload
     is bounded.
   - **No `earnedDate`.** For a late-counted feat the honest earning day is
     structurally unavailable (`StatsRow` carries no `completedAt` — the
     qualifying row's `date` is the *puzzle's* day), so a date field could
     only lie ("conquistada em 2024" on an account born in 2026 — the exact
     failure class ADR-0051's Rejected list names). No date ships, no date
     renders, no chronology exists to sort by — output is catalog order.
     **The handover, in writing:** an earned-date display, if ever wanted,
     requires projecting the completion instant into the reader — a decision
     deliberately not taken now.
   - **Ids are validated by shape, never by enum.** The wire schema is the
     slug grammar (the DB CHECK's), not `z.enum(MEDAL_IDS)`. Unknown *keys*
     are strictly rejected; unknown id *values* parse, and the client renders
     only ids in its bundled catalog, **silently dropping unknowns** — the
     honesty mechanism: during deploy skew a user's medal history never
     disappears into a failed parse. ADR-0048 decision 3 protects the
     **shape** — growth of keys/fields is a new contract, and the object
     stays strict — but it does not license closing a **value set**: id-set
     growth is content, and content growth must be additive. A grant row
     whose id is unknown to the catalog or names a rule-derived definition is
     ignored by the derivation — never an error, never surfaced.

6. **AC 3's mechanical teeth are three assertions, with the residual
   named.** T-DB-S39 pins the public base-table set to the exact 8-name
   list (a future wallet/ledger/XP/ranking *table* fails the suite);
   T-DB-S38 pins `medal_grants`' columns to `[granted_at, medal_id, user_id]`
   (a `points`/`tier`/`progress`/`revoked_at` column is the accumulable
   state ADR-0006 forbids — revocation, if ever needed, is a DELETE);
   T-DB-S43 scans every public column name for
   `balance|wallet|coin|point|credit|score|level|rank|xp` and requires zero
   rows (the table-set pin alone would miss a `balance` column on `users`).
   **The recorded residual, accepted rather than pretended away:** a
   wallet-as-*view*, or accumulable state hidden inside jsonb
   (`users.entitlements`, `remote_config.value`), passes all three; the AC's
   own words cover tables, and the residual is stated in the test-file
   comment and here.

7. **Definitions are hand-authored TypeScript under written constraints —
   ADR-0015's method, scaled to fit.** The catalog is `MEDAL_DEFINITIONS`
   (`packages/core/src/medals/definitions.ts`), authored against
   `content/medals/README.md` — the constraints document: category quotas
   whose minima/maxima sum inside [20, 30], the ≥ 2× anti-ladder threshold
   spacing, the pt-BR naming and tone rules (past-tense statements of the
   achieved fact, first word from a recorded allowlist, thresholds as digits,
   the forbidden-vocabulary regex), and the ≥ 10-row rejected-candidates
   sample recording the judgment calls. Mechanical validation is T-CORE-S70
   (structure) and T-WEB-S163 (README parity and copy rules). What ADR-0015
   actually requires — explicit constraints, mechanical invariants, a
   rejected sample — ships in full; what it does not require — a
   deterministic producer pipeline — is honestly omitted, because ~23
   hand-sized records whose single source of truth is the TS module have no
   upstream source to pipeline (Termo's 5,310 words did). Ids are wire
   values and grant keys: stable forever once shipped.

8. **Display: rows inside `/estatisticas`, nothing at zero, and the ladder
   defence.** The section renders at the slot `stats-view.tsx` reserved,
   between the Dia Perfeito card and the per-game blocks — no new route. The
   idiom is **rows in a list, never a tile grid** (the anti-references ban
   both default medal idioms); a uniform `--accent-app` stamp-ring mark
   (accents colour shapes, never words — ADR-0041), name in `--ink`,
   description in `--ink-2`, catalog order, single column at every width.
   At unsettled, settled-null and **zero earned medals the section renders
   nothing** — no heading, no locked grid, no count, no DOM; it appears with
   the first earned medal. **The ladder defence:** what separates 20–30
   milestone medals from an XP-levels system is **invisibility of the
   unearned** — no locked medals, no greyed placeholders, no progress
   meters, no "next tier" affordance, no remaining-count; the player only
   ever sees earned facts, never a position on a scale. The ≥ 2× threshold
   spacing (decision 7) is the same defence applied to the catalog itself. A
   threshold catalog becomes levels only when the interface shows the
   ladder, and this interface never does.

9. **The founder medal ships as a definition now; #37's launch checklist
   owes the grant.** `founder` is in the v1 catalog because the drop-unknown
   rule (decision 5) makes the bundled definition load-bearing — a grant
   whose id is missing from the catalog renders nothing, so the definition
   must precede the first grant. The window is decided at launch by #37
   (accounts with `created_at` before the launch instant); the procedure is
   the documented one-shot bulk insert via the decision-4 operator pattern —
   `INSERT INTO medal_grants (user_id, medal_id) SELECT id, 'founder' FROM
   users WHERE created_at < $launch ON CONFLICT DO NOTHING` — and the
   **owner is #37's launch checklist**: this sentence is the written
   obligation. The cheater medal stays unshipped (no cheat detection exists
   to trigger the judgment); when it ships, its definition must precede its
   first grant for the same reason.

10. **Read amplification, restated with the third reader in it.** A
    signed-in `/estatisticas` visit now issues **three full-history reads**
    — `GET /stats`, `GET /stats/calendar`, `GET /medals` — each running
    `listCompletionsForStats` over every completion row. ADR-0051
    decision 3's read-side trigger stands where it is, with the multiplier
    made explicit: the per-user trigger stays **~4,000 rows**, now carrying
    a **×3 per-screen multiplier** (≈ 12,000 row-reads per stats-screen
    visit at the trigger point). The streak-sweep cost inside `earnedMedals`
    is one shared `computeStreak` walk over the distinct counted dates —
    O(D·R) once per request for all streak medals together (≈ 5M cheap
    operations at three years of daily play) — with its own revisit trigger:
    if `/medals` p95 exceeds 200 ms server-side or the account passes 1,100
    counted days, replace the sweep with a single-pass run-length scan
    pinned to the computeStreak-per-day oracle T-CORE-S76 already provides.
    Numbers, not shrugs, are what #37 inherits.

## Rejected

- **A production grant writer or admin surface:** no named caller exists —
  the v1 granting act is an operator judgment, not code; a dormant exported
  writer is the unused-surface class this repo treats as a HIGH finding
  (`hint_grants`' dormant writers had a named future ticket; a medal writer
  has none). The seam tests insert rows directly, the manufactured-rows
  precedent.
- **A `reason`/`source` column on `medal_grants`:** a column with one writer
  and no reader; the paper trail lives with the operator's ADR/issue.
- **A membership CHECK tying `medal_id` to the catalog:** a migration per
  new curated medal, and the wrong failure mode (insert-time production
  error for what should be a read-time no-op).
- **`z.enum(MEDAL_IDS)` on the wire:** closes a value set ADR-0048
  decision 3 never closed; during deploy skew every already-loaded client's
  parse fails and the user's entire history disappears — indistinguishable
  from "earned nothing" — until bundle update.
- **`earnedDate` on the wire, or any per-medal date display:** the honest
  date is structurally unavailable for late-counted feats; a field no
  display renders is speculative surface, and a field a display renders
  would lie.
- **A stored `earned_medals` cache:** ADR-0009 makes any stored derived
  value a cache needing merge code and invalidation; recompute needs
  neither.
- **A consecutive-Dias-Perfeitos medal:** ADR-0051's rejection of run-length
  over perfect days, restated — a second streak wearing a ribbon.
- **Archive-volume medals in v1:** provably always zero until #31 writes
  late rows; #31 adds them additively instead.
- **Hint, time, time-of-day and account-age rules:** the forbidden-inputs
  list of decision 3, each named in the constraints file's rejected sample.
- **Locked/greyed/upcoming medals, progress bars, a "ver todas" route:**
  gamification chrome; the ladder defence (decision 8) exists precisely to
  keep the unearned invisible.
- **A codegen/staleness pipeline for the catalog:** ADR-0015's pipeline
  serves content with an upstream source; these records have none
  (decision 7).

## Consequences

- `mergeAccounts` gains exactly two statements (the union-earliest-dedupe
  and the loser's delete) at ADR-0049 decision 6's reserved point;
  rule-derived medals cross a merge with **zero** medal-specific code —
  ADR-0009's promise, discharged.
- Account deletion cascades `medal_grants` (schema-declared FK; T-API-S77a);
  the `/privacidade` inventory names operator-recorded grants, because a
  grant row is data about the user that the rows-only story would otherwise
  omit.
- #31 inherits an open, additive path: new late-row definitions are catalog
  appends — no schema, engine or contract change — and old clients drop the
  unknown id instead of losing history.
- #37 inherits, in writing: the founder-grant one-shot insert on its launch
  checklist (decision 9), the ×3 read-amplification figure and the
  streak-sweep trigger (decision 10), and the CLS/bundle measurements the
  PR body records.
- The free-play wall extends over `src/medals/**` (ADR-0046's consequence,
  kept true by growth); free play can never touch a medal, structurally and
  by lint.
- `impeccable detect`'s anonymous CI scan sees no medal section (nothing at
  zero) and is vacuously green for medals; the substitute evidence is the
  jsdom suites (T-WEB-S161–S163) and the seeded browser pass recorded in
  the PR — stated so the green is never mistaken for coverage.
- "Curated grant" enters CONTEXT.md as a durable term; the Medal row cites
  this ADR.

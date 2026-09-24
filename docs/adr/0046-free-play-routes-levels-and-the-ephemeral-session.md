# ADR-0046 — Free play: three routes, a level picker over the weekday ramps, an ephemeral session

**Status:** Accepted — 2026-08-12 (issue #28, shipped in #81)
**Depends on:** [ADR-0011](./0011-free-play-is-generated-on-the-client.md), [ADR-0008](./0008-completion-and-streak-semantics-across-play-modes.md), [ADR-0005](./0005-all-content-is-free.md), [ADR-0013](./0013-canonical-domain-and-pt-br-routes.md), [ADR-0019](./0019-per-game-subpath-exports-in-packages-games.md)
**Amended by:** [ADR-0070](./0070-the-daily-nonogram-conclusion-names-its-motif.md) (#64) — consequence 1's *"non-user-facing **everywhere**"* narrows to FREE PLAY, which stays unnamed permanently. A narrowing, not a reversal.
**Amended by:** [ADR-0078](./0078-the-free-play-wall-is-proved-on-the-runtime-module-graph.md) (#255) — consequence 2's ESLint wall is no longer the enforcement on its own: the proof is the free-play runtime module graph (`T-WEB-S374`, `T-WEB-S375`); the name list stays as editor feedback.

## Context

ADR-0011 decided free play is generated in the browser from a client-picked
seed, with no endpoint and nothing recorded. It deliberately left open the
product surface: routes, how difficulty is expressed (the engines have no
free-play difficulty concept — their only axis is the ISO weekday ramp,
Monday easiest through Sunday hardest, in all three grid games), whether a
session persists, and what daily furniture (timer, hints, conclusion)
transfers. Termo is excluded by project invariant (ADR-0005/ADR-0015).

## Decision

1. **Routes:** `/modo-livre` (index) plus literal per-game segments
   `/modo-livre/{binairo,sudoku,nonogram}` (pt-BR slug per ADR-0013; game
   names are untranslated proper nouns). Literal, not dynamic: typed routes
   stay literal types, and the route boundary is what carries ADR-0011's
   per-game code-splitting. No `/modo-livre/termo` segment exists; the 404
   is by absence. The pages are static — they fetch nothing.
2. **Difficulty is a three-level picker** — Leve / Médio / Difícil — mapped
   to weekdays **1 / 4 / 7**, the ramp's endpoints and middle. The picker
   lives on each game screen (default Médio), not in the URL, keeping the
   pages static and level switches offline-instant.
3. **The client picks one uint32 seed per puzzle** via
   `crypto.getRandomValues`. "Mais um" draws a fresh seed at the same
   level. No seed is user-visible in v1; the state keeps `{seed, weekday}`
   so ADR-0011's noted-not-scheduled shareable links stay one rendering
   away.
4. **A free-play session is ephemeral.** Nothing is written to
   `localStorage` — no reuse of the daily `miolos:play:*` namespace and no
   new namespace. Reload regenerates. Puzzles are infinite; nothing scarce
   is lost, and zero-writes is the strongest provable form of "records
   nothing" on the client.
5. **One free hint per puzzle, computed client-side** from the generator's
   own solution (ADR-0027's mechanism). No extra-hint affordance: hint
   grants are day-scoped server rows (ADR-0006) and free play never
   touches that system.
6. **No timer.** A clock measures a value free play has nowhere to put.
7. **No conclusion screen and no daily chaining.** Solving swaps, in
   place, to a solved card offering "Mais um".
8. **The root layout's `POST /session` is unchanged** on free-play routes:
   it is route-agnostic identity bootstrap, not a free-play request. The
   "no free-play requests" guarantee is: zero requests originate from any
   free-play module.

## Rejected

- **Seven-weekday difficulty UI:** exposes an internal axis as seven
  labels nobody asked for.
- **Random weekday per puzzle:** difficulty roulette.
- **A persistence namespace:** schema/versioning/pruning machinery for a
  convenience, purchased by weakening the cleanest negative proof.
- **Suppressing the session mint on free-play routes:** layout surgery to
  hide a request every other route makes.

## Consequences

- The Nonogram motif library (curated pt-BR names included) ships in the
  free-play nonogram chunk — generation needs the tables. The names remain
  **non-user-facing everywhere**: the solved card shows the painted
  picture, never `reveal.name`. ADR-0033's payload and response
  guarantees are unaffected; its bundle clause is amended and narrowed to
  daily-route and shared chunks by ADR-0047, whose route-scoped tripwire
  keeps daily chunks as forbidden as ever. CONTEXT.md's Motif row is
  rewritten accordingly.

  > **Narrowed at #64 ([ADR-0070](./0070-the-daily-nonogram-conclusion-names-its-motif.md)) to FREE PLAY, and it is a narrowing rather than a reversal.** *"Non-user-facing everywhere"* is no longer true of the product: the DAILY Nonogram conclusion names its motif. It is still exactly true **here**, and permanently so — free play generates infinitely, motifs recur across generated puzzles, there is no day for a server to judge and no server read to make, so `use-free-nonogram.ts` still drops `reveal` at the parse and the solved card still shows the painted picture and never `reveal.name`. The daily name is WIRE-delivered, from the user's own completed `/day` claim, so this consequence's actual subject — the motif tables in the free-play chunk — is untouched, and the tables are still never bundled for a daily route.
- Free play never touches streak, statistics distributions or medals
  (ADR-0008 rule 5) — enforced by an ESLint wall around the free-play
  directories banning the sync/record/lifecycle/session/db/termo modules,
  with probe tests.
- Sudoku generation runs on the main thread with a generating state and a
  fresh-seed retry ladder on exhaustion; a Web Worker is the named
  escalation, not the default.

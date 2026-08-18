# ADR-0047 — Bundle markers are route-scoped: forbidden-everywhere vs forbidden-in-daily-scope

**Status:** Accepted — 2026-08-12 (issue #28, shipped in #81)
**Depends on:** [ADR-0033](./0033-the-nonogram-reveal-ships-no-name.md), [ADR-0011](./0011-free-play-is-generated-on-the-client.md), [ADR-0046](./0046-free-play-routes-levels-and-the-ephemeral-session.md)
**Amends:** [ADR-0033](./0033-the-nonogram-reveal-ships-no-name.md) — decision 1's *"not by shipping the motif library into the bundle"* clause narrows to daily-route and shared chunks, and consequence (d)'s premise that no motif name may reach `apps/web` narrows likewise; the payload and completion-response guarantees, and `FORBIDDEN_DAILY_KEYS`, are not touched. Its Rejected entry on shipping the motif tables stays rejected for what it argued — naming the daily reveal client-side; free play ships the tables to generate, never to name.

## Context

`apps/web/scripts/route-client-js.mjs` greps every client chunk for one
global forbidden list (motif names, server-only schema keys, Termo answer
words), with expected markers proving the scan looks at the right files.
ADR-0011/ADR-0046 put the generators in the browser for free play, so
free-play chunks now legitimately contain motif names and generator output
keys (`givensCount`, `clueCount`, `motifId`). A global
scan therefore fails by design — while the guarantee it protects (no
withheld daily content in daily-route or shared chunks; ADR-0033) must
not weaken by a byte.

## Decision

Chunks are attributed from Next's own `route-bundle-stats.json`:
**daily-scope** (first-load chunks of every non-`/modo-livre` route),
**free-play-only** (free-play first-load chunks minus daily-scope), and
**unattributed** (on disk, in neither — scanned as daily scope, fail
closed). Markers carry a scope:

- **Forbidden everywhere:** Termo answer canonicals (`então`, `mamãe`,
  `época`).
- **Forbidden in daily scope** (daily + unattributed): motif names,
  `sitting-cat`, `motifId`, `givensCount`, `clueCount`, the reveal refine
  message. **`requiredTier` is deliberately not among them,** a deviation
  from the plan that reserved it (plan 025 §10.2), measured at
  implementation time: the string also lives in
  `packages/games/src/binairo/solve.ts` — `gradeBinairo` returns
  `{requiredTier}` — and solve.ts is a module the daily legitimately
  ships (`solveBinairo` is the hint's solution memo). While nothing used
  `gradeBinairo` the minifier dropped it; free play made it a live export
  (`generateBinairo` → `validateBinairo` → `gradeBinairo`), and webpack's
  used-exports analysis is global, so every copy of solve.ts — the daily
  `/binairo` first-load included — retains the property key with zero
  daily generator imports. A marker that fires on a legitimate daily
  module cannot detect a leak; its duty transfers whole to `givensCount`
  and `clueCount` (binairo validate/generate and sudoku generate —
  modules no daily route imports) and the motif names.
- **Forbidden in any free-play route's first-load set:** `zurro` —
  scanned over each `/modo-livre*` route's `firstLoadChunkPaths`
  directly, shared chunks included, never over the derived free-play-only
  set: a Termo import from free play could be hoisted into a chunk shared
  with `/termo`, which the derived set excludes by construction, and the
  scan would pass vacuously. The dictionary in any free-play first-load
  set means `@miolos/games/termo` leaked there; in `/termo`'s own chunks
  it remains expected.
- **Expected in daily scope:** the five existing controls, unchanged.
- **Expected in free-play scope:** at least one motif name and one
  generator key — the SAME strings the daily scope forbids, so a broken
  motif attribution reds one side or the other. The `zurro` check earns
  the same non-vacuousness differently — by scanning per-route first-load
  sets rather than a derived set that hoisting could empty.

The script exits non-zero if the free-play chunk set is empty or a
free-play route is missing from the stats: a vacuous scope is a failure,
never a pass. A chunk shared between a daily route and a free-play route
is daily-scope, period — sharing withheld-content code with a daily route
is the defect, not an attribution nuance.

## Rejected

- **Raising the shared budget / trimming the forbidden list:** un-arms the
  motif tripwire for the three daily grid routes — the only thing it
  exists for.
- **Per-chunk allowlists by filename:** chunk names are build artifacts;
  route attribution is the stable identity.
- **Keeping `requiredTier` in the daily-scope set by splitting
  `gradeBinairo` out of solve.ts:** a `packages/games` source change
  bought purely to preserve a marker two other markers already cover —
  the engine's public API is not reshaped to serve a grep (ADR-0019).

## Consequences

- ADR-0033 is amended as headed above and continues to bind everywhere
  else, enforcement now scoped: daily chunks are exactly as forbidden as
  before, and free play's legitimate content cannot mask a daily leak.
  ADR-0033's own file gains the reciprocal amendment pointer.
- New routes are daily-strict by default (attribution is "everything not
  under /modo-livre"), so forgetting to classify a future route fails
  closed.
- The library-side marker pins (`packages/games/test/*/bundle-markers.test.ts`)
  are unchanged in their assertions: markers must keep existing on both
  sides of every grep.

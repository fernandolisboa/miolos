# ADR-0078 — The free-play wall is proved on the runtime module graph

**Status:** Accepted — 2026-09-24
**Depends on:** [ADR-0005](./0005-all-content-is-free.md), [ADR-0011](./0011-free-play-is-generated-on-the-client.md), [ADR-0015](./0015-termo-word-list-is-ai-curated-under-mechanical-constraints.md), [ADR-0024](./0024-buffer-stores-validated-content-reads-strip-inside-the-wall.md)
**Amends:** [ADR-0046](./0046-free-play-routes-levels-and-the-ephemeral-session.md) consequence 2; [ADR-0077](./0077-the-play-screen-chrome-is-one-component.md) — its Rejected entry on banning all of `packages/games/src`, and its consequences on the 27 unguarded modules and on `T-WEB-S368` measuring specifiers rather than erasure

## Context

The free-play wall was a list of module names under `no-restricted-imports`, attached to `src/free-play/**` and `app/modo-livre/**` only. A module outside those directories that sits on both graphs is a one-hop door the list cannot see: `termo/termo-screen` reaches `api/client` and `session/bootstrap` and was not on the list, nor were the daily route pages (#255). The list also matched strings, so `../play/sync.ts`, `../x/../play/sync` and `../play//sync` walked past a ban written as `**/play/sync` (#201). And the games deep-path ban covered only `packages/games/src/termo` (#257).

## Decision

1. **The proof is the runtime graph.** `T-WEB-S369` walks the value edges of every free-play file (`valueClosureOf` in `apps/web/test/module-graph.ts`) and asserts no module on it does network or storage I/O, and none lives in `packages/db/src` or `packages/games/src/termo`. `T-WEB-S370` puts every specifier those `apps/web` modules write through the real `eslint.config.mjs` at a free-play path. T-WEB-S368 is retired; S370 covers it on runtime edges and deliberately no longer checks the chrome's type-only edges.
2. **The name list stays, as editor feedback.** Termo is banned from free play as a directory (`**/termo`, `**/termo/**`), not by name.
3. **Relative specifiers are in normal form.** Two structural selectors: `webDotSegment` (no `.` or empty segment, `..` only as a leading run) in every `apps/web` block, and `webCodeExtension` in `app/` and `src/`.
4. **`packages/games/src` is unreachable by relative path from all of `apps/web`**, static and dynamic. Games are reached through `@miolos/games[/<game>]`.
5. The module resolver throws on a relative or `@miolos/*` specifier that resolves to nothing, CSS aside, so the graph cannot silently lose an edge.

## Rejected

- **Appending each new door's name.** It drifts: the next screen root is a door again the day it lands.
- **Following type edges.** `import type` is erased at build. Following it fails today on `../play/play-record`, which no browser ever loads.
- **Deriving the lint probe from closure members.** ADR-0077's reason stands: 46 false positives from `@miolos/core` re-spelled as banned deep paths.

## Consequences

- ADR-0077 deferred the games-wide ban as out of scope; this ADR does it, and re-founds `T-LINT-S41`, `S42`, `S57` and `S58` in place — their clean controls move to package specifiers.
- ADR-0077 said S368 "measures the specifiers, not the erasure". That is reversed: the check now measures runtime edges.
- The type-edge regex must keep `import { type X }` as a value edge — it is one under `verbatimModuleSyntax`. `T-WEB-S369` reds if it drops a real value edge.
- The walker cannot see `new Worker(new URL(…))` edges. None exist in `apps/web` today.
- The OG block's games ban names only the package specifiers; the deep spellings live in the shared arrays, so a hit reports once.

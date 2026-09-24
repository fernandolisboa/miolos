# Do I need to do anything?

**No.** [`docs/pending-fernando.md`](./docs/pending-fernando.md) still holds one ⚡ decision, low urgency by ~13 months. To work through the ledger: start a session with *"run /wizard over docs/pending-fernando.md, NOW section"*.

## Start here

Nothing to verify. #255, #201 and #257 merged together.

## Session state

**The free-play wall is proved on the runtime module graph** (**ADR-0078**, amends ADR-0046 and ADR-0077). `T-WEB-S369` walks the value edges of every free-play file and finds no I/O module, no `packages/db/src`, no Termo source; `T-WEB-S370` lints every specifier that graph writes through the real config. A one-hop door — `termo-screen`, a daily route page — no longer needs its name on a list to be caught. The 27 shared modules ADR-0077 left unguarded are covered.

Relative specifiers must now be in normal form (no `.`, empty or mid-path `..` segment, no code extension in `app/` or `src/`), and a relative path into any of `packages/games/src` is banned across `apps/web`. `T-LINT-S41`, `S42`, `S57`, `S58` were re-founded in place; `T-WEB-S368` is retired.

## The lesson — a graph that follows type edges proves the wrong thing

`closureOf` follows `import type`, so on it free play already "reaches" `play/play-record` — a module no browser ever loads for free play, because the import is erased. A runtime claim needs the runtime graph: `valueClosureOf` drops `import type`, `export type` and `typeof import(…)`, and keeps `import { type X }`, which is a value edge under `verbatimModuleSyntax`. The regex agrees with the TypeScript AST on all 254 source files. The resolver now throws on an unresolved relative or `@miolos/*` specifier, so a walk can no longer lose an edge in silence.

## Next

**#206 cluster 7** — 321 lines (not 640).

**Also queued:** #254 (the remote conclusion announces its body sentence twice — `.announcer` is `clip-path`-hidden, so a screen reader gets it on mount and again in browse mode), #205's CSS half (~1,820 lines, NOT a sweep), #155 (`bundle-check` into CI), the `jsonResponse`/`stubFetch` Quick change, and folding `T-WEB-S183`'s duplicate module walker in `archive-day.test.tsx` onto `module-graph.ts`.

# Do I need to do anything?

**No.** [`docs/pending-fernando.md`](./docs/pending-fernando.md) still holds one ⚡ decision, low urgency by ~13 months. To work through the ledger: start a session with *"run /wizard over docs/pending-fernando.md, NOW section"*.

## Start here

Nothing to verify. #255, #201 and #257 merged together, and #206 clusters 5, 6, 7, 8 and 14. Cluster 7 moved the four roots' claim-pause effect into `usePlayLifecycle` and did **not** build the issue's `useDailyScreenState` phase union: the ladders differ per game, so it would have saved nothing. Cluster 8 gave the four `apps/api/src/publishing/service.ts` top-ups one shared `topUpBuffer` envelope and one shared `withSeedRetries` loop; the audit's ~420 lines were really 293 across the four, and the file is 378 lines now (was 413).

## Session state

**The free-play wall is proved on the runtime module graph** (**ADR-0078**, amends ADR-0046 and ADR-0077). `T-WEB-S374` walks the value edges of every free-play file and finds no I/O module, no `packages/db/src`, no Termo source; `T-WEB-S375` lints every specifier that graph writes through the real config. A one-hop door — `termo-screen`, a daily route page — no longer needs its name on a list to be caught. The 27 shared modules ADR-0077 left unguarded are covered.

Relative specifiers must now be in normal form (no `.`, empty or mid-path `..` segment, no code extension in `app/` or `src/`), and a relative path into any of `packages/games/src` is banned across `apps/web`. `T-LINT-S41`, `S42`, `S57`, `S58` were re-founded in place; `T-WEB-S368` is retired. Its ids were first reserved as `S369…S373` and renumbered to `S374…S378` at merge, because #206 cluster 7 landed `S369`/`S370` in parallel: two threads cutting ids off one frontier collide, so re-derive it after merging `main`.

## The lesson — a graph that follows type edges proves the wrong thing

`closureOf` follows `import type`, so on it free play already "reaches" `play/play-record` — a module no browser ever loads for free play, because the import is erased. A runtime claim needs the runtime graph: `valueClosureOf` drops `import type`, `export type` and `typeof import(…)`, and keeps `import { type X }`, which is a value edge under `verbatimModuleSyntax`. The regex agrees with the TypeScript AST on all 254 source files. The resolver now throws on an unresolved relative or `@miolos/*` specifier, so a walk can no longer lose an edge in silence.

## Dependabot npm PRs cannot be merged as opened

next 16.3.5, sharp 0.35.4 and vitest 4.1.11 landed in one PR that superseded Dependabot #259–#262. Dependabot's npm PRs here change one `package.json` and never `pnpm-lock.yaml`, so `--frozen-lockfile` fails, and they bump a package in only one of the workspaces that pin it. Land them as one hand-made bump across every pin, and stay outside `minimumReleaseAge` (7 days): `pnpm install` refuses anything newer.

## Next

**#206 cluster 9** — re-derive the audit's numbers first, as clusters 1, 4, 7 and 8 had to.

**Also queued:** the Binairo `validate.test.ts` uniqueness property has no explicit timeout, and it hit the 5 s default under CI load on #264 (about 530 ms locally; the sibling property tests in `binairo/generate.test.ts` carry `25_000`), #254 (the remote conclusion announces its body sentence twice — `.announcer` is `clip-path`-hidden, so a screen reader gets it on mount and again in browse mode), #205's CSS half (~1,820 lines, NOT a sweep), #155 (`bundle-check` into CI), the `jsonResponse`/`stubFetch` Quick change, and folding `T-WEB-S183`'s duplicate module walker in `archive-day.test.tsx` onto `module-graph.ts`.

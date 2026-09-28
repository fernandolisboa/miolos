# ADR-0088 — Cruzadinha free play ships the lexicon on its own route

**Status:** Accepted — 2026-09-28 (issue #279)
**Depends on:** [ADR-0004](./0004-no-unpublished-puzzle-reaches-the-client.md), [ADR-0011](./0011-free-play-is-generated-on-the-client.md), [ADR-0046](./0046-free-play-routes-levels-and-the-ephemeral-session.md), [ADR-0047](./0047-bundle-markers-are-route-scoped.md), [ADR-0078](./0078-the-free-play-wall-is-proved-on-the-runtime-module-graph.md)
**Supersedes in part:** [ADR-0085](./0085-cruzadinha-is-a-seeded-fill-from-a-curated-lexicon.md) decision 7 and its consequence that free play needs a new decision; [ADR-0086](./0086-the-cruzadinha-daily-ships-its-letters.md) decision 6.
**Amends:** [ADR-0011](./0011-free-play-is-generated-on-the-client.md)'s consequence that generator code is "pure TS and small"; [ADR-0019](./0019-per-game-subpath-exports-in-packages-games.md)'s root-barrel substrate, which gains `normalizeWord`; [ADR-0045](./0045-the-termo-screen-ships-no-hint-and-no-clock.md) decision 6's markers; [ADR-0046](./0046-free-play-routes-levels-and-the-ephemeral-session.md) decisions 1–3 and 7; [ADR-0047](./0047-bundle-markers-are-route-scoped.md)'s forbidden-everywhere list; [ADR-0078](./0078-the-free-play-wall-is-proved-on-the-runtime-module-graph.md) decision 1, whose `T-WEB-S375` also asserts the wall's verdict at the exempt importer.

## Context

ADR-0085 decision 7 kept the lexicon off the client for two reasons: a clue → answer lookup spoils the day, and the lexicon is large. The first reason is gone. Since ADR-0086 today's letters ship in the payload anyway, and the daily seed is random on the server and never ships, so no future day can be computed from the lexicon (ADR-0004 holds). Size is what remains: the engine and lexicon minify to about 287 KB raw / 69 KB gzip.

The lexicon also spells all 49 accented Termo answer canonicals, so the single-word Termo markers `então`, `mamãe` and `época` would fire on any chunk that carries it.

## Decision

1. **One static importer.** `apps/web/src/free-play/use-free-crossword.ts` is the only module that imports `@miolos/games/crossword`, and only statically. ESLint exempts that one file from the crossword ban; a dynamic `import()` stays banned everywhere. The engine output is projected to the daily wire shape by `projectCrosswordDaily` in `@miolos/core`, which the server's strip also uses.
2. **No level.** The engine has no difficulty axis (ADR-0085 decision 6). The free crossword's state is `{seed}`; the route shows no level picker.
3. **Bundle markers.** The lexicon clue `Calculadora de bolinhas` must appear in the chunks only `/modo-livre/cruzadinha` loads, and in no other chunk on disk. The Termo tripwire becomes adjacent answer-list pairs (`então\nagora`, `mamãe\nconta`, `época\ncarne`, with the escaped `\n` the minifier keeps). The lexicon stores words as separate literals and cannot spell a pair. The validation pair `zurre\nzurro` is expected in daily scope as the positive control for that encoding.

## Consequences

- `/modo-livre/cruzadinha` carries its own budget in `PER_ROUTE_BUDGET`. The hub's `<Link>` prefetches that chunk; accepted.
- On that route, devtools can map a clue to an answer, but only for grids the device generates. Today's daily is already public.
- The lexicon contains 397 of the 400 Termo answers, all 49 accented ones included, inside 2,878 five-letter words. That narrows a Termo guesser's pool from 5,408 words. This is accepted: ADR-0045 decision 5 rests on cost and strip integrity and does not keep the answer list confidential.
- Until `bundle-check` runs in CI (#155), a module-graph test is what proves in CI that only this route reaches the lexicon.
- `normalizeWord` lives at the `@miolos/games` root, so the crossword board reaches no Termo module from free play.

## Rejected

- **A disjoint free-play lexicon.** It halves the daily's variety.
- **A server endpoint.** ADR-0011.
- **A dynamic `import()`.** The lazy chunk is unattributed, scanned as daily scope, and fails closed; fixing that needs attribution code for no UX gain.
- **Carving the route out of the Termo markers.** It weakens a gate.

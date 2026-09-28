# ADR-0085 — Cruzadinha is a seeded fill from a curated lexicon

**Status:** Accepted — 2026-09-28 (issue #275)
**Depends on:** [ADR-0011](./0011-free-play-is-generated-on-the-client.md), [ADR-0015](./0015-termo-word-list-is-ai-curated-under-mechanical-constraints.md), [ADR-0019](./0019-per-game-subpath-exports-in-packages-games.md), [ADR-0023](./0023-proved-not-sampled-property-testing.md)

## Context

Cruzadinha is a 5×5 mini crossword (#274). Its content has two parts: the grid shape, and the words with their clues. Termo draws each day's answer from a finite list and must never draw one twice ([ADR-0040](./0040-the-termo-daily-stores-the-drawn-answer.md)), and it needs an alert when that list runs low ([ADR-0084](./0084-the-answer-list-alert-rides-the-buffer-depth-poll.md)). A crossword can be built fresh each day from a word pool, so it does not have to be a finite list at all.

## Decision

1. **A puzzle is a generated fill, not a draw.** `generateCrossword` in `packages/games/src/crossword/generate.ts` turns a uint32 seed into a grid. It picks one of `CROSSWORD_TEMPLATES` and fills it by backtracking over `CROSSWORD_LEXICON`, one clue per word. Words repeat across days, and never inside one puzzle. There is no draw ledger and no answer-list alert.
2. **Matching uses the normalized form**, a–z only, as in Termo (ADR-0015). The canonical spelling rides on each entry.
3. **Common inflected forms are answers**: plurals, feminine forms and everyday verb forms, clued in the same form ("Eu ___ você"), never as "Plural de …". Brazilian cruzadinhas use them routinely, and a lemma-only lexicon cannot fill the templates with variety (see Rejected). Rare tenses, *tu*/*vós* forms and enclitics stay out.
4. **The lexicon is AI-curated under constraints.** `content/crossword/README.md` lists them. `packages/games/test/crossword/lexicon.test.ts` enforces the mechanical ones: shape, sort order, clue rules, per-length floors, the rejected list, and that `lexicon.generated.ts` matches `content/crossword/lexicon.tsv`.
5. **A template ships only if it passes the shape test** in `packages/games/test/crossword/templates.test.ts`: every white cell sits in an across run and a down run, and every run is 3–5 letters long.
6. **No weekday ramp.** Every day draws from the same templates and lexicon.
7. **The lexicon never reaches a client chunk.** It is large, and with it a clue → answer lookup spoils the day. So Cruzadinha is not in free play for now.
8. **`validateCrossword` reuses `deriveSlots`.** Its independence as an instrument (ADR-0023) rests on the hand-numbered fixtures in `packages/games/test/crossword/slots.test.ts`.

## Consequences

- A puzzle is a pure function of its seed, the templates and the lexicon. Editing either changes what a seed produces.
- If a per-length floor ever binds, the pool is widened. The floor is never lowered.
- Free play for Cruzadinha would need a client-safe lexicon split first. That is a new decision.

## Rejected

- **A finite bank of pre-built puzzles.** It burns down like Termo's list and needs the same ledger and alert.
- **A fully white 5×5.** It is a double word square, and the lexicon cannot fill one reliably.
- **Lemmas only.** Counted exhaustively, a lemma-only lexicon of 1,440 words has 36 fills on the `#...#` template and 234 and 388 on two others, with `ler`, `lar` and `rol` in about 40% of the diagonal template's 7,070 grids: the same grid would come back within weeks. With inflected forms, each template has more than 100,000 fills.
- **Never repeating a word across days.** It would burn the lexicon and bring the finite-list problem back.

# ADR-0153 — Termo answers and the free pool split the common words

**Status:** Accepted — 2026-10-23 (issue #427, PR B)
**Depends on:** [ADR-0004](./0004-no-unpublished-puzzle-reaches-the-client.md), [ADR-0147](./0147-a-termo-answer-may-return-after-365-days.md), [ADR-0152](./0152-the-termo-guess-dictionary-is-vero-plus-the-frozen-ime-forms.md)
**Supersedes in part:** [ADR-0015](./0015-termo-word-list-is-ai-curated-under-mechanical-constraints.md) — hand-picked answers and the lemma preference; [ADR-0114](./0114-termo-free-play-draws-from-a-pool-that-is-never-a-daily-answer.md) decision 1 — the pool definition, and decision 5.3's marker; [ADR-0147](./0147-a-termo-answer-may-return-after-365-days.md) decision 3 — the list is no longer the 626 picks — and the Consequences' `select_answers.py`; [ADR-0152](./0152-the-termo-guess-dictionary-is-vero-plus-the-frozen-ime-forms.md) decision 5 — the pool.
**Amends:** [ADR-0112](./0112-the-grid-game-routes-bundle-budget-is-a-leak-tripwire.md) — the `/modo-livre/termo` budget.
**Fulfils:** [ADR-0147](./0147-a-termo-answer-may-return-after-365-days.md) decision 6 — the exclusion list.

## Context

Fernando (2026-10-22): daily answers should come from the most frequent pt-BR words, not from a hand-picked list. `select_answers.py` no longer reproduced `answers.csv` (ADR-0152), and a published answer can never be deleted (ADR-0147 decision 6).

## Decision

1. **Common words** = the frozen IME forms (`ispell.txt`) that VERO also knows, whose most frequent spelling occurs at least 100 times in hermitdave's pt_BR list: 2,990. `pipeline.py` writes them to `content/termo/common.csv` (`canonical,normalized`) in **alphabetical** order, so no CC-BY-SA ranking ships beyond `answers.csv`'s order. Requiring both dictionaries drops VERO's names, English words and junk without a hand list. The floor of 100 leaves more than four years of answers and a pool of about a thousand; lower floors add mostly rare inflections and subtitle noise. `common.csv`, `answers.csv` and `answers.generated.ts` join ADR-0152's MPL-2.0 files.
2. **`answers.csv` is append-only.** The pipeline appends, in frequency order, every common word whose `sha256(normalized)` first byte is even, that is not excluded and not already present. It never rewrites a row, so the rule is idempotent and an exclusion never moves another word. Parity of a hash is fixed per word and independent of frequency, so each frequency band splits about evenly between answers and pool. 626 → 1,714 rows. A CI test pins the SHA-256 of the 626-row ADR-0147 prefix.
3. **`TERMO_ANSWERS` = `answers.csv` − `excluded.txt`, in row order.** A published answer is retired with a `retired` row; it stays in `answers.csv`, so it never enters the pool. A retired word already drawn into the buffer still publishes unless that row is also killed (`killed_at`).
4. **Free pool** = common − `answers.csv` − excluded, in `common.csv` order: 1,074 words. The crossword lexicon no longer feeds it. The pool marker becomes `álamo\nalças`; `FORBIDDEN_PAIRS` do not move.
5. **`excluded.txt` reasons:** `profanity`, `proper-noun`, `foreign`, `archaic`, `regional`, `editorial` and `retired`. Only `profanity` rows touch guesses, through the `/admin` switch `termoAcceptsProfanity` (ADR-0154). Every new answer and pool word was read against ADR-0015's constraints, then re-read by an independent reviewer: 198 rows, `editorial` covering contractions and closed-class words (`disso`, `pelos`, `esses`), sexual or scatological readings, slurs and ethnicity words; `regional` covering *tu* forms and pt-PT words (`sabes`, `gajos`). `negro`/`negra` are excluded as ethnicity words, while the colour words `preto`/`preta` stay: their main reading is the colour.

## Consequences

- Inflected forms and plurals are answers now (`tinha`, `horas`), as frequency ranks them.
- One-time cost: 1,028 words of the old 2,259-word pool become daily answers that free play has already shown.
- `select_answers.py` and `candidates.tsv` are gone. The pipeline downloads its sources, so CI checks the invariants instead: the prefix hash, every even non-excluded common word answered, the pool equation, and staleness of every generated module.
- The pool module shrinks with the pool: `/modo-livre/termo` measured 140.4 KB, its budget lowered 154 → 145 KB (ADR-0112). The answers never reach a client, so no other route moves.
- At 1,714 answers a buffered answer stays mixed with at least 1,320 others (`T-API-S346`).

## Rejected

- **Pool = (lexicon ∩ guesses) − answers − excluded.** Two curated sources for one split; answers and pool come from one list now.
- **Ranking answers by frequency without a parity split.** The pool would be only the rarest words.
- **Committing `common.csv` in frequency order.** It redistributes the CC-BY-SA ranking.

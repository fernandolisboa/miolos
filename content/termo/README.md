# Termo word lists

The word lists of the Miolos Termo game (Brazilian Portuguese, five letters).
Matching is accent-insensitive: a guess is compared after lowercasing, Unicode
NFD and stripping combining marks (so `ç` becomes `c`), and tiles reveal the
canonical accented spelling
([ADR-0015](../../docs/adr/0015-termo-word-list-is-ai-curated-under-mechanical-constraints.md)).

**The file order is not the daily order.** Which word is a day's answer is a
server-side seeded choice
([ADR-0010](../../docs/adr/0010-publication-is-time-driven-published-at-plus-buffer.md)),
so the list being public spoils nothing.

## Files

| File | Contents |
|---|---|
| `validation.txt` | The guess dictionary: 18,250 normalized words, one per line, sorted, unique, all `^[a-z]{5}$`. VERO ∪ `ispell.txt` ∪ `additions.txt` ([ADR-0152](../../docs/adr/0152-the-termo-guess-dictionary-is-vero-plus-the-frozen-ime-forms.md)). Written by `pipeline.py`. |
| `ispell.txt` | The 5,310 frozen IME-USP forms, normalized, sorted. Input, never rewritten: the IME host resets connections from CI and containers. |
| `additions.txt` | Curated canonical forms that neither VERO nor `ispell.txt` carries (`deque`, `drone`, `vison`), sorted by (normalized form, canonical) ([ADR-0062](../../docs/adr/0062-termo-guess-dictionary-gaps-close-with-curated-additions.md)). The pipeline refuses a line that is already a guess. |
| `excluded.txt` | The exclusion list: `normalized<TAB>reason`, sorted, unique. Today only `profanity` rows (41), written by `pipeline.py` from its `PROFANITY` stems and spellings, every inflection included. An excluded word is never an answer and never in the free pool. |
| `answers.csv` | The 626 daily answers, header `canonical,normalized`. Hand-picked under ADR-0015's constraints and ranked by corpus frequency. **Never delete a row** ([ADR-0147](../../docs/adr/0147-a-termo-answer-may-return-after-365-days.md)). |
| `rejected-sample.txt` | Hand-assembled audit record of the answer curation: 107 rejected words and why. |
| `rejected-lexicon-sample.txt` | A seeded sample of what `pipeline.py` rejects from VERO, per reason, rewritten on every run. |
| `pipeline.py`, `select_answers.py` | The scripts. `sources/` and `candidates.tsv` are gitignored intermediates. |

## Generated modules

`pnpm --filter @miolos/games generate:termo` renders:

- the guesses into `packages/games/src/termo/words.generated.ts`: `validation.txt`, minus the `profanity` rows of `excluded.txt` only if `PROFANITY_IS_A_GUESS` (in `packages/games/scripts/render-termo-words.ts`) is `false`. It is `true`: a typed profane word is accepted, pending Fernando's answer;
- `answers.csv` into `packages/games/src/termo-answers/answers.generated.ts`;
- the **free pool** into `packages/games/src/termo-free/pool.generated.ts`: the five-letter words of `content/crossword/lexicon.tsv` that are guesses, are not answers and are not excluded. 2,259 words ([ADR-0114](../../docs/adr/0114-termo-free-play-draws-from-a-pool-that-is-never-a-daily-answer.md)).

**Run `generate:termo` after editing anything here or the crossword lexicon**, then `pnpm test --force`: a staleness test fails when a generated module and its sources disagree.

## Sources and licences

1. **VERO**, the LibreOffice pt-BR hunspell dictionary (Raimundo Moura and the VERO team), dual-licensed LGPLv3 / MPL. Miolos takes it under the **Mozilla Public License 2.0**: `validation.txt`, `excluded.txt`, `words.generated.ts` and `pool.generated.ts` are MPL-2.0 files (<https://mozilla.org/MPL/2.0/>). `/termos` names VERO, the licence and this repository.
   - `https://raw.githubusercontent.com/LibreOffice/dictionaries/67032ee957631908098a72edf48dc81cac27e369/pt_BR/pt_BR.dic`, sha256 `a38bfb26b68ece2834e79fe83e48d5792652970ace12db89d1b9674bf9933183`
   - `.../pt_BR/pt_BR.aff`, sha256 `21d8ad2a769a60e17e2b5ea4ef11d4d593a58b9e2a82d642ef82d6a4c5523865`
2. **IME-USP** "Lista de palavras do português brasileiro" (`https://www.ime.usp.br/~pf/dicios/br-utf8.txt`), derived from Ricardo Ueda Karpischek's br.ispell, **CC BY**. Its five-letter forms, filtered as before #427, are frozen in `ispell.txt`.
3. **hermitdave/FrequencyWords** pt_BR (OpenSubtitles 2018), **CC-BY-SA-4.0** content. Used only to rank; no counts ship.
   - `https://raw.githubusercontent.com/hermitdave/FrequencyWords/525f9b560de45753a5ea01069454e72e9aa541c6/content/2018/pt_br/pt_br_full.txt`, sha256 `533b3abaab3b1ea9cec7a150fc8aaf8d428c6f241979cc2224b7ee82f8a369b2`

`pipeline.py` downloads each pinned file into `sources/` and stops if a hash differs. Nothing downloaded is committed.

## Pipeline

1. **Expand VERO.** Every `.dic` stem, its PFX and SFX forms and their cross product (both rules flagged `Y`). This `.aff`'s only continuation classes, on flag `5`'s state names, yield capitalized forms that are dropped anyway, so one pass of each is complete. Entries with the FORBIDDENWORD flag and multi-word entries are skipped.
2. **Keep five-letter words.** Drop forms with a capital (proper nouns), forms that are not `a`–`z` after normalization, the six forms `hunspell -l` rejects (`HUNSPELL_REJECTED`), the junk `https` and `vldis`, and `PROPER_NOUN_DUPLICATES` (`jesus`, `paris`, `maria`…). VERO's other lowercase names and English words stay: a guess shows nothing to anyone else (ADR-0152).
3. **Union** with `ispell.txt` and `additions.txt` into `validation.txt`.
4. **Profanity rows.** Every kept form whose VERO stem or spelling is in `PROFANITY` becomes an `excluded.txt` row; rows with other reasons are kept as they are.
5. **Candidates.** VERO and additions forms scored by their most frequent spelling, top 2,500, into `candidates.tsv` for `select_answers.py`. Since VERO knows `metrô`, the script no longer reproduces `answers.csv` byte for byte; `answers.csv` is the record.

## Answer constraints

The 626 answers were picked word by word against these:

- Common contemporary Brazilian Portuguese: no archaisms, regionalisms or jargon.
- No proper nouns, unnaturalized loanwords or abbreviations. Naturalized accented borrowings (`álbum`, `turnê`, `hotel`) are allowed.
- No obscenities, slurs or words whose main reading is sexual or scatological. Editorially, `judeu` and `negro` are not answers, though they are guesses.
- Lemmas preferred; 13 very frequent inflected or function forms admitted (`estou`, `vamos`, `minha`…).
- Unique after normalization; the canonical form is the dictionary spelling with accents.

## Checks

`packages/games/test/termo/word-list.test.ts` and `test/termo-free/pool.test.ts` pin these files and the generated modules on every CI run.

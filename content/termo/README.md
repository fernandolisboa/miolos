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

## The three lists

- **Guesses**: any pt-BR word, 18,250 forms. VERO ∪ `ispell.txt` ∪ `additions.txt`, less the `profanity` rows of `excluded.txt` ([ADR-0152](../../docs/adr/0152-the-termo-guess-dictionary-is-vero-plus-the-frozen-ime-forms.md)).
- **Daily answers**: the rows of `answers.csv` that are not in `excluded.txt`, 1,714 ([ADR-0153](../../docs/adr/0153-termo-answers-and-the-free-pool-split-the-common-words.md)).
- **Free pool**: the common words that are neither in `answers.csv` nor in `excluded.txt`, 1,074 ([ADR-0153](../../docs/adr/0153-termo-answers-and-the-free-pool-split-the-common-words.md), [ADR-0114](../../docs/adr/0114-termo-free-play-draws-from-a-pool-that-is-never-a-daily-answer.md)).

## Files

| File | Contents |
|---|---|
| `validation.txt` | The guess dictionary: 18,250 normalized words, sorted, unique, all `^[a-z]{5}$`. Written by `pipeline.py`. |
| `ispell.txt` | The 5,310 frozen IME-USP forms, normalized, sorted. Input, never rewritten: the IME host resets connections from CI and containers. |
| `additions.txt` | Curated canonical forms that neither VERO nor `ispell.txt` carries (`deque`, `drone`, `vison`), sorted by (normalized form, canonical) ([ADR-0062](../../docs/adr/0062-termo-guess-dictionary-gaps-close-with-curated-additions.md)). The pipeline refuses a line that is already a guess. |
| `common.csv` | The common words, header `canonical,normalized`, alphabetical: the `ispell.txt` forms VERO also knows whose most frequent spelling occurs at least 100 times in the frequency list. 2,990. Written by `pipeline.py`. |
| `answers.csv` | Header `canonical,normalized`. **Append-only: never edit or delete a row** ([ADR-0147](../../docs/adr/0147-a-termo-answer-may-return-after-365-days.md)). Rows 1–626 are the old hand picks; `pipeline.py` appends the rest. 1,714 rows. The appended rows' order is factual frequency ranking; no counts ship. |
| `excluded.txt` | The exclusion list: `normalized<TAB>reason`, sorted, unique. Reasons: `profanity`, `proper-noun`, `foreign`, `archaic`, `regional`, `editorial` and `retired`. An excluded word is never an answer and never in the free pool. Only `profanity` rows touch guesses. |
| `rejected-sample.txt` | Hand-assembled audit record of the 2026 hand-picked curation: 107 rejected words and why. Frozen. |
| `rejected-lexicon-sample.txt` | A seeded sample of what `pipeline.py` drops, up to 30 per reason, rewritten on every run: VERO forms that are not guesses, and guesses that are not common words. |
| `pipeline.py` | The script. `sources/` is its gitignored download folder. |

## Pipeline

Run `python3 -I pipeline.py` from this folder. It is idempotent: a second run changes nothing.

1. **Expand VERO.** Every `.dic` stem, its PFX and SFX forms and their cross product (both rules flagged `Y`). This `.aff`'s only continuation classes, on flag `5`'s state names, yield capitalized forms that are dropped anyway, so one pass of each is complete. FORBIDDENWORD and multi-word entries are skipped.
2. **Keep five-letter words.** Drop forms with a capital (proper nouns), forms that are not `a`–`z` after normalization, the six forms `hunspell -l` rejects (`HUNSPELL_REJECTED`), the junk `https` and `vldis`, and `PROPER_NOUN_DUPLICATES` (`jesus`, `paris`, `maria`…). VERO's other lowercase names and English words stay guesses.
3. **Guesses.** The union with `ispell.txt` and `additions.txt` is `validation.txt`.
4. **Profanity rows.** Every kept form whose VERO stem or spelling is in `PROFANITY` becomes a `profanity` row of `excluded.txt`. Rows with other reasons are kept as they are: they are edited by hand.
5. **Common words.** Each `ispell.txt` form that VERO knows, spelled as its most frequent VERO spelling, whose frequency is at least `FREQUENCY_FLOOR` (100). Written alphabetically, so the frequency ranking is not redistributed.
6. **Answers.** Appended to `answers.csv`, in frequency order: every common word whose `sha256` (of the normalized form, UTF-8) has an even first byte, that is not excluded and not already present. Existing rows never move.

## Changing the lists

- **Stop a word** from being an answer or a pool word: add a row to `excluded.txt` with its reason, run the pipeline, then `generate:termo`. An exclusion moves no other word. For a word already in `answers.csv`, the reason is `retired`. If that word is already drawn into the buffer, kill that row too, or it still publishes.
- **Never delete a row of `answers.csv`.** Its word would go back into the free pool.
- **Profanity**: add the stem to `PROFANITY` in `pipeline.py`. Its rows are refused as guesses unless the `/admin` switch `termoAcceptsProfanity` is on (ADR-0154); `generate:termo` writes them to `profanity.generated.ts`. If a new stem matches a word already in `answers.csv`, the pipeline stops: mark that word `retired` and take the stem out of `PROFANITY`, or extend the tool.

Which words are excluded, and why, follows ADR-0015's answer constraints as [ADR-0153](../../docs/adr/0153-termo-answers-and-the-free-pool-split-the-common-words.md) decision 5 applies them.

## Generated modules

`pnpm --filter @miolos/games generate:termo` renders:

- the guesses into `packages/games/src/termo/words.generated.ts`;
- the answers (`answers.csv` less `excluded.txt`) into `packages/games/src/termo-answers/answers.generated.ts`;
- the free pool (`common.csv` less `answers.csv` and `excluded.txt`) into `packages/games/src/termo-free/pool.generated.ts`.

**Run `generate:termo` after editing anything here**, then `pnpm test --force`: a staleness test fails when a generated module and its sources disagree.

## Sources and licences

1. **VERO**, the LibreOffice pt-BR hunspell dictionary (Raimundo Moura and the VERO team), dual-licensed LGPLv3 / MPL. Miolos takes it under the **Mozilla Public License 2.0**: `validation.txt`, `common.csv`, `answers.csv`, `excluded.txt` and the three generated modules are MPL-2.0 files (<https://mozilla.org/MPL/2.0/>). `/termos` names VERO, the licence and this repository.
   - `https://raw.githubusercontent.com/LibreOffice/dictionaries/67032ee957631908098a72edf48dc81cac27e369/pt_BR/pt_BR.dic`, sha256 `a38bfb26b68ece2834e79fe83e48d5792652970ace12db89d1b9674bf9933183`
   - `.../pt_BR/pt_BR.aff`, sha256 `21d8ad2a769a60e17e2b5ea4ef11d4d593a58b9e2a82d642ef82d6a4c5523865`
2. **IME-USP** "Lista de palavras do português brasileiro" (`https://www.ime.usp.br/~pf/dicios/br-utf8.txt`), derived from Ricardo Ueda Karpischek's br.ispell, **CC BY**. Its five-letter forms are frozen in `ispell.txt`.
3. **hermitdave/FrequencyWords** pt_BR (OpenSubtitles 2018), **CC-BY-SA-4.0** content. Used only to choose common words and order the appended answers; no counts ship.
   - `https://raw.githubusercontent.com/hermitdave/FrequencyWords/525f9b560de45753a5ea01069454e72e9aa541c6/content/2018/pt_br/pt_br_full.txt`, sha256 `533b3abaab3b1ea9cec7a150fc8aaf8d428c6f241979cc2224b7ee82f8a369b2`

`pipeline.py` downloads each pinned file into `sources/` and stops if a hash differs. Nothing downloaded is committed.

## Checks

The pipeline never runs in CI. `packages/games/test/termo/word-list.test.ts` and `test/termo-free/pool.test.ts` pin these files and the generated modules on every run: the SHA-256 of the 626-row prefix of `answers.csv`, every even non-excluded common word answered, every appended row a common row of even parity, the pool equation, and each count.

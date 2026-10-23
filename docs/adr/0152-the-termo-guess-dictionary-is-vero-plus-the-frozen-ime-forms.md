# ADR-0152 — The Termo guess dictionary is VERO plus the frozen IME forms

**Status:** Accepted — 2026-10-23 (issue #427, PR A)
**Depends on:** [ADR-0015](./0015-termo-word-list-is-ai-curated-under-mechanical-constraints.md), [ADR-0114](./0114-termo-free-play-draws-from-a-pool-that-is-never-a-daily-answer.md), [ADR-0147](./0147-a-termo-answer-may-return-after-365-days.md)
**Supersedes in part:** [ADR-0015](./0015-termo-word-list-is-ai-curated-under-mechanical-constraints.md) — the validation dictionary taken from the IME-USP list alone; [ADR-0062](./0062-termo-guess-dictionary-gaps-close-with-curated-additions.md) — its Rejected "full hunspell expansion".
**Amends:** [ADR-0062](./0062-termo-guess-dictionary-gaps-close-with-curated-additions.md) decision 2 — the blocklist no longer binds on guesses (decision 4 below); [ADR-0112](./0112-the-grid-game-routes-bundle-budget-is-a-leak-tripwire.md) — the three Termo budgets; [ADR-0114](./0114-termo-free-play-draws-from-a-pool-that-is-never-a-daily-answer.md) decision 1 — the pool also leaves out the exclusion list.

## Context

Fernando (2026-10-22): any valid pt-BR word must be accepted as a guess; the only filter he wants is profanity. The IME-USP list (5,310 forms) refuses real words such as `bolor`, `chope`, `sarau`, `vocal` and `sagui`. ADR-0062 rejected a hunspell expansion on feasibility only.

## Decision

1. **Guesses = VERO ∪ `ispell.txt` ∪ `additions.txt`: 18,250 words.** VERO is LibreOffice's `pt_BR.dic`/`.aff`, pinned to commit `67032ee957631908098a72edf48dc81cac27e369` with each file's sha256 checked. `pipeline.py` expands it with a stdlib affix expander (PFX, SFX and their cross product; this `.aff` has no continuation classes). `hunspell -l` accepts every kept form; the six it rejects are hard-coded out, and `https` and `vldis` are dropped as junk. The IME host resets connections from CI and containers, so its forms are frozen in `ispell.txt`. `additions.txt` keeps `deque`, `drone` and `vison`. `canonical-map.csv` is removed: nothing read it.
2. **Licence.** VERO is dual LGPLv3/MPL; the derived files (`validation.txt`, `excluded.txt`, `words.generated.ts`, `pool.generated.ts`) take **MPL-2.0**, which is file-level, so no other file changes licence. The generated modules carry the MPL notice, `/termos` carries the §3.2 notice in one line (VERO, the licence, the public repository), and `content/termo/README.md` records the commit and hashes.
3. **Stated leniency.** VERO's lowercase names and English words (`henry`, `miami`, `trade`) are guesses. A guess shows nothing to anyone else, and refusing a real word is the bug this fixes. `PROPER_NOUN_DUPLICATES` stays binding where it matches: `jesus`, `paris` and `maria` stay out.
4. **One exclusion list**, `content/termo/excluded.txt` (`normalized<TAB>reason`, sorted, unique). Its `profanity` rows are every five-letter form whose VERO stem or spelling is in `pipeline.py`'s `PROFANITY`, so each inflection of `foder`, `cagar` or `mijar` is caught: 37 rows. Rows always apply to answers and the free pool. Whether they apply to guesses is `PROFANITY_IS_A_GUESS` in `packages/games/scripts/render-termo-words.ts`. **Fernando's answer is pending; the recommended option ships: a typed profane word is accepted.** "Recusar" is that constant set to `false` and `generate:termo`.
5. **Free pool** = (lexicon ∩ guesses) − answers − excluded: 2,259 words.

## Consequences

- The dictionary module grows from 37 to 125 KB raw (6.4 → 19.1 KB brotli). Measured: `/termo` 154.8 KB, `/arquivo/[data]/termo` 149.7 KB, `/modo-livre/termo` 149.4 KB; budgets 159, 154 and 154 KB under Fernando's standing approval (2026-10-16). On every other route the dictionary now clears 48 KB by far.
- `select_answers.py` no longer reproduces `answers.csv` byte for byte: VERO knows `metrô`, so the `metro` row would move. `answers.csv` is the record; PR B deletes the script.
- A future gap closes in `additions.txt` only when VERO and `ispell.txt` both lack the word; the pipeline refuses a line that is already a guess. `ispell.txt` never grows.
- Deploy skew can accept a word on one side and 422 it on the other, as ADR-0062 anticipated.

## Rejected

- **A lemma filter** (stems only). VERO has false negatives: it fails 212 of the 626 hand-picked answers (`carro` appears only as a form of `carrar`).
- **`unmunch`.** It mangles `FLAG UTF-8`.
- **Packing the dictionary.** It saves about 5 KB brotli, not worth a decoder.
- **A second hand blocklist for guesses.** One list, one constant.

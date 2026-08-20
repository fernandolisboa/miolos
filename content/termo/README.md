# Termo draft word list

Draft answer/validation word lists for the Miolos Termo game (Brazilian Portuguese,
5 letters, accent-insensitive matching: guesses are compared after NFD diacritic
stripping and ç→c; tiles reveal the canonical accented spelling). Produced under
[ADR-0015](../../docs/adr/0015-termo-word-list-is-ai-curated-under-mechanical-constraints.md)
(AI-curated, mechanical constraints); the M2 Termo ticket ships the validation
harness that proves the invariants below as property-style tests before this list
feeds the publishing cron.

**The file order is not the daily order.** The list being public spoils nothing:
which word is any given day's answer is a server-side seeded choice
([ADR-0010](../../docs/adr/0010-publication-is-time-driven-published-at-plus-buffer.md)),
exactly as with the grid-game generators.

## Deliverables

| File | Contents |
|---|---|
| `answers.csv` | 400 daily-answer words. Header `canonical,normalized`. Canonical is the correct pt-BR spelling (lowercase, accents/ç kept); normalized matches `^[a-z]{5}$`. |
| `validation.txt` | 5,408 accepted-guess words, one normalized 5-letter word per line, sorted, unique. Superset of every `answers.csv` normalized form. |
| `additions.txt` | 98 curated canonical forms the base lexicon is missing ([ADR-0062](../../docs/adr/0062-termo-guess-dictionary-gaps-close-with-curated-additions.md), issue #140): real, current pt-BR words attested in the frequency corpus, one per line, sorted by (normalized form, canonical). Merged by `pipeline.py` under the same normalization and blocklist as lexicon entries. Guess dictionary only — never a source of answers. |
| `canonical-map.csv` | Header `normalized,canonical`. One row per validation word, mapping it to a canonical accented display form. When several accented words share a normalized form (e.g. `sabia`/`sábia`), the most frequent one in the subtitle corpus is the canonical; all colliding spellings remain guessable through the single normalized entry. |
| `rejected-sample.txt` | 107 examples of rejected words with the constraint that rejected each (tab-separated). **Hand-assembled audit record from the curation pass** — the answer-stage rejections come from model judgment, which no script reproduces. |
| `rejected-lexicon-sample.txt` | The mechanical, reproducible counterpart: a seeded random sample of lexicon-stage rejections, written by `pipeline.py` on every run. |
| `pipeline.py`, `select_answers.py` | The scripts that produce the three data files above (deterministic; run from anywhere, sources auto-download; `candidates.tsv` and `sources/` are gitignored intermediates). |

## Sources and licenses

1. **Base lexicon** — IME-USP "Lista de palavras do português brasileiro",
   derived from Ricardo Ueda Karpischek's br.ispell dictionary, pre-expanded
   (inflections, plurals and conjugations included as plain entries).
   - URL: `https://www.ime.usp.br/~pf/dicios/br-utf8.txt` (261,788 entries)
   - License: **Creative Commons Attribution (CC BY)**, as stated on
     `https://www.ime.usp.br/~pf/dicios/` ("O uso do material está sujeito à
     licença Creative Commons Attribution (CC BY)").
   - Chosen over the LibreOffice pt-BR hunspell dictionary because no
     hunspell/`unmunch` tooling was available for affix expansion; this list is
     already expanded.
2. **Frequency ranking** — hermitdave/FrequencyWords, pt_BR full list (built
   from the OpenSubtitles 2018 corpus).
   - URL: `https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/pt_br/pt_br_full.txt` (848,043 entries)
   - License: **MIT for code, CC-BY-SA-4.0 for content** (per the repo README).
     Used here only to rank/select; the frequency numbers themselves are not
     shipped.

Raw source downloads are not committed; the URLs above are the record, and
`pipeline.py` re-fetches them to regenerate everything deterministically.

## Pipeline

1. **Normalize** every lexicon entry: lowercase → Unicode NFD → strip combining
   marks (this also turns ç into c). Keep entries whose normalized form matches
   `^[a-z]{5}$`.
2. **Lexicon-stage exclusions**: capitalized lemmas (proper nouns), entries with
   hyphens/spaces/apostrophes/periods, roman numerals, a blocklist of slurs,
   heavy obscenities and scatological verbs (normalized forms; mild vulgarity
   stays guessable), a curated list of **lowercase proper-noun duplicates** the
   capitalization filter cannot see (`maria`, `paris`, `japao`… — words with a
   legitimate common-noun or verb reading like `silva`, `bento`, `marta`,
   `edite`, `tomas`, `rosa` are deliberately kept), and two corrupted source
   tokens (`ceemo`, `geemo` — truncated `-eemos` subjunctives).
3. **Curated additions** (`additions.txt`): canonical forms for real pt-BR
   words the base lexicon is missing, merged as if they were lexicon entries
   (same normalization, same blocklist assertion; the proper-noun filters do
   not apply because each line is hand-reviewed). A line already present in
   the base lexicon fails the run — the file can never silently duplicate
   the source.
4. **`validation.txt`** = all surviving normalized forms, sorted and deduplicated.
5. **`canonical-map.csv`** = for each normalized form, the colliding canonical
   spelling with the highest OpenSubtitles frequency (alphabetical tiebreak).
6. **Answer candidates** = normalized forms scored by the max frequency of any of
   their canonical spellings, descending (`candidates.tsv`, top 2,500).
7. **Curation** (`select_answers.py`): a hand-picked pool of 626 normalized forms
   chosen word by word from the ranked candidates against the answer constraints
   below, then the top 400 of that pool by corpus frequency became `answers.csv`.
   The frequency floor of the kept set is ≈5,400 subtitle occurrences — every
   answer is a genuinely everyday word.

## Answer constraints applied

- Common contemporary Brazilian Portuguese only — no archaisms, regionalisms or
  technical jargon.
- No proper nouns (including lowercase corpus artifacts like `paris`, `jesus`),
  no unnaturalized loanwords, no abbreviations. Naturalized accented borrowings
  (`álbum`, `turnê`, `tênis`, `álibi`, `hotel`) are allowed.
- No obscenities, slurs, or words whose primary reading is sexual or
  scatological. Editorial extra: ethnicity/race words (`judeu`, `negro`) are
  excluded from answers though they are ordinary words and remain valid guesses.
- Lemmas preferred: singular nouns/adjectives and infinitive verbs. Inflected or
  function forms admitted only when extremely frequent (13 of the 400: `estou`,
  `vamos`, `tenho`, `quero`, `posso`, `disse`, `mesmo`, `outro`, `algum`,
  `ambos`, `minha`, `nossa`, `sexta`).
- Unique after normalization (enforced; also verified).
- Canonical form is the correct dictionary spelling with accents/ç.
- Variety: a broad mix of infinitive verbs (~70), nouns (the majority),
  adjectives (~55), plus numerals (`cinco`, `vinte`), weekdays (`sexta`,
  `terça`), months (`abril`, `junho`, `julho`) and common adverbs; **49** of
  the 400 canonical forms carry a diacritic (`então`, `manhã`, `saúde`,
  `época`, `túnel`, `dúzia`, …), which the accent-insensitive design exists
  to allow.

## Self-review pass

A full word-by-word review of the initially selected 400 removed **2 words**:
`judeu` and `negro` (race/ethnicity words — inoffensive in pt-BR but unsuitable
as daily answers by editorial judgment). They were replaced by the next-ranked
curated candidates (`nuvem`, `praga`). Words like `vadia`, `bunda`, `bicha`,
`veado`, `pinto`, `tesão`, `gozar` had already been rejected during the initial
curation pass (see `rejected-sample.txt`).

## Sanity checks (all run, all passing)

- All 400 answer normalized forms match `^[a-z]{5}$`: **yes**
- Duplicate normalized forms in answers: **0**
- Every answer's normalized form present in `validation.txt`: **yes (400/400)**
- Every answer's canonical form normalizes exactly to its normalized form: **yes**
- `validation.txt`: **5,408 lines**, unique, sorted, all matching `^[a-z]{5}$`
- `canonical-map.csv`: **5,408 rows**, covers the validation set exactly; every
  canonical normalizes back to its key
- Every `additions.txt` entry survives the pipeline into `validation.txt`
  and is accepted by the shipped `isValidGuess` (pinned in
  `packages/games/test/termo/word-list.test.ts`)
- Normalized forms with more than one canonical spelling (sabia/sábia-style
  collisions): **520** (largest groups are 4-way ties: `calca`, `forca`,
  `troca`)

## Known limitations

- The IME-USP list is explicitly "possibly incomplete"; e.g. `sabiá` (the bird)
  is absent, so the `sabia` collision set is `sabia`/`sábia` only. Harmless for
  gameplay (the normalized form is guessable either way) but canonical-map
  coverage of rare accent variants is only as good as the source lexicon.
  Membership gaps reported by players (issue #140: `áudio`, and a corpus
  sweep found `podre`, `letal`, `doces`, `tchau`, `dócil`… — 98 in all) are
  closed through `additions.txt` ([ADR-0062](../../docs/adr/0062-termo-guess-dictionary-gaps-close-with-curated-additions.md));
  the additions pass reviewed every missing normalized form with an
  aggregated corpus frequency ≥ 200, so remaining gaps are rarer than that
  or absent from the subtitle corpus.
- 5,408 validation words is at the low end of the 5k–15k target; term.ooo
  accepts more because it expands the full hunspell affix table. Swapping in a
  fully unmunched hunspell expansion later would only add rows, never break
  existing ones — ADR-0062 records why that expansion was not shippable
  offline when #140 was fixed, and leaves the door open.
- The obscenity/slur blocklist is hand-made (24 normalized forms, including the
  slur-strength `bicha` and `vadia`, of which 16 actually occur in the source
  lexicon and are excluded from validation); it was not
  audited against a comprehensive pt-BR profanity corpus.
- The lowercase proper-noun-duplicate list is likewise curated, not exhaustive:
  rarer names present in the source lexicon as lowercase entries may remain
  guessable. Answers are unaffected — all 400 were reviewed individually.
- "Average Brazilian adult recognizes instantly" was applied by model judgment,
  not by a measurable test; frequency rank (≥ ~5,400 subtitle occurrences) is
  the verifiable proxy.

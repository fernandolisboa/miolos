# Cruzadinha lexicon

The answer words and clues the Cruzadinha generator fills its 5×5 templates from ([ADR-0085](../../docs/adr/0085-cruzadinha-is-a-seeded-fill-from-a-curated-lexicon.md)). Answers match on the normalized form: lowercase, accents stripped, `ç`→`c`, a–z only, as in Termo ([ADR-0015](../../docs/adr/0015-termo-word-list-is-ai-curated-under-mechanical-constraints.md)).

## Files

| File | Contents |
|---|---|
| `lexicon.tsv` | Header `normalized	canonical	clue`, sorted by `normalized`. One clue per answer. Tab-separated because clues contain commas and quotes, never tabs. |
| `rejected.tsv` | Header `normalized	canonical	reason`, sorted. Candidates the curation pass turned down, each with one reason from a closed set: `proper-noun`, `foreign`, `obscene`, `abbreviation`, `obscure`, `archaic`, `regional`, `not-a-word`, `interjection`, `inflection`, `offensive`, `brand`, `unclueable`. |
| `candidates.py` | The deterministic candidate stage. Writes the gitignored `candidates.tsv` from the gitignored `sources/`. |

`lexicon.tsv` is rendered into `packages/games/src/crossword/lexicon.generated.ts` by `pnpm --filter @miolos/games generate:crossword`. `packages/games/test/crossword/lexicon.test.ts` fails when the two disagree. Turbo does not track `content/` as a test input, so run `pnpm test --force` after editing the lexicon.

## Sources and licences

1. **Spelling check:** LibreOffice VERO `pt_BR.dic` and `pt_BR.aff` (Projeto VERO, Raimundo Moura and contributors; `https://github.com/LibreOffice/dictionaries`), dual-licensed LGPLv3 and MPL-2.0. Used only through a Hunspell lookup (`spylls`) to keep correctly spelled forms, inflected ones included. No dictionary data beyond membership ships: `lexicon.tsv` is a selection of ordinary Portuguese words with clues written for Miolos.
2. **Frequency ranking:** hermitdave/FrequencyWords `pt_br_full.txt` (OpenSubtitles 2018), MIT code and CC-BY-SA-4.0 content. Used only to rank; no frequency ships.

Both are pinned by sha256 in `candidates.py`, so an upstream change fails the run instead of shifting the pool. IME-USP, Termo's source, is not reachable from the build environment.

## Pipeline

1. **Candidates** (`candidates.py`): lowercase words within the frequency top 60,000 that the VERO dictionary accepts and whose normalized form matches `^[a-z]{3,5}$`. The canonical is the most frequent spelling that normalizes to it. 5,610 candidates.
2. **Curation** (model judgment, not reproducible, as with Termo): each candidate is kept with one clue or rejected with one reason. A consistency pass then re-reads every kept row.

## Constraints

Answers, by curation:

- Common contemporary Brazilian usage. Function words are welcome, and so are common inflected forms: plurals, feminine forms and everyday verb forms. Rare tenses, *tu*/*vós* forms and enclitics are not.
- An inflected form is clued in the same form (a plural definition, or a fill-in such as "Eu ___ você"), never as "Plural de …" and never naming its lemma.
- No proper nouns, abbreviations, archaisms, narrow regionalisms, unassimilated foreign words, brands, obscenity or slurs.
- No word with a strong vulgar double meaning in Brazil, no pejorative about bodies, ethnicity or class, no weapons or violence, no heavy topics. This is a calm morning ritual.

Mechanical, enforced by the harness:

- `normalized` matches `^[a-z]{3,5}$` and is the normalized form of `canonical`. Rows are sorted and unique.
- A clue is at most 48 characters, starts with an uppercase letter or `___`, and has no terminal period.
- Clues are unique across the lexicon.
- No normalized clue token equals the answer. For answers of 4+ letters, no clue token starts with the answer. (A raw substring rule would ban `amarelo` for `mar`.)
- Per-length floors: 3 letters ≥ 220, 4 letters ≥ 1,050, 5 letters ≥ 2,850. They protect fillability. If one binds, widen the pool; never lower the floor.
- `rejected.tsv` uses only the closed reason set and shares no word with `lexicon.tsv`.

In the UI a clue is a **pista**, never a *dica*: *dica* is the Hint.

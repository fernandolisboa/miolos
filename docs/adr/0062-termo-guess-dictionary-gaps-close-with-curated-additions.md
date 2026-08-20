# ADR-0062 — Termo guess-dictionary gaps close with curated additions, not a hunspell expansion

**Status:** Accepted — 2026-08-20 (issue #140, shipped in #TBD)
**Depends on:** [ADR-0015](./0015-termo-word-list-is-ai-curated-under-mechanical-constraints.md)

## Context

"Áudio" was rejected as a guess (#140). Not an accent bug — `normalizeWord`
and `pipeline.py`'s `normalize` are pinned twins and both are correct — but a
membership gap: the IME-USP br.ispell lexicon is `validation.txt`'s sole
membership source, it is explicitly "possibly incomplete", and it lacks the
standalone noun *áudio*. A corpus sweep showed the gap is a class, not a
word: intersecting the OpenSubtitles frequency list (aggregated by normalized
form) against `validation.txt` and reviewing **every** miss with aggregated
frequency ≥ 200 found ordinary words the lexicon simply does not carry —
*podre*, *letal*, *doces*, *cacau*, *tchau*, *dócil*, *tripé*, *rímel*,
*cárie*, *atroz*, *varal*… — alongside naturalized loanwords (*golfe*,
*suíte*, *ninja*, *sushi*, *skate*, *drone*, *mouse*) and inflections the
"pre-expanded" list is missing (*doces*, *pegos*, *bifes*, *reage*).

`content/termo/README.md` already named the two candidate mechanisms: expand
the membership source with a full pt-BR hunspell unmunch, or curate an
additions file.

## Decision

1. **Gaps close through `content/termo/additions.txt`** — one canonical
   accented form per line, sorted by (normalized form, canonical), unique.
   `pipeline.py` merges the file as if its lines were base-lexicon entries:
   same normalization, same blocklist assertion, and a loud failure on any
   line the base lexicon already carries, so a future source refresh cannot
   silently duplicate curation. The proper-noun filters do not apply —
   every line being hand-reviewed is the mechanism's point. This is
   ADR-0015's curation-under-mechanical-constraints applied to the guess
   dictionary: the judgment is recorded (a reviewable file, one word per
   diff line), the invariants are machine-checked (pipeline asserts +
   `packages/games/test/termo/word-list.test.ts` pins every addition as
   shaped, sorted and guessable through the shipped `isValidGuess`).

2. **The admission criterion for this pass, recorded so the next pass can
   repeat it:** a candidate had to be corpus-attested (aggregated
   OpenSubtitles frequency ≥ 200 across its spellings), missing from
   `validation.txt`, and a real, current, inoffensive pt-BR word — dictionary
   lemmas and their inflections, plus loanwords only when Brazilian
   dictionaries register them (*hobby*, *lobby*, *jeans*, *mouse*, *shows*).
   Excluded even though frequent: everything already deliberately excluded
   (the blocklist and the proper-noun list stay binding — *merda*, *jesus*,
   *paris* stay out), foreign words that are not pt-BR entries (*happy*,
   *there*), pt-PT-only forms (*facto*), brand names (*fusca*, *miojo*),
   misspellings (*homen*), and vulgarity-adjacent editorial calls (*pornô*).
   98 words passed.

3. **The guess dictionary only.** `answers.csv` is untouched; additions flow
   into `candidates.tsv` like any lexicon entry but the answer list is a
   separate hand-curated artifact under ADR-0015 and no part of this
   mechanism edits it.

## Rejected

- **A full pt-BR hunspell/unmunch expansion as a second membership source**
  (the README's own first suggestion) — rejected *for now*, on feasibility,
  not on principle. The box has no `unmunch`, no `hunspell` binary and no
  Python hunspell bindings; pt_BR.aff is among the most complex affix files
  in the hunspell ecosystem, so a from-scratch expander could not be made
  deterministic and verifiable offline within this fix, and shipping it
  half-done would put unreviewed generated rows in the guess dictionary.
  It would also add a vendored dictionary under LibreOffice's pt-BR
  licence (MPL/LGPL — fine, but a licence note the README would owe) and a
  tooling dependency the "run from anywhere" pipeline does not have today.
  The door stays open: an unmunched expansion only adds rows, and
  `additions.txt`'s stale-line assertion already handles the overlap the
  day it lands.
- **Editing `validation.txt` by hand** — breaks the pipeline's
  regenerate-from-sources determinism; the next `pipeline.py` run would
  silently drop the edits.

## Consequences

- `validation.txt` grows 5 310 → 5 408; `canonical-map.csv` gains the same
  98 rows; `VALIDATION_COUNT` and the codegen output move with them.
  *áudio*/*audio* are accepted, and the marker word `zurro` is unaffected.
- Player-reported gaps now have a one-line fix with a visible diff, at
  Tier 0/1 weight, instead of a source-swap project.
- Deploy skew between `apps/web` and `apps/api` can briefly accept a new
  word on one side and 422 it on the other — anticipated and non-fatal per
  ADR-0038/ADR-0039, unchanged by this decision.
- Words rarer than the ≥ 200 corpus threshold (or absent from the subtitle
  corpus) can still be missing; the next report repeats this mechanism,
  not a new one.

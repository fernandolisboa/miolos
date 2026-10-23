# ADR-0147 — A Termo answer may return after 365 days

**Status:** Accepted — 2026-10-22 (issue #200)
**Depends on:** [ADR-0004](./0004-no-unpublished-puzzle-reaches-the-client.md), [ADR-0024](./0024-buffer-stores-validated-content-reads-strip-inside-the-wall.md), [ADR-0025](./0025-remote-config-is-a-database-table.md)
**Superseded in part by:** [ADR-0153](./0153-termo-answers-and-the-free-pool-split-the-common-words.md) (#427 PR B) — decision 3: the list is `answers.csv` less `excluded.txt`, 1,726 rows appended by frequency; decision 6 is fulfilled by `excluded.txt`'s `retired` reason; and the Consequences' `select_answers.py`, which is deleted.
**Supersedes in part:** [ADR-0040](./0040-the-termo-daily-stores-the-drawn-answer.md) — decision 4 ("used" means every row ever), decision 7's premise that the list ends, the Rejected *"Recycling the oldest answers"*, the Rejected partial unique index's *"the sanctioned fix"*, consequence (f)'s drain mode and consequence (g)'s bound; [ADR-0084](./0084-the-answer-list-alert-rides-the-buffer-depth-poll.md) — decision 1's count, decision 4's "about a year out" and the Consequences' clocks; [ADR-0114](./0114-termo-free-play-draws-from-a-pool-that-is-never-a-daily-answer.md) — the reserve; [ADR-0015](./0015-termo-word-list-is-ai-curated-under-mechanical-constraints.md) — the 400 target.

## Context

The 400 curated answers lasted about 13 months, and then Termo would go dark. Fernando's direction (2026-10-22): let answers repeat now, and move to a full pt-BR dictionary in a follow-up (#427). `select_answers.py` picked 626 words; 400 became answers and 226 sat in `reserve.txt`.

## Decision

1. **An answer is used when a termo row is dated on or after `today − 364`.** Killed, unpublished and future rows count. `TERMO_ANSWER_COOLDOWN_DAYS = 365` and `eligibleTermoAnswers(db, today)` live in `apps/api/src/publishing/service.ts`; `listUsedTermoAnswers(db, fromDate)` takes the window's first day.
2. **One window per run.** `topUpBuffer` reads `todaySaoPaulo` once and passes it to the run, so a run that crosses midnight keeps its window. `GET /buffer-depth` uses the same function.
3. **The list is all 626 picks.** The 226 reserve words were appended to `answers.csv` in the verified frequency order; the first 400 rows did not move.
4. **The reserve is retired.** Anyone can derive the whole list and rule out what the archive shows, but a buffered answer is drawn from words outside a window of at most 394 rows (decision 5), so it stays mixed with at least 232 others, above ADR-0114's floor of 100. `T-API-S346` pins `TERMO_ANSWERS.length − 394 ≥ 100`, with 394 derived from the cooldown and the `bufferDepth` cap. The list no longer ends, so it never narrows.
5. **Exhaustion and the low alert stay as tripwires.** The `(game, date)` key and `bufferDepth ≤ 30` cap the window at 364 + 30 = 394 rows, so at least 232 answers are always eligible. `T-API-S344` is a static test of that bound, not a value on the wire, so ADR-0084's "the total stays off the wire" holds. `termoAnswersRemaining` now means "eligible today"; its shape is unchanged.
6. **Answers and the free pool stay disjoint.** A future extension takes its words out of the pool. Re-curation never deletes a published answer from `answers.csv`, or it would re-enter the pool; this binds #427, which must re-introduce an exclusion list if it ever stops drawing a word.

## Consequences

- A word can be the daily twice, at least a year apart. Nothing keys on the word: records, the judge, completions, share text and OG cards all key on `(game, date)`.
- ADR-0040's partial unique index on `normalized` is no longer a fix for anything: under repeats it would refuse a legal row. The concurrent-writer residual ADR-0040 accepted is unchanged.
- `listUsedTermoAnswers` reads at most 394 rows, bounded by the date filter instead of the list size.
- The 226 rows were appended, byte-identical to what `select_answers.py` now emits (all 226 rank below the first 400); `candidates.tsv` and the frequency corpus are not committed, so it cannot run in CI.
- Killing a row no longer retires its word: a killed answer returns after 365 days. Stopping a word for good needs the exclusion list of decision 6 (#427).

## Rejected

- **Hiding the Termo tile when the list empties:** the list can no longer empty.
- **Preferring never-used or least-recently-used answers:** it narrows the candidates at the tail, which is the narrowing ADR-0004 and ADR-0114 forbid.
- **A window per target date:** it gains at most 29 days of earlier reuse and lets one run use two windows.
- **A migration or a unique index:** no schema change is needed.

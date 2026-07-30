# ADR-0015 — The Termo word list is AI-curated under mechanical constraints

**Status:** Accepted — 2026-07-30
**Depends on:** [ADR-0005](./0005-all-content-is-free.md)
**Amends:** [`docs/handoffs/001-handoff-project-foundation.md`](../handoffs/001-handoff-project-foundation.md) — the M2 note *"curadoria da lista de palavras corre em paralelo, é trabalho não-técnico"* and pendência não-técnica 3, both of which assumed hand curation by Fernando.

## Context

The founding handoff treated the Termo answer list as the owner's manual, non-technical task. It was never started and never sized, which made Termo's place in v1 an unnamed risk. When sizing it (2026-07-30), Fernando redefined the approach: he will not hand-curate content — **the list is produced by AI, end to end**, with quality enforced by explicit constraints and mechanical validation rather than by a human reading 400 words.

Two game-rule questions were settled at the same time because the list's shape depends on them.

## Decision

**Accent handling: matching is accent-insensitive.** The player types on a plain 26-key board; comparison happens after normalization (Unicode-decompose, strip combining marks, `ç`→`c`); tiles reveal the canonical accented spelling on completion. This is exactly term.ooo's behavior — what every Brazilian player already expects — and it keeps the full accented vocabulary (ação, sábio, ânimo) available instead of impoverishing the game to accent-free words.

**The list is AI-curated under written constraints:**

- **Target: 400 answer words** (13+ months of dailies) plus a validation dictionary of several thousand accepted guesses, both derived from openly licensed pt-BR lexicons with attribution recorded.
- Answer constraints, each stated so it can be checked: common contemporary Brazilian Portuguese; no proper nouns, abbreviations, archaisms or narrow regionalisms; no obscenities or slurs; lemma preference (singular nouns/adjectives, infinitives), common inflected forms only when extremely frequent; canonical accented spelling recorded per word; **no two answers share a normalized form** (sabia/sábia/sabiá is one answer slot, one canonical display).
- The validation dictionary is permissive where the answer list is strict: inflected forms and plurals are accepted guesses.
- **The M2 Termo ticket ships a validation harness** that proves the list's mechanical invariants (normalization shape, uniqueness, answers ⊆ validation set) as property-style tests before the list may feed the publishing cron — the same "proved, not sampled" bar `packages/games` generators carry.

A draft list is generated pre-M0 (tracked as issue [#7](https://github.com/fernandolisboa/miolos/issues/7)) so Termo's content risk is retired years before its milestone.

## Rejected

- **Hand curation (400 words by M2):** the owner declined the workload outright; keeping the plan would have made Termo's v1 slot a fiction.
- **Shrinking the target or dropping Termo to v1.1:** unnecessary once curation is automated.
- **Accents required on input / accent-free words only:** respectively hostile on mobile keyboards and a poorer game; neither matches the cultural reference.

## Consequences

- Termo stays in v1 with its risk retired early instead of named and carried.
- **Termo remains excluded from free play.** The original wording ("while the word list is hand-curated") loses its letter but not its point: the list is finite curated content regardless of who curated it, and free play would burn it.
- The judgment calls the AI makes (what counts as "common", what is obscure) are recorded as a constraint list plus a rejected-words sample alongside the list itself, so a bad word found later is fixed by tightening a constraint and regenerating — not by ad-hoc edits.
- The normalization function (strip-diacritics, `ç`→`c`) is game logic in `packages/games`, shared by matching, the list harness, and input handling — written once.

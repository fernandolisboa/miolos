# Miolos — Domain Glossary

The ubiquitous language. Issue titles, test names, proposals and specs use these terms exactly; don't drift to synonyms. Code and identifiers use the English term; the pt-BR term is what users see. Maintained by `/domain-modeling`; decisions behind the terms live in [`docs/adr/`](./docs/adr/).

| Term (code) | pt-BR (UI) | Meaning |
|---|---|---|
| **Daily** | Puzzle do dia | The one puzzle per game per day, identical for every user, published by the server. The unit of the ritual. |
| **Rollover** | Virada | Midnight `America/Sao_Paulo`, fixed for everyone. The only clock that matters; the client clock is never a source of truth. |
| **Published** | Publicado | Visible to clients: `published_at <= now()` through the single shared query helper ([ADR-0010](./docs/adr/0010-publication-is-time-driven-published-at-plus-buffer.md)). Unpublished rows exist server-side only ([ADR-0004](./docs/adr/0004-no-unpublished-puzzle-reaches-the-client.md)). |
| **Buffer** | — | The pre-generated, validated, future-dated `daily_puzzles` rows the cron keeps topped up. Monitoring watches its depth. |
| **Completion (on time)** | Conclusão | A daily solved during its own `America/Sao_Paulo` day. The only event that feeds the streak ([ADR-0008](./docs/adr/0008-completion-and-streak-semantics-across-play-modes.md)). |
| **Late completion** | Conclusão tardia | A past daily solved from the archive. Recorded, shown distinctly in the calendar; never feeds streak, distributions, time stats or Dia Perfeito. |
| **Played** | Jogado | Reached a terminal state without winning. Only Termo can end here; a lost Termo feeds the guess distribution's fail row and nothing else. |
| **Streak** | Sequência | Consecutive days with ≥ 1 on-time completion. Always derivable from completion rows; any stored value is a cache ([ADR-0009](./docs/adr/0009-account-merge-recomputes-from-the-union-of-completions.md)). Computed server-side only. |
| **Dia Perfeito** | Dia Perfeito | All four dailies completed on time on one day. A lost Termo forfeits it. |
| **Archive** | Arquivo | The public, indexable collection of past dailies, starting at the first production-published date. Route: `/arquivo/...` ([ADR-0013](./docs/adr/0013-canonical-domain-and-pt-br-routes.md)). |
| **Free play** | Modo livre | Infinite client-generated puzzles ([ADR-0011](./docs/adr/0011-free-play-is-generated-on-the-client.md)). Records nothing server-side. Termo excluded. |
| **Medal** | Medalha | One of 20–30 curated awards. Rule-derived medals recompute from history; curated grants are explicit rows. No XP, levels or ranking behind them. |
| **Hint** | Dica | One free per puzzle; extras arrive as day-scoped grants recorded server-side, expiring at rollover ([ADR-0006](./docs/adr/0006-monetization-convenience-not-access.md)). Never a balance. |
| **Attach** | Vincular e-mail | Adding an email to an anonymous account (prompted at streak ≥ 5). Recovery consent and reminder consent are separate ([ADR-0012](./docs/adr/0012-minimal-lgpd-ships-with-email-attach.md)). |
| **Merge** | — | Two anonymous accounts joining under one email: union of completions, dedupe per puzzle keeping the earliest, everything derived recomputed ([ADR-0009](./docs/adr/0009-account-merge-recomputes-from-the-union-of-completions.md)). |
| **Entitlement** | — | A string in `entitlements: string[]` (never a boolean). Dormant in v1. |
| **Normalized form** | — | A word after Unicode-decompose, strip combining marks, `ç`→`c`. Termo matching is accent-insensitive; tiles reveal the **canonical form** (correct accented spelling) on completion ([ADR-0015](./docs/adr/0015-termo-word-list-is-ai-curated-under-mechanical-constraints.md)). |
| **Motif** | — | An entry in the Nonogram picture library inside `packages/games`. Server-side only: never user-facing, and neither its name nor its id ever reaches a client payload. |
| **Reveal** | — | The withheld part of a Nonogram daily — which motif it is and how it is oriented. Stripped from every published projection; the client is served clues only. |
| **Picture** | Figura | What a solved Nonogram grid paints. The client-rendered payoff, shown on the conclusion screen. |
| **Filled** | Preenchida | A Nonogram cell the player painted: `filled`, encoded `1` on the wire. The filled set is what a completion is judged on. |
| **Crossed** | Marcada | A Nonogram cell the player ruled out: `crossed`, encoded `0`. Notation for the player, never a claim about the picture. |
| **Empty** | Vazia | An undecided Nonogram cell: `empty`, encoded `null` client-side. |
| **Clues** | Números | The run lengths on a Nonogram's row and column rails: `clues`, whose entries are `runs`. Never *dicas* or *pistas* — a **dica** is the one free hint. |

**Games** (v1, build order): **Binairo**, **Sudoku**, **Nonogram**, **Termo** — "Termo" is the product's name for its Termo-like game; don't call it Wordle.

**Terms to avoid:** "win streak" (streaks count completions, not wins — except that a lost Termo alone doesn't complete); "coins/points/XP" (vetoed concepts, [ADR-0006](./docs/adr/0006-monetization-convenience-not-access.md)); "premium content" (nothing is gated, [ADR-0005](./docs/adr/0005-all-content-is-free.md)); "Picross", "Griddler", "Hanjie", "paint-by-numbers" (the game is **Nonogram**); *dica* or *pista* for a Nonogram's clue rails (those are **números**; *dica* is the hint).

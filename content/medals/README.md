# Medal catalog — curation constraints and record

The 20–30 Miolos medals (issue #30), AI-curated under written constraints with
mechanical validation — the content-curation method
[ADR-0015](../../docs/adr/0015-termo-word-list-is-ai-curated-under-mechanical-constraints.md)
established for the Termo word list, scaled to a hand-sized catalog (ADR-0052
records the scaling argument: ~23 hand-authored records whose single source of
truth is the TypeScript module need no producer pipeline; what the method
actually requires — explicit constraints, mechanical invariants, a rejected
sample recording the judgment calls — ships in full below).

The catalog itself lives in code:
`packages/core/src/medals/definitions.ts` (ids and rules) and the pt-BR
copy in `apps/web/src/i18n/messages.ts` (`medalCopy`,
[ADR-0018](../../docs/adr/0018-i18n-is-an-in-repo-typed-message-module.md)).
This file is the constraints document and the audit record; the harness
(T-CORE-S70 in `packages/core/test/medals.test.ts`, T-WEB-S163 in
`apps/web/test/medals-content.test.ts`) mechanically enforces the rules below
on every test run. Prose here may be tightened; rules may not be weakened.

## Constraints applied

**Sources of truth.** A medal is earned from completion rows or from an
explicit `medal_grants` row — nothing else exists. Every rule-derived medal's
rule must be expressible in the `MedalRule` union
(`packages/core/src/medals/definitions.ts`); if a candidate needs a field the
union lacks, the candidate is rejected, never the union widened silently
(widening is an ADR-0052-touching decision).

**Category quotas (mechanically enforced, T-CORE-S70):**

| Category (rule kind) | Quota | Threshold constraints |
|---|---|---|
| `totalWins`, all games (`game: null`) | 4–6 | counts strictly increasing, first = 1 (the first-win medal), last ≤ 1000 |
| `totalWins`, per-game | 4–6 | every one of the four games appears in ≥ 1 medal; counts strictly increasing per game |
| `streakReached` | 4–6 | days strictly increasing, 3 ≤ days ≤ 365 |
| `perfectDaysReached` | 3–5 | counts strictly increasing, first = 1 |
| `termoGuessWins` | 3–4 | `guesses ∈ {1, 2, 6}` only — win-in-1 and win-in-2 are skill feats, win-in-6 is survival; guess values 3, 4 and 5 are the middle of the distribution — ordinary outcomes the stats screen already reports, not feats — and are inexpressible in the type |
| `eachGameWon` | exactly 1 | — |
| `curated` | 1–2 | no rule; earned only via `medal_grants` rows (`founder` ships; the cheater medal stays unshipped — no cheat detection exists to trigger the judgment) |
| **Total** | **20–30** | |

**The quota arithmetic, shown:** sum of minima = 4 + 4 + 4 + 3 + 3 + 1 + 1 =
**20**; sum of maxima = 6 + 6 + 6 + 5 + 4 + 1 + 2 = **30**. Both sums sit
inside AC 1's [20, 30], so no quota-satisfying catalog can violate the total.
The total is nonetheless **independently binding**: T-CORE-S70 asserts
`count ∈ [20, 30]` on its own line, because quotas bound the catalog, they
don't fix it, and the AC's number must not depend on arithmetic staying
correct across future quota edits.

**Anti-ladder threshold spacing (mechanical, T-CORE-S70):** within any counted
kind (per game where scoped, per guess value where scoped), each threshold is
**at least double its predecessor**. Feats are round, rare marks — 1, 7, 30,
100 — never consecutive ladder filler (no 3-then-4-then-5 rungs). This is the
mechanical half of the levels-veto defence; the display half follows.

**Why this catalog is not a levels system (the ladder defence, recorded here
and in ADR-0052):** what separates 20–30 milestone medals from XP-levels is
**invisibility of the unearned**. No locked medals, no greyed placeholders, no
progress meters, no "next tier" affordance, no remaining-count — the player
only ever sees earned facts, never a position on a scale (the nothing-at-zero
display rule is this rule's enforcement; the spacing rule above keeps the
thresholds themselves from forming visible rungs). A threshold catalog becomes
levels only when the interface shows the ladder.

**Naming & tone rules (pt-BR, mechanical where possible):**

- Names: sentence case, 2–28 characters, noun phrases; no exclamation or
  question marks; no emoji (`\p{Extended_Pictographic}` — mechanically
  checked); no digits-as-rank ("Nível 2"-shaped names forbidden); the
  stationery/notebook register is the house voice (carimbo, caderno, tinta,
  papel — encouraged, not required).
- Descriptions: one sentence, 20–120 characters, ends with a period, states
  the feat **precisely** — for any counted rule with threshold ≥ 2, the
  threshold (the `count`/`days` parameter) appears as digits in the
  description (mechanically checked against the rule params).
- **Mood (stated as a rule):** every description is a **past-tense statement
  of the achieved fact** — the medal records what happened; it never
  instructs, cheers, or points at future behaviour. Imperatives ("Vença…",
  "Mantenha…", "Acerte…", "Complete…", "Jogue…") are forbidden: only earned
  medals render, so an imperative reads as a to-do list of already-done
  things — the casino quest-log register PRODUCT.md excludes. Verbs come from
  CONTEXT.md's set (concluir/vencer, as shipped in messages.ts). Mechanically
  enforced (T-WEB-S163): each description's first word is drawn from the
  recorded past-tense allowlist in this README — initially
  **{Acertou, Chegou, Concluiu, Estava, Venceu}** — and extending the
  allowlist is a deliberate README + harness edit.
- Forbidden vocabulary anywhere in medal copy (mechanical regex,
  case-insensitive, word-bounded): `xp`, `nível`/`níveis`, `moeda(s)`,
  `ponto(s)`, `ranking`/`ranque`, `placar`, `troféu` — the vetoed-concepts
  list (CONTEXT.md, ADR-0006) plus the scoreboard words; **plus the recorded
  copy rejections:** `dias seguidos` (messages.ts's own recorded rejection —
  CONTEXT.md's noun is *sequência*, never "dias seguidos") and CONTEXT.md's
  Terms-to-avoid — `premium`, `Wordle`, `Picross`, `Griddler`, `Hanjie`,
  `paint-by-numbers`, and `dica(s)`/`pista(s)` (hints can never back a medal,
  so the words have no legitimate place in medal copy); and the three bundle
  canaries `então`, `mamãe`, `época`.
- Tone: adult, dry, quiet — the medal records a fact, it does not cheer. No
  urgency, no mockery of the player, no diminutives (-inho/-inha), no
  losing-rewarded medals.
- Ids: lowercase slugs `^[a-z0-9]+(-[a-z0-9]+)*$`, ≤ 64 chars (the DB CHECK's
  shape and the wire schema's shape), stable forever once shipped (an id is a
  wire value and a grant key — renaming copy is free, renaming an id is a
  migration of user data and is forbidden).

**Curated-grant candidates (the sanctioned classes):** the launch-window
founder medal — **shipped as a v1 definition** with its window (#37 decides
the launch instant; accounts with `created_at` before it), its procedure (the
documented one-shot bulk insert, ADR-0052), and its owner (#37's launch
checklist, an ADR-0052 written obligation) all named — the drop-unknown client
rule makes the bundled definition load-bearing, since a grant without it would
render nothing; the caught-cheater medal ADR-0006 keeps available (copy must
stay dry, not cruel; **not shipped in v1** — no cheat detection exists to
trigger the judgment; when it ships, its definition must precede its first
grant, same reason); the bug-reporter medal. v1 ships 1–2 curated definitions
from these classes.

## The catalog (23 definitions, curated 2026-08-13)

Catalog order is display order (no date exists on the wire to sort by —
ADR-0052). Every name and description is **[Fernando-adjustable]** in the PR;
ids are frozen the moment they ship.

| # | Id | Name (pt-BR) | Description (pt-BR) | Rule | Rationale |
|---|---|---|---|---|---|
| 1 | `first-win` | Primeiro carimbo | Venceu um jogo diário pela primeira vez. | totalWins, all games, 1 | The door-opener: the section exists only after a real feat, and the first win is the first honest fact. |
| 2 | `wins-10` | Dez vitórias | Venceu 10 jogos diários. | totalWins, all games, 10 | First round volume mark; ≥ 2× spacing from 1. |
| 3 | `wins-50` | Cinquenta vitórias | Venceu 50 jogos diários. | totalWins, all games, 50 | Sustained habit; 5× the previous mark. |
| 4 | `wins-100` | Cem vitórias | Venceu 100 jogos diários. | totalWins, all games, 100 | The round hundred — exactly double 50, the spacing floor. |
| 5 | `wins-500` | Meio milhar | Venceu 500 jogos diários. | totalWins, all games, 500 | Long-haul mark; last all-games threshold, ≤ 1000. |
| 6 | `binairo-30` | Trinta de Binairo | Venceu o Binairo diário 30 vezes. | totalWins, binairo, 30 | Per-game depth; a month's worth of wins in one game. |
| 7 | `sudoku-30` | Trinta de Sudoku | Venceu o Sudoku diário 30 vezes. | totalWins, sudoku, 30 | Same mark per game — parity across the four, no favourite. |
| 8 | `nonogram-30` | Trinta de Nonogram | Venceu o Nonogram diário 30 vezes. | totalWins, nonogram, 30 | Same. |
| 9 | `termo-30` | Trinta de Termo | Venceu o Termo diário 30 vezes. | totalWins, termo, 30 | Same. |
| 10 | `streak-3` | Três dias de tinta | Chegou a uma sequência de 3 dias. | streakReached, 3 | The habit's first foothold; the lower bound the quota table allows. |
| 11 | `streak-7` | Sequência de sete | Chegou a uma sequência de 7 dias. | streakReached, 7 | The full week — the streak the reminder opt-in anchors on. |
| 12 | `streak-30` | Um mês inteiro | Chegou a uma sequência de 30 dias. | streakReached, 30 | The month. |
| 13 | `streak-100` | Centena corrida | Chegou a uma sequência de 100 dias. | streakReached, 100 | The round hundred, uninterrupted. |
| 14 | `streak-365` | Um ano de caderno | Chegou a uma sequência de 365 dias. | streakReached, 365 | The year — the upper bound; nothing beyond it would be a feat, it would be a lifestyle audit. |
| 15 | `perfect-1` | Quatro de quatro | Concluiu um Dia Perfeito: os quatro jogos no mesmo dia. | perfectDaysReached, 1 | The product's own defined feat (CONTEXT.md: Dia Perfeito), first occurrence. |
| 16 | `perfect-5` | Mão firme | Concluiu 5 Dias Perfeitos. | perfectDaysReached, 5 | Repeatable mastery, not a fluke. |
| 17 | `perfect-10` | Caderno caprichado | Concluiu 10 Dias Perfeitos. | perfectDaysReached, 10 | Exactly double 5. |
| 18 | `perfect-30` | Trinta sem borrão | Concluiu 30 Dias Perfeitos. | perfectDaysReached, 30 | The deep mark; stationery register (a notebook with no blot). |
| 19 | `termo-first-try` | De primeira | Acertou o Termo na primeira tentativa. | termoGuessWins, 1 guess, 1× | The luck-and-vocabulary lightning strike; once is the feat. |
| 20 | `termo-in-two` | Dez na segunda | Acertou o Termo na segunda tentativa 10 vezes. | termoGuessWins, 2 guesses, 10× | Win-in-2 once is common; ten times is skill. |
| 21 | `termo-last-guess` | Por um fio | Acertou o Termo na última tentativa. | termoGuessWins, 6 guesses, 1× | Survival — the last-guess save is a story, not a statistic. |
| 22 | `all-games` | Circuito completo | Venceu cada um dos quatro jogos ao menos uma vez. | eachGameWon | Breadth: the whole product visited and beaten. |
| 23 | `founder` | Da primeira leva | Estava aqui quando tudo começou. | curated | Launch-window founder grant (#37 decides the instant; the one-shot bulk insert is documented in ADR-0052). |

**Quota check against the table:** all-games totalWins 5 ∈ [4, 6] (1, 10, 50,
100, 500 — strictly increasing, first 1, last ≤ 1000, each ≥ 2× its
predecessor); per-game totalWins 4 ∈ [4, 6] (all four games, one mark each);
streakReached 5 ∈ [4, 6] (3, 7, 30, 100, 365 — in [3, 365], each ≥ 2×);
perfectDaysReached 4 ∈ [3, 5] (1, 5, 10, 30 — first 1, each ≥ 2×);
termoGuessWins 3 ∈ [3, 4] (guesses 1, 2, 6 — one per guess value);
eachGameWon 1; curated 1 ∈ [1, 2]. **Total 23 ∈ [20, 30].**

## Rejected candidates (the judgment record, ≥ 10 rows)

The audit record the ADR-0015 method requires — candidate → reason,
tab-separated in spirit:

- *Sem dicas* ("solved without hints") → `hints_used` is self-reported;
  ADR-0027 forbids it backing a medal until a server-computed path exists.
- *Relâmpago* ("solved under 2 minutes") → `elapsed_ms` is self-reported, same
  class; handoff 034 §5 binds both.
- *Madrugador / Coruja* (time-of-day) → not in `StatsRow`; would require new
  data collection.
- *Fim de semana perfeito* (day-of-week set) → same; and calendar-partition
  feats reintroduce run-shaped arithmetic by the back door.
- *Dias Perfeitos seguidos* → ADR-0051 rejected run-length over perfect days;
  the streak is the product's one run.
- *Arquivista / 100 do arquivo* → provably always zero until #31 writes late
  rows; #31 may add it (additive).
- *Maratonista do modo livre* → free play records nothing server-side
  (ADR-0008 rule 5) and is walled from medals by user story 39.
- *Perdeu 10 Termos* → a medal never rewards losing (tone rule).
- *Veterano* ("account 1 year old") as rule-derived → account age is not a
  completion fact; the founder class exists as a *curated* grant instead.
- *Nível dourado / Colecionador de pontos* → vetoed vocabulary;
  medal-as-currency framing (ADR-0006).

## Mechanical validation (the harness invariants)

Enforced by **T-CORE-S70** (`packages/core/test/medals.test.ts`, pure, over
the definitions module): count ∈ [20, 30] (independently of quotas); ids
unique and slug-shaped ≤ 64; every `rule.kind` ∈ the sanctioned discriminant
set (deep-equal on the set — adding a kind is a deliberate test edit); no two
rule-derived definitions with structurally identical rules; per-kind quotas
per the table above; threshold monotonicity **and the ≥ 2× anti-ladder
spacing** per kind/scope; every game represented in per-game volume; curated
count ∈ [1, 2]; rule params in bounds (counts ≥ 1, `days ∈ [3, 365]`,
`guesses ∈ {1, 2, 6}`).

Enforced by **T-WEB-S163** (`apps/web/test/medals-content.test.ts`, reading
this README via `node:fs` — homed in `apps/web/test` because `packages/core`
deliberately has no `@types/node`; the games word-list harness is the
file-reading precedent): every `MedalId` appears in this README's catalog
table and vice versa; the rejected sample has ≥ 10 entries; every `medalCopy`
name/description passes the mechanical rules above (lengths, no emoji, no
exclamation in names, the forbidden-vocabulary regex including the recorded
copy rejections, canary words, the past-tense first-word allowlist,
threshold-digits parity against the rule params imported from `@miolos/core`).
Exhaustiveness of `medalCopy` over `MedalId` is the `satisfies` typecheck, not
a runtime test.

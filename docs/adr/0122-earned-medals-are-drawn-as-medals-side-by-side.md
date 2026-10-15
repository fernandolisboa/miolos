# ADR-0122 — Earned medals are drawn as medals, side by side

**Status:** Accepted — 2026-10-15 (issue #360)
**Depends on:** [ADR-0041](./0041-accents-colour-shapes-never-words.md), [ADR-0087](./0087-dia-perfeito-counts-the-dailies-published-that-day.md)
**Supersedes in part:** [ADR-0052](./0052-medals-are-derived-facts-plus-curated-grants.md) decision 8's display idiom: *"rows in a list, never a tile grid"*, *"a uniform `--accent-app` stamp-ring mark"*, *"description in `--ink-2`"* and *"single column at every width"*. The rest of decision 8 and the whole Rejected list stay in force.

## Context

Fernando looked at `/estatisticas` and said the medals "não remetem a nada de medalhas": a column of empty rings with a name and a sentence each. He asked for real medal drawings, side by side, the name visible and the detail only on hover. ADR-0052 had chosen rows to stay away from two anti-references: the rounded icon tile above every heading, and gamification chrome.

## Decision

1. **Each earned medal is an SVG medal**: a V ribbon and a paper disc with a 3 px ring in the ribbon's accent, a hard offset shadow (blur 0) and a static tilt. The centre is `--ink`: the rule's threshold as a Fraunces italic numeral, the ordinal guess (`1ª 2ª 6ª`) for the Termo feats, a 2×2 of the original four games' accents for `all-games`, an ink star for a curated grant.
2. **The art is computed from the rule** (`artOf` in `apps/web/src/medals/art.ts`, an exhaustive switch on `MedalRule.kind`), never from a per-id table. The ribbon is the app accent, a game's accent for a per-game total, or Termo's for the Termo feats. Families differ by ribbon stripes. `ORIGINAL_GAMES` is exported from `@miolos/core` and drives the `all-games` colours. The tilt comes from the medal's place in the catalog, so earning one medal never turns another.
3. **Medals sit in a wrapping row on the page paper, with no tile**: no card, border or background per medal. That is what keeps it clear of the anti-reference.
4. **The name is visible; the description is a tooltip.** It opens when a mouse enters, on keyboard focus and on tap (a tap toggles it); Escape, blur, leaving and an outside tap close it. The open/close logic is `useTip` (`apps/web/src/play/use-tip.ts`), extracted from `InfoTip`, which now uses it too. The 200 ms wait is CSS: the tip stays `visibility: hidden` for its first 200 ms, so `InfoTip`'s routes carry no timer code (`/modo-livre/nonogram` sits at its budget). A tip that would overflow the viewport is shifted back inside it. No dialog: without an earned date or progress (both rejected by ADR-0052) it would only repeat the tooltip.

## Consequences

- PRODUCT.md says the interface never borrows gamification's visual language. A ribbon medal for a fact the player already achieved is a keepsake, not a ladder: ADR-0052's ladder defence still holds, and still shows no locked, greyed or upcoming medals, no count and no progress.
- The medal section moved to `apps/web/src/medals/medals-section.tsx`; `stats-view.tsx` renders it in the same slot.

## Rejected

- **A dialog on click.** It has nothing to add beyond the tooltip, and PRODUCT.md §3 rules out a modal takeover.
- **Bronze, silver and gold by threshold.** That would draw the ladder ADR-0052 decision 8 forbids.

# Do I need to do anything?

**No.** [`docs/pending-fernando.md`](./docs/pending-fernando.md) still holds one ⚡ decision, low urgency by ~13 months. To work through the ledger: start a session with *"run /wizard over docs/pending-fernando.md, NOW section"*.

## Start here

Nothing to verify. #206 clusters 5, 6 and 14 merged.

## Session state

**Cluster 6.** One `src/play/screen-chrome.tsx` now owns the five named grid areas of `play/screen.module.css` for nine composition shapes — the three daily grid play views, their skeletons, and free play's three screens, which share one `free-play/chrome.tsx` over it. Six source files went 1,660 → 1,017 lines; net production **−349**. Termo is excluded by the compiler (`game: Exclude<Game, "termo">`), not by prose, and priced in **ADR-0077**, which amends ADR-0029 decision 2 and consequence (b).

**Zero rendered delta, proved not argued.** `renderToStaticMarkup` over 31 shapes — every archive-note, nonogram-size-5, hint and free-play-phase variant — is byte-identical against `main`, md5 `11224528d82bf228f9a62fb1361a417d` both sides, with zero `aria-hidden="false"` and zero `undefined`. The `aria-hidden` asymmetry between the daily skeleton and free play was **preserved**, not tidied: the skeleton hides the whole `.statsCard`, free play hides each blank readout. Both are correct; unifying them is a behaviour change and a different ticket.

**`bundle-check` is the only gate that measures this**, and it is not in CI (#155). Chunk attribution is unchanged at 32 daily / 3 free-only / 6 unattributed, every ADR-0033/ADR-0047 marker `ok`. Free-play routes grew ~1.5 KB raw, daily routes shrank ~0.6 KB; every budget green.

## The lesson — a test that restates a wall is a wall with a hole in it

**`T-WEB-S368` took three rounds to become true, and each round's prose claimed more than the test delivered.** It first hand-copied 18 module paths out of `eslint.config.mjs`'s 13 ban groups, so `../streak/streak-client` in the chrome was silent everywhere. Rewritten to lint the closure through the real config, it then missed two *specifier shapes* it never produced: the deep-relative `../../../../packages/games/src/termo/word-list` — which walks past every ban written against `@miolos/games/termo` and would ship the answer list on `/modo-livre/*` — and any `.module.css`, which `closureOf` does not follow. Both are closed, and the deep-relative Termo path is now banned app-wide in `webWallImportPatterns` beside the existing `packages/db/src` and `packages/core/src` groups, because detecting a hole in one test is weaker than closing it everywhere. **Games-wide would have been the tidier rule and is deliberately not what shipped**: it reds `T-LINT-S58`'s control, the probe that proves the Termo ban is Termo-specific rather than a blanket games ban, and re-founding three other tickets' wall assertions does not belong in this one.

**The open half, on the record:** the chrome is not special. Twenty-one `apps/web` modules sit on both the daily and the free-play route graphs — `nonogram/state.ts`, `play/grid-hint.ts`, `nonogram/board.tsx` among them — every one of them is the same one-hop bypass, and only the chrome has a test. Extending that guard is unclaimed work.

Four assertions in the same file were written and found dead by mutation before merge — `pageModifier`, the hint's `className`, the accent `style`, and the extra stat's `className`, each deletable from the chrome with the full suite green. All four read `textContent` or a tag name where the thing that mattered was an attribute.

## Next

**#206 cluster 7** — 321 lines (not 640).

**Also queued:** #254 (the remote conclusion announces its body sentence twice — `.announcer` is `clip-path`-hidden, so a screen reader gets it on mount and again in browse mode), #201 (import walls walked by a mid-path `..`), #205's CSS half (~1,820 lines, NOT a sweep), #155 (`bundle-check` into CI), the `jsonResponse`/`stubFetch` Quick change, and the free-play wall's missing `**/termo/termo-screen` — the other three screen roots are walled and Termo's is not.

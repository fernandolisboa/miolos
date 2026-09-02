# Do I need to do anything?

**No.** [`docs/pending-fernando.md`](./docs/pending-fernando.md) still holds one ⚡ decision, low urgency by ~13 months. To work through the ledger: start a session with *"run /wizard over docs/pending-fernando.md, NOW section"*.

## Start here

Nothing to verify. #206 clusters 5, 6 and 14 merged.

## Session state

**Cluster 6.** One `src/play/screen-chrome.tsx` now owns the five named grid areas of `play/screen.module.css` for nine composition shapes — the three daily grid play views, their skeletons, and free play's three screens, which share one `free-play/chrome.tsx` over it. Six source files went 1,660 → 1,017 lines; net production **−349**. Termo is excluded by the compiler (`game: Exclude<Game, "termo">`), not by prose, and priced in **ADR-0077**, which amends ADR-0029 decision 2 and consequence (b).

**Zero rendered delta, proved not argued.** `renderToStaticMarkup` over 31 shapes — every archive-note, nonogram-size-5, hint and free-play-phase variant — is byte-identical against `main`, md5 `11224528d82bf228f9a62fb1361a417d` both sides, with zero `aria-hidden="false"` and zero `undefined`. The `aria-hidden` asymmetry between the daily skeleton and free play was **preserved**, not tidied: the skeleton hides the whole `.statsCard`, free play hides each blank readout. Both are correct; unifying them is a behaviour change and a different ticket.

**`bundle-check` is the only gate that measures this**, and it is not in CI (#155). Chunk attribution is unchanged at 32 daily / 3 free-only / 6 unattributed, every ADR-0033/ADR-0047 marker `ok`. Free-play routes grew ~1.5 KB raw, daily routes shrank ~0.6 KB; every budget green.

## The lesson — a hand-copied list is a wall with a hole in it

**`T-WEB-S368` first hand-copied 18 module paths out of `eslint.config.mjs`'s 13 ban groups.** The security lens added `import { fetchStreak } from "../streak/streak-client"` to the chrome and **nothing** reported it — not eslint, because `no-restricted-imports` is attached to `free-play/**` and the chrome is not there; not the suite, because `**/streak/**` was one of the twelve groups the copy omitted. The test now feeds every specifier in the chrome's closure through **the real config** at a free-play path, so a group added later is covered without touching the test. The general form: *when a test restates a config, it dates from the moment it is written.*

Four more assertions were written and found dead by mutation before merge — `pageModifier`, the hint's `className`, the accent `style`, and the extra stat's `className`, each of which could be deleted from the chrome with the full suite green. All four read `textContent` or a tag name where the thing that mattered was an attribute.

## Next

**#206 cluster 7** — 321 lines (not 640).

**Also queued:** #254 (the remote conclusion announces its body sentence twice — `.announcer` is `clip-path`-hidden, so a screen reader gets it on mount and again in browse mode), #201 (import walls walked by a mid-path `..`), #205's CSS half (~1,820 lines, NOT a sweep), #155 (`bundle-check` into CI), the `jsonResponse`/`stubFetch` Quick change, and the free-play wall's missing `**/termo/termo-screen` — the other three screen roots are walled and Termo's is not.

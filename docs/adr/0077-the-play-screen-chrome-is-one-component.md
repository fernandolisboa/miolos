# ADR-0077 — The play screen's chrome is one component, for nine composition shapes

**Status:** Accepted — 2026-09-02
**Depends on:** [ADR-0002](./0002-plain-react-web-ui-not-universal-rn-web.md), [ADR-0028](./0028-daily-play-routes-and-the-conclusion.md), [ADR-0029](./0029-shared-daily-play-layer-in-apps-web-src-play.md), [ADR-0045](./0045-the-termo-screen-ships-no-hint-and-no-clock.md), [ADR-0047](./0047-bundle-markers-are-route-scoped.md), [ADR-0076](./0076-the-shared-route-envelope-takes-a-render-callback-not-a-screen-registry.md)
**Amends:** [ADR-0029](./0029-shared-daily-play-layer-in-apps-web-src-play.md) decision 2 and consequence (b)

## Context

`play/screen.module.css` places `.page`'s children by five named grid areas — `bar`, `title`, `stats`, `board`, `hint`. That JSX contract was satisfied by hand in 11 compositions across 7 files with nothing enforcing it; #95 moved four together and #133 moved six together for one fix. `free-play/*-free-screen.tsx`'s `Frame` already *was* this component — data props, one `children` slot, a null discriminant — written three times, 110–116 lines each, with 14–16 differing lines between any two. ADR-0029 decision 2 lists "the play composition and its skeleton, the screen root" as per game, and rejected a `<PlayShell>` taking board, controls, hint, timer and copy as **node props**.

## Decision

One `PlayScreenChrome` in `apps/web/src/play/screen-chrome.tsx` for nine composition shapes: the three daily grid play views, their three skeletons, and free play's three screens. Data props plus exactly one `children` slot; no board, controls, timer or hint node crosses the boundary, and the module imports no per-game module — ADR-0076's rule, satisfied the same way its `render` callback satisfies it. The clock is one three-state prop (`"none" | "blank" | { elapsedMs }`) because ADR-0045 already made the clock an axis of this chrome, and a per-family boolean would be the game discriminator SOLID forbids.

**The amended boundary rule:** the shared layer holds the non-visual modules, the shared stylesheets, *and the game-agnostic page frame those stylesheets' grid areas define*; the board, its input model, the per-game geometry stylesheet and all per-game copy stay per game.

## Rejected

- **All eleven — Termo too.** Termo needs three further axes (progress in the bar not the title row, one stat row, no clock) plus a fourth hint state, "absent" as distinct from "placeholder". ADR-0045 already decided it takes almost none of this chrome. Price: its two compositions stay hand-written and a #133-class edit is 2 files, not 1. The exclusion is compiler-enforced — the chrome's `game` is `Exclude<Game, "termo">`, so `game="termo"` does not typecheck.
- **The daily six only.** Price: a fourth implementation of a component that already exists three times, and a 5-file residual.
- **Unifying the `aria-hidden` asymmetry while moving.** Forbidden by ADR-0029's closing consequence: the extraction is a move, not a rewrite. Its own ticket, or not at all.
- **The `<PlayShell>` of ADR-0029.** Five node props, no ownership. Not this.

## Consequences

- The `aria-hidden` asymmetry is preserved exactly. The daily skeleton hides the whole `.statsCard`, so no child carries its own attribute; free play leaves the card exposed and hides each blank readout instead. Both are correct for assistive tech, and unifying them is a behaviour change on six compositions. This is the module's only comment, and `T-WEB-S367` pins all five conditions — asserting the attribute **absent**, never `"false"`.
- **This is the first client module on both the daily and the free-play route graphs.** `apps/web/scripts/route-client-js.mjs` derives `freeOnlyChunkSet` by subtracting `dailyChunkSet` and scans unattributed chunks as daily against `FORBIDDEN_DAILY_SCOPE` — the ADR-0033/ADR-0047 motif-leak guard. That attribution is the only thing measuring this change and it is not in CI (#155), so it is run before and after any edit to this module.
- Reciprocal `Amended by:` on ADR-0029, an in-place note at its decision 2, and an annotation on ADR-0076's closing consequence, all in this PR. ADR-0029 decisions 1 and 3–7 and consequence (b)'s second sentence are untouched.
- Compositions: 11 in 7 files → 3 in 2 files. A #133-class edit becomes a 2-file change. Free play's three screens share one `free-play/chrome.tsx` over the chrome, so the shape is written once, not four times; the nonogram page modifier, which the daily view and the free screen must change together, is one `nonogram/page-class.ts`.
- **The chrome is a one-hop bypass of the free-play wall, and lint cannot see it.** `no-restricted-imports` is attached to `apps/web/src/free-play/**` and `app/modo-livre/**`; the chrome is under neither, so a banned module imported *here* reaches free play with `pnpm lint` silent. `T-WEB-S368` is the only thing that fails, and it derives its list from `freePlayBannedModuleGroups` rather than naming modules, so a group added to the config is covered without touching the test. `play/types` is the near miss the shape invites: it opens on `import type { PlayRecord } from "./play-record"`, and `PlayChromeBack`/`PlayChromeNote` are declared locally even though they are structurally `ArchivePlayChrome["back"]` and `["note"]`.
- This is not free play's first reach into `play/`: `free-play/solved-card.tsx` already imports `../play/types` and `binairo/state.ts` imports `../play/play-record`, both `import type`, both erased at build, and both already on all three `/modo-livre/*` closures. The rule the chrome must keep is about **runtime** reach, and `T-WEB-S368` measures the specifiers, not the erasure.

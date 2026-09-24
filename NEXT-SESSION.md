# Do I need to do anything?

**No.** [`docs/pending-fernando.md`](./docs/pending-fernando.md) still holds one ⚡ decision, low urgency by ~13 months. To work through the ledger: start a session with *"run /wizard over docs/pending-fernando.md, NOW section"*.

## Start here

Nothing to verify. #206 clusters 5, 6, 7 and 14 merged. Cluster 7 moved the four roots' claim-pause effect into `usePlayLifecycle` and did **not** build the issue's `useDailyScreenState` phase union: the ladders differ per game, so it would have saved nothing.

## Session state

**Cluster 6.** One `src/play/screen-chrome.tsx` now owns the five named grid areas of `play/screen.module.css` for nine composition shapes — the three daily grid play views, their skeletons, and free play's three screens, which share one `free-play/chrome.tsx` over it. Six source files went 1,660 → 1,017 lines; net production **−349**. Termo is excluded by the compiler (`game: Exclude<Game, "termo">`), not by prose, and priced in **ADR-0077**, which amends ADR-0029 decision 2 and consequence (b).

**Zero rendered delta, proved not argued.** `renderToStaticMarkup` over 31 shapes — every archive-note, nonogram-size-5, hint and free-play-phase variant — is byte-identical against `main`, md5 `11224528d82bf228f9a62fb1361a417d` both sides, with zero `aria-hidden="false"` and zero `undefined`. The `aria-hidden` asymmetry between the daily skeleton and free play was **preserved**, not tidied: the skeleton hides the whole `.statsCard`, free play hides each blank readout. Both are correct; unifying them is a behaviour change and a different ticket.

**`bundle-check` is the only gate that measures this**, and it is not in CI (#155). Chunk attribution is unchanged at 32 daily / 3 free-only / 6 unattributed, every ADR-0033/ADR-0047 marker `ok`. Free-play routes grew ~1.5 KB raw, daily routes shrank ~0.6 KB; every budget green.

## The lesson — a test that restates a wall is a wall with a hole in it

**A test derived from a wall must take every specifier its subject's closure *writes*** — not a hand-copied list of modules, and not only the specifiers that stay inside `apps/web/`. `T-WEB-S368` lints the chrome's closure through the real `eslint.config.mjs` at a free-play file path, so the whole config applies. Two specifier shapes are the ones a narrower rule never produces and both are load bearing: the deep relative path `../../../../packages/games/src/termo/word-list`, which walks past every ban written against `@miolos/games/termo` and would ship the answer list on `/modo-livre/*`, and any `.module.css`, which `closureOf` does not follow but the wall still matches by string. The deep Termo path is now also banned across `apps/web` in `webWallImportPatterns`, beside `packages/db/src` and `packages/core/src`: detecting a hole in one test is weaker than closing it everywhere.

**The open half, on the record:** the chrome is not special. Intersecting the three daily play routes' closures with the three free-play ones gives **29** `apps/web/src` modules, 26 of them before this ticket. The wall applies to exactly one — `free-play/catalog.ts`, which lives under `free-play/` — and to none of the other 28, so each of those is a one-hop route into free play that `pnpm lint` cannot see. Only the chrome has a test. Extending that guard to the other 27 is unclaimed work.

**An assertion that reads `textContent` or a tag name cannot see an attribute**, and a component's identity mostly lives in attributes: `pageModifier`, the hint's `className`, `style={ACCENTS[game]}` and the extra stat's `className` were each deletable from the chrome with the full suite green until the reader was changed to look at the attribute that carries them.

## Dependabot npm PRs cannot be merged as opened

next 16.3.5, sharp 0.35.4 and vitest 4.1.11 landed in one PR that superseded Dependabot #259–#262. Dependabot's npm PRs here change one `package.json` and never `pnpm-lock.yaml`, so `--frozen-lockfile` fails, and they bump a package in only one of the workspaces that pin it. Land them as one hand-made bump across every pin, and stay outside `minimumReleaseAge` (7 days): `pnpm install` refuses anything newer.

## Next

**#206 cluster 8** — the four `topUp*Buffer`s in `apps/api`. Re-derive the audit's numbers first, as clusters 1, 4 and 7 had to.

**Also queued:** the Binairo `validate.test.ts` uniqueness property has no explicit timeout, and it hit the 5 s default under CI load on #264 (about 530 ms locally; the sibling property tests in `binairo/generate.test.ts` carry `25_000`), #254 (the remote conclusion announces its body sentence twice — `.announcer` is `clip-path`-hidden, so a screen reader gets it on mount and again in browse mode), #201 (import walls walked by a mid-path `..`), #205's CSS half (~1,820 lines, NOT a sweep), #155 (`bundle-check` into CI), the `jsonResponse`/`stubFetch` Quick change, and the free-play wall's missing `**/termo/termo-screen` — the other three screen roots are walled and Termo's is not.

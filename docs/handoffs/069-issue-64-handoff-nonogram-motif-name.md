# Handoff 069 — #64 shipped: the Nonogram conclusion names its picture

Session of 2026-08-21/22. Was filed as "Addendum A" on handoff 063; moved to
its own file on 2026-08-22 because a session closes with its own numbered
handoff, and an addendum is only for correcting what its handoff already
says.

**State at close:** `main` = `69e4d35`, PR #188, #64 closed. Nothing pended
on Fernando. *(The frontier below has since moved on — #104 shipped too. The
live handoff is [070](./070-issue-104-handoff-archive-og-cards.md).)*

**#64 is closed.** The daily Nonogram conclusion names its motif. Steps 5–8
ran from plan `docs/plans/066`; **ADR-0070** shipped, superseding ADR-0033
decision 1's name clause in part and annotating ADR-0033/0046/0047/0060/0065
in place. Frontier is now **#104 → #149 → #155 → #106 → #74**, plus #32's
email-hedge slice.

## The shape, in one paragraph

`motifName`, optional, on the `/day` per-game claim — ADR-0065 decision 2's
`hintsUsed` template. Post-completion **by construction**: a claim is a
projection of the user's own completion rows, so the name cannot exist on a
claim before the server judged their day. Read by
`getPublishedNonogramMotifName` on `@miolos/db/publishing` only. Rendered on
the in-place conclusion and `/nonogram/concluido`, composed once in
`nonogram-conclusion.tsx` so `ConclusionView` stays game-blind.

## Two calls that contradict instructions — both STANDING in the ledger

1. **The bundle tripwire was KEPT, not spent.** ADR-0033 consequence (d)
   predicted the grep dies the day a name ships. It was about the wrong
   thing: the grep scans `.next/static/chunks` only, and an API response is
   never a chunk. `bundle-check` is pasted in #188 proving it still armed
   **with the name live**. Warrant rewritten, markers untouched.
2. **The caption's copy register is the shipped card's**, not Fernando's
   illustrative "Você revelou: Âncora" — impersonal kicker, second person in
   the aria. Agent's call under CLAUDE.md; recorded, not asked.

Both are rows in `docs/pending-fernando.md` § STANDING. **NOW stays empty.**

## What the six lenses caught, and the two lessons worth carrying

Four blocking findings. The two that no amount of re-reading would have
found, both proved by **mutation**:

- **A test that did not test its feature.** `T-WEB-S329` stayed green with
  the refresh trigger deleted outright — it asserted a count "between 1 and
  2" (a range admitting zero) over a scenario where the nudge is *provably*
  deduped away by hook ordering. **Lesson: a range assertion whose lower
  bound is the pre-feature value is not a test.**
- **A source scan blind over 515 of 1478 lines.** Stripping block comments
  before line comments lets a `/*` inside a line comment open a block that
  runs to the next real close — and this repo writes `src/day/**`-style
  globs in prose constantly. **Lesson: comment-stripping for a source scan
  needs a character scanner, not two regexes.** Both are now recorded in the
  code that carries them.

Also: `T-DB-S86`'s game-scope assertion was vacuous (the *parse* was doing
the scoping, not the wall — a wrong-game row with parseable content is the
only fixture that proves it), and `trim()` does not strip U+200B/U+FEFF, so
a hand-edited row could have rendered an invisible name under a visible
lead.

## Landmines this session added or confirmed

- **`play-sync.test.ts`'s teardown test is a load flake**, not a defect: it
  failed alone on a PR touching neither it nor `src/play/sync.ts`, green on
  re-run and on every local run. Six real `setTimeout(…, 0)` turns race a
  2 s backoff ladder — an implicit budget is still a budget. Recorded by
  **widening** napkin § Execution 3 rather than adding a tenth item; its
  ownership clause says fix it in the ticket that owns it, never in the PR
  whose gate surfaced it.
- **ADR filenames must be read off disk, never recalled.** ADR-0070 shipped
  with seven dead links from five plausible-but-wrong slugs, and it was the
  only file in the repo with a broken ADR link. `grep -oE '\]\(\./[0-9]{4}-[a-z0-9-]+\.md\)'`
  + an existence check is the whole cure.
- **The solved conclusion is not URL-reachable**, so `impeccable detect`
  cannot see it (needs a solved day; a clean profile's `/day` 401s —
  ADR-0065 consequence (c)'s precedent). The `file://` component fixture
  does **not** reproduce the page: fonts do not resolve and the grid does
  not lay out, so it reports occlusions on the unmodified control too. Use
  it for a control diff and screenshots, never as the gate. Where a rule is
  data-dependent, pin it mechanically instead — `all-caps-body` over the
  growing motif library is `T-WEB-S330` + `packages/games/…/name-length`.

## Records worth knowing about

- Test-id frontier updated and #64's six unspent tails burned. Live maxima:
  `T-CORE-S114`, `T-DB-S87`, `T-API-S179`, `T-WEB-S330`, `T-LINT-S53`.
- `docs/evidence/64-motif-name/` holds before/after screenshots at both
  viewports and a README stating plainly what the fixture does **not**
  prove.
- The step-8 issue comment on #64 is the durable record of the three calls.

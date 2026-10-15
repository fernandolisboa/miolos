# ADR-0115 — The bundle check runs in the CI gate

**Status:** Accepted — 2026-10-14
**Supersedes in part:** [ADR-0027](./0027-the-hint-is-computed-on-the-client.md), [ADR-0033](./0033-the-nonogram-reveal-ships-no-name.md), [ADR-0045](./0045-the-termo-screen-ships-no-hint-and-no-clock.md), [ADR-0076](./0076-the-shared-route-envelope-takes-a-render-callback-not-a-screen-registry.md), [ADR-0077](./0077-the-play-screen-chrome-is-one-component.md), [ADR-0088](./0088-cruzadinha-free-play-ships-the-lexicon-on-its-own-route.md), [ADR-0112](./0112-the-grid-game-routes-bundle-budget-is-a-leak-tripwire.md): each one's statement that the check runs by hand or is not in CI.

## Context

`apps/web/scripts/route-client-js.mjs` checks each route's First Load JS against its budget and greps the built chunks for leak markers (the Nonogram motifs, the Termo answers and dictionary, the crossword lexicon). It was run by hand. ADR-0027 gave two reasons: it was a per-PR tripwire for one route, and its expected-marker arrays hard-code pt-BR product copy, so in CI *"a copy edit"* would red a build; *"Automating it is a separate decision and needs that fragility designed out first."*

The first reason has expired: the script has guarded every play, archive and free-play route since ADR-0045 and ADR-0047. The cost of the manual rule is measured: `/nonogram`, `/modo-livre/nonogram`, `/sudoku` and `/rainhas` went over budget across three merged PRs and nobody saw it (ADR-0112).

## Decision

1. **The whole script runs in the `gate` job of `.github/workflows/ci.yml`**, as `pnpm --filter @miolos/web --fail-if-no-match bundle-check` (a renamed package fails instead of matching nothing), right after `pnpm build`. It reads the `.next` that step wrote or replayed from the turbo cache (`turbo.json` build outputs keep `.next/**` except `.next/cache`), so the gate builds once. The required `gate` check covers it; the ruleset does not change. `T-WEB-S710` (`apps/web/test/fanout-cap.test.ts`) pins the step's exact command and its order.
2. **ADR-0027's precondition is overturned, not met.** The copy coupling stays. While the check was manual, a copy edit that broke an expected marker landed green and reddened the next unrelated play-route PR. In CI it reddens the PR that made the edit, whose author can fix it in one line. The failure message now names that cause.
3. **Not in pre-commit.** It needs a `next build`, and the hook already runs typecheck and the full suite.

## Consequences

- A green gate now proves the budgets and markers on the CI build. That build has no environment variables, so `NEXT_PUBLIC_API_URL` is unset; the figures are a tripwire, not the production bundle size.
- `T-WEB-S444`'s module-graph test (`apps/web/test/free-play-graph.test.ts`) stays: it is the lexicon proof pre-commit can run.

## Rejected

- **Budgets in the gate, markers by hand.** Splits what a green gate means, and the manual half is the one the leak ADRs (0033, 0047, 0070, 0088) rely on.
- **Re-key the expected markers off product copy first.** Rebuilds the attribution proof to remove a failure that is loud and cheap to fix.

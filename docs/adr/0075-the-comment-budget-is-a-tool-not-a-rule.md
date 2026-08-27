# ADR-0075 — The comment budget is a tool, not a rule

**Status:** Accepted — 2026-08-27

## Context

ADR-0074 decision 4 said comments are rare and listed what to delete on sight. Written as prose, it did not hold. Five months and seven [#205](https://github.com/fernandolisboa/miolos/issues/205) tranches later, measured across 534 tracked `.ts`/`.tsx` files:

- **22.9%** of 106,650 lines were comment-only prose, and **490 of 530** files were over. Every figure in this ADR is `density.mjs`'s, re-derived at merge; the campaign's earlier numbers came from `count.mjs`, which counts directive lines too, and are a percentage point higher for that reason alone.
- The tranches had removed **citations by genre** — issue numbers, plan references, finding IDs — and never measured density. #205's own Rule P records the drift: *"the cost has moved from the sweep to the PR body"*, then Rule BB: *"nine of the ten rejections were a figure in a durable record, only one was a defect in a diff."*
- The largest surviving class was prose whose only reader is the next agent: `(#27 step-6 finding B-1)`, `// a reviewer caught this comment`, `// this used to assert the inverse`.
- Files were routinely inverted: `i18n/routes.ts` carried 101 comment lines over 65 lines of route table; `vitest.shared.ts` 60 over one line of code, duplicating ADR-0057; `eslint.config.mjs` 534 over 526. `apps/web/src` alone was **34.1%**.

Fernando's call, 2026-08-27: *"comments are exceptions… 99% of the code should be easy to read."*

## Decision

**A tool enforces the budget, and the tool is also the report.** `pnpm comments` runs `density.mjs` in pre-commit and in CI. No PR body restates a figure, because a restated figure is what nine of #205's ten review rejections were about.

**The budget is 3% of a file's lines, or two lines, whichever is larger.** The floor is load-bearing, not slack: 3% of a thirty-line file is zero, which would forbid outright the comments CLAUDE.md's *"Write a comment for"* list requires — a `TODO` with an issue number, a browser workaround. Without it the rulebook contradicts itself in a third of the repo.

**Directives are exempt, and the list lives in exactly one place** — `DIRECTIVES` in `density.mjs`. `selftest.mjs` iterates it for the probes and *separately* pins the label set by hand, because a probe list derived from the array cannot notice a member being deleted. Both failure directions have shipped: `/// <reference` documented-exempt and budgeted, then `@vitest-environment` the same way one review round later. Prose that merely mentions a directive is not exempt.

**Generated files report as SKIPPED, never as passing.** Their headers belong to their generators; a sweep that edits one is undone on the next run.

**When a file cannot fit, the first question is whether the code is too complex — not whether the budget is too small.**

## Residuals, named rather than discovered later

**A short file gets exactly two lines, and three of CLAUDE.md's five sanctioned comment kinds can need more.** 56% of files are under 100 lines; `apps/api/app/cron/publish/route.ts` sits at 3/100 carrying an ADR-0004 security argument with zero headroom. If a file genuinely needs a third line for a security argument or an untested invariant, raise the floor in `density.mjs` — do not delete the argument, and do not add a per-file waiver, which is how a budget becomes advisory.

**`.js` is not covered.** `apps/web/public/sw.js` is shipped source at 37% prose. It is out of scope because the gate's file list is `.ts`/`.tsx`/`.mjs`, not because the prose there is justified.

**CSS is not covered**, for a harder reason — see the last consequence below.

## Consequences

- The tracked `.ts`/`.tsx`/`.mjs` surface went to **0.0%**, with no file over budget. Run `pnpm comments` for the current number rather than trusting this line — that is the whole point of the decision above, and two figures in an earlier draft of this ADR were wrong.
- Deleting a comment that states a rule needs the rule tested first, per CLAUDE.md. Applying that found three rules whose only copy was the comment: the telemetry gate on a failed mint (`T-WEB-S355`), the `/*#__PURE__*/` annotations in `word-list.ts` and `medals/definitions.ts`, and the PGlite `t0` read order. All three are now tests that red under mutation.
- Three tests had made **prose** load-bearing — a non-vacuity check reading the doc block of the file it scanned, `shingle.mjs`'s selftest fixtures, and accent hexes named only in trailing comments. All three now stand on fixtures or structure. Prefer a synthetic fixture to a real file: a fixture this campaign was deleting went green by attrition, twice.
- `shingle.mjs`, `citations.mjs`, `markers.mjs`, `verbatim.mjs` and `excision.mjs` were built to sweep citations. With density at 0% they have little left to measure. They are kept for the CSS work and retired when it lands.
- **CSS needs a design change, not a sweep.** `T-WEB-S102` asserts the *contents* of `termo-board.module.css`'s header — seven numbered deviations, by token. Bringing CSS under the budget means moving that table into the test as data, which is a design change, not a sweep.

# ADR-0075 — The comment budget is a tool, not a rule

**Status:** Accepted — 2026-08-27

## Context

ADR-0074 decision 4 said comments are rare and listed what to delete on sight. Written as prose, it did not hold. Five months and seven [#205](https://github.com/fernandolisboa/miolos/issues/205) tranches later, `density.mjs --tracked` on `main` reported:

- **23.4%** of 110,757 lines were comment-only prose, and **505 of 545** files were over. (Over `.ts`/`.tsx` alone, the campaign's original corpus: 22.9% of 106,713, 491 of 531.) Every figure here is `density.mjs`'s over the gate's own corpus. Two earlier drafts of this ADR carried figures from `count.mjs`, which also counts directive lines, and from a snapshot that silently omitted a file — both were caught in review.
- The tranches had removed **citations by genre** — issue numbers, plan references, finding IDs — and never measured density. #205's own Rule P records the drift: *"the cost has moved from the sweep to the PR body"*, then Rule BB: *"nine of the ten rejections were a figure in a durable record, only one was a defect in a diff."*
- The largest surviving class was prose whose only reader is the next agent: `(#27 step-6 finding B-1)`, `// a reviewer caught this comment`, `// this used to assert the inverse`.
- Files were routinely inverted: `i18n/routes.ts` carried 101 comment lines over 65 lines of route table; `vitest.shared.ts` 60 over two lines of code, duplicating ADR-0057; `eslint.config.mjs` **558 over 1,060**. `apps/web/src` alone was **34.1%**.

Fernando's call, 2026-08-27: *"comments are exceptions… 99% of the code should be easy to read."*

## Decision

**A tool enforces the budget, and the tool is also the report.** `pnpm comments` runs `selftest.mjs` and then `density.mjs --tracked`, in pre-commit and in CI. The harness runs first and inside the gate — a gate whose own implementation has drifted reports green over the wrong rule, and running it only in CI would let a local commit land against a measurement nothing checked. No PR body restates a figure, because a restated figure is what nine of #205's ten review rejections were about.

**The budget is 3% of a file's lines, or two lines, whichever is larger.** The floor is load-bearing, not slack: 3% of a thirty-line file is zero, which would forbid outright the comments CLAUDE.md's *"Write a comment for"* list requires — a `TODO` with an issue number, a browser workaround. Without it the rulebook contradicts itself in a third of the repo.

**Directives are exempt, and the list lives in exactly one place** — `DIRECTIVES` in `density.mjs`. `selftest.mjs` iterates it for the probes and *separately* reads the enumerations in CLAUDE.md and the tool README back, failing if the three sets differ: a probe list derived from the array cannot notice a member being deleted, and prose copies drift silently. Both failure directions have shipped: `/// <reference` documented-exempt and budgeted, then `@vitest-environment` the same way one review round later. Prose that merely mentions a directive is not exempt.

**A line counts when it carries a comment and no code — and `{/* … */}` is such a line.** The braces of a JSX comment sit outside the comment range, so reading them as code hid every line of JSX prose from the budget while still counting it in the denominator: prose diluted its own percentage. A brace counts as comment only when it abuts the comment, which keeps `} // trailing` a code line. A trailing `//` is a code line; a **standalone** `//` is residue and counts.

**Generated files report as SKIPPED, never as passing.** Their headers belong to their generators; a sweep that edits one is undone on the next run.

**When a file cannot fit, the first question is whether the code is too complex — not whether the budget is too small.**

## Residuals, named rather than discovered later

**A short file gets exactly two lines, and three of CLAUDE.md's five sanctioned comment kinds can need more.** 56% of files are under 100 lines; `apps/api/app/cron/publish/route.ts` sits at 3/100 carrying an ADR-0004 security argument with zero headroom. If a file genuinely needs a third line for a security argument or an untested invariant, raise `FLOOR_LINES` in `density.mjs` — do not delete the argument, and do not add a per-file waiver, which is how a budget becomes advisory. Two things follow: the gate is in pre-commit and CI, so CLAUDE.md's third fallback (*"or leave the comment"*) is no longer available to a file at its cap — the first two still are; and the lever is repo-wide, so raising it for one file relaxes all 309 short files at once.

**The corpus is `.ts`, `.tsx`, `.mts`, `.cts`, `.mjs` and `.cjs`, minus `.claude/skills/`.** The module extensions are there because a rename must not be an exit from the budget — `packages/games`'s purity test already treats `.mts`/`.cts` as a proven evasion vector. Vendored skills are excluded because they are not ours to edit. `selftest.mjs` pins the corpus, since one more filter here would leave every other check printing green over nothing.

**`.js` is not covered.** `apps/web/public/sw.js` is shipped source at 37% prose. It is out of scope because it is not on that list, not because the prose there is justified.

**CSS is not covered**, for a harder reason — see the last consequence below.

## Consequences

- The tracked surface went from 23.4% to a fraction of a percent, with no file over budget. Run `pnpm comments` for the current number rather than trusting any figure written here — that is the whole point of the decision above, and two figures in an earlier draft of this ADR were wrong.
- Deleting a comment that states a rule needs the rule tested first, per CLAUDE.md. Applying that found **four** rules whose only copy was the comment: the telemetry gate on a failed mint (`T-WEB-S355`), the `/*#__PURE__*/` annotations in `word-list.ts` and `medals/definitions.ts`, the PGlite `t0` read order, and `users.updated_at`. All four are now tests that red under mutation, and the `updated_at` one is a scan, so it also catches the next writer rather than only the last.
- Three tests had made **prose** load-bearing — a non-vacuity check reading the doc block of the file it scanned, a sweep tool's selftest fixtures, and accent hexes named only in trailing comments. All three now stand on fixtures or structure. Prefer a synthetic fixture to a real file: a fixture this campaign was deleting went green by attrition, twice.
- Eight scripts built to sweep citations — `shingle`, `citations`, `markers`, `verbatim`, `excision`, `hash`, `wrap`, `css-count` — were **deleted** with the sweep that needed them. Keeping them for the CSS work would have been a second consumer that does not exist, and a third of the harness existed to keep them green; `git` has them when the CSS ticket starts.
- **CSS needs a design change, not a sweep.** `T-WEB-S102` asserts the *contents* of `termo-board.module.css`'s header — seven numbered deviations, by token. Bringing CSS under the budget means moving that table into the test as data, which is a design change, not a sweep.

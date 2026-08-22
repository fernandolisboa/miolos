# Docs

Everything committed here is a **living document**, edited in place. There are no numbered per-ticket artifacts any more — see `CLAUDE.md` § *The four documents that exist*.

| Path | What it is |
|---|---|
| `adr/` | Architecture Decision Records — the only place a long-lived "why" is stored. One decision between real alternatives per file, ~40 lines. |
| `pending-fernando.md` | The wizard-ready ledger of actions and decisions only Fernando can take. Maintained by every session that surfaces or discharges one. |
| `agents/issue-tracker.md` | Where issues live and how agents operate on them |
| `agents/triage-labels.md` | The five canonical triage roles → this repo's label strings |
| `agents/domain.md` | How agents consume `CONTEXT.md` and the ADRs, and the ADR status lifecycle |
| `agents/test-ids.md` | The `T-<AREA>-[S]<n>[<letter>]` convention, the per-area frontier and the burned slots |

`CONTEXT.md`, `PRODUCT.md` and `DESIGN.md` live at the repo root, not here.

## Snapshots that stay

Three sets of files are frozen point-in-time records that are still cited, so they are kept as written and never edited to match a later decision:

| Path | What it is |
|---|---|
| `handoffs/001-handoff-project-foundation.md` | The founding handoff — **the product's source of truth**, as amended by the ADRs |
| `design/002-brief-design-direction.md` | The visual direction brief that fed the design exploration |
| `design/006-handoff-design-winner-atelie/` | The winning direction ("Ateliê"): six `.dc.html` reference frames, `support.js`, token sheet. Visual specs, never production code — open them in a browser |
| `research/003-…`, `004-…`, `005-…` | Primary-source research cited as `Evidence:` by ADR-0001, ADR-0002 and ADR-0013 |

## Where plans and handoffs went

`docs/plans/` (45 files), `docs/evidence/` (60 files) and 22 of the 23 handoffs were deleted in the process reset. They were point-in-time snapshots of finished work, and keeping them cost more than they returned: 45% of this repo's merged PRs touched no code at all.

Nothing is lost — every one of them is in git history, reachable at the commit before the reset:

```sh
git log --diff-filter=D --name-only -- docs/plans docs/evidence docs/handoffs
git show <commit>^:docs/plans/011-issue-22-plan-sudoku-engine.md
```

A handful of ADRs still link into those paths. The links are dead on GitHub and recoverable with the command above; they are left as written rather than rewritten, because an ADR body is not edited after the fact.

**Going forward:** a plan is a comment on its GitHub issue. Session state is `NEXT-SESSION.md` at the root, overwritten each time. Verification output is the PR body.

## Language

English for filenames, new documents, code and commits. pt-BR for user-facing product content, and for the two founding documents, whose **bodies** stay as written — corrections are appended as an amendment table, never edited inline.

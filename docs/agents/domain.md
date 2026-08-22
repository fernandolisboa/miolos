# Domain Docs

How agents consume this repo's domain documentation, and how ADRs are maintained.

This repo is **single-context**: `CONTEXT.md` at the root, `docs/adr/` beside it.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root
- **`docs/adr/`** — the ADRs that touch the area you are about to work in

## Use the glossary's vocabulary

When your output names a domain concept — an issue title, a test name, a proposal — use the term as `CONTEXT.md` defines it. Don't drift to synonyms.

If the concept isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider), or there's a real gap (add it).

## Cite symbols, not lines

When an ADR or agent doc cites code, cite the **symbol** — a function, export or test id (`normalizeWord`, `T-WEB-S43`) — plus its file path. Never a line number. Lines move on every edit; a symbol moves only when the thing it names changes.

## Flag ADR conflicts

If your output contradicts an existing ADR, say so explicitly rather than silently overriding it:

> _Contradicts ADR-0007 (event-sourced orders) — but worth reopening because…_

## What earns an ADR

A **decision between real alternatives** — one a future agent could otherwise reverse by accident. Not a record of work done. If you cannot name the alternative that was rejected, it is not an ADR.

Keep it to about **40 lines**: Context, Decision, Consequences, a few lines each. An ADR is not an essay, and it never carries implementation status prose ("decisions 5, 6 and 8 were implemented by PR 1") or benchmark tables. Those belong in the PR body.

## Status

Line 3 of every ADR is its status line. Two statuses:

```
**Status:** Proposed — <day>
**Status:** Accepted — <day>
```

`Proposed` while the decision has no code on `main`. The PR that ships the code flips it to `Accepted` **in the same diff** — never in a follow-up PR of its own.

A reversed decision gets a new ADR carrying `**Supersedes:** [ADR-NNNN](…)`, and the old one gains `**Superseded by:** [ADR-MMMM](…)`. That is the whole lifecycle. There is no amendment table, no reciprocal annotation protocol, and no `Withdrawn` — a proposal that will not ship is deleted.

Dates are the `America/Sao_Paulo` day the status was reached.

**Who checks:** the `reviewer-invariants` lens, against the PR.

## Existing ADRs are as written

ADRs 0001–0071 predate these rules. Many are far longer than 40 lines and carry the older four-status lifecycle, amendment tables and cross-annotations. **They are not rewritten.** Their decisions are live and cited from ~300 source files; only new ADRs follow the shorter form.

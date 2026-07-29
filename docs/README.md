# Docs

Project documentation. Two kinds of file live here, and they follow different rules.

## Living documents (no number)

Read them for the current state of the project. They are edited in place.

| Path | What it is |
|---|---|
| `agents/issue-tracker.md` | Where issues live and how agents operate on them |
| `agents/triage-labels.md` | The five canonical triage roles → this repo's label strings |
| `agents/domain.md` | How agents must consume `CONTEXT.md` and ADRs |
| `adr/` | Architecture Decision Records (`0001-…`, own 4-digit sequence) |

`CONTEXT.md` (the domain glossary) lives at the repo root, not here — see `agents/domain.md`.

## Sequenced artifacts (numbered)

Handoffs, briefs, plans and specs are **snapshots of a point in time**, not living specs. They are never rewritten to stay current; a newer one supersedes an older one. The number tells you the order they were created and used.

```
NNN[-issue-<n>]-<type>-<slug>.md
```

- **`NNN`** — a single sequence shared across every subdirectory, so creation order stays readable no matter where a file sits. Next free number wins.
- **`issue-<n>`** — optional. Present only when the document belongs to exactly one GitHub issue. Omitted for documents written before any issue exists, and for documents that span a whole milestone. Don't force it: a handoff covering M0 is not "issue 12's handoff".
- **`<type>`** — `handoff`, `brief`, `plan`, `spec`, `research`.
- **`<slug>`** — short, kebab-case, English.

Current:

| File | Type |
|---|---|
| `handoffs/001-handoff-project-foundation.md` | Founding handoff — **the source of truth for the whole project** |
| `design/002-brief-design-direction.md` | Visual direction brief, feeds the Claude Design exploration |

## Language

English for filenames, new documents, code and commits. pt-BR for user-facing product content, and for the two founding documents above, which stay exactly as they were written.

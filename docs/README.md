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

Handoffs, briefs, plans and specs are **snapshots of a point in time**, not living specs. Their bodies are never rewritten to stay current: a newer document supersedes an older one, and where a decision changes part of one, an **amendment table is prepended** pointing at the ADR that supersedes it. Never edit the body to match a later decision. The number tells you the order they were created and used.

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
| `handoffs/001-handoff-project-foundation.md` | Founding handoff — **the source of truth**, as amended by the table at its top |
| `design/002-brief-design-direction.md` | Visual direction brief, feeds the Claude Design exploration |
| `research/003-research-universal-rn-web.md` | Whether universal Expo Router + react-native-web fits this product |
| `research/004-research-web-native-code-sharing.md` | Two UIs sharing a core, and the universal styling systems |
| `research/005-research-miolos-name-check.md` | "Miolos" domain + INPI check (2026-07-30 snapshot); sources the Android-share figure |
| `design/006-handoff-design-winner-atelie/` | Handoff bundle of the winning design direction (F "Ateliê"): six `.dc.html` reference frames + `support.js` + token sheet. Snapshot — the living files are root `PRODUCT.md`, `DESIGN.md` and `packages/ui/tokens.css` |
| `plans/007-issue-14-plan-monorepo-foundation.md` | Implementation plan for #14 (monorepo foundation) |
| `plans/008-issue-41-plan-security-hardening.md` | Implementation plan for #41 (CI and security-header hardening) |
| `plans/009-issue-15-plan-anonymous-identity.md` | Implementation plan for #15 (anonymous identity: users/sessions schema, `POST /session`, web bootstrap) |
| `plans/010-issue-16-plan-binairo-engine.md` | Implementation plan for #16 (Binairo engine) |
| `plans/012-issue-24-plan-nonogram-engine.md` | Implementation plan for #24 (Nonogram engine) |
| `plans/013-issue-26-plan-termo-engine.md` | Implementation plan for #26 (Termo engine and word-list harness) |

## Language

English for filenames, new documents, code and commits. pt-BR for user-facing product content, and for the two founding documents above, whose **bodies** stay as written — corrections are appended as an amendment table, never edited inline.

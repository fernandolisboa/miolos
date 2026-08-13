# Docs

Project documentation. Two kinds of file live here, and they follow different rules.

## Living documents (no number)

Read them for the current state of the project. They are edited in place.

| Path | What it is |
|---|---|
| `agents/issue-tracker.md` | Where issues live and how agents operate on them |
| `agents/triage-labels.md` | The five canonical triage roles → this repo's label strings |
| `agents/domain.md` | How agents must consume `CONTEXT.md` and ADRs |
| `agents/test-ids.md` | The `T-<AREA>-[S]<n>[<letter>]` convention, the per-area frontier and the burned slots |
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
| `plans/011-issue-22-plan-sudoku-engine.md` | Implementation plan for #22 (Sudoku engine) |
| `plans/012-issue-24-plan-nonogram-engine.md` | Implementation plan for #24 (Nonogram engine) |
| `plans/013-issue-26-plan-termo-engine.md` | Implementation plan for #26 (Termo engine and word-list harness) |
| `plans/014-issue-17-plan-publication-pipeline.md` | Implementation plan for #17 (publication pipeline: buffer, cron, published-predicate wall) |
| `plans/015-issue-39-plan-impeccable-ci.md` | Implementation plan for #39 (impeccable detect against Vercel preview deployments in CI) |
| `plans/016-issue-43-plan-dependabot.md` | Implementation plan for #43 (Dependabot for SHA-pinned actions) |
| `plans/017-issue-18-plan-play-the-daily-binairo.md` | Implementation plan for #18 (play the daily Binairo: play and conclusion screens, write-once completions, dormant hint grants, the apps/web db wall) |
| `plans/018-issue-23-plan-daily-sudoku-end-to-end.md` | Implementation plan for #23 (daily Sudoku end to end: the shared `apps/web/src/play/` layer, the Sudoku buffer and screen, device-local day state and conclusion chaining) |
| `handoffs/019-handoff-m2-nonogram-and-termo.md` | Session handoff for M2's remaining two games — #25 (daily Nonogram) and #27 (daily Termo): the shared play layer's real API and its honest limits, every extension point, and the decisions each game must make |
| `plans/020-issue-25-plan-daily-nonogram-end-to-end.md` | Implementation plan for #25 (daily Nonogram end to end: the Nonogram buffer and its contracts, the ruled variable-size board and its three-state brush, the picture reveal in the conclusion, and completion, hint, timer and offline sync at parity) |
| `handoffs/021-handoff-m2-termo-and-free-play.md` | Session handoff for M2's last two — #27 (daily Termo) and #28 (free play): what #25 changed in the shared play layer, where handoff 019 is now wrong, and Termo's two unresolved structural decisions (it cannot play offline, and ADR-0027's client-side hint argument does not transfer) |
| `plans/022-issue-27-plan-daily-termo-end-to-end.md` | Implementation plan for #27 (daily Termo end to end: the answer draw and its no-repeat rule, the stateless guess route and the offline degradation, the tile board and the pt-BR keyboard, the conclusion's fourth state, and the accent rule that closes #68) |
| `handoffs/023-issue-27-handoff-termo-mid-flight.md` | Session handoff taken mid-#27 with PR #77 open and steps 1–5 complete: what the ten commits landed, the three facts that cost that session real time (drizzle's insert column list, the `@miolos/core` ESM cycle vitest cannot see, zod's mutable tuple), the already-applied migration, and the known-deferred list step 6 must be shown |
| `handoffs/024-handoff-m2-free-play-the-last-ticket.md` | Session handoff after #27 merged and the daily Termo went live: what the review changed, the four seams #28 (free play) already has, the silent-green traps in `bundle-check` and `impeccable detect`, and the obligations #27 transferred rather than discharged |
| `plans/025-issue-28-plan-free-play-on-the-grid-games.md` | Implementation plan for #28 (free play on the grid games: the `/modo-livre` routes and level picker over the weekday ramps, browser-side generation with client-picked seeds, the free-play import wall and the evidence plan for the three negative acceptance criteria, and the route-scoped rework of the bundle markers) |
| `handoffs/026-handoff-m2-complete-the-frontier-opens.md` | Session handoff after #28 merged and free play went live, closing M2: the new machinery that must not break (route-scoped fail-closed bundle markers, the free-play wall's hoist-don't-copy rule, ephemeral-by-decision free play), the re-derived test-id frontier, and the open frontier with #58's pending decision flagged for whoever starts M3 |
| `plans/027-issue-19-plan-hoje-hub-streak-and-pwa-manifest.md` | Implementation plan for #19 (Hoje hub, streak, and PWA manifest: the `computeStreak` pure function and its alive-until-the-rollover anchor, the first authenticated read `GET /streak` and its client-fetched delivery to the hub stamp and the conclusion card, the free-play wall extension over the streak modules, and the manifest, icons and install metadata — with the day-truth payload deferral recorded as proposed ADR-0048) |
| `handoffs/028-handoff-19-merged-the-streak-is-live.md` | Session handoff after #19 merged and the streak, the first authenticated read and the PWA manifest went live: the authenticated-read conventions `GET /streak` sets, the reciprocal `Amended by:` rule and the other machinery #19 leaves armed, why M1 still has one ticket (#20, now unblocked), and #58's decided-but-unimplemented status the next streak-adjacent plan must respect |
| `plans/029-issue-20-plan-account-merge-recompute.md` | Implementation plan for #20 (account-merge recompute: the pure `mergeCompletions` union-earliest-dedupe in `packages/core` with its opaque ordering key, the idempotent no-transaction `mergeAccounts` operation on `@miolos/db/user` — sessions remapped never deleted, the loser emptied and retained as a tombstone, no migration — the deterministic winner rule, the lost-Termo collision carve-out, and the semantics recorded as proposed ADR-0049) |
| `handoffs/030-handoff-20-merged-the-account-merge-lands.md` | Session handoff after #20 merged: the two-seam merge machinery and its tripwires (the T-DB-S22 agreement bridge, the T-DB-S24 column-list tripwire, the strict-< tie rule), ADR-0049's amendment of ADR-0026, the #21 security preconditions recorded on the issue, the correction that M1 completes with #21 not #20, and the re-derived test-id frontier |
| `plans/031-issue-21-plan-email-attach-magic-link-merge-lgpd.md` | Implementation plan for #21 (email attach: the one request/confirm magic-link flow that serves attach, recovery, device move and merge-on-collision, the `attach_tokens` table and migration 0004 with the verified-email partial unique index, the winner-liveness guard discharging the merge-serialization precondition, timestamp-only consents kept per ADR-0022's conditional, the server-owned exactly-once prompt over a new `GET /attach/state`, Resend-via-fetch fail-closed transport, the `/privacidade` page with real self-service deletion, and the semantics recorded as proposed ADR-0050) |
| `handoffs/032-handoff-21-merged-m1-complete.md` | Session handoff after #21 merged, completing M1: the dormant-until-keyed attach stack and its security posture (cross-account session revocation closing the review-found takeover, the four recorded residuals), ADR-0050's flow-level amendment of ADR-0009, the preview-shares-prod-DB migration push-ordering rule, Fernando's activation checklist, and the re-derived test-id frontier |

## Language

English for filenames, new documents, code and commits. pt-BR for user-facing product content, and for the two founding documents above, whose **bodies** stay as written — corrections are appended as an amendment table, never edited inline.

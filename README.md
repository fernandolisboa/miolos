# Miolos

A daily-puzzle **web app** for Brazil, in Portuguese. One fresh puzzle per game per day — the same puzzle for everyone, published by the server. A ten-minute ritual with a streak as its spine. Native iOS and Android follow the web launch.

Four games in v1, in build order: **Binairo**, **Sudoku**, **Nonogram**, **Termo-like**.

The design direction is editorial rather than arcade: a well-printed puzzle section, not a mobile game. Typography leads, paper is warm, celebrations are restrained.

**All puzzle content is free** — the daily, the archive, and infinite auto-generated free play. Access to the daily is never sold.

## Status

**Pre-M0.** The repository holds the founding documents, fifteen architecture decisions, the domain glossary (`CONTEXT.md`) and the agent workflow configuration. No application code exists yet.

| Milestone | Scope |
|---|---|
| **M0 — Foundation** | Monorepo, CI, pre-commit, Next.js web app with a base theme, anonymous auth, initial Drizzle schema |
| **M1 — Binairo end to end** | Generator + validator, publishing cron running in production with a multi-day buffer ([ADR-0010](./docs/adr/0010-publication-is-time-driven-published-at-plus-buffer.md)), polished screen, persisted completion, working streak, magic-link email recovery ([ADR-0003](./docs/adr/0003-anonymous-first-identity-with-email-recovery.md)) with the minimal LGPD package ([ADR-0012](./docs/adr/0012-minimal-lgpd-ships-with-email-attach.md)), PWA manifest. Proves the whole architecture. |
| **M2 — Catalogue** | Sudoku → Nonogram → Termo, plus client-generated free play on the grid games ([ADR-0011](./docs/adr/0011-free-play-is-generated-on-the-client.md)) and the Termo word-list validation harness ([ADR-0015](./docs/adr/0015-termo-word-list-is-ai-curated-under-mechanical-constraints.md)) |
| **M3 — Retention** | Stats, medals, Perfect Day, service worker + streak notifications (web push + email), archive routes, PostHog |
| **M4 — Web launch** | Onboarding, settings, full LGPD review, Open Graph share cards, SEO, production |
| **Post-launch** | Native iOS and Android, social login, monetization activation, crosswords v1.1 |

Launching deliberately **without** social login or active monetization.

## Planned architecture

pnpm + Turborepo monorepo:

| Package | Purpose |
|---|---|
| `apps/web` | Next.js (React) — the launch client. Plain React, **not** react-native-web ([ADR-0002](./docs/adr/0002-plain-react-web-ui-not-universal-rn-web.md)). |
| `apps/api` | Next.js — API plus the publishing cron. Deliberately separate from `apps/web` ([ADR-0007](./docs/adr/0007-separate-web-and-api-apps.md)). |
| `packages/games` | Generator / solver / validator per game. **Pure TypeScript: zero React Native or Node dependencies.** Deterministic, seed → puzzle. |
| `packages/core` | Shared types, Zod contracts, streak and medal rules |
| `packages/db` | Drizzle schema and migrations |
| `packages/ui` | Design **tokens and primitives** — not components |

A future native client is a separate UI consuming the same packages; its shape is deliberately undecided.

Backend is thin: Neon (Postgres) + Drizzle. A cron generates candidates, a validator approves them, approved puzzles land in `daily_puzzles` as a multi-day pre-published buffer — visibility is the time predicate `published_at <= now()`, never a job side-effect ([ADR-0010](./docs/adr/0010-publication-is-time-driven-published-at-plus-buffer.md)). Streaks are computed server-side; the day turns at midnight `America/Sao_Paulo` for everyone, and nothing unpublished is ever sent to the client.

Canonical domain: **`miolos.app`** (registered, managed in Vercel), with the API at `api.miolos.app` ([ADR-0013](./docs/adr/0013-canonical-domain-and-pt-br-routes.md)). Public routes are pt-BR (`/arquivo/...`).

## Documentation

| Document | What it's for |
|---|---|
| [`docs/handoffs/001-handoff-project-foundation.md`](./docs/handoffs/001-handoff-project-foundation.md) | **The source of truth**, plus an amendment table listing every point an ADR supersedes |
| [`docs/adr/`](./docs/adr/) | Architecture decisions. Seven so far; each records the alternatives rejected and why |
| [`docs/design/002-brief-design-direction.md`](./docs/design/002-brief-design-direction.md) | Visual direction, palette and typography candidates, the design exploration process |
| [`docs/research/`](./docs/research/) | Primary-source research behind the decisions |
| [`CLAUDE.md`](./CLAUDE.md) | How agents work in this repo — mandatory implementation flow and verification gates |
| [`docs/README.md`](./docs/README.md) | Documentation map and file naming convention |

### Decisions so far

| ADR | Decision |
|---|---|
| [0001](./docs/adr/0001-web-is-the-launch-platform.md) | Web is the launch platform; native follows |
| [0002](./docs/adr/0002-plain-react-web-ui-not-universal-rn-web.md) | Plain React/Next.js UI, not universal react-native-web |
| [0003](./docs/adr/0003-anonymous-first-identity-with-email-recovery.md) | Anonymous-first, email attached once the streak has value |
| [0004](./docs/adr/0004-no-unpublished-puzzle-reaches-the-client.md) | No unpublished puzzle reaches the client |
| [0005](./docs/adr/0005-all-content-is-free.md) | All content free: daily, archive, free play |
| [0006](./docs/adr/0006-monetization-convenience-not-access.md) | Monetize convenience, never access. No currency, no third-party banner |
| [0007](./docs/adr/0007-separate-web-and-api-apps.md) | `apps/web` and `apps/api` stay separate |
| [0008](./docs/adr/0008-completion-and-streak-semantics-across-play-modes.md) | Only on-time completions feed the streak; archive is recorded but marked late; a lost Termo is played, not completed |
| [0009](./docs/adr/0009-account-merge-recomputes-from-the-union-of-completions.md) | Account merge recomputes from the union of completions |
| [0010](./docs/adr/0010-publication-is-time-driven-published-at-plus-buffer.md) | Publication is time-driven: `published_at` plus a pre-generated buffer; no archive backfill |
| [0011](./docs/adr/0011-free-play-is-generated-on-the-client.md) | Free play is generated on the client |
| [0012](./docs/adr/0012-minimal-lgpd-ships-with-email-attach.md) | Minimal LGPD ships with email attach; recovery and reminder consent are separate |
| [0013](./docs/adr/0013-canonical-domain-and-pt-br-routes.md) | Canonical domain `miolos.app`; public routes in pt-BR |
| [0014](./docs/adr/0014-apps-web-reads-the-database-directly-for-public-pages.md) | `apps/web` reads the database directly for public pages only |
| [0015](./docs/adr/0015-termo-word-list-is-ai-curated-under-mechanical-constraints.md) | The Termo word list is AI-curated under mechanical constraints; matching is accent-insensitive |

## Development

Solo, agent-driven through Claude Code. Work is tracked as GitHub Issues; every issue goes through the eight-step implementation flow defined in [`CLAUDE.md`](./CLAUDE.md), which ends at a green mechanical gate and a merged pull request.

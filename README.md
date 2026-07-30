# Miolos

A daily-puzzle **web app** for Brazil, in Portuguese. One fresh puzzle per game per day — the same puzzle for everyone, published by the server. A ten-minute ritual with a streak as its spine. Native iOS and Android follow the web launch.

Four games in v1, in build order: **Binairo**, **Sudoku**, **Nonogram**, **Termo-like**.

The design direction is editorial rather than arcade: a well-printed puzzle section, not a mobile game. Typography leads, paper is warm, celebrations are restrained.

**All puzzle content is free** — the daily, the archive, and infinite auto-generated free play. Nothing is ever behind a paywall.

## Status

**Pre-M0.** The repository holds the founding documents, six architecture decisions and the agent workflow configuration. No application code exists yet.

| Milestone | Scope |
|---|---|
| **M0 — Foundation** | Monorepo, CI, pre-commit, Next.js web app with a base theme, anonymous auth, initial Drizzle schema |
| **M1 — Binairo end to end** | Generator + validator, publishing cron, polished screen, persisted completion, working streak. Proves the whole architecture. |
| **M2 — Catalogue** | Sudoku → Nonogram → Termo, plus free play on the grid games |
| **M3 — Retention** | Stats, medals, Perfect Day, streak notifications (web push + email), archive routes, PostHog |
| **M4 — Web launch** | Onboarding, settings, LGPD, Open Graph share cards, SEO, production |
| **Post-launch** | Native iOS and Android, social login, monetization activation, crosswords v1.1 |

Launching deliberately **without** social login or active monetization.

## Planned architecture

pnpm + Turborepo monorepo:

| Package | Purpose |
|---|---|
| `apps/web` | Next.js (React) — the launch client. Plain React, **not** react-native-web ([ADR-0002](./docs/adr/0002-plain-react-web-ui-not-universal-rn-web.md)). |
| `apps/api` | Next.js — API plus the publishing cron. *Whether this stays separate from `apps/web` or merges into it is an open M0 decision.* |
| `packages/games` | Generator / solver / validator per game. **Pure TypeScript: zero React Native or Node dependencies.** Deterministic, seed → puzzle. |
| `packages/core` | Shared types, Zod contracts, streak and medal rules |
| `packages/db` | Drizzle schema and migrations |
| `packages/ui` | Design **tokens and primitives** — not components |

A future native client is a separate UI consuming the same packages; its shape is deliberately undecided.

Backend is thin: Neon (Postgres) + Drizzle. A cron generates candidates, a validator approves them, approved puzzles land in `daily_puzzles`. Streaks are computed server-side; the day turns at midnight `America/Sao_Paulo` for everyone, and nothing unpublished is ever sent to the client.

## Documentation

| Document | What it's for |
|---|---|
| [`docs/handoffs/001-handoff-project-foundation.md`](./docs/handoffs/001-handoff-project-foundation.md) | **The source of truth**, plus an amendment table listing every point an ADR supersedes |
| [`docs/adr/`](./docs/adr/) | Architecture decisions. Six so far; each records the alternatives rejected and why |
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

## Development

Solo, agent-driven through Claude Code. Work is tracked as GitHub Issues; every issue goes through the eight-step implementation flow defined in [`CLAUDE.md`](./CLAUDE.md), which ends at a green mechanical gate and a merged pull request.

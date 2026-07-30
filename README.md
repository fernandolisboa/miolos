# Miolos

A daily-puzzle app for Brazil, in Portuguese. One fresh puzzle per game per day — the same puzzle for everyone, published by the server. A ten-minute ritual with a streak as its spine.

Four games in v1, in build order: **Binairo**, **Sudoku**, **Nonogram**, **Termo-like**.

The design direction is editorial rather than arcade: a well-printed puzzle section, not a mobile game. Typography leads, paper is warm, celebrations are restrained.

## Status

**Pre-M0.** The repository currently holds the founding documents and the agent workflow configuration. No application code exists yet.

| Milestone | Scope |
|---|---|
| **M0 — Foundation** | Monorepo, CI, pre-commit, Expo running with a base theme, API with anonymous auth, initial Drizzle schema |
| **M1 — Binairo end to end** | Generator + validator, publishing cron, polished screen, persisted completion, working streak. Proves the whole architecture. |
| **M2 — Catalogue** | Sudoku → Nonogram → Termo |
| **M3 — Retention** | Stats, medals, Perfect Day, streak push, PostHog |
| **M4 — Android launch** | Onboarding, settings, LGPD, store listing, closed beta, production |

Launching deliberately **without** social login, free-play mode, or active monetization.

## Planned architecture

pnpm + Turborepo monorepo:

| Package | Purpose |
|---|---|
| `apps/mobile` | Expo (React Native, New Architecture), EAS Build |
| `apps/api` | Next.js — API plus the publishing cron |
| `packages/games` | Generator / solver / validator per game. **Pure TypeScript: zero React Native or Node dependencies.** Deterministic, seed → puzzle. |
| `packages/core` | Shared types, Zod contracts, streak and medal rules |
| `packages/db` | Drizzle schema and migrations |
| `packages/ui` | Design tokens and shared components |

Backend is thin: Neon (Postgres) + Drizzle. A cron generates candidates, a validator approves them, approved puzzles land in `daily_puzzles`. Streaks are computed server-side; the day turns at midnight `America/Sao_Paulo` for everyone.

## Documentation

| Document | What it's for |
|---|---|
| [`docs/handoffs/001-handoff-project-foundation.md`](./docs/handoffs/001-handoff-project-foundation.md) | **The source of truth.** Every locked product, architecture and scope decision. |
| [`docs/design/002-brief-design-direction.md`](./docs/design/002-brief-design-direction.md) | Visual direction, palette and typography candidates, the design exploration process |
| [`CLAUDE.md`](./CLAUDE.md) | How agents work in this repo — mandatory implementation flow and verification gates |
| [`docs/README.md`](./docs/README.md) | Documentation map and file naming convention |

## Development

Solo, agent-driven through Claude Code. Work is tracked as GitHub Issues; every issue goes through the eight-step implementation flow defined in [`CLAUDE.md`](./CLAUDE.md), which ends at a green mechanical gate and a merged pull request.

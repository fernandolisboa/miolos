# ADR-0148 — Measurements are turned off per account, inside the capture

**Status:** Accepted — 2026-10-22 (issue #37)
**Amends:** [ADR-0069](./0069-telemetry-is-five-server-anchored-events-over-a-hand-rolled-capture.md) decision 5 ("no opt-out UI")

## Context

The five PostHog events (ADR-0069) are keyed to the account and leave Brazil. LGPD gives the player the right to refuse, and ADR-0069 left the switch to the first settings surface. Fernando chose a switch in Ajustes, on by default (2026-10-22).

## Decision

1. **Per account, server-side.** `users.telemetry_opt_out_at` (migration 0018): `null` sends, a timestamp means off since then. The first opt-out instant is kept on a repeat. `GET /account/telemetry/state` and `POST /account/telemetry` read and write it with the strict `{ sending }` contract (`telemetryChoiceSchema`).
2. **Enforced inside `captureEvent`** (`apps/api/src/telemetry/capture.ts`), not at the five seams: its input takes a required `db`, and it reads the flag after the key check and the property parse. A new seam cannot skip the check, the type forbids it. No row (an account deleted while the event waited) or a failed read sends nothing.
3. **Survives a merge.** `mergeAccounts` keeps the earliest of the two opt-outs, so turning it off on any device of the account holds after sign-in on another.
4. **Not a consent.** No `consent_events` row: the log holds the two email consents only (ADR-0082). The client relay still posts `puzzle_started`; the server drops it.

## Consequences

- One extra primary-key read per event, after the response.
- A new anonymous device starts sending until it signs in to an account that opted out.
- The switch stops future events only. Rows PostHog already holds still need `privacidade@miolos.app` (the deletion residual in ADR-0069 decision 5); `/privacidade` says so.
- Migration 0018 also adds `users.game_settings` (jsonb), unread here: Fernando ran both `ALTER`s together, so the file and snapshot describe the database as it is. #317 (settings sync) gives it its reader and its own ADR.
- `mintSession` and `createGoogleUser` insert with `returning id` only, so a database missing a later `users` column breaks that feature, not every new session.

## Rejected

- **A field on `GET /account/state`:** that response is strict, so an older web build would refuse it until both apps deploy.
- **A check at each seam, or in the client:** five places to forget, and the client is never the source of truth.
- **A per-device switch:** the events are keyed to the account, so the choice is the account's.

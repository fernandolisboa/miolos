# 0025 — Remote config is a database table read through a typed accessor

**Status:** Accepted — 2026-07-31

## Context

The spec makes buffer depth (starting value 7) a remote-config tunable:
changing it must not be a deploy. Feature flags and entitlements already
exist as dormant in-code seams (M0, `packages/core`); what M1 needs is the
first genuinely remote tunable, with the smallest possible surface.
Candidates: env vars (tuning = deploy — fails the requirement), Vercel
Edge Config (a new vendor surface and SDK, and reads from api functions
add a network hop anyway), or a database table.

## Decision

Remote config is a Postgres table, `remote_config` (`key` text primary
key, `value` jsonb), read through one typed accessor:
`getRemoteConfig(db)` in `packages/db` merges all rows into an object and
parses it with `remoteConfigSchema` (`packages/core/src/remote-config.ts`),
whose in-code defaults (`bufferDepth: 7`) apply when the table is empty.
Invalid or out-of-clamp values fall back to the defaults with a
once-per-process `console.error` — the cron must run against an empty or
corrupted table. `bufferDepth` is clamped 1..30 in the schema: loop
bounds are never derived from unclamped input.

Tuning is one INSERT/UPDATE on the table; no deploy, no new vendor.
Future tunables (and, if wanted, remote feature-flag resolution) ride the
same table by extending the schema.

## Consequences

- The accessor is PGlite-testable like everything else in `packages/db`,
  and costs one query per cron run (the only M1 reader).
- The table is reachable only through `@miolos/db/publishing` (ADR-0024's
  surface rule); client-serving code sees config effects, never the
  table.
- Config values are code-validated, so a bad manual edit degrades to
  defaults loudly instead of driving the cron with garbage.

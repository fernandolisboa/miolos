# ADR-0010 — Publication is time-driven: `published_at` plus a pre-generated buffer

**Status:** Accepted — 2026-07-30
**Depends on:** [ADR-0004](./0004-no-unpublished-puzzle-reaches-the-client.md)

## Context

[ADR-0004](./0004-no-unpublished-puzzle-reaches-the-client.md) says nothing unpublished ever reaches the client, but left "published" without a mechanical definition. Two candidate meanings:

- **Absence of row:** the cron inserts the day's puzzles at midnight; a row's existence is its publication. Nothing to filter — but a cron failure at 00:00 is an immediate outage for every streak in Brazil, with no fallback by construction.
- **A predicate:** rows exist ahead of time and a condition decides visibility. Requires discipline on every read path, but decouples publication from the cron actually firing at the critical instant.

A related question: the public archive is empty at launch unless the cron runs in production long before launch, or past dates are synthetically backfilled.

## Decision

**Publication is a time predicate, not a job side-effect.**

- Every row in `daily_puzzles` carries a `published_at` timestamp (the `America/Sao_Paulo` midnight of its day, stored as an instant).
- **Every** read path — daily, archive, OG images, anything — filters `published_at <= now()`, and does so through **one shared query helper**, not a predicate re-typed per route. That helper is where ADR-0004's guarantee lives, and it gets its own test: no route, payload, or prefetch may leak a future row.
- The cron's job is to **keep a buffer**: it pre-generates and validates several days of future-dated rows (initial depth 7, tunable), topping the buffer up on each run. Midnight itself involves no job — the next day's puzzles become visible because time passed, not because something ran.
- Monitoring watches **buffer depth**, not cron exit codes. A failed run means the buffer shrinks by one day and there are days of slack to fix it; depth below a threshold pages loudly.
- The per-puzzle kill switch from the founding handoff is a flag on the row that the shared helper also respects — killing a published puzzle and hiding an unpublished one go through the same gate.

**No archive backfill.** The archive starts at the first date the production cron actually published; day one of the product is day one of the archive. The cron runs in production from M1 (already in the README), so weeks of real archive exist by web launch. Every archive date was genuinely the shared daily.

## Rejected

- **Absence of row:** turns the most critical scheduled job in the product into a single point of failure at the worst possible minute, and forecloses any buffer.
- **Status flag flipped by the cron at midnight:** rows exist ahead but visibility is still job-driven at the critical instant — keeps the outage mode and adds the predicate anyway.
- **Synthetic backfill:** manufactures dates that were never a shared daily, spending work to make the ritual claim retroactively false.

## Consequences

- The buffer rows are precisely the "unpublished content" ADR-0004 protects. They exist server-side only; the shared helper is the entire wall. This is why the helper is tested rather than trusted.
- [ADR-0014](./0014-apps-web-reads-the-database-directly-for-public-pages.md) allows `apps/web` to read the database directly for public pages — those reads must go through the same helper, which therefore lives in a shared package, not inside `apps/api`.
- `now()` is the database's clock, a single authority. The client clock stays out of publication exactly as it stays out of streaks.
- Puzzle generation being deterministic and cheap (`packages/games`, seed → puzzle) is what makes a multi-day buffer nearly free to maintain.

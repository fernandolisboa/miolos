# ADR-0048 — The streak is a client-fetched, server-computed value, alive until the rollover

**Status:** Accepted — 2026-08-13
**Depends on:** [ADR-0008](./0008-completion-and-streak-semantics-across-play-modes.md), [ADR-0009](./0009-account-merge-recomputes-from-the-union-of-completions.md), [ADR-0014](./0014-apps-web-reads-the-database-directly-for-public-pages.md), [ADR-0022](./0022-opaque-session-tokens-in-a-sessions-table.md), [ADR-0026](./0026-completions-are-write-once-rows-on-time-is-derived.md), [ADR-0031](./0031-per-device-day-state-is-a-local-monotone-safe-affordance.md)
**Amends:** [ADR-0031](./0031-per-device-day-state-is-a-local-monotone-safe-affordance.md) —
decision 5's *"#19 replaces `readDayState`'s body and nothing else"* is narrowed:
#19 ships the streak (the value that decision 3 deferred) and does NOT replace
`readDayState`'s body; the server day-truth payload and the local reader's
body-replacement move to a dedicated follow-up issue
([#83](https://github.com/fernandolisboa/miolos/issues/83)). The local reader,
its callers and the offline-fallback rule are unchanged.
**Discharged at #83 / [ADR-0060](./0060-the-day-payload-is-server-truth-and-the-device-may-only-add-to-it.md)**,
which ships the payload this deferral names and replaces `readDayState`'s
body, keeping the local reader as the offline fallback exactly as the sentence
above requires. This ADR's own decisions need no change — this is the
fulfilment it predicted.
Also amends [ADR-0041](./0041-accents-colour-shapes-never-words.md)
consequence (h) — its enumeration of surviving accent-text declarations
("thirteen … this table is the thing to recompute rather than trust") grows
by two rows for the conclusion streak card, and `ink-on-accent.test.ts`'s
`ALLOWED_ACCENT_TEXT` widens by the same two names (decision 1's exception
mechanism, exercised rather than bypassed):

| # | site | value | on | ratio |
|---|---|---|---|---|
| 14 | `play/conclusion-view.module.css` `.streakCardNumeral` | `--accent-app` | `--paper-card` | **6.2980:1** |
| 15 | `play/conclusion-view.module.css` `.streakCardLabel` | `--accent-app` | `--paper-card` | **6.2980:1** |

Both figures are ADR-0041 decision 1's own recorded measurement of
`--accent-app` #9E3B2F on `--paper-card` #FBF7EF.

## Context

ADR-0009 mandates the streak be a pure function over completion rows in
`packages/core`; ADR-0014 routes every user-specific read through `apps/api`;
ADR-0031 deferred the value to #19. Three things remained open: how the value
reaches a hub that is a synchronous server component with a client-minted,
host-only-outside-production session cookie; what the pure function's inputs
are, given #58's decided-but-unimplemented direction (on-time judged once at
write time, stored on the row); and what a streak reads on a morning where
yesterday's run is intact but today is unplayed — a case ADR-0008 defines no
display semantics for.

## Decision

1. **`computeStreak(rows, today)` in `packages/core`:** rows carry
   `{date, outcome, onTime}`; `today` is the DB clock's SP date supplied by
   the caller. The function consumes `onTime` as row data and never
   recomputes it from a timestamp — forward-compatible with #58, whose only
   effect here is changing the field's producer. A day counts iff it has ≥1
   row with `outcome = 'won'` and `onTime = true`; a `lost` row never counts,
   on time or not (ADR-0008 rule 3).
2. **Alive until the rollover:** the streak is the maximal run of consecutive
   counted days ending at `today` or `today − 1`. A run ending yesterday
   reads at full length until today's rollover passes unplayed. The function
   also answers `todayCounts`, so copy can distinguish "maintained today"
   from "alive from yesterday" honestly. CONTEXT.md's Streak row is
   **unchanged** by this reading — it defines the counted set (consecutive
   days with ≥ 1 on-time completion); this ADR defines the read anchor.
3. **`GET /streak` on `apps/api` is the delivery path** — the repo's first
   authenticated read: cookie → `requireUserId` (never mints), rows via an
   unfiltered `@miolos/db/user` reader (the pure function is the only
   filter, so the seam exercises the authority), `today` via
   `todaySaoPaulo(db)`. Strict contract `{date, streak, todayCounts}`,
   parsed on both ends; `Cache-Control: no-store`; no OPTIONS handler — a
   credentialed GET without custom headers never preflights. Future payload
   growth is a NEW endpoint/contract, never fields appended to a strict
   schema deployed clients parse.
4. **The client fetches it with `credentials: "include"` from client
   components**; the server renders the zero state and hydration only ever
   raises the number. No `localStorage` cache: a stale server number
   presented as current is wrong in both directions, while zero is the
   honest unknown of a value the client can never compute (ADR-0031
   decision 6). The conclusion's card additionally gates on the day being
   on the server (`syncOutcome === "recorded"`), so its number includes the
   day it decorates; unfetched and offline states render the card absent,
   as shipped, while a fetched zero (a late win or lost-only day with no
   prior history) renders honestly — it is real server data, not the fake
   zero the pre-#19 conclusion refused to invent.

## Rejected

- **A server-side cookie read + fetch in `apps/web`:** not for preview
  parity — on `*.vercel.app` previews EVERY credentialed call is anonymous
  either way (the cookie is `SameSite=Lax` and `vercel.app` is on the
  Public Suffix List, so preview web→api is cross-site and the Lax cookie
  neither travels nor sets; both paths degrade to the honest zero state
  there). Rejected on the real discriminators: it forces the hub async
  (the smoke-suite constraint), and a browser fetch is the only shipped
  precedent for calling `apps/api`.
- **Widening `completionResponseSchema`:** strict on both ends; and the hub
  needs the streak without a completion in flight.
- **Streak reads as 0 until today's first completion:** matches ADR-0008's
  letter and breaks the product every morning — the number the player
  returns for would be gone at the moment of return.
- **Caching the last-known value on the device:** see decision 4.
- **SQL-filtering the reader to won/on-time rows:** leaves the core
  function's exclusions untestable at the seam and creates a second streak
  definition.

## Consequences

- The merge (ADR-0009), nightly checks and support tooling reuse
  `computeStreak` unchanged — the route is just its first caller.
- #58, when implemented, changes the producer of `onTime` and nothing in
  this ADR.
- Free play's wall extends over the streak modules (ADR-0046's consequence,
  kept true by growth).
- The attach prompt (streak ≥ 5, ADR-0003) has a real value to read; its
  ticket owns the prompt.
- The morning hub shows yesterday's live run with `todayCounts: false` —
  the streak-at-risk push, when it ships, warns about exactly the state
  this ADR makes representable.

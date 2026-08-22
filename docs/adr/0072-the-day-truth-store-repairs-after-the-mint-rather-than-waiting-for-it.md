# ADR-0072 — The day-truth store repairs after the mint rather than waiting for it

**Status:** Accepted — 2026-08-22 (issue [#195](https://github.com/fernandolisboa/miolos/issues/195), shipped in [#203](https://github.com/fernandolisboa/miolos/pull/203))
**Depends on:** [ADR-0060](./0060-the-day-payload-is-server-truth-and-the-device-may-only-add-to-it.md), [ADR-0031](./0031-per-device-day-state-is-a-local-monotone-safe-affordance.md), [ADR-0069](./0069-telemetry-is-five-server-anchored-events-over-a-hand-rolled-capture.md), [ADR-0070](./0070-the-daily-nonogram-conclusion-names-its-motif.md)
**Amends:** [ADR-0060](./0060-the-day-payload-is-server-truth-and-the-device-may-only-add-to-it.md) — annotations **(j)** and **(k)**, continuing the series ((h) is ADR-0066's at #58, (i) is ADR-0070's at #64). Annotation (j), decision-level, on **decision 5**: its closed trigger list gains the post-mint repair, while its *"all deduped by an in-flight guard"* clause and annotation (a)'s *"every tick goes through the same in-flight guard, so a slow answer is never stacked on"* are unchanged and re-affirmed. Annotation (k), on **consequence (a)**: the hub's credentialed-GET count was three and is four, plus a cold-load fifth. Annotated in place; nothing deleted; references qualify the letter, on ADR-0060's own standing rule.

**Letter hygiene.** Three lettered series meet here: this ADR's own consequences (a)–(m), ADR-0060's annotation series (now through (k)), and ADR-0060's natively lettered Consequences. A bare "(a)" is ambiguous, so every cross-reference qualifies **and names the document** — "ADR-0060 annotation (j)", "ADR-0060 consequence (a)", "ADR-0072 consequence (j)".

## Context

[#149](https://github.com/fernandolisboa/miolos/issues/149) established the
ordering rule for the authenticated read surface: a mount fetch awaits
`ensureSession()` before it reads, because on a **re-mint load** — a returning
player whose cookie expired, so the layout mints afresh on that page load — a
bare mount fetch races `POST /session` into the 401 branch and the surface
reads empty for that whole load. Seven hooks now do it.

The eighth reader is not a hook. `apps/web/src/day/day-truth.ts` is a
`useSyncExternalStore` module store (ADR-0060 decision 5) with page-lifetime
state and six trigger sites, and #149's `await ensureSession()` does not
transplant into it. Its `refresh()` is synchronous and sets `inFlight = true`
**before** the fetch, so awaiting the mint inside it changes what the guard
means — and `refreshDayTruth()` (#64, ADR-0070) is a second entry point with
its own documented no-loop proof.

The loss when `/day` 401s is real but mild: `useDayState` falls back to this
device's own play record, so the player's own completions still render and
only the cross-device half reads as pending. It is also self-healing, on
`focus`, `visibilitychange`, `online` or at worst the 60 s poll.

## Decision

1. **`refresh()` stays UNORDERED against the mint.** It fires immediately, as
   it does today. The prologue `if (inFlight) { return; } inFlight = true;` is
   unchanged.
2. **A fetch that answers `undefined` while the store holds no server truth
   for this page load spends a PAGE-LIFETIME ONE-SHOT repair:**
   `ensureSession()`, then one more `refresh()`, scheduled **after** the guard
   has been released. `mintRepairSpent` is set *before* the mint is awaited
   and is never cleared, and both entry points share it.
3. **`inFlight` keeps both of its properties** — set synchronously (P1), and
   held for exactly one `GET /day` (P2). The rule, stated once so it can be
   cited: **the guard is held across exactly the one `GET /day` it exists to
   dedupe, and nothing else is ever awaited under it.**

   Stated that way deliberately, rather than as "no promise that can hang is
   ever awaited under the guard" — which would be false of the code it
   governs. `fetchDayTruth()` calls `fetch` with no `AbortSignal` and no
   timeout, so the one request held under the guard *can itself* hang, and
   that residual is accepted unmitigated: it is the request the guard exists
   for, and a mitigation would be a second decision. What the rule forbids is
   *widening* the guard to cover anything else — which is what disqualified
   ordering the fetch behind `ensureSession()`.
4. **The repair is wired to the `next === undefined` arm only, never
   `.catch`.** The catch arm is unreachable through the shipped client, and
   `T-WEB-S246` stubs a rejecting client precisely to prove the guard's
   correctness is local.
5. **The hub's split arrival order is left as it is.** `/day` stays in the
   early wave; the seven mint-ordered reads stay in the later one. #195 does
   not merge the waves.

### Why decision 1 rather than the obvious mirror of #149

`ensureSession()` **has no timeout**, and its cached `pending` never settles
if `POST /session` hangs. Holding `inFlight` across it — inside `refresh()` or
inside `day-client.ts` — reproduces on a new path exactly the harm the
module's longest comment exists to prevent: *"With the reset inside the
`then`, one escaping rejection leaves `inFlight === true` for the lifetime of
the page: every later trigger, `online` recovery included, is swallowed by the
guard and there is no way back short of a reload."* A hanging mint reaches
that end state with **no rejection at all**, so there is nothing for `finally`
to release. Today a dead mint costs the page one 401 on `/day` and every other
trigger keeps working. That is a disqualification, not a cost.

The second reason is the round trip. `ensureSession()` POSTs unconditionally,
with no client-side cookie check, so ordering `/day` charges **every warm
load** — the overwhelmingly common one — a round trip on the read that decides
whether a hub tile paints as a call to action or as *Feito*, in order to fix
only the loads whose cookie had expired. Decision 5 rests on the same count:
round trips, which are counted. It deliberately does **not** rest on reflow,
which nothing here has measured (consequence (i)).

## Rejected

- **(a1) Guard-then-mint** — `await ensureSession()` under `inFlight`.
  Disqualified by the hanging mint, above.
- **(c) Mint inside `day-client.ts`** — same disqualification, and two more:
  it makes a minting `/day` client the one asymmetric one of five, against
  that module's own *"three clients that read the authenticated surface should
  fail the same way"*; and it reds `T-WEB-S234`'s env-unset arm at
  `expect(errorSpy).toHaveBeenCalledTimes(1)`, because `mintSession` logs its
  own skip line first.
- **(b) Subscribe-only ordering** — leaves `refreshDayTruth()` firing
  unordered, which relocates the defect to the conclusion screen *and* lets
  the unordered fetch take the guard and swallow the ordered one. Closing the
  trap makes it (a2) with extra branching.
- **(f) First-refresh-only** — (a2) plus a module boolean, plus (b)'s trap.
  Nothing bought.
- **(a2) Mint-then-check-and-set-the-guard** — safe, and the real runner-up.
  It loses on four counts: it costs every warm load a round trip; it makes
  ADR-0070 consequence (h) false **as written** (*"sets the guard
  synchronously"*), which `T-WEB-S329`'s own comment repeats as the reason its
  first version was wrong; its rescue argument is an unverified claim about
  `.then` continuations draining in registration order; and it moves 30 exact,
  non-URL-filtered `toHaveBeenCalledTimes` assertions across 11 of
  `day-truth.test.tsx`'s 18 cases, several read synchronously right after
  `renderHook`.
- **(d) Accept the skew** — defensible, and strictly dominated: decision 2
  buys everything (d) buys and additionally repairs the defect, for one extra
  401-answering `GET /day` on loads that were already answering 401.
- **(e-narrow) Condition the repair on the mint being UNSETTLED when the fetch
  began** — the direct answer to the strongest objection against decision 2
  (consequence (j)), and rejected on three counts. It **does not fix what it
  is sold on**: the repair fires at most once and only while no truth is held,
  so in practice it fires on the mount fetch, where the mint is unsettled
  anyway — the 5xx retry and the cookie-blocked browser's per-load cost both
  survive it unchanged. **"Settled" is not monotone**: `remintSession()`
  *replaces* the cached promise (`pending = attempt.then(() => undefined);`),
  so a flag set by the first `pending`'s `.finally` describes a promise
  `ensureSession()` no longer returns, and a correct predicate needs a second
  copy of `bootstrap.ts`'s hardest state machine. And it **widens
  `bootstrap.ts`'s public surface for a read path**, reversing decision 2's
  shape, in which the store treats the mint as an opaque promise it awaits
  once.

## Consequences

- **(a)** `/day` stays at ~1 RTT on a warm load, and `day-truth` is the only
  reader of eight that is not mint-ordered. The warrant is structural: it is a
  module store with page-lifetime state and six trigger sites, not a hook with
  a per-consumer `cancelled` flag.
- **(b)** A cold or re-mint load pays **one extra `GET /day`** — the same ~2
  RTT the ordering candidates would have cost it, one more request, of the
  kind that load was already paying.
- **(c)** An offline load spends the one-shot on a second failing `/day`.
  Bounded at one per page load.
- **(d)** `src/day/day-truth.ts` gains an **outbound** import of
  `src/session/bootstrap`. No wall is breached: `T-WEB-S244` constrains
  **inbound** importers of `src/day` and excludes files under `src/day/`
  itself, and the free-play wall bans `../day/**` and `src/session` from free
  play by name and non-transitively (free play imports neither). The bundle
  delta for `/` is measured in the PR, not assumed.

  **The store therefore becomes a surface that CAN mint, and what stops it is
  a property of the app rather than of this module.** `app/layout.tsx` is the
  only layout and renders `<SessionBootstrap/>` ahead of `{children}`, so
  `ensureSession()`'s cached promise is always already pending by the time a
  full `GET /day` round trip has returned — the repair joins a mint, never
  starts one. Render the day island under a layout that does not bootstrap —
  a new route group, an embedded hub, a screenshot harness — and a pure read
  path mints one anonymous user per load. Pinned by `T-WEB-S345`'s third
  case rather than left as an unwritten assumption.
- **(e)** **ADR-0070 consequence (h) stays true as written and is deliberately
  not annotated.** Its bound is *"at most one per genuine `pending →
  recorded` transition"* — per transition — while this repair is per page load
  and is shared by both entry points, so it does not enter that bound.
  Consequence (i)'s droppable-nudge residual is not widened, because the
  guard's hold is unchanged. Recorded here so the two ADRs agree without a
  second edit.
- **(f)** Residual **R1**: the repair's own `refresh()` can be swallowed if an
  unrelated trigger takes the guard in the microtask gap after the mint
  resolves. Same family as ADR-0070 consequence (i) — *"`refresh()` discards a
  trigger that arrives while `inFlight`; it does not coalesce a trailing
  fetch"* — self-healing on the same schedule, and the swallowing trigger is
  itself a `GET /day`.
- **(g)** Residual **R2**: a **mid-session cookie expiry**, where the store
  already holds today's truth, is not repaired — `payload === undefined` is
  false. Deliberate: `remintSession()` is not for read paths (its one-per-load
  allowance exists for write paths that would otherwise strand a completion),
  and the retained payload is ADR-0060 decision 5's own contract.
- **(h)** ADR-0060 consequence (c)'s stated mechanism — *"`impeccable detect`
  launches a clean browser profile: no session, `/day` answers 401"* — stays
  true, where every ordering candidate would have falsified it; a second,
  repaired `/day` then lands with four `pending`s, the same composition a
  freshly minted user has. *(Reasoning, **unmeasured**; it changes nothing the
  gate checks.)*
- **(i)** **Open question, deliberately unanswered:** whether either hub wave
  moves layout at paint. `page.module.css` gives `.cta` and `.done` the same
  `min-height: var(--cta-box-min-height)` and `.done`'s comment says *"in the
  same reserved box as the pending button"*, so the box was reserved on
  purpose — but nothing has measured the settled result. Decision 5 does not
  depend on it. **Recipe for whoever measures it:** a seeded session, not
  `impeccable detect`'s clean profile, which only ever shows the settled zero
  state.
- **(j)** **The trigger is a STATE — "any empty answer while no truth is
  held" — never a CAUSE, and `undefined` has five causes.** `day-client.ts`
  states the contract: *"EVERY FAILURE PATH ANSWERS `undefined`, and
  `undefined` means 'no server truth, for any reason'."* The five: (1)
  `NEXT_PUBLIC_API_URL` unset; (2) **any** `!response.ok` — 401, 403, 404, 429,
  5xx alike; (3) a 200 whose body fails the schema; (4) any thrown fetch —
  offline, DNS, CORS; and only *within* (2) is (5) the 401 this ADR is about.
  The repair fires on all five. That is deliberate — narrowing on cause is
  (e-narrow), rejected above — but it is stated rather than left to be
  discovered, because "repairs after the mint" is not what the mechanism does
  on four of the five paths.
- **(k)** **Two costs follow from (j), and both are accepted with their
  names.** First, **a 5xx or 429 on `/day` degenerates the repair into a
  zero-delay retry-once against an already-failing API** — the mint is settled
  or resolves immediately, so there is no delay between the two calls: a ~2x
  amplification on `/day` at exactly the moment `/day` is failing, bounded at
  one per page load, which is why it ships. Second, **a cookie-blocked
  browser** (ITP, private mode, third-party-cookie policy) discards the cookie
  `POST /session` sets, so `/day` 401s forever: for that population the extra
  request is not a rare cold-load cost but **the steady state, on every hard
  load, permanently**. Consequence (b) is the common case; this is the tail,
  and the two must be read together. Residual **R4** rides here too: the flag
  is set before the await, so a hung `POST /session` burns the one-shot with
  the repair's `.then` never running, and a later `remintSession()` from
  `play/sync.ts` or `termo/guess-client.ts` can land a working identity while
  the store still awaits the dead promise — bounded by the 60 s poll.
- **(l)** **The store fires the repair BLIND, and that is forced rather than
  chosen.** `ensureSession(): Promise<void>` discards `mintSession`'s boolean,
  so the store cannot tell a mint that landed an identity from one that
  resolved `false` with no `Set-Cookie`; it spends the one-shot either way,
  and on the latter the second `GET /day` is guaranteed useless. Reading the
  boolean means `remintSession()`, which decision 2 refuses for a read path
  (consequence (g)). One wasted request per page load, worst case.
- **(m)** **`src/day` can now open the telemetry gate.** A repair calls
  `ensureSession()`, whose `.finally` calls `markSessionReady()` — *"THE
  TELEMETRY GATE OPENS WHEN THE MINT SETTLES (#33, ADR-0069)"*. In any suite
  or page where the repair is the first thing to touch `ensureSession()`, the
  day store is what drains the telemetry buffer. Harmless — the gate is
  idempotent and opens on failure too, by design — but it is a new
  cross-module reach and ADR-0069 should be findable from here. **No ADR-0069
  annotation is owed**: its rule is *when* the gate opens (the mint settles),
  not *who* triggers the mint, and that is unchanged.

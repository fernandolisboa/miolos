# ADR-0004 — No unpublished puzzle reaches the client

**Status:** Accepted — 2026-07-29
**Depends on:** [ADR-0001](./0001-web-is-the-launch-platform.md)
**Supersedes:** the offline caching line in [`docs/handoffs/001-handoff-project-foundation.md`](../handoffs/001-handoff-project-foundation.md) — *"App offline-friendly: cache dos próximos 2–3 dias de puzzles."*

## Context

The handoff specified caching the next 2–3 days of puzzles. That was written for a native app. On the web, pre-caching future puzzles means shipping tomorrow's puzzle into Cache Storage today, where anyone can read it from developer tools.

For the grid games this is a minor leak — the puzzle is solvable by a solver anyway. For Termo it is fatal: offline letter feedback requires the answer word on the client, so pre-caching means tomorrow's answer sits in every browser a day early. One person posting it breaks the "same puzzle for all of Brazil" ritual, which is the product.

The threat that matters here is **spoiler broadcast**, not individual cheating. There is nothing to cheat for — v1 has no global ranking (a product veto), so a cheated streak only cheats its owner.

### The rejected schemes, and why

**Client-derived key (hash chain over adjacent days' puzzles).** Considered and rejected as cryptographically unsound. A hash is a public function: if the client can derive the key from data it already holds, it can derive it the moment the payload arrives, not at midnight. Chaining adds steps, not secrecy. It is also circular — deriving tomorrow's key from tomorrow's puzzle requires tomorrow's puzzle already decrypted.

**Verifiable delay functions / time-lock puzzles.** Real cryptography, wrong tool. The work is hardware-relative, so a lock tuned to open in 24 hours on a low-end Android opens in an hour on a desktop, and sustaining hours of sequential squaring in a browser tab is not shippable.

**Server-held key released at midnight.** Sound, but it still requires the network at midnight — so it delivers no offline benefit at rollover. Its only real gain is fetching 32 bytes instead of a full payload.

## Decision

**Nothing unpublished is ever sent to the client.** Today's puzzles are fetched at or after the `America/Sao_Paulo` midnight rollover.

Offline support covers the scenario that actually exists: **mid-puzzle**. A puzzle loaded while online keeps working when the connection drops, validates locally for responsiveness, and syncs completion when connectivity returns. The server remains authoritative for completion and streak, as the handoff already requires.

Tomorrow's **shell** may be prefetched — route, layout, fonts, app skeleton — never its content.

## Consequences

- The publishing API must not expose puzzles before their publication instant, and this deserves a test, not just care.
- Today's Termo answer necessarily reaches the client at midnight. That is unavoidable and acceptable; only pre-release is the problem.
- Local validation is a responsiveness affordance only. Never a source of truth.
- Users who are offline at rollover cannot start the day's puzzle. Accepted.

## Parked: encrypted prefetch

If rollover latency on poor mobile connections turns out to hurt real users, the correct fix is prefetching an encrypted payload with a **server-held** key released at midnight — the only sound variant. Trigger condition: measured rollover failures or latency complaints on Brazilian mobile networks. Not before.

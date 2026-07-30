# ADR-0001 — Web is the launch platform

**Status:** Accepted — 2026-07-29
**Superseded in part by:** [ADR-0003](./0003-anonymous-first-identity-with-email-recovery.md) (identity), [ADR-0004](./0004-no-unpublished-puzzle-reaches-the-client.md) (offline caching)
**Supersedes:** the milestone sequencing in [`docs/handoffs/001-handoff-project-foundation.md`](../handoffs/001-handoff-project-foundation.md), which placed a web version after the Android launch.

## Context

The founding handoff scoped Miolos as an Android-first mobile app (M4 — Android launch), with iOS and "futura versão web" after it. `apps/api` was already Next.js and a web version was already named as a `/wayfinder` block, so web was anticipated — just sequenced last.

Two things argued for moving it to the front:

- **Distribution.** The cultural comparable in Brazil, Termo, spread through shared links in a browser. App-store installation suppresses exactly that mechanic. A daily puzzle is a link-shaped product.
- **Solo-developer cycle time.** Web has no store review, no build queue, no beta track, no store listing paperwork, and no multi-day turnaround to ship a fix. Shipping to real users months earlier makes the eventual mobile app better, not worse.

The strongest counter-argument was retention: the streak is the spine of the product and depends on a "streak at risk" push notification, which is weak on iOS Safari. Research (see [`docs/research/004-research-web-native-code-sharing.md`](../research/004-research-web-native-code-sharing.md)) found that Web Push covers the entire v1 notification requirement **on Android and desktop, and on iOS 16.4+ only for home-screen-installed apps**. The ADR-0001 decision therefore rests on Brazil's Android-dominant smartphone share — **sourced 2026-07-30: Android 78.96% / iOS 21.03%, StatCounter, June 2026** (see [`docs/research/005-research-miolos-name-check.md`](../research/005-research-miolos-name-check.md); note iOS is trending upward, ≈18.5% early 2025 → 21% mid-2026). Requiring an iOS user to install the PWA reintroduces exactly the friction web-first was chosen to escape. This remains the weakest point of this decision — Android dominance holds at roughly 4:1, but the iOS fifth is growing.

## Decision

**Web is the launch platform.** Native iOS and Android follow it.

Everything the founding handoff locks about the *product* — the four games and their order, the fixed midnight `America/Sao_Paulo` rollover, streak rules, the monetization vetoes, pt-BR only — is unaffected. This changes the delivery surface and the milestone order, nothing else.

## Consequences

- The milestone map is rewritten: M0's foundation targets web, and "M4 — Android launch" becomes a web launch with native moving after it. Expo and EAS leave M0.
- Server-side streak computation becomes more important, not less: a browser client is even less trustworthy as a clock than a phone.
- Anonymous-first identity had to be reconsidered. "Device → JWT" on the web means a cookie or `localStorage` entry, which a user can clear — and losing a streak that way is a product-level failure. **Resolved by [ADR-0003](./0003-anonymous-first-identity-with-email-recovery.md).**
- Offline support becomes a service worker / PWA concern rather than a native cache. Its scope was then narrowed by **[ADR-0004](./0004-no-unpublished-puzzle-reaches-the-client.md)**: today's puzzle only, never a future day. No milestone yet owns the PWA manifest and service worker — they gate both push and offline, and need one.
- Per-day, per-game URLs and Open Graph share cards become launch features rather than nice-to-haves, since they are the distribution mechanism.

## Follow-ups

- ~~Resolve web anonymous identity and streak durability.~~ → [ADR-0003](./0003-anonymous-first-identity-with-email-recovery.md)
- ~~Amend the founding handoff's milestone section.~~ → amendment table at the top of the handoff
- **Open:** the push/retention model on web, including the installed-PWA requirement on iOS. ~~The Android-share figure the decision rests on.~~ → sourced, [`docs/research/005-research-miolos-name-check.md`](../research/005-research-miolos-name-check.md) (StatCounter, June 2026: 78.96% / 21.03%).
- ~~Which milestone owns the PWA manifest and service worker.~~ → decided 2026-07-30: the manifest ships in M1 (static, cheap, installability from the first playable game); the service worker ships in M3 with push, its first real consumer. Offline mid-puzzle ([ADR-0004](./0004-no-unpublished-puzzle-reaches-the-client.md)) needs no service worker — in-flight state lives in memory/local storage; offline *reload* is a post-launch nicety. Recorded in the README milestone map.

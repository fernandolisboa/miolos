# ADR-0001 — Web is the launch platform

**Status:** Accepted — 2026-07-29
**Supersedes:** the milestone sequencing in [`docs/handoffs/001-handoff-project-foundation.md`](../handoffs/001-handoff-project-foundation.md), which placed a web version after the Android launch.

## Context

The founding handoff scoped Miolos as an Android-first mobile app (M4 — Android launch), with iOS and "futura versão web" after it. `apps/api` was already Next.js and a web version was already named as a `/wayfinder` block, so web was anticipated — just sequenced last.

Two things argued for moving it to the front:

- **Distribution.** The cultural comparable in Brazil, Termo, spread through shared links in a browser. App-store installation suppresses exactly that mechanic. A daily puzzle is a link-shaped product.
- **Solo-developer cycle time.** Web has no store review, no build queue, no beta track, no store listing paperwork, and no multi-day turnaround to ship a fix. Shipping to real users months earlier makes the eventual mobile app better, not worse.

The strongest counter-argument was retention: the streak is the spine of the product and depends on a "streak at risk" push notification, which is weak on iOS Safari. Research (see [`docs/research/004-research-web-native-code-sharing.md`](../research/004-research-web-native-code-sharing.md)) found the Web Push API covers this requirement on the platforms that matter at launch, retiring most of that risk. It remains the weakest point of this decision.

## Decision

**Web is the launch platform.** Native iOS and Android follow it.

Everything the founding handoff locks about the *product* — the four games and their order, the fixed midnight `America/Sao_Paulo` rollover, streak rules, the monetization vetoes, pt-BR only — is unaffected. This changes the delivery surface and the milestone order, nothing else.

## Consequences

- The milestone map is rewritten: M0's foundation targets web, and "M4 — Android launch" becomes a web launch with native moving after it. Expo and EAS leave M0.
- Server-side streak computation becomes more important, not less: a browser client is even less trustworthy as a clock than a phone.
- Anonymous-first identity has to be reconsidered. "Device → JWT" on the web means a cookie or `localStorage` entry, which a user can clear — and losing a streak that way is a product-level failure. **Open question, not yet decided.**
- Offline support for the next 2–3 days of puzzles becomes a service worker / PWA concern rather than a native cache.
- Per-day, per-game URLs and Open Graph share cards become launch features rather than nice-to-haves, since they are the distribution mechanism.

## Follow-ups

- Resolve web anonymous identity and streak durability.
- Resolve the push/retention model on web, including the installed-PWA requirement on iOS.
- Amend the founding handoff's milestone section once the remaining grilling questions are settled.

# ADR-0006 — Monetize convenience, never access. No currency, no third-party banner.

**Status:** Accepted — 2026-07-29
**Depends on:** [ADR-0005](./0005-all-content-is-free.md)
**Upholds:** two vetoes in [`docs/handoffs/001-handoff-project-foundation.md`](../handoffs/001-handoff-project-foundation.md) (virtual currency, accumulable balance) and **narrows a third** — the banner veto now covers third-party creative specifically. Each was explicitly reconsidered, not deferred to.

## Context

With all content free ([ADR-0005](./0005-all-content-is-free.md)), the question is what — if anything — is ever sold. A virtual coin currency for hints, funded by purchase or by rewarded ads, plus a small dismissible banner shown once or twice a day, was proposed and considered seriously.

Three handoff vetoes were at stake: *"Proibido: moeda virtual…"*, *"Sem saldo acumulável"*, and *"Banner: nunca."* The first two are upheld unchanged. The third is **narrowed**: third-party banners remain forbidden, while an in-layout promo whose creative is ours becomes permitted. Reasons below, rather than deference.

## Decision

The principle: **monetize convenience, never access.** No puzzle is ever behind a payment.

**No virtual currency, and no accumulable balance.** Extra hints are earned by a rewarded ad, batched and day-scoped: one ad grants three hints, valid for that day, expiring at the `America/Sao_Paulo` midnight rollover. No wallet, no balance, no ledger.

**No third-party banner, ever.** The already-planned model stands: an interstitial after puzzle completion with a frequency cap, plus rewarded opt-in. A single-purchase entitlement (~R$ 10) removes ads.

**In-layout promotion is permitted only when the creative is ours.** A small dismissible house strip — promoting ad removal or a new game — is fully controllable and may be beautiful. The prohibition is on third-party creative in the layout, not on in-layout units as such.

All of this remains **designed but dormant** at launch, as the handoff requires. Launch is free and clean, with no ads SDK embedded.

## Rationale

### Why no currency

The stated goal was that non-paying players should still get hints. **Rewarded-ad-per-hint already achieves that**, and it is what the handoff specifies. A currency adds a wallet, a balance, a purchase flow, an ad-reward ledger with fraud handling, and an economy to balance — for one real benefit: batching, so players don't watch an ad per hint.

Session-scoped batching delivers that benefit with none of the machinery.

The register matters too. A coin balance with a `+` button is the visual language of *plástico, infantil, barulhento* — the design brief's own anti-list — against a product whose guiding words are *editorial, adulto, confiante*. NYT Games, the stated reference, has no coins.

### Why no third-party banner

**The creative is uncontrollable.** A banner is a hole in the page where a third party puts whatever it likes, inside a layout built on warm paper, hairline rules and typographic restraint.

**The revenue is negligible.** A small dismissible banner at one or two impressions per user per day, at banner CPMs, is rounding error — and on web a large share of desktop users block it outright.

**On web it costs distribution.** Banners cause layout shift, layout shift hits Core Web Vitals, and Core Web Vitals affect search ranking. Organic search is now part of how users find Miolos. This argument did not exist when the handoff was written for an app store; it makes the original veto stronger, not weaker.

The planned interstitial-plus-rewarded model earns more, sits outside the layout, and arrives after the ritual rather than during it.

## Consequences

- **M0 builds these seams and no others:** `entitlements: string[]` (an array, never a boolean), remote feature flags, and an `<AdSlot placement="…"/>` component that renders nothing **but reserves its final dimensions** per placement (`min-height`/`aspect-ratio`, transparent). A slot that occupies no space would insert layout when activated — reproducing exactly the layout shift this ADR disqualifies banners for. Activation must be a paint, not a reflow.
- **No wallet or transaction ledger in the schema.** This is the concrete saving from rejecting currency.
- Hint grants expire at the next `America/Sao_Paulo` rollover and are recorded **server-side** against user and day — not browser `sessionStorage` (which dies with the tab, a different lifetime) and not a persisted balance. Server-side matters if any curated medal ever depends on "solved without hints".
- Revenue at launch is zero by design. If it ever needs to be non-zero, the levers are ad removal, new premium game types, or seasons — never access to the daily.
- A deliberately ridiculous medal for a caught cheater remains available as **a curated medal**, which the handoff already allows. It is not an anti-cheat system, and no detection infrastructure is being built for a rank that v1 does not have.

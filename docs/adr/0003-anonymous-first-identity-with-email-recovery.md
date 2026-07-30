# ADR-0003 — Anonymous-first identity, with email attached once the streak has value

**Status:** Accepted — 2026-07-29
**Depends on:** [ADR-0001](./0001-web-is-the-launch-platform.md)
**Amends:** the auth section of [`docs/handoffs/001-handoff-project-foundation.md`](../handoffs/001-handoff-project-foundation.md)

## Context

The founding handoff specified anonymous-first auth: device → JWT, a real account in Postgres, with social login as a later upgrade that merges the anonymous account. On native that works well — the token lives in device storage and effectively survives forever.

On the web the same design degrades badly. The token is a cookie or a `localStorage` entry. Clearing site data destroys it. Switching from a phone browser to a laptop is indistinguishable from being a different person. Since the streak is the spine of the product, a forty-day streak disappearing because someone cleared cookies is the worst single failure this product can produce — and it is a failure the user will blame us for, correctly.

Requiring an account up front was rejected: it contradicts the handoff's anonymous-first decision and puts friction in front of the first play, which is the moment the product has to prove itself.

## Decision

**Anonymous-first is retained. The first play requires nothing.**

Once the streak reaches a threshold — starting at **5 days**, tunable — the user is prompted once to attach an **email address**. No password. A magic link both recovers a lost streak and moves it to another device.

Social login (Sign in with Apple, Google) remains a post-launch upgrade as originally planned.

## Rationale

The handoff's reason for anonymous-first was removing friction from the first play, and that reason survives intact — the first play is still zero-friction. What changes is *when* the ask arrives: after the product has proven itself and the user has something worth protecting. That is when people actually accept an account prompt.

It mirrors a pattern already in the handoff: push opt-in is requested at streak ≥ 3, for the same reason.

It also solves cross-device, which web-first makes a real scenario rather than an edge case. Phone browser at breakfast, laptop at lunch — without this, those are two users with two streaks.

## Consequences

- The M0 `users` schema must carry a nullable `email` and a verification state from the start, alongside the already-planned nullable `apple_id` / `google_id`. Getting this right at M0 is cheap; migrating identity later with live streaks attached is not.
- A magic-link flow is needed at launch, not post-launch — meaning transactional email is an M0-or-M1 dependency.
- Account merge logic (anonymous → identified) is needed earlier than the handoff assumed, since attaching an email to an existing anonymous account is exactly that merge.
- The threshold is a product tuning knob, not a constant. It belongs in remote config, not in a compiled constant.
- Email becomes a second retention channel, which reduces dependence on web push.

# ADR-0161 — Miolos mail has one address: miolos@filx.app

**Status:** Accepted — 2026-11-05
**Amends:** [ADR-0160](./0160-transactional-mail-sends-from-filx-app.md) decision 2 (the reply-to); [ADR-0050](./0050-email-attach-magic-link-tokens-consents-and-the-lgpd-minimum.md) decision 12, [ADR-0069](./0069-telemetry-is-five-server-anchored-events-over-a-hand-rolled-capture.md) decision 5 and [ADR-0148](./0148-measurements-are-turned-off-per-account-inside-the-capture.md) (the mailbox they name)

## Context

ADR-0160 sent mail as `Miolos <miolos@filx.app>` with `reply_to: privacidade@miolos.app`, because `filx.app` had no inbound mail. The same day, Proton Mail's three-domain limit made Fernando remove `miolos.app` from Proton and add `filx.app`, with a real `miolos@filx.app` mailbox. So `privacidade@miolos.app` no longer exists, and the reply-to, `/privacidade` and `/termos` all pointed at a dead address.

## Decision

1. `miolos@filx.app` is the one published contact: the privacy channel on `/privacidade` (the LGPD channel, ADR-0012), the contact on `/termos`, and the sender. It is `contactEmail` in `apps/web/src/i18n/messages.ts`.
2. Sends carry no `reply_to`: the sender (`SENDER` in `apps/api/src/email/transport.ts`) receives replies itself.

## Consequences

- A reply to the magic link or the reminder reaches the same mailbox as a privacy request.
- `VAPID_SUBJECT` on miolos-api production should name the same address; it is an env var, outside this diff.

## Rejected

- **A separate `privacidade.miolos@filx.app`:** costs a Proton address and a second inbox to watch, for a channel the law only needs to work.

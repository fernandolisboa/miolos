# ADR-0160 — Transactional mail sends from filx.app

**Status:** Accepted — 2026-11-05
**Amends:** [ADR-0050](./0050-email-attach-magic-link-tokens-consents-and-the-lgpd-minimum.md) decision 10 (the sender identity)

## Context

The magic link and the streak reminder were sent as `Miolos <conta@miolos.app>` through Resend, on the `miolos.app` sending domain. Fernando's other apps, Feudo and Fetha, also borrowed that domain (`feudo@miolos.app`, `fetha@miolos.app`), all in one Resend team. Resend's free plan allows three domains per team, and Fernando wants Refogando and Palpiteiro to keep their own, since a recipe site sending magic links from a developer domain reads worse than a games site doing it. On 2026-11-05 he decided that Miolos, Feudo and Fetha send from `filx.app`, the domain of his company FILX Tecnologia, and that `miolos.app` leaves Resend.

## Decision

1. `sendMagicLinkEmail` and `sendReminderEmail` send as `Miolos <miolos@filx.app>` (`SENDER` in `apps/api/src/email/transport.ts`), the same local-part-per-app pattern as `feudo@filx.app` and `fetha@filx.app`.
2. Every send carries `reply_to: privacidade@miolos.app`. `filx.app` has no inbound mail, so a reply to the sender would bounce; `privacidade@miolos.app` is a real mailbox (Proton Mail) and already the published human channel.
3. The sender stays a module-private literal, as ADR-0050 decision 10 says: it is bound to the domain verified in Resend, not to a deployment.

## Consequences

- The deploy that ships this must run after `filx.app` is *Verified* in the Resend team that `RESEND_API_KEY` belongs to. Before that, Resend refuses the send: `POST /attach/request` answers 502 and reminders count as failed.
- If the key is restricted to `miolos.app`, it must be replaced by one allowed to send from `filx.app` before the merge; the new value reaches the function with this deploy.
- The sender domain no longer matches the links (`miolos.app`). Accepted: the sender names the developer, FILX; the display name stays "Miolos".
- `miolos.app` keeps its Proton Mail and Google verification records; only the three Resend records (`resend._domainkey`, `send` MX and TXT) go once nothing sends from it.

## Rejected

- **Keep Miolos on `miolos.app`, move only Feudo and Fetha:** better brand match on the magic link, but it spends one of the three free domains that Refogando and Palpiteiro need.
- **Sender from an env var:** lets the address drift from the verified domain without a review, which is why ADR-0050 decision 10 made it a literal.

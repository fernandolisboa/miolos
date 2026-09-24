# ADR-0012 — Minimal LGPD ships with email attach; recovery and reminder consent are separate

**Status:** Accepted — 2026-07-30
**Amended by:** [ADR-0079](./0079-the-email-hedge-is-a-second-arm-of-the-one-tick.md) decision 6 — an interim mail withdrawal of the email reminder nulls its timestamp, so neither the given nor the withdrawn time survives it
**Depends on:** [ADR-0003](./0003-anonymous-first-identity-with-email-recovery.md)
**Amends:** the milestone placement of LGPD work in [`docs/handoffs/001-handoff-project-foundation.md`](../handoffs/001-handoff-project-foundation.md) (all of it in the launch milestone).

## Context

[ADR-0003](./0003-anonymous-first-identity-with-email-recovery.md) moved email collection to M1 — the magic-link flow ships with the first end-to-end game. The founding handoff scheduled LGPD work in the launch milestone (M4). That sequencing collects personal data for roughly three milestones before any documented legal basis exists, which is the actual exposure — LGPD's problem is not the launch date, it's the first byte of personal data stored.

There is also a consent-scope trap: consent given to *recover a streak* is not consent to *receive reminder emails*. One checkbox covering both would make the retention channel legally wobbly from day one.

## Decision

**The milestone that ships email attach ships the legal minimum with it (M1):**

- A privacy policy page — what is collected (email, completions, telemetry per the handoff), why, and how to request deletion.
- Purpose-limited consent language at the attach prompt: the email exists to recover and move the streak.
- **Two separate consents:** attaching an email (recovery — the account function) and receiving streak-at-risk reminder emails (a marketing-adjacent channel) are independent checkboxes, stored as independent flags. Reminder consent defaults to unchecked.

The **full** LGPD pass — data inventory, deletion flow polish, DPO contact, review of telemetry against the policy — stays in M4 as planned.

## Rejected

- **Everything at M4:** email collected for months under no documented basis; invisible debt until someone asks.
- **Full LGPD at M0:** front-loads a compliance workload before any feature exists to comply about; worst use of solo-developer time.

## Consequences

- The M0 `users` schema carries consent columns from the start: per-consent flag plus timestamp (when it was given or withdrawn). Adding consent tracking after live rows exist is the expensive path this ADR avoids.
- The streak-at-risk **email** channel ([ADR-0003](./0003-anonymous-first-identity-with-email-recovery.md) consequence) may only target users with reminder consent. Web push keeps its own opt-in (browser permission at streak ≥ 3, per the handoff) — two channels, two consents, never inferred from each other.
- The privacy policy is a public pt-BR page and part of M1's definition of done, not a launch-week scramble.

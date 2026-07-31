# ADR-0018 — i18n is an in-repo typed message module, not a library

**Status:** Accepted — 2026-07-31
**Depends on:** [ADR-0013](./0013-canonical-domain-and-pt-br-routes.md)

## Context

ADR-0013 requires user-facing strings externalized from the first screen, with route slugs living alongside the i18n strings. v1 is pt-BR only. An i18n library (next-intl and kin) buys locale negotiation, middleware and message-format runtimes that a single-locale product will not exercise, at the cost of a dependency — and CLAUDE.md says prefer fewer dependencies.

## Decision

An in-repo typed module under `apps/web/src/i18n/`:

- `messages.ts` — `export const messages = { … } as const` plus `export type Messages = typeof messages`. Pure values and pure value-returning functions (e.g. `completedOfTotal(done, total)`). All UI copy and metadata strings live here; components never carry string literals.
- `routes.ts` — `routeSlugs` map: English identifiers, pt-BR slugs, satisfying ADR-0013's "route slugs live with the i18n strings" from the first screen.
- The locale tag itself is exported (`locale = "pt-BR"`), used for `<html lang>` and `Intl` APIs, so locale tags are externalized too.

The module is web-only for now; it moves to a package only when a second consumer exists, per ADR-0002's rule for shared code.

## Rejected

- **next-intl (or any i18n library):** a dependency plus runtime indirection and middleware for exactly one locale.
- **Hardcoded strings "until i18n matters":** violates ADR-0013 and makes later extraction archaeology.

## Consequences

- Adding copy means editing one typed module; the compiler catches missing or misspelled keys at the call site.
- **Revisit trigger:** a second locale, or a second consumer of the strings. The `Messages` type is the migration contract — any library adopted later must be able to represent it.

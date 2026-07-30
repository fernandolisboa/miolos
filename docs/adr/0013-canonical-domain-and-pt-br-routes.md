# ADR-0013 — Canonical domain `miolos.app.br`; public routes in pt-BR

**Status:** Accepted — 2026-07-30
**Depends on:** [ADR-0001](./0001-web-is-the-launch-platform.md), [ADR-0007](./0007-separate-web-and-api-apps.md)
**Closes:** the `registro.br` pendency in [`docs/handoffs/001-handoff-project-foundation.md`](../handoffs/001-handoff-project-foundation.md) (pendência não-técnica 1), as far as engineering is concerned.

## Context

Nothing could hardcode a domain — magic links, OG cards, cookies, SEO all sit on it — until the name was checked. The check ran on 2026-07-30; full findings with process numbers in [`docs/research/005-research-miolos-name-check.md`](../research/005-research-miolos-name-check.md). The short version:

- **`miolos.com.br`** is registered to a third party but **expired 2026-06-04 and is on hold** at registro.br — if the holder doesn't pay, it enters the public release process and becomes registrable. No determinable drop date.
- **`miolos.app.br`** and **`miolos.app`** are available today.
- **INPI:** "MIOLOS" has never been filed as a trademark. Miolo Wine Group is confined to food/beverage classes — a non-issue. The real neighbours are Solis's "MIOLO" in classes 9/42 (specified as a software *development framework*, not a game) and a cluster of in-force "MIOLO"-formative marks in class 41 (education/media). Registering "MIOLOS" would face genuine citation risk; *using* the name commercially is a lower risk, since no prior holder operates a consumer game.

Separately, the permanent public URLs — the SEO surface — needed a language: `/arquivo/...` or `/archive/...`.

## Decision

- **`miolos.app.br` is the canonical domain.** Fernando registers it now (~R$40/yr). It alone unblocks every domain-dependent decision. `miolos.app` is not registered — a pre-launch solo project is not a squatting target.
- **`miolos.com.br` is monitored** via registro.br's release list. If it drops before web launch it becomes canonical; if after, it becomes a redirect. Its availability changes nothing in the spec either way.
- **The API is a sibling subdomain, `api.miolos.app.br`**, settling [ADR-0007](./0007-separate-web-and-api-apps.md)'s open cookie question: the anonymous session cookie is scoped to the shared parent domain.
- **Public route segments are pt-BR**: `/arquivo/...`, not `/archive/...`. The audience searches in Portuguese, the product is pt-BR only, and pt-BR slugs read as native in Brazilian search results. Code identifiers stay English; route slugs are externalized alongside the i18n strings so a future locale brings its own segments rather than inheriting Portuguese paths.
- **A trademark filing is deferred, and is not a launch gate.** The name is used; registration is revisited if the product grows into something worth defending, ideally with counsel, given the class-41 neighbours.

## Rejected

- **Waiting for `.com.br`:** months of blocked decisions against no guaranteed date, while someone else may take it.
- **Renaming:** the INPI picture is workable for use, the exact mark is unfiled, and the name is load-bearing in the founding documents.
- **English routes:** consistent with the code-language rule, but the visible URLs would mismatch the product language for the only audience v1 has.

## Consequences

- Magic links, OG cards, CORS config and cookie scope all target `miolos.app.br` / `api.miolos.app.br` from M0 onward.
- A canonical-domain swap (if `.com.br` drops pre-launch) is a config change plus redirects, not a code change — nothing may hardcode the apex outside environment config.
- Route slugs live with the i18n strings from the first route, even though v1 ships pt-BR only.
- Non-engineering follow-ups for Fernando: register `miolos.app.br`; watch the release list for `miolos.com.br`.

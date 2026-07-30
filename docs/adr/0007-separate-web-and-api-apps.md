# ADR-0007 — `apps/web` and `apps/api` stay separate

**Status:** Accepted — 2026-07-30
**Depends on:** [ADR-0002](./0002-plain-react-web-ui-not-universal-rn-web.md)
**Closes:** the open question flagged in the README when ADR-0002 landed.

## Context

Once the launch client became a Next.js app ([ADR-0002](./0002-plain-react-web-ui-not-universal-rn-web.md)), the founding handoff's `apps/api` — also Next.js, carrying the API and the publishing cron — became a plausible thing to merge into it. One Next.js app can serve the UI, the API routes and the cron.

The question was left deliberately open rather than guessed at, because it decides deployment shape and the identity of the backend the future native client talks to.

## Decision

**They stay separate.** `apps/web` is the launch client. `apps/api` owns the API surface and the publishing cron.

## Rationale

The decisive argument is [ADR-0002](./0002-plain-react-web-ui-not-universal-rn-web.md)'s consequence: the native client is a **separate implementation**. If the API lives inside the web app, the native client's backend is the web app — an awkward dependency that only gets worse as both grow. Keeping `apps/api` independent means the native client consumes a real backend rather than a web app's internals.

Secondary: the publishing cron is the most critical scheduled job in the product — every streak in Brazil depends on it. Decoupling its deployment from UI changes means a design tweak cannot take out publication.

## Consequences

- **Two deployments and two build pipelines.** More infrastructure for a solo developer than a merged app would need. Accepted.
- **The anonymous session cookie must work across both origins.** Whether that is a cookie scoped to a shared parent domain with `api.` as a sibling subdomain, or a proxy path, is an M0 implementation decision — but it must be settled *before* auth is built, because it constrains domain layout. This also interacts with the unresolved `registro.br` check on the name.
- **CORS becomes real configuration** rather than an afterthought.
- **Open sub-question for M0:** whether `apps/web` may read from `packages/db` directly for public, cacheable, server-rendered pages (the archive index, OG image generation), or whether every read goes through `apps/api`. Direct reads avoid a needless hop on SEO-critical pages; a single gateway keeps the boundary clean and the Neon connection count predictable. **`apps/api` owns all writes and the cron regardless.**
- The `apps/api` line in the founding handoff described it as "API + cron de publicação; futura versão web". The future web version is now `apps/web`; `apps/api` keeps the first two roles and sheds the third.

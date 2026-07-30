# ADR-0005 — All puzzle content is free: daily, archive, and free play

**Status:** Accepted — 2026-07-29
**Depends on:** [ADR-0001](./0001-web-is-the-launch-platform.md)
**Supersedes:** two lines in [`docs/handoffs/001-handoff-project-foundation.md`](../handoffs/001-handoff-project-foundation.md) — *"arquivo histórico/temas/stats avançadas são o inventário premium futuro"* and the launch cut *"sem modo livre"*.

## Context

The handoff scoped launch to the daily puzzle alone, cut free play explicitly, and earmarked the historical archive as future premium inventory.

Web-first breaks that reasoning in a way the handoff could not have anticipated. On native, a first-timer who exhausts the day's puzzles still has an icon on their home screen tomorrow. On the web they have nothing: they land, finish today's Binairo in four minutes, hit a wall with no streak started and no reason to return. That is the largest retention hole in the product, and it exists *because* of the platform change.

The archive also has a property it did not have on native: **it is indexable**. Hundreds of per-day, per-game URLs are an organic-search asset for a product whose distribution is link-shaped.

## Decision

**Everything is free. There is no gated puzzle content.**

- **Daily puzzles** — free, as always intended.
- **Archive of past dailies** — free, and public. Indexable.
- **Free play** — infinite auto-generated puzzles, at launch.

### Constraints on free play

**Free play never touches the streak, the statistics distributions, or the medals.** If generated puzzles fed the Termo distribution, the shared-comparison number would become meaningless and the daily would lose the scarcity that makes streaks work.

**Termo is excluded from free play initially.** The grid games are generator-driven and effectively infinite. Termo answers come from a finite, curated pt-BR word list (AI-curated since [ADR-0015](./0015-termo-word-list-is-ai-curated-under-mechanical-constraints.md); this line originally said "hand-curated"); spending it on free play would burn the scarcest content on the least valuable mode.

**Free play depends on the generators**, so it lands in M2 at the earliest — not M0.

## Consequences

- The project has no gated content inventory. Revenue, if it ever arrives, comes from the model in [ADR-0006](./0006-monetization-convenience-not-access.md), or from new content built later — premium game types, or seasons with a pass.
- **Seasons and premium games require continuous content creation**, which is the failure mode most likely to bite a solo developer. This is recorded so that "we'll monetize with seasons later" is not mistaken for a plan.
- The archive needs real routing and pagination from early on — it is public surface area, and it is SEO surface area.
- Puzzle generation must be callable on demand, not only from the publishing cron. `packages/games` being deterministic and dependency-free already supports this.

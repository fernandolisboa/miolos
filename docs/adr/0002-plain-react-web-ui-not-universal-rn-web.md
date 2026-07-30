# ADR-0002 — The web UI is plain React/Next.js, not universal react-native-web

**Status:** Accepted — 2026-07-29
**Depends on:** [ADR-0001](./0001-web-is-the-launch-platform.md)
**Evidence:** [`docs/research/003-research-universal-rn-web.md`](../research/003-research-universal-rn-web.md), [`docs/research/004-research-web-native-code-sharing.md`](../research/004-research-web-native-code-sharing.md)

## Context

With web as the launch platform, the question was whether the web UI should be built as a universal Expo Router + react-native-web app — one UI codebase later retargeted to native — or as a plain React/Next.js app, with a separate native UI built later.

The universal option was attractive for one reason: a solo developer maintaining two UI implementations forever. Two independent research passes were run against primary sources, one tasked with making the strongest case *for* the universal option.

The universal option is genuinely better than its reputation in several respects, and this is recorded so the decision is not read as dismissing it: Expo web is not second-class in 2026, static rendering is production-grade, and `<Head>` does emit real meta and OG tags into static HTML. A typography-led editorial precedent on the stack exists (theoutbound.com).

It still loses, on four verified facts.

**The author of react-native-web says this is not the use case.** Nicolas Gallagher, on the record (2024-04-01): RNW *"has always had the expectation that it be used for web-first development, where the extra semantics it provides for web simply no-op on native"*, and *"there is no investment at Meta in RNfWeb by either the Web or RN teams."* The no-op-on-native behaviour is the design contract, not a gap — the universal-codebase premise misreads the tool. The repository has had no commit since 2025-10-16; the recommended successor, React Strict DOM, is at `0.0.55`.

**RNW's `StyleSheet` has no media queries and no pseudo-classes.** An unmodified SDK 57 static export ships `style="max-width:-32px"` (invalid, from `Dimensions` returning width 0 on the server), a hardcoded light background, and zero occurrences of `prefers-color-scheme`. Dark mode from day one is a locked product requirement.

**The one strong precedent proves the point rather than refuting it.** theoutbound.com achieves its typography by bypassing both escape hatches — hand-written `@font-face` instead of `expo-font`, Tailwind with real CSS media queries instead of `StyleSheet` — and still ships three static font instances rather than a variable font, in a 1.78 MB bundle. Expo's own site hand-writes variable Inter rather than using `expo-font`. Taking those escape hatches collapses the universal codebase into a Tailwind web app hosted inside Expo Router, at which point the wrapper buys almost nothing.

**Measured cost:** Expo 291 KB gzip against Next.js 125 KB gzip, Lighthouse mobile total blocking time 126 ms against 16 ms. Tree shaking recovers 1%. RSC cannot be combined with `web.output: static`.

Separately, Puzzmo — named in this project's own design brief as an inspiration — launched on Expo/react-native-web with the same web-first reasoning, voted unanimously to abandon the native RN build, and removed React Native entirely in 2025. Their stated trigger was that a design-system redesign came out web-only.

## Decision

The web app is **plain React on Next.js**. `packages/games`, `packages/core` and a **tokens-first** `packages/ui` are shared; UI components are not.

`packages/ui` holds tokens and primitives — colour, type scale, spacing, radii, durations — not components. Visual identity stays consistent across platforms by construction; only layout is reimplemented.

No universal styling system is adopted. Tamagui's style-prop allowlist excludes `fontVariationSettings` and `fontVariantNumeric`, reachable only through a raw-style escape hatch that bypasses its compiler; Unistyles is the strongest of them but amounts to two style implementations in one file; StyleX has the full CSS surface and is web-only.

## Consequences

- Next.js `ImageResponse` gives per-day, per-game Open Graph share cards natively — the distribution mechanic from ADR-0001.
- Full CSS is available: variable font axes, `font-variant-numeric: tnum`, `text-wrap`, container queries, real `prefers-color-scheme` dark mode.
- **The native UI will be a separate implementation.** Evidence suggests this is far cheaper than feared — Puzzmo's entire iOS app is ~3k lines of Swift, roughly 0.5% of their TypeScript, with zero duplicated UI, because the portable artefact is a headless runtime contract rather than shared components. `packages/games` is already a stronger version of that contract. The shape of the native client is deliberately left open.
- If this is wrong, the reversal is the cheap direction: RN → web is mechanical and documented (one engineer converted hundreds of components in ~6 weeks). Web → RN is the lossy direction.
- **React Native has no `fontVariationSettings`** — both proposals remain open and unimplemented. Variable font axes are unavailable on native under *any* architecture, so a future native client needs static instances of Fraunces at chosen weights. This constrains the design brief, not just the code. `fontVariant: ['tabular-nums']` does work cross-platform, so the tabular-numerals mandate survives.

## Confidence

High on the technical facts — measured, and sourced to the maintainers and to first-party output. Lower on the organisational claim: the abandonment evidence is essentially n=1 (Puzzmo), and no comparably documented team that stayed universal and was glad could be found. That absence is weak evidence, not strong.

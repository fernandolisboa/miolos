# 004 — Research: two UIs sharing a core, vs. a universal styling system

**Question assessed:** for Miolos (web-first daily-puzzle app, native later, solo dev), is "plain React/Next.js web UI now + a separate Expo native UI later, sharing a non-UI core" the right call — and does any 2026 universal styling system dissolve the tradeoff?

**Scope note.** This document assesses **only** option (b) plus middle-grounds. A separate agent assessed the universal Expo Router + react-native-web option. Research date: **2026-07-29**. Every version number and date below was verified against the source on that date.

---

## Verdict

**Yes — build the web app as a plain React/Next.js app. Do not adopt a universal RN-web UI, and do not adopt a universal styling system to try to have both.**

Three things drive this, in order of weight:

1. **The closest comparable product in the world made exactly this decision, in this direction, and wrote it up.** Puzzmo — named as a primary inspiration in `docs/design/002-brief-design-direction.md` — launched on Expo/React-Native-Web as a universal codebase, spent 2024 regretting it, abandoned the RN native build, shipped a webview+Swift app instead, and in 2025 **removed React Native from the codebase entirely**. The stated trigger is the exact one Miolos faces: *"the re-design of today and games pages created a new design system which was web only."* ([Puzzmo Tech Stack: 2025](https://blog.puzzmo.com/posts/2025/12/9/tech-2025/), 2025-12-09.)

2. **No universal styling system gives full editorial typography control, and the one that gets closest is web-only.** Tamagui, Unistyles and NativeWind all render through `react-native-web` on web, and the platform-level ceiling is React Native's text model — which has **no `fontVariationSettings`** and therefore no variable font axes. Two RN proposals for it are still open and unimplemented (below). The system that *does* have full control — **StyleX** — is web-only, and is precisely what Puzzmo migrated to.

3. **The "two UIs forever" fear is mispriced, because the second UI is not a port of the first.** The design brief's own premises — variable font axes, `text-wrap`, hairline rules, container queries — are web-only capabilities. A native Miolos would have to be redesigned within RN's constraints regardless of which architecture you pick. A universal codebase does not buy you one design; it buys you the *intersection* of web and native capability, which is the native one. You pay the typography tax up front and still write platform branches.

**Corollary on sequencing:** the cheapest native path for Miolos, when the time comes, is probably not "a second Expo UI" at all. It is the Puzzmo path — a thin native shell around the already-offline-capable PWA, with native code only for the things that must be native (App Store billing, haptics, push, Game Center). Puzzmo's entire iOS app is **~3k lines of Swift, half of which is one natively-implemented game** — i.e. ~1.5k lines of shell against a ~280k-LOC TypeScript product ([Shipping the iOS App](https://blog.puzzmo.com/posts/2025/06/01/ios-app-architecture/), 2025-06-01). That is not "a second UI." Keep that option open; it does not require any decision today, and it is only available if the web app is a real web app.

**One legitimate hedge, and it is cheap:** keep `packages/games` exactly as the invariant already requires (pure TS, zero RN, zero Node, headless — no rendering at all). Keep the design system as *tokens plus web components*, not tokens plus a component abstraction layer. That is the entire portability investment needed. Details in §6.

---

## Findings

### 1. The tokens-only sharing pattern

**The W3C design-tokens spec is now stable, for the first time, and it is not a W3C standard.**

- **Design Tokens Format Module 2025.10** is a **Final Community Group Report**, published **28 October 2025**. Its status section states verbatim: *"This specification was published by the Design Tokens Community Group. It is not a W3C Standard nor is it on the W3C Standards Track."* Further changes will come via superseding specifications rather than revisions to this version. ([designtokens.org/tr/2025.10/format/](https://www.designtokens.org/tr/2025.10/format/))
- The **living editor's draft** at [designtokens.org/TR/drafts/format/](https://www.designtokens.org/TR/drafts/format/) is a **Draft Community Group Report dated 17 June 2026** and carries the warning: *"This is a preview… Do not attempt to implement this version of the specification. Do not reference this version as authoritative in any way."*
- Token types covered by 2025.10: color, dimension, fontFamily, fontWeight, duration, cubicBezier, number, plus composite types strokeStyle, border, transition, shadow, gradient, **typography**.

**What the spec covers is exactly the easy half.** `fontFamily`, `fontWeight`, `dimension`, `duration`, `cubicBezier` and `color` are the values that are already trivially portable. The DTCG typography composite type has **no fields for `font-variant-numeric`, variable-font axis settings, `font-feature-settings`, or optical sizing** — the properties that carry Miolos's design differentiation. A shared token package will keep colours, spacing, radii and durations identical across a web and a native UI. It will not keep the *typography* identical, because the divergence is not in the token values.

**Tooling health (all verified 2026-07-29):**

| Tool | Latest | Published | Target |
|---|---|---|---|
| Style Dictionary | **5.5.0** | 2026-06-21 | build-time transform; any output |
| Panda CSS | **1.12.0** (2.0.0-beta.11 on `beta`) | 2026-07-29 | web only (requires PostCSS) |
| StyleX | **0.19.0** | 2026-06-16 | web only |
| Tamagui | **2.6.0** | 2026-07-28 | web + native |
| react-native-unistyles | **3.3.0** | 2026-07-10 | web + native |
| NativeWind | **4.2.6** (v5 still `5.0.0-preview.4`, 2026-05-15) | 2026-06-22 | web + native |

Sources: npm registry `dist-tags`/`time` for each package; GitHub releases APIs for [tamagui](https://github.com/tamagui/tamagui/releases), [unistyles](https://github.com/jpudysz/react-native-unistyles/releases), [nativewind](https://github.com/nativewind/nativewind/releases), [style-dictionary](https://github.com/amzn/style-dictionary/releases), [panda](https://github.com/chakra-ui/panda/releases), [stylex](https://github.com/facebook/stylex/releases).

**Style Dictionary itself flags the spec churn.** Its DTCG page states it has *"first-class support for the DTCG format"* since v4, but that *"the latest format 2025.10 does not have full support yet in Style Dictionary,"* with expanded compatibility in progress for v5. ([styledictionary.com/info/dtcg/](https://styledictionary.com/info/dtcg/), no publication date shown on page — **date unverified**.)

**Panda CSS is web-only.** Its own positioning: *"If you're building a JavaScript application with a framework that supports PostCSS, Panda is a great choice."* ([panda-css.com/docs/overview/why-panda](https://panda-css.com/docs/overview/why-panda)) It is not a candidate for sharing with native.

**Assessment for Miolos.** Tokens-only sharing works, and works well, for everything except the thing that differentiates this product. Recommended shape: a plain TypeScript module in `packages/ui` exporting typed token objects (colour, space, radius, duration, easing, type scale), authored in DTCG 2025.10 JSON if you want tool interop later. Style Dictionary is only worth adding when you have a second consumer; for a single Next.js app it is ceremony. Do **not** put a cross-platform component abstraction in `packages/ui` — put web components there.

---

### 2. Universal styling systems, and their real typography ceiling

**The platform ceiling first, because it binds all of them.**

React Native's documented text style props are: `color`, `fontFamily`, `fontSize`, `fontStyle`, `fontWeight`, `includeFontPadding` (Android), `fontVariant`, `letterSpacing`, `lineHeight`, `textAlign`, `textAlignVertical` (Android), `textDecorationColor` (iOS), `textDecorationLine`, `textDecorationStyle` (iOS), `textShadow*`, `textTransform`, `verticalAlign` (Android), `writingDirection` (iOS), `userSelect`. ([reactnative.dev/docs/text-style-props](https://reactnative.dev/docs/text-style-props))

- ✅ **Tabular numerals are available on native.** `fontVariant` accepts an array or space-separated string of `'small-caps' | 'oldstyle-nums' | 'lining-nums' | 'tabular-nums' | 'proportional-nums'`, cross-platform. Miolos's `tnum` mandate survives on native. This is the one good piece of news.
- ❌ **Variable font axes are not available on native.** There is no `fontVariationSettings` in the list. Two React Native community proposals are **still open and unimplemented**: [#829 "Add `font-variation-settings` feature for variable fonts"](https://github.com/react-native-community/discussions-and-proposals/issues/829) (opened 2024-11-05, last updated 2025-02-20) and [#976 "First-class Variable Font support (single .ttf with weight/style axes)"](https://github.com/react-native-community/discussions-and-proposals/issues/976) (opened 2026-01-29, last updated 2026-04-07, 1 comment). On native you ship static instances of Fraunces and lose the axes.
- ❌ No `text-wrap: balance/pretty`, no `font-feature-settings`, no `font-optical-sizing`, no pseudo-elements, no CSS cascade.

Anything universal is capped by that list *on native*. The question is only what each library gives you *on web*.

**react-native-web is the shared substrate — and it is quiet.**

- Latest release **0.21.2, 2025-10-16**; the most recent commit on `master` is also **2025-10-16** ([releases](https://github.com/necolas/react-native-web/releases), [commits](https://github.com/necolas/react-native-web/commits/master)). Nine and a half months without a commit, still pre-1.0.
- The maintainer's own position, in [discussion #2816](https://github.com/necolas/react-native-web/discussions/2816) (thread 2025-11-29, reply **2025-12-06**): *"I will continue to review PRs and merge fixes. But I don't expect to put significant time into major development initiatives."* and *"open to adding maintainers from RN partners like SM & Expo. Let's figure out details in the React discord?"*
- This is not abandonware — it is a stable, minimally-maintained dependency. But every universal option below inherits it, and Tamagui has already vendored a copy of its internals (`code/core/react-native-web-internals/` in the tamagui repo).
- **The good news buried in RNW:** its styling doc states *"React Native for Web supports all long-form CSS properties,"* with the caveat *"no direct support for `@`-rules, selectors, pseudo-selectors, and pseudo-elements."* ([necolas.github.io/react-native-web/docs/styling/](https://necolas.github.io/react-native-web/docs/styling/)) Confirmed in source: `StyleSheet/validate.js` rejects only shorthands and `!important`; it has no property allowlist, and the compiler's default branch emits a declaration for any unrecognised property ([validate.js](https://github.com/necolas/react-native-web/blob/master/packages/react-native-web/src/exports/StyleSheet/validate.js), [compiler/index.js](https://github.com/necolas/react-native-web/blob/master/packages/react-native-web/src/exports/StyleSheet/compiler/index.js)). So `fontVariationSettings` *can* be passed through on web — as an inline style, on a component that will silently drop it on native.

#### Tamagui — 2.6.0, published 2026-07-28

- **Health: excellent.** v2.5.0 → v2.6.0 shipped between 2026-07-21 and 2026-07-28; five releases in eight days. Actively developed.
- **Targets:** web + iOS + Android from one source. First-party Next.js App Router guide, with Server Components support and `use client`; works with Turbopack in dev, needs the Tamagui CLI for optimised production builds; requires `react-native` → `react-native-web` aliasing and `transpilePackages` entries. ([tamagui.dev/docs/guides/next-js](https://tamagui.dev/docs/guides/next-js))
- **Container queries: yes.** Group styles compile to real CSS container queries on web; Tamagui sets `container-type: inline-size` on the containing element. ([tamagui.dev/docs/intro/styles](https://tamagui.dev/docs/intro/styles))
- **`text-wrap`: yes.** `textWrap` is in the web-only style prop allowlist ([`webOnlyStyleProps.ts`](https://github.com/tamagui/tamagui/blob/main/code/core/helpers/src/webOnlyStyleProps.ts)).
- **Tabular numerals: yes**, via `fontVariant` (in `nonAnimatableFontProps` in [`validStyleProps.ts`](https://github.com/tamagui/tamagui/blob/main/code/core/helpers/src/validStyleProps.ts)).
- **Variable font axes: no, not as a first-class style prop.** `fontVariationSettings`, `fontFeatureSettings`, `fontVariantNumeric` and `fontOpticalSizing` appear in **neither** `validStyleProps.ts` nor `webOnlyStyleProps.ts`. `getSplitStyles` routes any key failing `isValidStyleKey` to `viewProps` rather than to styles ([`getSplitStyles.tsx`](https://github.com/tamagui/tamagui/blob/main/code/core/web/src/helpers/getSplitStyles.tsx), lines ~156, ~422, ~1091) — i.e. it becomes a DOM attribute, not CSS.
- **Escape hatch exists but costs the compiler.** Same file, ~line 1373: a raw `style` prop is merged into the style state (`Object.assign(styleState.style, normalizeStyle(style))`), so `style={{ fontVariationSettings: '"SOFT" 40' }}` will reach react-native-web and emit real CSS on web. But it bypasses Tamagui's atomic-CSS extraction (stays an inline style), and is dead weight on native.
- **`createFont` covers** family, size, lineHeight, weight, letterSpacing, and `face` (platform font-file mapping). No axis configuration. ([tamagui.dev/docs/core/configuration](https://tamagui.dev/docs/core/configuration))
- **Verdict:** the strongest universal option. Container queries and `text-wrap` are genuinely there. But the design brief's variable-font premise lands outside the type system and outside the compiler, and you would be authoring your most design-critical CSS through an escape hatch that the framework does not model.

#### react-native-unistyles — 3.3.0, published 2026-07-10

- **Health: good.** Regular releases through 2026 (3.2.2 April → 3.3.0 July). Built on [Nitro Modules](https://nitro.margelo.com/).
- **This is the best web-CSS escape hatch of the three.** The `_web` block *"supports any CSS property and value that matches the `CSSProperties` type from React,"* pseudo-classes and pseudo-elements are expressed as `_hover` / `_before`, and `_classNames: 'my-custom-class'` injects arbitrary CSS classes. Themes are converted to CSS variables by default. ([unistyl.es/v3/references/web-only/](https://www.unistyl.es/v3/references/web-only/))
- Because React's `CSSProperties` includes `fontVariationSettings`, `fontVariantNumeric` and `textWrap`, **all the target typography is reachable on web** — and `_classNames` is an unbounded escape hatch for anything else (container queries included, via a hand-written class).
- **First-party Next.js SSR support**, App Router and Pages Router, with `useServerUnistyles()` / `getServerUnistyles()`. Caveat documented: hydration warnings on the root element when not using adaptive themes; also an `includeRNWStyles` flag (default `true`) confirming react-native-web is in the pipeline. ([unistyl.es/v3/guides/server-side-rendering/](https://www.unistyl.es/v3/guides/server-side-rendering/))
- Documented web caveat: *"Styles cannot be accessed directly as they would be with React Native Web"* — the parser generates classes, so `console.log(styles)` returns `{}`. ([unistyl.es/v3/references/web-styles/](https://www.unistyl.es/v3/references/web-styles/))
- Container queries: **not mentioned** in the web-only reference. Reachable only via `_classNames`. **Unverified** whether there is first-class support.
- **Verdict: this is the closest thing to a genuine third option, and it still doesn't dissolve the tradeoff.** Everything past `_web`/`_classNames` is, by construction, web-only code inside a "universal" stylesheet. You are writing two style implementations in one file instead of two files, and you still ship RN's `View`/`Text` into the DOM — losing semantic HTML, which matters for a link-shared, SEO-dependent product (§5).

#### NativeWind — 4.2.6 stable (2026-06-22); v5 in preview

- **Health: alive but slowing on the stable line, and v5 has been in preview a while.** `latest` is 4.2.6 (2026-06-22); `preview` is `5.0.0-preview.4`, last published **2026-05-15**. The three most recent repo commits (2026-06-11, 2026-06-19, 2026-07-08) are all **CI/docs**, not source ([commits](https://github.com/nativewind/nativewind/commits/main)). The most recent substantive release note fixes Metro 0.83+ hot-reload path emission.
- The **v4 installation doc, last updated 2026-01-10**, still pins `tailwindcss@^3.4.17` ([nativewind.dev/docs/getting-started/installation](https://www.nativewind.dev/docs/getting-started/installation)). Tailwind v4 alignment is a v5 feature and v5 is not stable.
- **Platform behaviour:** *"accepts all classes but only applies styles that are supported on the current platform"* — CSS grid works on web, not native — with `native:` / `web:` variants for branching. *"Nativewind compiles your Tailwind CSS at build time, [so] the full Tailwind CSS language is available."* ([nativewind.dev/v5/core-concepts/tailwindcss](https://www.nativewind.dev/v5/core-concepts/tailwindcss))
- Whether NativeWind emits real CSS classNames on web (which would make Tailwind arbitrary values like `[font-variation-settings:'SOFT'_40]` work end-to-end) versus converting to RN style objects is **not stated in the docs I could reach; unverified**. The `web:` variant mechanism implies at least partial CSS-level output.
- **Verdict: weakest fit.** Utility-class authoring is the opposite of what an editorial type system wants — you would be writing arbitrary-value escapes constantly. Betting the product's differentiator on a preview release is not a solo-dev move.

#### StyleX — 0.19.0, published 2026-06-16

- **Health: good; still 0.x.** npm `latest` is 0.19.0 (2026-06-16); repo commits on 2026-07-02, 2026-07-13, 2026-07-21 ([commits](https://github.com/facebook/stylex/commits/main)). Note the GitHub *Releases* page lags npm (top release listed is 0.17.5) — npm is the reliable signal.
- **Web only.** Documented as framework-agnostic across React, Preact, Solid; no React Native target is documented. ([stylexjs.com/docs/learn/](https://stylexjs.com/docs/learn/))
- **Full CSS property coverage, verified in source.** `packages/@stylexjs/stylex/src/types/StyleXCSSTypes.js` declares `fontVariant`, `fontVariantAlternates`, `fontVariantCaps`, `fontVariantEastAsian`, `fontVariantLigatures`, **`fontVariantNumeric`**, `fontVariantPosition`, **`fontVariationSettings`**, **`containerType`**, and **`textWrap?: 'wrap'|'nowrap'|'balance'|'pretty'|'stable'`**. `StyleXTypes.d.ts` composes `CSSProperties` with a full set of pseudo-element keys (`::before`, `::after`, `::placeholder`, `::selection`, `::marker`, …). ([StyleXCSSTypes.js](https://github.com/facebook/stylex/blob/main/packages/%40stylexjs/stylex/src/types/StyleXCSSTypes.js), [StyleXTypes.d.ts](https://github.com/facebook/stylex/blob/main/packages/%40stylexjs/stylex/src/types/StyleXTypes.d.ts))
- Constraint: ahead-of-time compilation requires statically analysable styles; dynamic styles compile to CSS custom properties. ([stylexjs.com/docs/learn/styling-ui/defining-styles/](https://stylexjs.com/docs/learn/styling-ui/defining-styles/))
- **This is what Puzzmo chose** after removing React Native (§4).

**Summary of §2:** the only system that gives Miolos's typography brief 100% of what it asks for is web-only. Every universal system either caps at RN's text model or reaches web CSS through an escape hatch it does not type-check or compile. **No universal styling system dissolves the tradeoff.**

---

### 3. Sharing non-UI code between Next.js and Expo in a pnpm/Turborepo monorepo

Short version: **for a package shaped like `packages/games`, this is close to a non-problem in 2026.** The friction is entirely in the *UI* direction.

**Next.js side (v16.2.12, doc last updated 2026-06-23):** *"Turbopack transpiles workspace packages (npm, pnpm, or Yarn workspaces) in your monorepo automatically under both routers. Webpack does the same for the App Router."* `transpilePackages` is only needed for a `node_modules` dependency shipping raw TS/JSX, or for webpack + Pages Router. ([nextjs.org/docs/app/api-reference/config/next-config-js/transpilePackages](https://nextjs.org/docs/app/api-reference/config/next-config-js/transpilePackages)) A pure-TS workspace package requires **zero configuration**.

**Expo side (Expo monorepos guide, last updated 2026-06-30):**
- First-class support for Bun, npm, pnpm, and Yarn (v1 and Berry). From **SDK 52+**, `expo/metro-config` auto-configures Metro for monorepos — no manual `watchFolders`/`resolver`.
- From **SDK 54**, isolated module installations (pnpm's default) are supported, but *"not all packages you install will work and some React Native libraries may cause build or resolution errors."*
- *"Duplicate React Native versions in a single monorepo are not supported"*; duplicate React versions *"will cause runtime errors."*
- Native build scripts may hardcode `react-native` paths broken by hoisting differences; resolve dynamically.
- ([docs.expo.dev/guides/monorepos/](https://docs.expo.dev/guides/monorepos/))

**React version alignment is currently favourable.** Next.js 16.2.12 peer-depends on `react: ^18.2.0 || ^19.0.0`; Expo SDK 57 ships **React Native 0.86 / React 19.2.3** ([docs.expo.dev/versions/latest/](https://docs.expo.dev/versions/latest/)). A single hoisted React 19.2.x satisfies both today. This is a *current* alignment, not a guarantee — Expo pins React to the RN release train, Next.js does not, and they have drifted before.

**The genuinely hostile part: putting Expo/RN components inside Next.js.** Expo's own guide (last updated **2026-07-29**) states:
- *"Using Next.js is not an official part of Expo's universal app development workflow."*
- *"The Expo Next.js adapter does not support the experimental **app** directory."*
- *"Next.js can only be used with Expo for web as there is no support for Server-Side Rendering (SSR) for native apps."*
- ([docs.expo.dev/guides/using-nextjs/](https://docs.expo.dev/guides/using-nextjs/))

And `@expo/next-adapter` was **last published 2024-01-08** (v6.0.0, npm registry) — 18 months stale, with no App Router support. **The first-party bridge between Expo and Next.js does not exist in 2026.** Tamagui and Unistyles each maintain their *own* Next.js integration precisely because Expo's doesn't cover it.

**Practical shape for Miolos:**
- `packages/games` — pure TS, no `react-native` field, no `main` pointing at source; build to plain JS or rely on Turbopack's workspace transpilation. Consumable by Next.js, by Metro, by a Vitest run, by a Node script that pre-generates puzzles. This is already the repo invariant and it is correct.
- Same for a future `packages/tokens`, `packages/api-contracts` (Zod schemas), `packages/date` (the `America/Sao_Paulo` logic).
- Do **not** put React components in a package intended for both. That is where the `react-native` field, dual-React, Metro-vs-Turbopack and RNW-alias problems all live.

---

### 4. How much UI is actually duplicated — real evidence

The single best-documented case is **Puzzmo**: a daily-puzzle product, editorially typeset, web-first, with an iOS app, run by a very small team. It is a near-exact structural match for Miolos, and its lead engineer has blogged the whole arc. All quotes below are from primary sources.

**2023–2024 — the universal codebase, as built.** *"For Puzzmo, instead of writing a React Native app from scratch, I opted for building via Expo. As the web platform is the weakest supported platform for React Native, it meant we could prioritise that for launch."* ([Puzzmo Tech Stack: 2024](https://blog.puzzmo.com/posts/2024/10/30/tech-stack/), 2024-10-30) That is Miolos's exact proposed option (a), including the reasoning.

**2024 — the verdict on it, 12 months in, same post:**
> *"I migrated Puzzmo to a monorepo, I took the time to eject us from Expo, and now the puzzmo.com codebase is a React Native Web app powered by Webpack. **This isn't a great place to be**, folks who only have a web background feel the impedance mismatch of using native metaphors for navigation and interaction designs. So with luck, the next time I write this, I can say we fully pulled ourselves out of being a React Native app."*

And on shipping native from it:
> *"Half-way through this year, I realised that the codebase was just getting too complex for a team our size to be able to reliably maintain across two platforms. … So, I presented this choice to the team: 1. We build as good of a web view app as we can, but only I know iOS native code. 2. We significantly slow down development and build a native app from this existing codebase. **When I polled folks internally, the vote for a web view was unanimous.**"*

**2025 — why the RN native build was blocked** ([Shipping the iOS App](https://blog.puzzmo.com/posts/2025/06/01/ios-app-architecture/), 2025-06-01). Three reasons, verbatim:
> *"1. Our team is very web slanted, and React Native's abstractions are based on native concepts, which are distinctly not web. 2. The complexity of legal and SDK requirements inside the codebase. 3. Game code could crash the entire app, and the games team didn't have an easy way to know this ahead of time."*

Reason 1 and reason 3 both apply directly to Miolos. Reason 3 is worth pausing on: in an RN app, a bug in generated-puzzle rendering takes down the whole binary and needs an App Store round-trip. On the web it is a reload.

**And, decisively for a design-led product:**
> *"I didn't want us to be forced into making native builds when there were titlebar design changes — and was **especially worried about design slippage between the puzzmo.com on mobile and the iOS version**."*

Note what this says: the fear of "two UIs drifting" pushed Puzzmo *toward* a single web UI wrapped natively, **not** toward a universal RN codebase.

**2025 — RN removed entirely** ([Puzzmo Tech Stack: 2025](https://blog.puzzmo.com/posts/2025/12/9/tech-2025/), 2025-12-09), section headed *"Puzzmo.com -> RN -> Web -> SSR"*:
> *"This year we removed React Native from the codebase, it was a project which most engineers ended up contributing to as **the re-design of today and games pages created a new design system which was web only**. … We took the time to migrate to wouter, **StyleX**. and Base UI during this process. I've found them all to be a pleasure."*

They are now adding server-side rendering ([Tapped](https://github.com/puzzmo-com/tapped)) — moving *toward* the Next.js-shaped architecture, from the universal one.

**How Puzzmo shares its actual game code.** Not via a universal component library. Each game is a separate package in a Turborepo, bundled by Vite to its own CDN bundle, and launched through a versioned runtime contract whose surface is `container: HTMLElement` plus loaders/delegates (`GameConfig` type published in the 2024 post). Four different runtime implementations consume that one contract (puzzmo.com, the dev "Jig", crossword submissions, third-party iframe embeds). **The portable artefact is a headless contract, not shared UI.** Miolos's `packages/games` invariant — pure TS, seed in, puzzle out, no rendering at all — is a *stricter and better* version of the same idea.

**Scale numbers, for calibration** (from the 2025-06-01 post):
- Puzzmo TypeScript: **~200k LOC outside the games**, **~80k LOC of games**.
- Puzzmo iOS app: **~3k lines of Swift**, *"an even split between the app and a natively implemented game that lives inside the same codebase"* — so **~1.5k lines** of actual native shell.
- Ratio of native-shell code to product code: roughly **0.5%**.

**Counter-evidence, honestly stated:** Puzzmo's webview path was not free. Offline support was the casualty. *"In the end, timelines got me and we never finished what we'd call a good enough experience for classing the Puzzmo iOS app as having 'offline support.' Some of this came from the complexity of not shipping the codebase as a React Native app"* ([Offline in Progress](https://blog.puzzmo.com/posts/2025/06/08/offline-wip/), 2025-06-08). But read the same post's conclusion on *why* they still chose the service-worker route: *"I opted for a service worker, because that means adding offline support for the iOS app also benefits all web users too! This also means less conceptual forks in how the entire app is loaded."* That is the anti-duplication argument, applied to offline. It also requires `WKAppBoundDomains` and `limitsNavigationsToAppBoundDomains = true` in the iOS target — a real but small, documented cost.

**Other named examples were weak.** I found no NYT Games engineering write-up on web/native code sharing (**unverified — likely does not exist publicly**). Secondary posts on React/RN code sharing (DevHub, Standard Notes, various Medium tutorials) surfaced in search but are individual-blog tutorials, not dated production retrospectives, and I am not citing them as evidence.

---

### 5. The React Server Components / web-platform angle

For a **link-shared, SEO-dependent, offline-capable daily puzzle in pt-BR**, Next.js is not marginally better. It is a different category. Every capability below is first-party, stable, and documented; the RN-based equivalents are either absent, alpha, or bolt-on.

**Next.js 16.2.12** (npm `latest`, published 2026-07-25).

- **Metadata and OG images** — `metadata` object, `generateMetadata()`, and file conventions `opengraph-image.tsx`, `twitter-image.tsx`, `icon`, `robots.txt`, `sitemap.xml`. Dynamic OG images via `ImageResponse` from `next/og` (satori + resvg), with per-route params. Streaming metadata is automatically **disabled for bots and crawlers** (Twitterbot, Slackbot, Bingbot) so they always get metadata in `<head>`. Doc `version: 16.2.12`, `lastUpdated: 2026-06-23`. ([nextjs.org/docs/app/getting-started/metadata-and-og-images](https://nextjs.org/docs/app/getting-started/metadata-and-og-images))
  - *This is exactly the "share your result" mechanic.* A per-day, per-game OG card — "Miolos · Binairo · 29 de julho · 🟩🟩⬜" — is a file-convention route, not a project.
  - `ImageResponse` limitation to note: *"Only flexbox and a subset of CSS properties are supported. Advanced layouts (e.g. `display: grid`) will not work."*
- **Static generation / PPR** — with `cacheComponents: true`, Partial Prerendering is the default rendering model: `'use cache'` + `cacheLife`/`cacheTag` put cached UI into the static shell, `<Suspense>` streams the rest. Doc `version: 16.2.12`, `lastUpdated: 2026-05-13`. ([nextjs.org/docs/app/getting-started/caching](https://nextjs.org/docs/app/getting-started/caching)) A daily puzzle is the canonical fit: the puzzle is identical for every user and changes once at midnight `America/Sao_Paulo` — `cacheTag('daily')` + `updateTag` at rollover, with only the personal streak streaming per-request.
- **PWA** — first-party `app/manifest.ts`, plus a documented service-worker + Web Push flow with VAPID keys and Server Actions. Web Push is documented as working on **iOS 16.4+ for home-screen-installed apps**, Safari 16 on macOS 13+, Chromium, and Firefox: *"This makes PWAs a viable alternative to native apps."* Offline is explicitly a bring-your-own step (Serwist is suggested; *"this plugin currently requires webpack configuration"*). Doc `version: 16.2.12`, `lastUpdated: 2026-02-11`. ([nextjs.org/docs/app/guides/progressive-web-apps](https://nextjs.org/docs/app/guides/progressive-web-apps))
  - Note against the project invariant *"one push notification type only — streak at risk"*: Web Push on an installed PWA covers the entire v1 notification requirement without an app store.

**The RN-based comparison, for completeness:**

- **Expo Router static rendering** does work: `web.output: "static"`, `npx expo export --platform web`, build-time data loaders, `expo-router/head` meta tags, `generateStaticParams` for dynamic routes. Limitations listed: no request-time rendering, dynamic routes must be pre-generated, no custom server API, no browser APIs in root HTML. Doc last updated **2026-07-29**. ([docs.expo.dev/router/web/static-rendering/](https://docs.expo.dev/router/web/static-rendering/))
- **Expo Router server rendering is alpha.** Requires `"unstable_useServerRendering": true` (SDK 55+). `generateMetadata` exists for per-page title/description/OG tags. Listed limitations: cannot deploy to static hosts, requires a deployed server, *"cannot mix server and static rendering in the same project,"* slower TTFB. Doc last updated **2026-07-29**. ([docs.expo.dev/router/web/server-rendering/](https://docs.expo.dev/router/web/server-rendering/))
- **Expo React Server Components are an early technical preview.** Expo's own doc: *"Expo Snack does not support bundling Server Components," "EAS Update does not work with Server Components yet," "Production deployment is limited and not recommended yet,"* Server Functions calling Server Functions unsupported on Hermes, *"HTML form integration and static rendering of RSC payloads to HTML remain unsupported,"* and *"a very early technical preview that we're actively developing."* ([docs.expo.dev/guides/server-components/](https://docs.expo.dev/guides/server-components/))
- **No first-party dynamic OG image generation** in Expo Router — **unverified**, but I found no equivalent to `ImageResponse` in Expo's docs, and Vercel's `@vercel/og` is the ecosystem answer.

**The unquantified structural cost of the RN path on web: semantic HTML.** react-native-web renders `View` → `div` and `Text` → `div`/`span`. There is no `<h1>`, `<main>`, `<article>`, `<time>`, `<button>`, `<table>`. For a puzzle grid this matters twice — for Google (a pt-BR daily-puzzle site competes on organic search against Termo and clones) and for screen readers. You can force `role`/`aria-*` attributes back on, but you are re-adding by hand what the DOM gives you free. I did not find a primary source quantifying the SEO delta; treat this as a reasoned structural argument, not a cited fact.

---

### 6. Migration cost if the decision is wrong

**The two directions are not symmetric, and the asymmetry favours starting on the web.**

**RN/universal → plain web: mechanical, and now cheap. Documented.** Puzzmo did it. In [Six Weeks of Claude Code](https://blog.puzzmo.com/posts/2025/07/30/six-weeks-of-claude-code/) (2025-07-30), section *"Maintenance is Significantly Cheaper,"* Orta Therox lists what he completed **solo, as background side-projects while still delivering his roadmap**, over roughly six weeks:
> *"Converting hundreds of React Native components to just React … Migrated significant code from inline styles to stylex … Converted a significant amount of our design system primitives to use base-ui … Converted all animations in puzzmo.com to use the same techniques as games …"*

And, from the 2025 tech-stack post: *"it is wild that such a big task became a single line in the list of Claude Code changes as I wrapped up every other screen in the app."*

Hundreds of RN components → React, on a ~200k-LOC codebase, one person, weeks. It is mechanical because **every RN construct has an obvious DOM equivalent and RN's style object is a strict subset of CSS**: `View`→`div`, `Text`→`span`, `StyleSheet.create`→CSS-in-JS, `flexDirection: 'column'` default → one line of CSS. Nothing is lost in translation.

**Plain web → universal RN: lossy, and no primary source quantifies it.** The reverse translation must *delete* capability, because RN has no equivalent for: the cascade, pseudo-elements, `::before`/`::after` decorative rules, CSS grid, container queries, `text-wrap`, `font-variation-settings` (§2), `position: sticky`, and semantic elements. Every one of those is a **redesign decision**, not a rename — which is why Puzzmo's redesign produced *"a new design system which was web only"* rather than a portable one. This is the direction Miolos would take if it changed its mind, and it is the expensive one.

**But that framing overstates the risk, because the reversal Miolos would actually face is different.** The realistic future is not "port the web UI to a universal codebase." It is "ship a native app." And there are two ways to do that from a Next.js web app, in increasing cost:

1. **Native shell around the PWA** (Puzzmo's path). ~1.5k lines of Swift + equivalent Kotlin. Requires the web app to already be a solid installable PWA — which the offline/daily-puzzle brief wants anyway. Zero UI duplication, permanently. Cost is concentrated in the platform seams: App Store billing, haptics, push, and offline-in-a-webview (`WKAppBoundDomains`; Puzzmo did not finish this one).
2. **A second Expo UI.** Real duplication — but bounded, and *not* by the number of games. `packages/games` is headless: the generator, solver, validator and scoring for Sudoku/Nonogram/Binairo/Termo are written once regardless. What gets written twice is the *chrome*: Hoje hub, in-game grid rendering, completion screen, stats, settings, onboarding — call it 8–12 screens, plus a grid renderer per game family. Each new game after that adds one screen and one renderer per platform, not a second implementation of the game.

**The cheap hedges, all of which cost ~nothing today:**
- Keep `packages/games` headless and rendering-agnostic (already an invariant — do not weaken it).
- Keep tokens as data, in a package with no React dependency at all.
- Keep API contracts as Zod schemas in a shared package (already mandated by the gate).
- Keep game *state machines* (input handling, undo, hint accounting, win detection) inside `packages/games`, not in React components. This is the single highest-leverage portability move available, and it also makes the property-based test mandate easier to satisfy.
- Do **not** hedge by adopting a universal styling system "just in case." That converts a possible future cost into a certain present one, and caps the typography permanently.

---

## The duplication cost, quantified

As concretely as the sources allow.

| Thing | Written once or twice? | Basis |
|---|---|---|
| Puzzle generators, solvers, validators, scoring | **Once** — `packages/games`, pure TS | Repo invariant (`CLAUDE.md`); mirrors Puzzmo's headless `GameConfig` runtime contract |
| Game state machines / input logic | **Once**, if kept out of components | Recommendation, not yet true of Miolos |
| Design tokens (colour, space, radius, duration, easing, type scale) | **Once** | DTCG 2025.10 covers all of these token types |
| Typography *rendering* | **Twice, and differently** — variable axes and `text-wrap` are web-only; native gets static instances + `fontVariant: ['tabular-nums']` | RN text-style-props list; RN proposals [#829](https://github.com/react-native-community/discussions-and-proposals/issues/829) / [#976](https://github.com/react-native-community/discussions-and-proposals/issues/976) still open |
| API contracts (Zod), date/streak logic | **Once** | Repo gate already mandates Zod at boundaries |
| Screen chrome (Hoje, in-game, completion, stats, settings, onboarding) | **Twice** if you build a second Expo UI; **once** if you use a native shell | — |
| Native shell code, if you take the Puzzmo path | ~**1.5k lines of Swift** against ~280k LOC TS (~0.5%) | [Shipping the iOS App](https://blog.puzzmo.com/posts/2025/06/01/ios-app-architecture/), 2025-06-01 |
| Cost of undoing a universal RN codebase later | Hundreds of components, **one person, ~6 weeks, as a side project** (2025 tooling) | [Six Weeks of Claude Code](https://blog.puzzmo.com/posts/2025/07/30/six-weeks-of-claude-code/), 2025-07-30 |
| Cost of undoing a plain-web codebase into a universal one | **Not quantified in any primary source.** Structurally lossy — each web-only CSS capability is a redesign decision, not a rename | §6 reasoning |

**The number that reframes the worry:** Puzzmo, a *much* larger product than Miolos will be for years, ships iOS on ~1.5k lines of native code and **zero duplicated UI**, having deliberately walked away from the universal codebase. The "two UIs forever" scenario is not the default outcome of choosing plain web — it is one of two options, and the cheaper one does not involve a second UI at all.

**And the number that reframes the reversal risk:** the expensive-sounding migration (RN → web) is the one that is empirically cheap and documented. Miolos would only ever face the expensive direction if it decided a universal codebase was worth having — and §2 shows it isn't, for this design brief.

---

## Confidence and gaps

**High confidence (verified in primary sources, dated):**
- DTCG Format Module 2025.10 is a Final Community Group Report, 2025-10-28, not a W3C standard; the living draft is explicitly not to be implemented.
- React Native has no `fontVariationSettings`; both proposals are open. Tabular numerals *are* available via `fontVariant`.
- Tamagui's style-prop allowlists do not include `fontVariationSettings` / `fontVariantNumeric` / `fontFeatureSettings`; they do include `textWrap` and `containerType`. Verified in repo source.
- StyleX's type system covers the full CSS property surface including variable-font axes, and StyleX is web-only.
- Unistyles `_web` accepts React's `CSSProperties` plus `_classNames`, and has a first-party Next.js SSR guide.
- react-native-web is stable but minimally maintained: no commit since 2025-10-16; maintainer's own statement 2025-12-06.
- `@expo/next-adapter` last published 2024-01-08, no App Router support; Expo states Next.js is not part of its official workflow (doc updated 2026-07-29).
- Turbopack auto-transpiles pnpm workspace packages; `packages/games` needs no Next.js config.
- Expo RSC is an early technical preview, production deployment not recommended (Expo's own words).
- The entire Puzzmo arc, including all quotes, from four dated first-party blog posts.

**Medium confidence:**
- The Tamagui `style={{}}` escape hatch reaching real CSS on web: verified by reading `getSplitStyles.tsx` and RNW's compiler, **not** verified by running it.
- NativeWind v5's release timeline: `preview.4` at 2026-05-15 with only CI/docs commits since 2026-06-11 suggests a slowdown, but I did not check open PRs or branch activity, and the maintainer may be working elsewhere.

**Explicitly unverified — do not treat as fact:**
- Whether NativeWind emits real CSS classNames on web (making Tailwind arbitrary values work end-to-end) or converts to RN style objects. Not stated in the docs I could reach.
- Whether Unistyles has first-class container-query support beyond the `_classNames` escape hatch.
- The publication/last-updated date of Style Dictionary's DTCG page.
- Whether Expo Router has any first-party dynamic OG image generation. I found none; absence of evidence.
- Any NYT Games engineering source on web/native code sharing. I found none publicly.
- The SEO delta between semantic HTML and react-native-web's `div` soup. Reasoned structurally; not measured in any source I found.
- Whether the Puzzmo blog's `blog.puzzmo.com` posts have been edited since publication (fetched 2026-07-29 via HTTP; dates are the posts' own stated dates).

**Known bias in the evidence base.** Puzzmo is one company with one engineering lead who has a documented, long-standing preference for React Native ("I still believe in the same tech stack I have used since I was persuaded back in 2015") — which makes his reversal *more* credible, not less, since it runs against his prior. But it is still n=1. The counterfactual — a team that stayed universal and was glad of it — is not represented here because I did not find a comparably documented one for a typography-led puzzle product. If that matters to the decision, it is the gap to close.

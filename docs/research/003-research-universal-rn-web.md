# 003 — Research: Universal Expo Router + react-native-web for Miolos web

**Date of research:** 2026-07-29
**Question assessed:** Should the Miolos web app be built as a universal Expo Router + react-native-web (RNW) app that later also targets native iOS/Android?
**Scope:** This document assesses *only* the universal RNW option. A separate document assesses the plain-React/Next.js alternative.

**Versions current at time of writing (all verified against npm registry / official docs on 2026-07-29):**

| Package | Version | Source |
| --- | --- | --- |
| `expo` | 57.0.9 (published 2026-07-29) | npm registry metadata |
| `expo-router` | 57.0.9 (published 2026-07-29) | npm registry metadata |
| `@expo/cli` | 57.0.11 | npm registry metadata |
| `@expo/router-server` | 57.0.4 | npm registry metadata |
| React Native | 0.86 | https://docs.expo.dev/versions/latest/ |
| React | 19.2.3 | https://docs.expo.dev/versions/latest/ |
| **`react-native-web`** | **0.21.2 — published 2025-10-16** | npm registry metadata |

---

## Verdict

**No. Do not build the Miolos web app as a universal Expo Router + react-native-web app.**

This is not a "web is second-class in Expo" verdict — that framing is out of date. Expo's web story in SDK 57 is genuinely good: static rendering is real, per-route HTML is real, `<Head>` meta tags *are* emitted into static HTML (I verified this in `@expo/router-server` source, contradicting a community claim in an eight-month-old unmerged docs PR), and build-time data loaders exist. If the product were a utility app with default-ish typography, the universal path would be defensible.

The verdict is **no because of the specific constraints you named**, and it rests on five things I verified rather than inferred:

1. **The `Text`/`StyleSheet` abstraction does not block your typography — but only via undocumented, untyped pass-through.** I ran react-native-web 0.21.2 server-side and confirmed that `fontVariationSettings`, `fontFeatureSettings`, `fontOpticalSizing`, `textWrap: 'balance'`, `fontWeight: '437'`, `letterSpacing: '-0.02em'` and `fontVariant: ['tabular-nums']` all compile to correct CSS. Every one of those except `fontVariant` and integer `fontWeight` is **absent from React Native 0.86's `TextStyle` type** and is a **silent no-op on native**. So your entire typographic identity would live in `as any` casts that do nothing on the platform the universal codebase exists to serve. The "one UI codebase" premise is void precisely at the layer that differentiates the product.

2. **`expo-font`'s generated `@font-face` has no weight-range descriptor, no `format()`, no `size-adjust`.** Expo's own docs show the exact output. For a variable font (Fraunces) this means the browser sees a face declared at weight `normal` and will **synthesise bold** rather than move the `wght` axis, and you get no metric-compatible fallback (guaranteed CLS). Fixing it means hand-writing `@font-face` in a global CSS file — which Expo documents as **web-only** and which therefore leaves the native target with a different font pipeline anyway.

3. **RNW resolves `prefers-color-scheme` and viewport size in JavaScript, not CSS — and both return wrong values during static rendering.** I confirmed empirically that on the server `Appearance.getColorScheme()` returns `'light'` unconditionally and `Dimensions.get('window')` returns `{width: 0, height: 0}`. RNW's `StyleSheet` supports **no media queries and no pseudo-classes** (verified: no `@media`, `:hover`, `::before` handling anywhere in the compiler). This is not theoretical: the `dist/index.html` from a **default, unmodified SDK 57 project** contains `style="max-width:-32px"` (an invalid negative length, produced by `0 - 32` from the zero-width server render), a hardcoded light `background-color:rgba(242,242,242,1.00)`, and zero occurrences of `prefers-color-scheme`. For a statically-rendered, dark-mode-from-day-one, mobile-first site on slow Brazilian networks, that is a structural flash-of-wrong-theme and flash-of-wrong-layout on every cold load, fixable only by dropping to global CSS + CSS custom properties — i.e. by not using RNW for the thing that matters.

4. **The author of react-native-web says this is not what it is for, and the project is dormant.** Nicolas Gallagher, 2024-04-01: *"RNfWeb has always had the expectation that it be used for **web-first development, where the extra semantics it provides for web simply no-op on native**"*; *"there is no investment at Meta in RNfWeb by either the Web or RN teams"*; *"I don't expect to put significant time into major development initiatives"*; *"it's unrealistic to expect RNfWeb to become materially smaller in the years ahead."* The no-op-on-native behaviour I measured in point 1 is **the design contract, not a gap to be closed**. Meanwhile: zero commits on `master` since **2025-10-16** (nine months), 158 open issues, July 2026 contributor PRs closed unmerged, no TypeScript types shipped, and the recommended successor (React Strict DOM) still at `0.0.55`.

5. **The bundle and hydration cost is 2.3× Next.js, measured, and structural.** A one-route Expo Router static export (SDK 57) ships **291 KB gzip / 1.06 MiB raw** of JavaScript against Next.js 16.2.12's **125 KB gzip / 416 KB raw** — for a page containing a single line of text. Lighthouse mobile: **126 ms Total Blocking Time vs 16 ms (7.9×)** and **274 ms JS bootup vs 92 ms (3.0×)**. Tree shaking recovers 1%; async routes recover 0%; RSC cannot be combined with `web.output: static` at all. The floor is `expo-router`+`@react-navigation` (42.5% of the graph) plus RNW (26.7%), and it has not moved since Expo published 1.05 MB in December 2023. Against "fast first load on Brazilian mobile networks", this is the second-hardest fact in the document.

Add to that: **no first-party PWA/service-worker support** (Expo's own docs actively warn you off service workers).

**The one strong precedent proves the point rather than refuting it.** https://www.theoutbound.com is a genuinely design-led, statically-rendered, SEO-driven editorial site on Expo Router — 538 words of real prose in the initial HTML, real `<h1>`/`<h2>`, 8 `@font-face`, self-hosted woff2, JSON-LD. I verified it directly. But its `<h1>` carries `class="… font-new-spirit-regular text-3xl md:text-5xl …"` and the page is full of `dark:bg-black`, `dark:text-white`, `lg:hidden`: **Tailwind/NativeWind, with real CSS media queries and a real CSS dark-mode variant**, plus hand-written `@font-face` with `format("woff2")` and `font-display: swap`. They bypassed RNW's `StyleSheet` and bypassed `expo-font` — the exact two escape hatches this document says you are forced into. They still ship **three static font instances rather than a variable font**, and a **1.78 MB** bundle. The best editorial site on this stack got there by not using the stack for typography, and still conceded the variable axes that are Miolos's whole premise.

**What I would do instead, given this research:** build web as a plain React/Next.js app that consumes `packages/games` directly, and treat native as a later, separate UI. The shared asset is the game logic — which is already correctly isolated in a zero-dependency TypeScript package. The UI layer is where web and native *should* diverge for this product, because the whole thesis is a web-native editorial feel.

**The narrow case where universal still wins** is spelled out in "What would have to be true" below. Short version: only if you were willing to demote the typography from differentiator to nice-to-have, or accept that the web typography layer is a web-only CSS escape hatch you will rewrite for native.

---

## Findings

### 1. Expo's positioning of web in 2026

**Expo positions web as first-class, and the language backs it up.**

- https://docs.expo.dev/workflow/web/ (modificationDate: 2026-06-03): *"Expo has first-class support for building full-stack websites with React."* No experimental/secondary framing anywhere on the page.
- Same page, on RNW: *"RNW is optional when developing for web since you can use React DOM directly, but we often recommended it when building across platforms as it maximizes code reuse."* — **Note this carefully. Expo itself tells you RNW is optional on web.**
- https://docs.expo.dev/llms.txt (fetched 2026-07-29): *"Expo is the official framework recommended by the React Native team for building production apps on Android, iOS, and the web. It is to React Native what Next.js is to React: the standard way to build, not an optional add-on."*
- https://docs.expo.dev/router/introduction/ describes Expo Router as providing *"static and server web rendering, API routes"* among its core features.

**Rendering modes available (all first-party):**

| Mode | `web.output` | Status | Source |
| --- | --- | --- | --- |
| SPA | `single` | Stable | https://docs.expo.dev/router/web/static-rendering/ |
| Static export (SSG) | `static` | **Stable** | https://docs.expo.dev/router/web/static-rendering/ (last updated 2026-07-29) |
| SSR | `server` | **"Server rendering is in alpha and is available in SDK 55 and later."** | https://docs.expo.dev/router/web/server-rendering/ |
| Data loaders | n/a | **alpha**, "SDK 55 and later" | https://docs.expo.dev/router/web/data-loaders/ |
| React Server Components | n/a | see §4 | https://docs.expo.dev/guides/server-components/ |

**Assessment:** the production-grade web path in mid-2026 is `web.output: "static"`. SSR and data loaders are explicitly alpha, so a launch plan should not depend on them. Static rendering is sufficient for a daily-puzzle app (content is known at build time or per-day) — this constraint is *not* a blocker.

**Caveat worth flagging:** *"Currently, Expo Router does not support mixing server and static rendering in the same project"* (https://docs.expo.dev/router/web/server-rendering/). If you ever need one request-time route (e.g. a personalised share card), you flip the entire site to alpha SSR.

**A supply-chain observation on `expo-router` 57.0.9:** its `dependencies` include `@radix-ui/react-slot`, `@radix-ui/react-tabs`, `vaul`, `@testing-library/jest-dom` and `@testing-library/user-event` as *runtime* dependencies (verified from the published `package.json` on the npm registry). These are presumably reachable only via subpath exports (`expo-router/testing-library`, web modals) and should tree-shake out of a route bundle, but I did **not verify that they are excluded from a production web bundle** — mark as *unverified*.

---

### 2. Typography control under react-native-web

This is the decisive section, so it is the one I tested rather than read about.

#### 2a. Empirical test — what RNW 0.21.2 actually emits

I installed `react-native-web@0.21.2` + `react@19.2.3` + `react-dom@19.2.3` and server-rendered a `Text` through `AppRegistry.getApplication()`, then dumped the generated stylesheet.

Input style object:

```js
StyleSheet.create({
  display: {
    fontFamily: 'Fraunces',
    fontSize: 48,
    fontWeight: '437',
    letterSpacing: '-0.02em',
    fontVariant: ['tabular-nums'],
    fontVariationSettings: "'wght' 437, 'opsz' 48, 'SOFT' 20",
    textWrap: 'balance',
    fontFeatureSettings: "'ss01' 1",
    fontOpticalSizing: 'auto',
  },
})
```

Emitted CSS (verbatim from the run):

```css
.r-fontFamily-u4487e{font-family:Fraunces;}
.r-fontFeatureSettings-j34ahq{font-feature-settings:'ss01' 1;}
.r-fontOpticalSizing-1cvnf04{font-optical-sizing:auto;}
.r-fontSize-s67bdx{font-size:48px;}
.r-fontVariant-1ghxqbu{font-variant:tabular-nums;}
.r-fontVariationSettings-1ys2yh3{font-variation-settings:'wght' 437, 'opsz' 48, 'SOFT' 20;}
.r-fontWeight-1dxfqpj{font-weight:437;}
.r-letterSpacing-16cbgwe{letter-spacing:-0.02em;}
.r-textWrap-gk7n9i{text-wrap:balance;}
```

Emitted HTML for `<Text role="heading" aria-level={1}>`:

```html
<h1 dir="auto" aria-level="1" role="heading" class="css-text-146c3p1 r-fontFamily-u4487e ...">Palavra do dia</h1>
```

**So: every CSS feature you need is reachable. `text-wrap: balance` works. Variable font axes work. `tnum` works. Real `<h1>` elements work.** No dev warnings were printed (tested with `NODE_ENV=development`).

One subtlety on `tnum`: RNW maps `fontVariant` to the **`font-variant` shorthand**, not to `font-variant-numeric`. Per https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant (Baseline widely available since July 2015), that shorthand accepts `tabular-nums` but **resets `font-variant-ligatures`, `font-variant-caps`, `font-variant-alternates`, `font-variant-east-asian`, `font-variant-position` and `font-variant-emoji`**. RN also accepts a space-separated string, so `fontVariant: 'tabular-nums common-ligatures'` is the way to keep both. `preprocess.js` in RNW joins arrays with a space, so both forms work — I verified `fontVariant: 'tabular-nums lining-nums'` emits `font-variant:tabular-nums lining-nums`.

**Why this works:** react-native-web does not whitelist style properties. `packages/react-native-web/src/exports/StyleSheet/validate.js` (master) rejects only a curated list of CSS *shorthands* (`font`, `background`, `grid`, multi-value `margin`/`padding`/`flex`) with *"Please use long-form properties"*; **unknown properties pass through unchecked** and are hyphenated into real CSS. `normalizeValueWithProperty.js` appends `px` only when `typeof value === 'number'`, so **string values pass through verbatim** — which is what makes `letterSpacing: '-0.02em'` work.

#### 2b. What the TypeScript surface actually allows

This is the cost. From React Native 0.86's `StyleSheetTypes.d.ts` (https://github.com/facebook/react-native/blob/v0.86.0/packages/react-native/Libraries/StyleSheet/StyleSheetTypes.d.ts):

```ts
export interface TextStyleIOS extends ViewStyle {
  fontVariant?: FontVariant[] | undefined;   // note: declared on the *iOS* interface
  ...
}
export interface TextStyle extends TextStyleIOS, TextStyleAndroid, ViewStyle {
  fontWeight?: 'normal'|'bold'|'100'|...|'900'|100|...|900|'ultralight'|...;
  letterSpacing?: number | undefined;
  ...
}
```

| Property | Works on web? | In RN 0.86 `TextStyle`? | Works on native? |
| --- | --- | --- | --- |
| `fontVariant: ['tabular-nums']` | Yes (→ `font-variant: tabular-nums`) | Yes (via `TextStyleIOS`) | iOS yes; **Android status conflicting** — the TS type declares it on `TextStyleIOS`, but https://reactnative.dev/docs/text-style-props lists no platform restriction. *Unverified.* |
| `fontWeight: '437'` (variable axis) | Yes | **No** — union is 100–900 only | No |
| `letterSpacing: '-0.02em'` | Yes | **No** — `number` only | No |
| `fontVariationSettings` | Yes | **No** | No |
| `fontFeatureSettings` | Yes | **No** | No |
| `fontOpticalSizing` | Yes | **No** | No |
| `textWrap: 'balance' \| 'pretty'` | Yes | **No** | No |

Also: **`react-native-web` ships no TypeScript types at all** (its `package.json` has no `types`/`typings` field — verified in the installed package). The DefinitelyTyped package `@types/react-native-web` is at **0.19.2**, two minors behind (npm registry). In an Expo app you import from `react-native` and Metro aliases to RNW, so you get RN's types — which is exactly the table above.

**Classification, per your rubric:**
- Variable font axes, `tnum`, em letter-spacing, `text-wrap: balance` on **web**: *possible with an escape hatch* (type assertions or module augmentation of `TextStyle`).
- The same on **native**: *not possible* through these props. `fontVariant` is iOS-only; the rest are inert.

#### 2c. Where the `Text` abstraction genuinely leaks

Three real leaks, all verified from the emitted CSS / source:

**(i) The base `Text` rule uses the `font` shorthand.**

```css
.css-text-146c3p1{...;font:14px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;...;white-space:pre-wrap;word-wrap:break-word;}
```

`font` is a shorthand that resets `font-variant`, `font-weight`, `font-style`, `font-stretch`, `font-size`, `line-height` and `font-family` (https://developer.mozilla.org/en-US/docs/Web/CSS/font). RNW's own atomic `r-*` classes are emitted **after** this rule and therefore win at equal specificity — I confirmed the ordering in the generated stylesheet. But **any external CSS class of equal specificity that lands earlier in the cascade will be silently wiped** for those seven properties. `font-variation-settings` is *not* part of the shorthand and survives.

**(ii) Every `Text` is `white-space: pre-wrap`.** Per CSS Text 4, `white-space` is a shorthand for `white-space-collapse` + `text-wrap-mode`, and `pre-wrap` = `preserve wrap` (https://developer.mozilla.org/en-US/docs/Web/CSS/white-space). So whitespace and newlines in your JSX are **preserved, not collapsed** — different from every HTML authoring habit. `text-wrap: balance` still applies (it sets `text-wrap-style`, which `white-space` does not touch), and I confirmed both rules coexist in the output.

**(iii) `Text` renders `<div>`/`<span>`, not semantic HTML, unless you opt in.** Confirmed from `Text/index.js`: `let component = hasTextAncestor ? 'span' : 'div'`. Semantic elements come only from `role`, via `propsToAccessibilityComponent.js`'s map:

```js
const roleComponents = {
  article:'article', banner:'header', blockquote:'blockquote', button:'button',
  code:'code', complementary:'aside', contentinfo:'footer', deletion:'del',
  emphasis:'em', figure:'figure', insertion:'ins', form:'form', list:'ul',
  listitem:'li', main:'main', navigation:'nav', paragraph:'p', region:'section',
  strong:'strong'
};
```
plus special-casing for `heading` → `h${aria-level}` (default `h1`) and `label` → `<label>`. **You must remember `role` on every single element or you ship a page made of `<div>`s.** No `<time>`, `<table>`, `<dl>`, `<h1>`–`<h6>` shorthand, no `<hgroup>`.

#### 2d. `@media` and pseudo-classes: not supported at all

I grepped `react-native-web@0.21.2`'s `StyleSheet` compiler for `@media`, `:hover`, `::before`, `pseudo` — **zero matches**. RNW's `StyleSheet` has no media-query and no pseudo-class support. Consequences:

- **Hover states**: must be JS (`Pressable`'s `onHoverIn`/`onHoverOut`, which is a typed RN API and does work) — a state update per hover, per cell. Workable for a 5×6 Termo grid; noisier for a large Nonogram.
- **`prefers-reduced-motion`**: available only as the JS API `AccessibilityInfo.isReduceMotionEnabled()` (confirmed present in `AccessibilityInfo/index.js`, backed by `matchMedia`). Correct behaviour, but resolved after hydration.
- **`prefers-color-scheme`**: `Appearance/index.js` is literally `window.matchMedia('(prefers-color-scheme: dark)')`, guarded by `canUseDOM`. **On the server it returns `'light'` unconditionally.** I verified this in source. Your statically rendered HTML is therefore always light-themed → **flash of light theme on every cold load for dark-mode users.**
- **Responsive layout**: `useWindowDimensions()` on the server yields `{"fontScale":1,"height":0,"scale":1,"width":0}` — I ran `Dimensions.get('window')` in Node and got exactly that. Any breakpoint logic renders at zero width in the static HTML and reflows on hydrate.

These last two are the sharpest conflict with "fast first load on Brazilian mobile networks" + "dark mode from day one", because they are *structural to RNW's design* (styles are JS objects, not CSS), not bugs to be fixed.

#### 2d-bis. The failure is visible in a real `expo export` output, out of the box

I inspected the `dist/index.html` from the minimal SDK 57 app built in §4b — an unmodified `<Stack />` plus one `<Text>`. Verbatim excerpts:

```html
<style id="expo-reset">#root,body,html{height:100%}body{overflow:hidden}#root{display:flex}</style>
...
<div class="css-g5y9jx ..." style="background-color:rgba(242,242,242,1.00);display:flex">
...
<div class="css-g5y9jx r-1777fci r-12vffkv" style="max-width:-32px;margin-right:16px;margin-left:16px">
  <h1 dir="auto" aria-level="1" role="heading" ... style="...font-weight:500">index</h1>
</div>
```

Three things to note, none of which I had to induce:

1. **`max-width:-32px`.** A negative CSS length — invalid, and the browser discards the declaration. It exists because `Dimensions.get('window').width` is `0` on the server and React Navigation computed `0 - 32`. **This is Expo's default header component, in a default project, shipping broken CSS into the statically rendered HTML.** It is the §2d zero-width problem made concrete.
2. **`background-color:rgba(242,242,242,1.00)`** — React Navigation's *light* theme, baked into the static HTML. `grep prefers-color-scheme index.html` returns **nothing**. Dark-mode users get a light chrome until hydration completes.
3. **`body{overflow:hidden}`** from `ScrollViewStyleReset`. The document body does not scroll; scrolling happens inside an RNW `ScrollView`. Consequences for an editorial reading experience: no browser-native scroll restoration, mobile URL-bar auto-hide will not trigger, and viewport-relative `position: sticky` behaves differently than you would expect.

Also visible: `<title data-rh="true"></title>` — the `data-rh` attribute is react-helmet's, confirming at the artifact level that the `<Head>` pipeline really does run during static export (empty here only because the test app set no title). See §3.

#### 2e. Fonts: `expo-font`'s `@font-face` is inadequate for a variable font

Expo's static-rendering docs (https://docs.expo.dev/router/web/static-rendering/, last updated 2026-07-29) show the **exact** generated output:

```html
<link rel="preload" href="/assets/inter.ttf" as="font" crossorigin />
<style id="expo-generated-fonts" type="text/css">
  @font-face {
    font-family: inter;
    src: url(/assets/inter.ttf);
    font-display: auto;
  }
</style>
```

I confirmed the generator in `expo-font@57.0.1`, `build/ExpoFontLoader.web.js`:

```js
return `@font-face{font-family:${JSON.stringify(fontFamily)};src:url(${JSON.stringify(resource.uri)});font-display:${display}}`;
```

and the `FontResource` type (`build/Font.types.d.ts`) exposes only `uri` and `display`.

What that means concretely:

| Missing descriptor | Consequence for Fraunces (variable) |
| --- | --- |
| `font-weight: 100 900` | Face is matched as weight `normal`. Requesting `fontWeight: 700` makes the browser **synthesise bold** instead of driving the `wght` axis. **Workaround: drive weight only through `fontVariationSettings`** (verified working). |
| `size-adjust` / `ascent-override` / `descent-override` | No metric-compatible fallback → **unavoidable CLS** on font swap. |
| `format('woff2-variations')` / `tech(variations)` | No format hint; also **`.woff2` is not a supported Expo font format on Android** (https://docs.expo.dev/develop/user-interface/fonts/, last updated 2026-07-28: OTF/TTF on all platforms, WOFF/WOFF2 additionally on iOS). Shipping TTF to Brazilian mobile means a materially larger font payload than WOFF2. |
| `unicode-range` | No subsetting split. |
| `font-display` default is `auto`, not `swap`/`optional` | Browser-chosen blocking behaviour by default. Settable per resource via `FontDisplay`. |

**And Expo says the quiet part out loud** — https://docs.expo.dev/develop/user-interface/fonts/ (2026-07-28): *"Variable fonts, including variable font implementations in OTF and TTF, do not have support across all platforms."* The recommended remedy is to **use fontTools to extract static instances** — i.e. to give up the variable axes, which are the point.

**Every shipped site with good typography bypasses `expo-font`, and this is empirically verifiable** (details and URLs in §6):

| Site | Font pipeline |
| --- | --- |
| theoutbound.com | hand-written `@font-face`, self-hosted **woff2** + `format()` + `font-display: swap` (Onest 26 KB, New Spirit 40 KB) |
| **Expo's own sites** | hand-written `static.expo.dev/static/fonts/fonts.css` — **variable Inter `100 900`**, woff2, `unicode-range`, `swap` |
| evanbacon.dev (stock `@expo-google-fonts`) | 20 `@font-face`, **40 `.ttf`, 661 KB preloaded**, `font-display: auto`, 4 static weights |

Across the 1,093 Expo Router web domains surveyed, **only ~25 serve even a single `.woff2`**. Expo does not use `expo-font` for Expo's own typography.

**Escape hatch:** write your own `@font-face` (with `font-weight: 100 900`, `size-adjust`, WOFF2) in a global CSS file. Expo Metro supports global CSS and CSS Modules (https://docs.expo.dev/versions/latest/config/metro/), but states plainly: *"Global styles are web-only, usage will cause your application to diverge visually on native"*, *"on native, all global stylesheets are automatically ignored"*, and *"CSS Modules for native are under development and currently only work on web."*

#### 2f. The CSS escape hatch and its cost

Tested empirically against RNW 0.21.2:

| Escape hatch | Works? | Evidence |
| --- | --- | --- |
| `className="x"` on `View`/`Text` | **No — silently dropped.** Rendered `<div dir="auto" class="css-text-146c3p1">`, no `x`. | my test run |
| `style={{ $$css: true, editorial: 'editorial-hash' }}` (CSS Modules form) | **Yes** — rendered `class="css-text-146c3p1 editorial-hash"` | my test run |
| `dataSet={{ kind: 'display' }}` → `data-kind="display"` | **Yes** — targetable with `[data-kind="display"] { … }` | my test run |
| Raw DOM elements (`<h1>`, `<p>`) inside a web route | **Yes** — Expo docs: *"you can use React DOM directly"* | https://docs.expo.dev/workflow/web/ |
| `'use dom'` components | Yes on web (**pass-through, no iframe**) — but see below | https://docs.expo.dev/guides/dom-components/ |

**Cascade hazard for `$$css` / `dataSet`:** RNW's base `.css-text-*` rule (with the `font` shorthand) and your CSS-Module class have identical specificity `(0,1,0)`, so **document order decides**. Reading `@expo/router-server@57.0.4`'s `build/static/renderStaticContent.js`, `getStaticContent()` injects RNW's stylesheet before `</head>` first, then the bundled app CSS after it — so app CSS *should* win. I derived this from source and **did not verify it against a real `expo export` output** — mark as *unverified*.

**On `'use dom'` as an escape hatch:** it is real and documented, but the docs disqualify it here. https://docs.expo.dev/guides/dom-components/:
- *"Built-in DOM support only renders websites as single-page applications (no SSR or SSG)."*
- *"DOM components currently only render as single-page applications and don't support static rendering or React Server Components (RSC)."*
- On web specifically: *"DOM components rendered within websites or other DOM components will behave as regular components, and the `dom` prop will be ignored… because web content is passed directly through and not wrapped in an `iframe`."*
- Limitations: *"you cannot pass `children` to DOM components. DOM components are standalone and do not automatically share data between different instances. You cannot add native views to DOM components. Function props cannot return values synchronously."*

So `'use dom'` cannot be your SEO-critical typography layer (no SSG), and on native it becomes a WebView — unacceptable for a puzzle grid's touch latency.

**Net:** the honest description of the typography escape hatch is *"write your CSS in web-only global CSS / CSS Modules, and use `dataSet` or `$$css` to hook it up."* That is a perfectly good way to build a website. It is **not** a universal codebase — it is a Next.js-shaped app wearing an Expo Router costume, and you will still write the native typography layer from scratch later.

---

### 3. SEO and rendering

**Verdict for this area: genuinely good, and better than its reputation. Not a reason to reject.**

- **Static export is real per-route HTML.** `web.output: "static"` + `npx expo export --platform web` produces a `dist/` of HTML files. https://docs.expo.dev/router/web/static-rendering/ (2026-07-29): *"This is not a single-page application, nor does it contain a custom server."* and *"You don't need to add Single-Page Application styled redirects to your static hosting service. The static website is not a single-page application. It is a collection of static HTML files."*
- **Per-day URLs work.** Dynamic routes (`app/[date].tsx`) require `generateStaticParams`, which *"Runs at build-time in Node.js"* with access to `process.cwd()`, env vars and the filesystem. Returning `[{id:'alpha'},{id:'beta'}]` emits `dist/blog/alpha.html` and `dist/blog/beta.html`. That maps cleanly onto `/termo/2026-07-29`. Same doc.
- **Meta/OG tags: `<Head>` DOES emit into the static HTML.** This is the one place where I directly contradict a circulating community claim, so here is the source chain:
  - `expo-router@57.0.9`, `build/head/ExpoHead.js`: `Head` is `react-helmet-async`'s `Helmet`, and `Head.Provider` is `HelmetProvider`.
  - `@expo/router-server@57.0.4`, `build/static/renderStaticContent.js`, `getStaticContent()`:
    ```js
    const html = ReactDOMServer.renderToString(
      <Head.Provider context={headContext}>
        <InnerRoot loadedData={loadedData}>{element}</InnerRoot>
      </Head.Provider>
    );
    let output = mixHeadComponentsWithStaticResults(headContext.helmet, html);
    ```
    and `mixHeadComponentsWithStaticResults` calls `serializeHelmetToHtml(helmet)` and does `html.replace('<head>', '<head>' + headTags)`.
  - The docs agree: *"The head elements can be updated dynamically using the same API. However, it's useful for SEO to have static head elements rendered ahead of time."*
  - **The contrary claim:** https://github.com/expo/expo/pull/41215 (opened 2025-11-25, **still open and unmerged as of 2026-07-29, no maintainer response**) proposes doc text saying *"Head elements added this way are rendered dynamically on the client-side, so this approach doesn't work for SEO and social links."* Given the source above, I judge this claim **incorrect for SDK 57** (it may have been true on an earlier SDK, or the reporter was on `web.output: single`). Flagging it because the eight-month silence on the PR is itself a maintenance signal.
- **`generateMetadata` (Next.js-style) exists but is server-rendering-only.** `@expo/router-server` has `resolveMetadata`/`serializeMetadataToReact`, and it is documented **only** on the alpha server-rendering page (https://docs.expo.dev/router/web/server-rendering/): *"Routes may export a `generateMetadata` function… This function runs on the server before rendering begins."* It is called from `renderStreamingContent`, not from `getStaticContent`. **On static export you use `<Head>`, not `generateMetadata`.** (There is an open issue, expo/expo#46526 from 2026-06-03, to move SSG onto streamed rendering, which would presumably unify this — *unverified* as to timeline.)
- **Root HTML customisation** via `app/+html.tsx`, with `ScrollViewStyleReset`. Constraints from the docs: *"Global CSS cannot be imported inside of it"*, *"Browser APIs like `window.location` are unavailable."*
- **Font preloading is automatic** for synchronously-loaded `expo-font` fonts (see §2e) — confirmed in `renderStaticContent.js` via `Font.withServerContext` / `Font.getServerResources()`, and in `expo-font@57.0.1`'s `build/serverContext.web.js` which emits `{rel: 'preload'}` links.

**The one SEO-relevant leak** is §2c(iii): everything is a `<div>` unless you add `role`. Google renders JS and does read `<div>` text, but heading structure, `<article>`, `<main>`, `<time>` and `<nav>` all become manual work you must not forget. A plain-HTML app gets this for free.

**Also worth knowing (from Expo docs, https://docs.expo.dev/router/reference/reserved-paths/, added 2026-02-26):** `/assets/*`, `/_expo/*`, `/_flight/*`, `/inspector`, `/expo-dev-plugins/*`, `/manifest`, `/_sitemap`, `/public/*` are reserved. `/favicon.ico` is explicitly safe to override. **`/manifest` (no extension) is reserved** — name your PWA manifest `manifest.json`.

---

### 4. Performance

#### 4a. Measured: the intrinsic cost of react-native-web

I bundled two minimal entrypoints with esbuild (`--bundle --minify --format=esm --define:process.env.NODE_ENV='"production"'`), both rendering into `#root` with `react@19.2.3` / `react-dom@19.2.3`:

| Entry | Raw | Gzip (`gzip -9`) |
| --- | --- | --- |
| `react` + `react-dom/client` + 3 DOM elements | 193,450 B | **60,122 B** |
| same + RNW `View`, `Text`, `Pressable`, `StyleSheet`, `useWindowDimensions`, `Appearance` | 281,670 B | **88,546 B** |
| **RNW delta** | **+88,220 B** | **+28,424 B (+47 % over the React baseline)** |

This is a **floor**, and generous to RNW: ESM tree-shaking was fully effective and I imported only six symbols. A real Expo Router app additionally pulls `expo-router` → `@react-navigation/*`, `react-native-screens`, `react-native-safe-area-context`, `react-native-gesture-handler`, `react-native-reanimated` (all hard peer/dependencies of `expo-router@57.0.9`, verified from its published `package.json`). Published package size for reference: `react-native-web@0.21.2` unpacked is **2,980,393 B across 863 files** (npm registry `dist.unpackedSize`).

Commands are reproducible; artifacts were written to a scratchpad, not the repo.

#### 4b. Measured: a real minimal app, both stacks, built and benchmarked

Both apps were scaffolded and production-built. Expo: `expo@57.0.8` / `expo-router@57.0.8` / RN 0.86.0 / RNW 0.21.2, `web.output: "static"`, app = `_layout.tsx` with `<Stack />` plus `index.tsx` rendering one `<View><Text>Hello</Text></View>`, built with `npx expo export --platform web`. Next: `next@16.2.12` (latest, verified via `npm view next version`), bare App Router `layout.tsx` + `page.tsx`, no `next/font`, no `next/image`, no CSS.

**First-load JavaScript:**

| | raw | gzip -9 | brotli |
| --- | --- | --- | --- |
| **Expo Router web (static)** | **1,106,525 B** (1.06 MiB) | **291,363 B** | 229,865 B |
| Next.js 16.2.12 (Turbopack, default) | 514,526 B | 145,185 B | 124,565 B |
| Next.js 16.2.12 (`--webpack`) | 425,935 B | 125,252 B | 105,056 B |
| **Ratio (Expo ÷ Next-webpack)** | **2.60×** | **2.33×** | **2.19×** |

Expo ships roughly **166 KB more gzipped JS than Next.js at baseline**, for an app that renders one line of text. The Expo `index.html` is 18,823 B, of which **16,588 B is inline react-native-web `<style>` — repeated in every HTML file**.

**What is in the Expo bundle** (source-map attribution over 2,819,212 pre-minify bytes):

| package | share |
| --- | --- |
| `expo-router` | 42.5% (including **564,149 B of vendored `@react-navigation`**) |
| `react-native-web` | 26.7% |
| `react-dom` | 19.3% |
| `expo` + `expo-modules-core` | 3.4% |
| `react-native-screens` | 1.0% |

**The mitigations do not move it.** Tree shaking with `EXPO_UNSTABLE_TREE_SHAKING=1 EXPO_UNSTABLE_METRO_OPTIMIZE_GRAPH=1` recovered **1.0%**. `asyncRoutes: {web: true}` produced 3 chunks — **all referenced from `/`'s HTML**, and the total was 2 KB *larger*. Per https://docs.expo.dev/router/web/async-routes/, `asyncRoutes` defaults to `"development"`; production web splitting is opt-in.

**Lighthouse 12, headless Chrome, default mobile throttling, 3 runs, medians** (`npx lighthouse@12 --only-categories=performance`, both served locally):

| metric | Expo Router | Next.js |
| --- | --- | --- |
| Performance score | 99 | 100 |
| FCP | 615 ms | 608 ms |
| **Total Blocking Time** | **126 ms** | **16 ms** (7.9×) |
| **JS bootup time** | **274 ms** | **92 ms** (3.0×) |
| Main-thread work | 360 ms | 171 ms |
| TTI | 2,429 ms | 1,719 ms |

Run-to-run spread was under 5%. *(LCP is not comparable here — both pages render a single text node, so the LCP figures are artifacts. TBT and bootup time are the load-bearing signals.)* **RNW's hydration cost is roughly 8× Next's on a page containing one `<Text>`.** These were measured unthrottled on localhost with Lighthouse's default mobile CPU/network throttling; a real Brazilian 4G connection will amplify the transfer-size gap, not shrink it.

**Historical context — this floor has not moved in 2.5 years.** The only quantified first-party Expo figure I could find is https://blog.expo.dev/expo-router-v3-beta-is-now-available-eab52baf1e3e (*first-party Expo blog, published 2023-12-12, updated 2023-12-15*, shipped in SDK 50): *"30% smaller base bundle size: The base bundle size for production websites is now 30% smaller (from 1.48mb to 1.05mb)."* The measurement above is **1.06 MiB raw** on SDK 57. Expo's own docs pages on tree shaking, bundle analysis and minification (https://docs.expo.dev/guides/tree-shaking/, https://docs.expo.dev/guides/analyzing-bundles/, https://docs.expo.dev/guides/minify/) publish **no size numbers at all**. Neither do the SDK 54 or SDK 57 changelogs. (The "up to 75% smaller" claim circulating around SDK 55 refers to EAS Update bundle diffing for native OTA, not web: https://expo.dev/blog/ship-smaller-ota-updates-bundle-diffing-comes-to-ota-updates-in-sdk-55.)

**Next.js side note:** Next.js **removed the First Load JS metric from `next build` in v16.0.0** — https://nextjs.org/docs/app/api-reference/cli/next (docs version 16.2.12, lastUpdated 2026-05-13) version-history table: *"`v16.0.0` — The JS bundle size metrics have been removed from `next build`"*. So there is no citable official Next.js baseline; the figures above are measured, not quoted.

**Isolated RNW cost** (esbuild, `--external:react --external:react-dom`), corroborating §4a:

| entry | gzip |
| --- | --- |
| `export * from 'react-native-web'` | 81,553 B |
| `{View, Text, StyleSheet}` | 24,455 B |
| + `Pressable, ScrollView, Image, TextInput, FlatList, Animated` | 66,808 B |
| (scale reference) `react` + `react-dom/client` | 60,158 B |

RNW **does** tree-shake with an ESM-aware bundler (`"sideEffects": false`, `"module": "dist/index.js"`) — 3.3× spread between the full namespace and three components proves it. But a *typical* nine-component surface costs 66.8 KB gzip, comparable to all of react-dom, and in the real Expo build RNW contributes 26.7% of the graph regardless of what your app imports, because `expo-router` → `@react-navigation` pulls in most of the surface anyway.

#### 4c. Hydration model — full-tree, no islands, no escape

- https://docs.expo.dev/router/web/static-rendering/: *"The `children` prop comes with the root `<div id="root" />` tag included inside. The JavaScript scripts are appended after the static render. React Native web styles are statically injected automatically."* One root container.
- The docs never mention partial hydration, selective hydration, or islands.
- Verified in the built bundle: RNW's render path makes exactly one root call — `e.hydrate=function(u,o){return (0,n.createSheet)(o),(0,t.hydrateRoot)(o,u)}`, with exactly two occurrences each of `hydrateRoot`/`createRoot` in the entire 1.06 MiB entry.
- Server side, `getStaticContent` in `@expo/router-server@57.0.4` uses `ReactDOMServer.renderToString` over the whole tree.

**Every module in the graph ships to the client and hydrates.** Combined with §2d, the first paint is also structurally *wrong*: colour scheme is `'light'` and window size is `0×0` in the server output, so the correct UI appears only after JS downloads, parses, hydrates and re-renders. On a slow Brazilian mobile connection that is precisely the window you were trying to protect.

#### 4d. React Server Components — cannot be combined with static output

https://docs.expo.dev/guides/server-components/ describes RSC as **"Experimentally available"**, a **"beta release"**, **"subject to breaking changes"**, an **"early preview"**. The disqualifying constraints, quoted:

- *"`web.output` must be `'single'` in the app config during the developer preview."*
- *"Server rendering RSC payloads to HTML is not supported yet. This means static and server output doesn't fully work yet."*
- *"There is currently no stack routing. The custom layouts, Stack, Tabs, and Drawer, do not support Server Components yet."*
- *"Production deployment is limited and not recommended yet."*

**RSC and `web.output: 'static'` are mutually exclusive in SDK 57.** You cannot have SEO-static HTML *and* move work off the client via server components. There is no server-component escape hatch from the hydration cost above.

---

### 5. PWA and offline

**There is no first-party service-worker or PWA support in Expo SDK 57. This is documented, deliberate, and Expo actively warns against it.**

From https://docs.expo.dev/guides/progressive-web-apps/ (last updated **2026-06-03**):

- Service workers: *"Google's Workbox is the best way to add service workers to a website."* Recommended build script: `"build:web": "expo export -p web && npx workbox-cli generateSW workbox-config.js"`. Registration is a hand-written inline `<script>` calling `navigator.serviceWorker.register('/sw.js')`.
- The standing warning, verbatim: *"Be careful adding service workers as they are known to cause unexpected behavior on web. If you accidentally ship a service worker that aggressively caches your website, users cannot request updates easily. For the best offline mobile experience, create a native app with Expo."*
- Manifest: hand-write `public/manifest.json` and link it yourself in `+html.tsx`.

From https://docs.expo.dev/router/migrate/from-expo-webpack/ (last updated 2026-06-03):
- *"Unlike `@expo/webpack-config`, Expo Router does not automatically attempt to generate the PWA manifest configuration. You can create one in **public/manifest.json**"*
- *"Workbox doesn't have a Metro integration, but because Workbox doesn't require one of the core features of a bundler (transformation, resolution, serialization), it can easily be used as a post-build step."*

Maintainer position (Expo team member `marklawlor`, https://github.com/expo/router/discussions/408, **2023-09-18**, still the operative statement):
> *"Expo Router uses Metro, which doesn't have first-class support for PWA/Workbox."* … *"You can still use it, you will just need to do the setup manually as if you weren't using a framework or a bundler, just a vanilla HTML project."*

**Config-surface rot.** `https://docs.expo.dev/versions/latest/config/app/` still documents `web.shortName` (*"Maps to `short_name` in the PWA manifest.json"*), `web.startUrl`, `web.display`, `web.scope`, `web.orientation`, `web.backgroundColor`, `web.dir`, `web.preferRelatedApplications`, `web.barStyle`, `web.splash` — but in SDK 57's Metro pipeline **nothing reads them**. `packages/@expo/cli/src/start/server/webTemplate.ts` consumes exactly four: `web.lang`, name, `web.description`, `web.themeColor`. `web.favicon` still works (`packages/@expo/cli/src/export/favicon.ts`). Everything else is Webpack-era legacy that validates and generates nothing. There is no `rel="manifest"` string anywhere in `packages/`.

**History:** Workbox/offline was removed from `@expo/webpack-config` in **August 2021** (expo/expo-cli#3729, merged 2021-08-03); offline was disabled by default from SDK 39. Webpack itself was deprecated in SDK 50, announced **2024-01-18** (https://expo.dev/changelog/2024-01-18-sdk-50 and https://blog.expo.dev/webpack-support-in-expo-cli-is-now-deprecated-e9831d7eb631 — *secondary, first-party Expo blog*). `@expo/webpack-config@19.0.1` (2024-01-17) peer-caps at `expo@^50`; `expo-pwa@0.0.127` last published 2023-08-25. Both are dead for SDK 57.

**Does the DIY path work?** Yes. `public/sw.js` → `dist/sw.js` → served at `/sw.js` with root scope (`packages/@expo/cli/src/export/publicFolder.ts` does a recursive copy of `public/` onto `dist/`; `/sw.js` is not on the reserved-paths list).

**One deployment gotcha (inferred, not documented):** https://docs.expo.dev/eas/hosting/reference/caching/ (last commit 2026-07-29) says *"For any assets your deployment responds with, a default cache time of 3600 seconds will be applied for browser caches"*, and https://docs.expo.dev/eas/hosting/reference/responses-and-headers/ (2025-10-22) documents no mechanism for custom `Cache-Control` on static files. A 1-hour browser cache on `sw.js` is a classic PWA footgun. Neither page mentions service workers at all.

**Bottom line for Miolos:** caching 2–3 days of puzzles offline is entirely achievable, but it is hand-rolled Workbox on both this option and the alternative. **This area is close to a wash** — except that Expo's docs discourage it and Next.js has a large ecosystem of maintained PWA plugins. Do not let this be the deciding factor.

---

### 6. Evidence from real products

**One exists.** A deep sweep (urlscan.io resource search on `filename:"_expo/static/js"` → 1,093 live domains, bulk-fingerprinted) found exactly one design-led, statically-rendered, SEO-driven editorial product on Expo Router web. I then verified it myself with `curl --compressed` on 2026-07-29.

> **Methodology note:** `curl` *without* `--compressed` produces false negatives on some hosts. My earlier negative fingerprints were re-run with it; none flipped.

#### The precedent: theoutbound.com

**The Outbound Collective** — https://www.theoutbound.com. My own verification of `/san-francisco/chillin/a-lawn-party-in-the-city`:

| Signal | Measured |
| --- | --- |
| `__EXPO_ROUTER_HYDRATE__` | present |
| `_expo/static/js` / `_expo/static/css` | 3 / 4 |
| **Visible words in initial HTML** | **538** (real prose, before any JS) |
| Semantic HTML | real `<h1>` + 3× `<h2>` via `role="heading"` + `aria-level` |
| `@font-face` blocks / `woff2` refs | 8 / 20 |
| `application/ld+json` | 1 |

It is real. It disproves the strong form of my earlier claim, and I have corrected it.

**But look at *how* they did it** — this is the important part. The actual `<h1>` they ship:

```html
<h1 dir="auto" aria-level="1" role="heading"
    class="css-146c3p1 r-6e8ixz font-new-spirit-regular text-3xl md:text-5xl default-text pb-2 md:pb-3"
    style="margin-top:0px;margin-bottom:0px;font-weight:auto">
```

and their `@font-face`:

```css
@font-face{font-family:"Onest-Regular";font-display:swap;font-style:normal;src:url("/fonts/Onest-Regular.woff2") format("woff2")}
@font-face{font-family:"Onest-Medium";font-display:swap;font-style:normal;src:url("/fonts/Onest-Medium.woff2") format("woff2")}
@font-face{font-family:"Onest-SemiBold";font-display:swap;font-style:normal;src:url("/fonts/Onest-SemiBold.woff2") format("woff2")}
```

Four observations, every one of which **confirms** the analysis in §2 rather than undermining it:

1. **They bypassed RNW's `StyleSheet` for everything that matters.** Those are Tailwind/NativeWind classes: `text-3xl`, `md:text-5xl`, `pb-2`, and — I grepped the page — `dark:bg-black`, `dark:text-white`, `dark:border-gray-`, `lg:hidden`, `lg:flex`. That is **real CSS with real media queries and a real `dark:` variant**, i.e. precisely the web-only escape hatch §2d says you are forced into. RNW is the renderer; it is not the styling system.
2. **They bypassed `expo-font` entirely.** Hand-written `@font-face`, self-hosted **woff2** with a `format()` hint and `font-display: swap` — none of which `expo-font` can emit (§2e). Onest is 26 KB, New Spirit 40 KB; contrast `evanbacon.dev` on stock `@expo-google-fonts`, which preloads **661 KB across 40 `.ttf` files** at `font-display: auto`. Across all 1,093 Expo Router domains found, **only ~25 serve even a single `.woff2`**.
3. **They are not using variable fonts.** `Onest-Regular`, `Onest-Medium`, `Onest-SemiBold` are three separate static families — exactly the "extract static instances" concession Expo's own font docs recommend. **Even the best editorial site on this stack gave up the variable axes**, which are the core of the Miolos brief.
4. **The abstraction still leaks visibly.** `style="font-weight:auto"` appears **7 times** in the page — invalid CSS, an artifact of NativeWind selecting a font *family* per weight while RNW still emits a `font-weight` declaration. Their JS bundle is **1.78 MB**, consistent with the 1.06 MiB floor I measured in §4b.

**So the honest reading of the precedent is: it validates the verdict.** The one team that achieved editorial typography on Expo Router web did it by using Tailwind CSS classes, hand-rolled woff2 `@font-face`, CSS media queries and CSS dark-mode variants — a web stack — with RNW reduced to a rendering shell. That is the thing §2f calls *"a Next.js-shaped app wearing an Expo Router costume."* They pay Expo's 1.78 MB bundle tax for it, and they still don't get variable fonts.

#### Commercial validation exists, but it is transactional, not editorial

**Restaurant Brands International** runs Expo Router on the web: `www.bk.com` (`expo-router` ×11), `www.popeyes.com` (`__EXPO_ROUTER_HYDRATE__`, 7 `_expo/static/js`, statically rendered, brand face *Chicken Sans* self-hosted as `.otf`/`.ttf`), `www.firehousesubs.com`/`.ca`. Peers checked and negative: Subway, Chipotle, Wendy's, KFC, Domino's, Dunkin', Starbucks, Tim Hortons — all Next.js or other.

Others confirmed on Expo Router web: **goldin.co** (`expo-router` ×22), **gofan.co** (PlayOn ticketing), **app.lingvano.com**, **matiks.com**, **start.billgo.com**, **journ.it**, **docs.aptoria.ai** (the only docs site; 2,805 statically rendered words, but system fonts only).

**Nearly all are SPA shells that serve almost nothing to a crawler:** bk.com is 1.5 KB / **11 visible words**; goldin.co 2.1 KB / **21 words**; gofan.co serves **1 visible word to Googlebot** across a 53-page school sitemap. For a product whose distribution thesis is browser sharing and SEO, that is the modal outcome on this stack, and Outbound is the exception.

#### What Expo itself ships

- **expo.dev/blog** *is* Expo Router (server rendering + data loaders) — **and it does not server-render its prose.** Test phrases from a post appear exactly once each, **both inside `<script>`, zero times in markup**: 143 visible words against ~755 words buried in a ~100 KB `__EXPO_ROUTER_LOADER_DATA__` blob. Expo's own blog fails the SEO test Miolos needs.
- Only `/blog/*` is Expo Router. `expo.dev/`, `/pricing`, `/changelog`, `/customers`, `/eas`, `/router` and `expo.new` are **Next.js with zero RNW classes**. **docs.expo.dev is Next.js.**
- Expo hand-wrote `static.expo.dev/static/fonts/fonts.css` for its own sites — variable Inter `100 900`, woff2, `unicode-range`, `font-display: swap`. **Expo does not use `expo-font` for Expo's own typography.**

#### Expo's customer roster names no web shippers

https://expo.dev/customers (fetched 2026-07-29) lists 15 customers — MTA, Hipcamp, Phantom, Partiful, incident.io, Awaze, Insider, Lingvano, Bounce, Mollie, Goody, Better, Blackline, PlayOn, Cameo. **Not one testimonial mentions shipping a web app.** I fingerprinted two directly: **partiful.com** marketing is Framer/Vite and its app is **Next.js** (27 `_next/static`, zero RNW); **bounce.com** is **Next.js** (636 `_next/static`). Also negative for RNW: hipcamp, incident.io, mollie, awaze, better, blackline, insider, ongoody, phantom.

#### The X/Twitter claim is now stale

https://docs.expo.dev/workflow/web/ still says RNW *"powers X's website"*. Two corrections: X was never an Expo Router app (it is Gallagher's own RNW work, predating Expo Router), and **x.com's logged-out experience was rewritten off react-native-web around 2026-07-03** onto TanStack Router + Tailwind v4 + Vite/Rolldown. The logged-in app reportedly remains RNW (*unverified* — behind auth). Expo's flagship social proof for RNW is being migrated away from.

Other RNW-but-not-Expo-Router products: **bsky.app** (`expo 54.0.35` + `react-native-web ^0.21.0`, `expo export:web`, **`expo-router`: 0**), **tamagui.dev** (SSR'd, 8 woff2 — but the *One* framework, not Expo Router), beatgig.com, food.bolt.eu, abetterrouteplanner.com, new.expensify.com. `app.uniswap.org` is Vite + Tamagui (RNW `0.19.13` pinned at monorepo root only, absent from served bundles).

**Bottom line for §6:** the precedent exists and is worth studying, but below Outbound the corpus drops into SPA shells, hobby projects, and obviously AI-scaffolded output sharing an identical `@expo-google-fonts` `.ttf` block. There is no Expo Router magazine, blog platform, or editorial product at scale — and the one good example got there by routing around every part of the stack that Miolos would be adopting it for.

---

### 7. Known limitations and escape hatches (summary)

**Maintainer-acknowledged / documented as unsupported or web-only:**

| Limitation | Source |
| --- | --- |
| Server rendering is alpha | https://docs.expo.dev/router/web/server-rendering/ |
| Data loaders are alpha | https://docs.expo.dev/router/web/data-loaders/ |
| Cannot mix server and static rendering in one project | https://docs.expo.dev/router/web/server-rendering/ |
| Request-time rendering impossible with `web.output: static` | https://docs.expo.dev/router/web/static-rendering/ |
| RSC: *"`web.output` must be `'single'`… during the developer preview"*; *"static and server output doesn't fully work yet"* | https://docs.expo.dev/guides/server-components/ |
| Production web code splitting is opt-in (`asyncRoutes` defaults to `"development"`) and recovered 0% in measurement | https://docs.expo.dev/router/web/async-routes/ + §4b |
| Tree shaking cannot touch CJS: *"Files that use `module.exports` and `require` will not be tree-shaken"* | https://docs.expo.dev/guides/tree-shaking/ |
| No first-class PWA/Workbox support | expo/router#408 (2023-09-18) + PWA guide (2026-06-03) |
| Global CSS is web-only; *"will cause your application to diverge visually on native"* | https://docs.expo.dev/versions/latest/config/metro/ |
| *"CSS Modules for native are under development and currently only work on web"* | same |
| *"Standard Tailwind CSS supports only web platform"* | same |
| *"Variable fonts… do not have support across all platforms"* | https://docs.expo.dev/develop/user-interface/fonts/ (2026-07-28) |
| WOFF/WOFF2 supported on iOS and web, **not Android** | same |
| `expo-font` config plugin is native-only; *"For web, use the useFonts hook instead"* | same |
| DOM components: *"only renders websites as single-page applications (no SSR or SSG)"* | https://docs.expo.dev/guides/dom-components/ |
| RNW `StyleSheet`: no `@media`, no pseudo-classes | verified by grep of RNW 0.21.2 source |
| RNW ships no TypeScript types | verified: no `types` field in `package.json` |

**The author of react-native-web has said, on the record, that this is not the use case.** Nicolas Gallagher, https://github.com/necolas/react-native-web/discussions/2646 (discussion opened 2024-03-05; his reply **2024-04-01**, retrieved via GitHub API 2026-07-29). Verbatim:

> *"I think new projects should use RSD as much as possible… **There is no investment at Meta in RNfWeb by either the Web or RN teams**, whereas both have been working on RSD."*

> *"I will continue to review PRs and merge fixes. But **I don't expect to put significant time into major development initiatives**."*

> *"**using RNfWeb to bring existing RN apps to Web is not a good use case.** We tried this internally at Meta and found that RN apps are simply missing too much semantic information to produce quality web apps as output."*

> *"**RNfWeb has always had the expectation that it be used for web-first development, where the extra semantics it provides for web simply no-op on native.**"*

> *"**I now think it's unrealistic to expect RNfWeb to become materially smaller in the years ahead**, as to do that would first require that most of the existing RN ecosystem migrate away from certain patterns… There's been little progress on that front in OSS over the last 6+ years."*

> *"This is one of the fundamental problems with React Native's JS API today — **it's not a cross-platform library**."*

Three of these land directly on this decision:

- The "extra semantics… simply no-op on native" line is the **author's own design intent** describing exactly the behaviour I measured empirically in §2b. It is not a gap to be closed; it is the contract. The universal-codebase premise is a misreading of what RNW is for.
- "Unrealistic to expect RNfWeb to become materially smaller in the years ahead" is the maintainer telling you the §4b bundle floor is permanent.
- His recommended successor, **React Strict DOM**, is still at `0.0.55` (2026-01-09) — not a viable alternative today, so there is no forward path off RNW either.

**Maintenance signal.** From the GitHub API on 2026-07-29:
- `necolas/react-native-web` `pushed_at`: **2025-10-16**. Zero commits on `master` since. 158 open issues, 22,137 stars, not archived.
- Latest release **0.21.2, 2025-10-16**. Prior: 0.21.1 (2025-08-20), 0.21.0 (2025-07-25), 0.20.0 (2025-04-03), 0.19.0 (2023-03-27).
- Contributor PRs #2844, #2845, #2846, #2847 (opened 2026-07-16/17) were all **closed unmerged** on 2026-07-17.
- PR #2733 *"Add missing Font Variants"* (fixing #2732) has been **open since 2024-10-31**, last touched 2025-08-20, unmerged.
- npm maintainers are `necolas` and `brentvatne` (Expo) — so Expo has publish access, which is some mitigation, but no code has flowed.

**Escape hatches, honestly classified:**

| Need | Verdict |
| --- | --- |
| Variable font axes / `tnum` / em letter-spacing / `text-wrap` **on web** | *Possible with an escape hatch* — untyped pass-through style props (verified working) or web-only CSS |
| The same **on native** | *Not possible* via these props |
| Semantic HTML (`<h1>`, `<p>`, `<main>`) | *Possible with effort* — `role` on every element |
| `@media` / `:hover` / `::before` in RN styles | *Not possible* — must use global CSS / CSS Modules (web-only) or JS state |
| Correct dark mode in statically rendered HTML | *Possible only with an escape hatch* — CSS custom properties in web-only global CSS; **not possible** through RNW's `Appearance` |
| Correct responsive layout in statically rendered HTML | *Possible only with an escape hatch* — CSS media queries in web-only global CSS; **not possible** through `useWindowDimensions` |
| Raw DOM (`<div>`, `<h1>`) inside a web route | *Possible* — Expo says so explicitly; breaks native |
| `'use dom'` components | *Possible on web* (pass-through) but **excludes the component from SSG**, and becomes a WebView on native |
| Hand-written `@font-face` with `font-weight: 100 900` + `size-adjust` | *Possible* via web-only global CSS |
| PWA / offline | *Possible with effort* — hand-rolled Workbox post-build step |

Notice the pattern: **almost every escape hatch that solves a Miolos requirement is explicitly web-only.** Each one you take reduces the universal codebase back toward a web app, while adding Expo's abstraction tax.

---

## What would have to be true for this option to win

All of the following, not some:

1. **Typography would have to be demoted from differentiator to preference.** Specifically: accept the `wght` axis driven only through `fontVariationSettings` (or static instances per Expo's own recommendation), accept `letterSpacing` in px rather than em, and accept that none of it carries to native. If you are willing to say "the native app will have its own type system", the argument changes — but then you are not buying "one UI codebase", you are buying "one navigation and state layer", which is a much smaller prize.
2. **You would have to accept a first-paint that is light-themed and zero-width**, or commit up front to a web-only CSS-custom-property theming layer that RNW styles read from. That layer is real work, is not the RNW idiom, and must be duplicated for native.
3. **Native would have to be a near-certain, near-term commitment**, not a "later". The universal bet only pays back when the second platform ships. If native slips a year — plausible for a solo developer launching web-first in Brazil — you will have paid the full abstraction tax and collected none of the return.
4. **You would have to be comfortable depending on a package with no upstream commits since 2025-10-16 and no TypeScript types**, for the layer that renders every pixel of your product.
5. **You would have to accept 291 KB gzip of first-load JavaScript before writing a single feature**, and ~8× Next.js's Total Blocking Time, against a bundle-size requirement you called out explicitly. No documented lever moves this meaningfully.
6. **You would have to be willing to build it the way the one successful precedent did** — Tailwind/NativeWind for all styling, hand-written woff2 `@font-face`, CSS `dark:` variants and CSS media queries, with RNW demoted to a rendering shell (§6). That is a viable, proven path. Note what it means: you would be writing a Tailwind web app, hosting it inside Expo Router, and paying a ~1.8 MB bundle for the privilege — and theoutbound.com *still* ships static font instances rather than variable axes. If you are going to write Tailwind + CSS anyway, the Expo Router wrapper is buying you almost nothing on web.

Conditions 1 and 2 are the load-bearing ones, and both are direct contradictions of the brief as written.

**The genuinely strong parts of this option, for the record:** static rendering with real per-route HTML and working `<Head>` meta tags; `generateStaticParams` mapping cleanly to per-day URLs; automatic font preload injection; full desktop interaction support (`onKeyDown`, `onKeyUp`, `onContextMenu`, `onMouseEnter/Leave`, `tabIndex`, and the complete ARIA surface are all in RNW's `forwardedProps` — I dumped the list); `AccessibilityInfo.isReduceMotionEnabled()` and `Appearance` as proper cross-platform APIs. If your constraints were different, this would be a real contender. They aren't.

---

## Confidence and gaps

**High confidence (verified by running code against the actual published packages):**
- RNW 0.21.2 emits `font-variation-settings`, `font-feature-settings`, `font-optical-sizing`, `text-wrap`, `font-weight:437`, `letter-spacing:-0.02em`, `font-variant:tabular-nums`. Confirmed by rendering and dumping the stylesheet.
- `role="heading"` + `aria-level` → real `<h1>`. Confirmed by rendered HTML.
- `className` is dropped; `$$css` and `dataSet` work. Confirmed by rendered HTML.
- `Appearance.getColorScheme()` → `'light'` on server; `Dimensions.get('window')` → `{width:0,height:0}` on server. Confirmed by running in Node.
- RNW `StyleSheet` has no `@media` / pseudo-class support. Confirmed by grep of installed source.
- RNW ships no TS types; `@types/react-native-web` latest is 0.19.2. Confirmed from `package.json` and npm registry.
- Bundle delta +28,424 B gzip for six RNW symbols. My own measurement, commands given in §4a.
- All §4b figures: both apps were actually scaffolded, production-built, served and benchmarked with Lighthouse 12 (3 runs, medians, <5% spread). Expo 291,363 B gzip vs Next 125,252 B gzip; TBT 126 ms vs 16 ms. Source-map attribution of the Expo bundle composition likewise measured.
- RSC is incompatible with `web.output: static` — quoted directly from https://docs.expo.dev/guides/server-components/.
- Full-tree hydration with no islands — confirmed both from docs and by finding exactly one `hydrateRoot` root call in the built 1.06 MiB bundle.
- `<Head>` is wired into static rendering. Confirmed by reading `@expo/router-server@57.0.4` `renderStaticContent.js`.
- `expo-font`'s `@font-face` template. Confirmed by reading `expo-font@57.0.1` source *and* matching it against Expo's published docs example.
- The `max-width:-32px`, baked light theme, absent `prefers-color-scheme`, and `body{overflow:hidden}` in a real `dist/index.html` — read directly from a built default SDK 57 export (§2d-bis).
- theoutbound.com's stack, prose count, `@font-face` blocks, Tailwind/`dark:` classes and `font-weight:auto` artifacts — fetched and counted by me on 2026-07-29.
- Nicolas Gallagher's statements — retrieved via the GitHub GraphQL API from discussion #2646, comment dated 2024-04-01, quoted verbatim.
- RNW repo dormancy since 2025-10-16. Confirmed via GitHub API (`pushed_at`, commit list, PR merge states).

**Medium confidence (read from primary source, not executed):**
- Cascade ordering between RNW's stylesheet and bundled app CSS in a real `expo export` output. Derived from `getStaticContent` source; **not verified against a built `dist/`**.
- Whether `@radix-ui/*`, `vaul`, `@testing-library/*` (runtime deps of `expo-router@57.0.9`) are excluded from production route bundles. **Unverified.**
- Whether the synthetic-bold problem actually manifests for a specific variable font in a specific browser. The mechanism is certain from the CSS spec and the generated `@font-face`; I did **not** run a browser test. Treat as *strongly expected, unverified in practice*.
- The `font` shorthand cascade: I confirmed RNW's own atomic classes win, but did not test a three-way conflict with external CSS.

**Gaps — could not verify:**
- **No published third-party Lighthouse/LCP comparison of RNW vs plain React DOM exists.** Searches found nothing on point. The closest hits are disqualified: `indeedeng/react-native-lighthouse` (https://engineering.indeedblog.com/blog/2026/03/bringing-lighthouse-to-the-app-building-performance-metrics-for-react-native/, 2026-03) is Lighthouse-*style* scoring for **native** RN, not web; and a 2025 secondary post at viewlytics.ai claiming "+78 KB / 1.4 s" for Expo Router has undisclosed methodology and figures an order of magnitude smaller than measurement — **do not rely on it**. §4b is therefore my own data, not corroborated by an independent published benchmark.
- **The Lighthouse runs were on localhost with Lighthouse's default throttling**, not on a real Brazilian network. Directionally safe (transfer-size gaps widen on slow links) but not a field measurement.
- bundlephobia was unavailable (HTTP 503) during this research; packagephobia rate-limited. All size figures are own measurements or npm registry `dist.unpackedSize`.
- **§6 was corrected mid-research.** My first pass concluded no editorial Expo Router web product existed; a systematic sweep (urlscan.io `filename:"_expo/static/js"`, 1,093 domains) found theoutbound.com, which I then verified myself. The corpus is large but not exhaustive — urlscan only indexes scanned domains, and the `_expo/static/js` fingerprint misses any site serving from a custom asset path. **More examples may exist.** They would not change the verdict, which rests on §2, §2d and §4b; and the one strong example found actively supports it (§6).
- Whether theoutbound.com uses NativeWind specifically vs. another Tailwind-to-RNW bridge. The Tailwind class names and `dark:`/`md:`/`lg:` variants in the served HTML are first-hand and certain; the exact library is *unverified*.
- Whether X/Twitter's logged-in app still uses react-native-web. **Unverified** — behind authentication. The logged-out rewrite off RNW (~2026-07-03, to TanStack Router + Tailwind v4 + Vite/Rolldown) came from the sweep, not from my own fetch; treat the date as approximate. The Expo docs claim that RNW *"powers X's website"* is undated.
- Whether the SSG-via-streaming work (expo/expo#46526, opened 2026-06-03) will bring `generateMetadata` to static export, and on what timeline.
- Whether Expo maintains a private patch set over the dormant react-native-web, or intends to fork it. `brentvatne` having npm publish rights is suggestive but not evidence.
- Actual behaviour of `fontVariationSettings` and friends on native in RN 0.86 — I asserted they are inert based on their absence from the type definitions and from the RN `Text` style API docs (https://reactnative.dev/docs/text-style-props), but did not run a native build.

**Undated sources flagged:** https://docs.expo.dev/versions/latest/config/app/ and https://docs.expo.dev/more/expo-cli/ carry no modification date. https://github.com/expo/fyi/blob/main/enabling-web-service-workers.md is undated.

**Secondary sources used, and only as pointers to primary material:** https://blog.expo.dev/webpack-support-in-expo-cli-is-now-deprecated-e9831d7eb631 (first-party Expo blog, 2024-01-18) — corroborated by the SDK 50 changelog. Bundlephobia was not used; all size figures are either my own measurements or npm registry `dist.unpackedSize`.

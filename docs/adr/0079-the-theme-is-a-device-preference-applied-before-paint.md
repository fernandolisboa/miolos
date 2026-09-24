# ADR-0079 — The theme is a device preference, applied before paint

**Status:** Accepted — 2026-09-24

## Context

Dark mode is a launch requirement (DESIGN.md, "Dark mode (pending)"). Miolos has no server-rendered per-user state today — every page is static or driven by client-side session data — and the theme choice (system / light / dark) has to reach the very first paint, or the page flashes the wrong palette before JavaScript runs.

## Decision

1. **`prefers-color-scheme` decides by default; `[data-theme]` on `<html>` overrides it.** `packages/ui/tokens.css` carries the light `:root` block unconditionally, a `@media (prefers-color-scheme: dark)` block scoped to `:root:not([data-theme="light"])`, and a `:root[data-theme="dark"]` block with the same values — so an explicit choice always wins over the media query, and "system" is simply the absence of the attribute.
2. **The choice lives in `localStorage`** (`miolos-theme`, `apps/web/src/theme/theme.ts`), read and applied by a small inline `<script>` in `app/layout.tsx`'s `<head>`, before React hydrates. `suppressHydrationWarning` is set on `<html>` only, because the script may set `data-theme` before the server-rendered markup reaches the client.
3. **No server state.** `readThemeChoice` / `applyThemeChoice` are the only readers and writers; every storage access is wrapped in `try`/`catch` — private browsing and storage quota errors leave the page on `prefers-color-scheme` rather than throwing.

## Rejected

- **A cookie plus a server-rendered attribute.** Reading a cookie in the root layout makes every route dynamic, which the app does not otherwise need — most pages are static or ISR.
- **A server-side stored preference.** Would need an authenticated user and a round trip before first paint; the device-only choice is available before login and matches how the OS-level preference already works.
- **CSS `light-dark()`.** Needs `color-scheme` set per token and every consumer rewritten to `light-dark(x, y)`; the two-block duplication is more verbose but keeps every existing `var(--token)` call site unchanged.

## Consequences

- A future Content-Security-Policy `script-src` must allow this inline script (nonce or hash), or the theme breaks silently on first paint.
- Browser chrome colour (`<meta name="theme-color">`) follows the system preference via `viewport.themeColor`'s media-query pair — it does not follow an explicit in-app override, since that would need JS to rewrite the meta tag after hydration, which this ADR does not add.
- `packages/ui/tokens.css`'s two dark blocks must stay byte-identical; `T-WEB-S390` pins it.

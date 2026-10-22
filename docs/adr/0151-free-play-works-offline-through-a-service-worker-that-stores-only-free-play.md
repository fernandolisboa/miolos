# ADR-0151 — Free play works offline through a service worker that stores only free play

**Status:** Accepted — 2026-10-22 (issue #426)
**Depends on:** [ADR-0004](./0004-no-unpublished-puzzle-reaches-the-client.md), [ADR-0011](./0011-free-play-is-generated-on-the-client.md), [ADR-0079](./0079-the-theme-is-a-device-preference-applied-before-paint.md)
**Supersedes in part:** [ADR-0064](./0064-streak-at-risk-is-a-derived-decision.md) decision 5 — "no request-interception handler, no cache storage, ever" and "registration happens inside the accept gesture only"
**Annotates:** [ADR-0028](./0028-daily-play-routes-and-the-conclusion.md), [ADR-0068](./0068-the-dispatchers-operating-decisions.md)

## Context

Fernando wants free play to keep working without signal. Free play already generates and judges every puzzle on the device (T-WEB-S374), but its pages and scripts must be on the device before the signal drops. The only worker, `apps/web/public/sw.js`, was push-only and caching-free by decision.

## Decision

1. The worker gains `install`, `activate` and `fetch`. It stores only same-origin GET responses that are `ok`, `basic`, not redirected, and not `Cache-Control: no-store` or `private`, and only two kinds: the free-play pages (`/modo-livre` and `/modo-livre/<slug>`, all static) and `/_next/static/` build assets.
2. One writer, `warm()`. It fetches `/modo-livre`, follows its `/modo-livre/<slug>` links, and crawls each page's assets: `/_next/static/` refs in HTML, bare `static/…` strings in JS and CSS (how Turbopack names `lazyChunk` imports; Vercel adds an `immutable/` segment), and CSS `url()`. It fills a fresh `miolos-livre-<ms>` cache, writes a completion marker last, and only then deletes the older caches. Reads use the newest cache holding the marker. One warm runs at a time; Save-Data skips it.
3. Warm runs in `install`, on any online navigation while no complete cache exists, and when an online free-play navigation returns HTML that differs from the stored page, which is how a deploy shows up (`sw.js` itself does not change per deploy).
4. Navigations go to the network, with navigation preload. Offline, a stored free-play page answers; any other path gets a 302 to `/modo-livre?sem-conexao`, where `OfflineNote` explains that the daily needs a connection (it also shows whenever `navigator.onLine` is false). Assets are cache first, query ignored, since the paths are content-hashed. Nothing else is intercepted: not the API (another origin), not RSC fetches, not POSTs.
5. The root layout registers the worker with a production-only inline script at the end of `<body>`, run on `load`, in the `themeScript` style: no client JS on any route. Dev skips it because dev chunks are not content-hashed. The push flow still registers the same script.

## Consequences

- ADR-0004 holds, now pinned by T-WEB-S1062 and S1064 instead of a caching-free worker: no dynamic route, RSC payload or API response is written. T-WEB-S261 pins the five handlers. ADR-0064 decision 10 (b) and ADR-0068 decision 6 argued "no third capability"; that premise is gone, and their no-`pushsubscriptionchange` call stands on ADR-0081.
- Every visitor downloads all of free play once, about 0.8 MB gzipped, and the changed files after a deploy. A player who reaches free play only through in-app links keeps the older build offline; its pages and chunks are stored together, so it still works.
- Offline `Link` taps work because Next turns a failed RSC fetch into a browser navigation. Turning on `experimental.useOffline` would break that.
- The crawl reads Turbopack's output. After a Next upgrade, re-check against a Vercel deployment (local `next start` emits different paths): warm, go offline, open each game and a lazy part.
- Kill switch: never unregister (that drops every push subscription). Ship a `sw.js` that keeps `push` and `notificationclick`, has no `fetch`, and deletes every `miolos-livre-*` cache in `activate`.
- A future `script-src` CSP must allow this second inline script too (ADR-0079).

## Rejected

- **Caching pages as they are visited:** a page whose lazy chunks were never loaded fails offline, and runtime writes race the warm.
- **A build-time precache list:** Next writes no per-route list we can ship from `public/`, and a postbuild step would sit outside the Vercel build.

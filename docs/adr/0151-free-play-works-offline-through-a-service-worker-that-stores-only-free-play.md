# ADR-0151 — Free play works offline through a service worker that stores only free play

**Status:** Accepted — 2026-10-22 (issue #426)
**Depends on:** [ADR-0004](./0004-no-unpublished-puzzle-reaches-the-client.md), [ADR-0011](./0011-free-play-is-generated-on-the-client.md), [ADR-0079](./0079-the-theme-is-a-device-preference-applied-before-paint.md)
**Supersedes in part:** [ADR-0064](./0064-streak-at-risk-is-a-derived-decision.md) decision 5 — "no request-interception handler, no cache storage, ever" and "registration happens inside the accept gesture only"

## Context

Fernando wants free play to keep working without signal. Free play already generates and judges every puzzle on the device (T-WEB-S374), but its pages and scripts must be on the device before the signal drops. The only worker, `apps/web/public/sw.js`, was push-only and caching-free by decision.

## Decision

1. The worker gains `install`, `activate` and `fetch`. It stores only same-origin GET responses that are `ok`, `basic`, not redirected, and not `Cache-Control: no-store` or `private`, and only two kinds: the free-play pages (`/modo-livre` and `/modo-livre/<slug>`, all static) and `/_next/static/` build assets.
2. One writer, `warm()`. It fetches `/modo-livre`, follows its `/modo-livre/<slug>` links, and crawls each page's assets: `/_next/static/` refs in HTML, `static/(chunks|media)/…` strings in JS and CSS (so `lazyChunk` imports are found), and CSS `url()`. It fills a fresh `miolos-livre-<ms>` cache, writes a completion marker last, and only then deletes the older caches. Reads use the newest cache holding the marker. One warm runs at a time; Save-Data skips it.
3. Warm runs in `install` and again when an online free-play navigation returns HTML that differs from the stored page, which is how a deploy shows up (`sw.js` itself does not change per deploy).
4. Navigations go to the network (with navigation preload). Offline, a stored free-play page answers; any other path gets a 302 to `/modo-livre` when it is stored. Assets are cache first. Nothing else is intercepted: not the API (another origin), not RSC fetches, not POSTs.
5. The root layout registers the worker with a production-only inline script at the end of `<body>`, run on `load`, in the `themeScript` style: no client JS on any route. Dev skips it because dev chunks are not content-hashed. The push flow still registers the same script.
6. `/modo-livre` shows `messages.freePlay.offline` while `navigator.onLine` is false.

## Consequences

- ADR-0004 holds: no dynamic route, RSC payload or API response is ever written, and the free-play graph has no daily lifecycle.
- Every visitor downloads all of free play once, about 0.8 MB gzipped, and the changed files again after a deploy.
- Offline `Link` taps work because Next turns a failed RSC fetch into a browser navigation, which the worker answers. Turning on Next's `experimental.useOffline` would break that.
- The crawl reads Turbopack's output format. A Next upgrade must re-run the offline check: production build, warm, server off, open each game.

## Rejected

- **Caching pages as they are visited:** a page whose lazy chunks were never loaded fails offline, and runtime writes race the warm.
- **A build-time precache list:** Next writes no per-route list we can ship from `public/`, and a postbuild step would sit outside the Vercel build.

// Free play offline (ADR-0151) and the streak-at-risk push (ADR-0064). The
// only responses ever stored are free-play pages and /_next/static/ build
// assets, so no daily puzzle can reach Cache Storage (ADR-0004).

const FALLBACK_TITLE = "Miolos";
const FALLBACK_BODY =
  "Sua sequência está em risco: a virada é à meia-noite, no horário de Brasília.";

const CACHE_PREFIX = "miolos-livre-";
const FREE_PLAY = new URL("/modo-livre", self.location.origin).href;
const COMPLETE = new URL("/sw-cache-complete", self.location.origin).href;
const ASSET_PREFIX = "/_next/static/";

function isFreePlayPath(pathname) {
  return pathname === "/modo-livre" || /^\/modo-livre\/[^/]+$/.test(pathname);
}

function storable(response) {
  const cacheControl = response.headers.get("Cache-Control") || "";
  return (
    response.ok &&
    response.type === "basic" &&
    !response.redirected &&
    !/no-store|private/i.test(cacheControl)
  );
}

async function completeCache() {
  const names = (await caches.keys())
    .filter((name) => name.startsWith(CACHE_PREFIX))
    .sort(
      (a, b) =>
        Number(b.slice(CACHE_PREFIX.length)) -
        Number(a.slice(CACHE_PREFIX.length)),
    );
  for (const name of names) {
    const cache = await caches.open(name);
    if (await cache.match(COMPLETE)) {
      return cache;
    }
  }
  return undefined;
}

function assetRefs(text, base) {
  const refs = [
    ...[...text.matchAll(/\/_next\/static\/[\w\-.~%/]+/g)].map((m) => m[0]),
    ...[...text.matchAll(/(?<![\w/])static\/(?:chunks|media)\/[\w\-.~]+/g)].map(
      (m) => `/_next/${m[0]}`,
    ),
    ...[...text.matchAll(/url\(\s*["']?([^"')\s]+)["']?\s*\)/g)].map(
      (m) => m[1],
    ),
  ];
  return refs
    .map((ref) => new URL(ref, base))
    .filter(
      (url) =>
        url.origin === self.location.origin &&
        url.pathname.startsWith(ASSET_PREFIX),
    )
    .map((url) => url.origin + url.pathname);
}

async function storedPage(cache, url) {
  const response = await fetch(url);
  if (!storable(response)) {
    throw new Error(`free-play page not storable: ${url}`);
  }
  const html = await response.clone().text();
  await cache.put(url, response);
  return html;
}

async function fill() {
  if (self.navigator.connection && self.navigator.connection.saveData) {
    return;
  }
  const name = CACHE_PREFIX + String(Date.now());
  const cache = await caches.open(name);
  try {
    const indexHtml = await storedPage(cache, FREE_PLAY);
    const pages = new Set(
      [...indexHtml.matchAll(/href="(\/modo-livre\/[^"/?#]+)"/g)].map(
        (m) => new URL(m[1], self.location.origin).href,
      ),
    );
    const pending = assetRefs(indexHtml, FREE_PLAY);
    for (const page of pages) {
      pending.push(...assetRefs(await storedPage(cache, page), page));
    }
    const seen = new Set();
    while (pending.length > 0) {
      const url = pending.pop();
      if (seen.has(url)) continue;
      seen.add(url);
      const response = (await caches.match(url)) || (await fetch(url));
      if (!storable(response)) continue;
      if (/\.(?:js|css)$/.test(url)) {
        pending.push(...assetRefs(await response.clone().text(), url));
      }
      await cache.put(url, response);
    }
    await cache.put(COMPLETE, new Response(""));
  } catch (error) {
    await caches.delete(name);
    throw error;
  }
  for (const other of await caches.keys()) {
    if (other.startsWith(CACHE_PREFIX) && other !== name) {
      await caches.delete(other);
    }
  }
}

let warming;

function warm() {
  warming ??= fill().finally(() => {
    warming = undefined;
  });
  return warming;
}

async function refreshIfChanged(url, response) {
  const cache = await completeCache();
  const stored = cache && (await cache.match(url));
  if (stored && (await stored.text()) === (await response.text())) {
    return;
  }
  await warm();
}

async function navigate(event, url) {
  const page = url.origin + url.pathname;
  try {
    const response =
      (await event.preloadResponse) || (await fetch(event.request));
    if (isFreePlayPath(url.pathname) && storable(response)) {
      event.waitUntil(
        refreshIfChanged(page, response.clone()).catch(() => undefined),
      );
    }
    return response;
  } catch (error) {
    const cache = await completeCache();
    const stored =
      cache && isFreePlayPath(url.pathname) && (await cache.match(page));
    if (stored) {
      return stored;
    }
    if (cache && (await cache.match(FREE_PLAY))) {
      return Response.redirect(FREE_PLAY, 302);
    }
    throw error;
  }
}

async function asset(request) {
  const cache = await completeCache();
  return (cache && (await cache.match(request))) || fetch(request);
}

self.addEventListener("install", (event) => {
  void self.skipWaiting();
  event.waitUntil(warm().catch(() => undefined));
});

self.addEventListener("activate", (event) => {
  if (self.registration.navigationPreload) {
    event.waitUntil(self.registration.navigationPreload.enable());
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(navigate(event, url));
  } else if (url.pathname.startsWith(ASSET_PREFIX)) {
    event.respondWith(asset(request));
  }
});

self.addEventListener("push", (event) => {
  // The payload is `pushNudgePayloadSchema`; a missing or malformed one still
  // notifies, with the pt-BR fallbacks.
  let title = FALLBACK_TITLE;
  let body = FALLBACK_BODY;
  try {
    const payload = event.data ? event.data.json() : undefined;
    if (payload && typeof payload.title === "string" && payload.title) {
      title = payload.title;
    }
    if (payload && typeof payload.body === "string" && payload.body) {
      body = payload.body;
    }
  } catch {
    // Not JSON: the fallbacks stand.
  }
  event.waitUntil(self.registration.showNotification(title, { body }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        const existing = windowClients.find(
          (windowClient) => "focus" in windowClient,
        );
        if (existing) {
          return existing.focus();
        }
        return clients.openWindow("/");
      }),
  );
});

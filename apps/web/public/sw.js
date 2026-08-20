// The caching-free service worker (#145, ADR-0064; ADR-0004 discharged by
// construction). Exactly two handlers, and NO third capability of any kind:
// a worker that never intercepts requests and never stores responses cannot
// hold a future-dated payload, so the no-unpublished-content invariant holds
// structurally rather than by review. T-WEB-S261 pins this file's source to
// that shape. Plain unbundled JS at root scope, served by Next.js from
// /public — not a route, no bundle marker (ADR-0047's classifier does not
// see /public files).
//
// Recorded i18n exception (plan 061 §2): the fallback strings below are the
// one place pt-BR copy lives outside messages.ts — a plain unbundled worker
// cannot import a TypeScript module, so the duplication is forced, and this
// comment is the recorded decision rather than a drift. They are invisible
// to T-WEB-S270's externalisation scan, which reads messages.push.* only.

const FALLBACK_TITLE = "Miolos";
const FALLBACK_BODY =
  "Sua sequência está em risco: a virada é à meia-noite, no horário de Brasília.";

self.addEventListener("push", (event) => {
  // The payload is slice B's (#146) and carries zero puzzle content —
  // title and body only. A missing or malformed payload still notifies,
  // with the baked-in pt-BR fallbacks.
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
  // The deep link is the hub: close the notification, focus an existing
  // window if one is open, otherwise open one at "/".
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

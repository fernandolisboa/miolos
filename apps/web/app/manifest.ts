import type { MetadataRoute } from "next";

import { locale, messages } from "../src/i18n";

/**
 * The web app manifest (#19, plan 027 D11) — a TS metadata route rather
 * than a static `public/` file, because the manifest carries PRODUCT
 * STRINGS and CLAUDE.md externalises strings from the start: `name` and
 * `description` come from the same `messages` object every screen reads,
 * where a JSON file would be the repo's first out-of-module copy of
 * product copy. Next serves it at /manifest.webmanifest and injects the
 * <link rel="manifest"> itself.
 *
 * This is a metadata route, not a page: no React tree, no row in
 * route-ssr's ROUTES table, nothing for `impeccable detect` to scan, and
 * no first-load client chunks (plan 027 §10.4).
 *
 * NO SERVICE WORKER anywhere in this ticket, and its absence is a decision
 * (plan 027 D13): installability no longer requires one, and a worker
 * first earns its complexity with the streak-at-risk push ticket.
 * T-WEB-S131 is the tripwire that none snuck in.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: messages.brand.wordmark,
    short_name: messages.brand.wordmark,
    description: messages.meta.description,
    lang: locale,
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    // Hex duplicated from packages/ui/tokens.css BY NECESSITY — a
    // webmanifest cannot read CSS custom properties. T-WEB-S130 ties each
    // literal back to the tokens file, so a token change that forgets the
    // manifest is a red test, not silent drift.
    background_color: "#F7F2E9", // --paper-desk
    theme_color: "#F7F2E9", // --paper-desk
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

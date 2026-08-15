import type { Metadata, Viewport } from "next";
import { Fraunces, Instrument_Sans } from "next/font/google";
import type { ReactNode } from "react";

import "@miolos/ui/tokens.css";
import "./globals.css";

import { SessionBootstrap } from "../src/components/session-bootstrap";
import { locale, messages } from "../src/i18n";
import { OG_DEFAULTS } from "../src/og/defaults";
import { siteOrigin } from "../src/site-origin";

const fraunces = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--font-fraunces",
  display: "swap",
});

// Normal only: nothing renders Instrument Sans italic, and the italic face
// would preload ~32 KB on every first view.
const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  style: ["normal"],
  variable: "--font-instrument-sans",
  display: "swap",
});

// The same --paper-desk literal the manifest ships, for the same reason:
// neither surface can read a CSS custom property, and T-WEB-S130/S131 tie
// both back to packages/ui/tokens.css (#19, plan 027 §10.3).
export const viewport: Viewport = {
  themeColor: "#F7F2E9", // --paper-desk
};

export const metadata: Metadata = {
  // #31: hoisted to `src/site-origin.ts`, because `sitemap.ts` and
  // `robots.ts` need the same origin and Next does NOT resolve a sitemap
  // entry against `metadataBase` — a canonical and a sitemap URL that
  // resolve to different origins is exactly the failure one spelling
  // prevents (ADR-0013 :36).
  metadataBase: siteOrigin(),
  title: messages.meta.title,
  description: messages.meta.description,
  // The install-surface half iOS actually reads (#19, plan 027 §10.3):
  // Safari ignores manifest icons, so app/apple-icon.png (auto-linked by
  // file convention, like app/icon.svg) plus this block is what
  // "installable" looks like on an iPhone home screen.
  appleWebApp: {
    capable: true,
    title: messages.brand.wordmark,
    statusBarStyle: "default",
  },
  // #34 (ADR-0054 decision 11): the fallback card for every route that
  // declares no `openGraph` of its own. The eight routes that DO declare one
  // spread `OG_DEFAULTS` into it, because a leaf declaration replaces this
  // object rather than merging into it — see `src/og/defaults.ts`.
  openGraph: {
    ...OG_DEFAULTS,
    title: messages.meta.title,
    description: messages.meta.description,
  },
  // `twitter:image`, `:image:alt`, `:type`, `:width` and `:height` are
  // emitted automatically from the `opengraph-image` file convention, and
  // `twitter:title`/`:description` are derived from `openGraph` — verified on
  // the same build. So the card size is the only member worth declaring, and
  // no `twitter-image.tsx` will ever be needed.
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang={locale}
      className={`${fraunces.variable} ${instrumentSans.variable}`}
    >
      <body>
        <SessionBootstrap />
        {children}
      </body>
    </html>
  );
}

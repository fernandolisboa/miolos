import type { Metadata, Viewport } from "next";
import { Fraunces, Instrument_Sans } from "next/font/google";
import type { ReactNode } from "react";

import "@miolos/ui/tokens.css";
import "./globals.css";

import { SessionBootstrap } from "../src/components/session-bootstrap";
import { locale, messages } from "../src/i18n";

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
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
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

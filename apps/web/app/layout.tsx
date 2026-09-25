import type { Metadata, Viewport } from "next";
import { Fraunces, Instrument_Sans } from "next/font/google";
import type { ReactNode } from "react";

import "@miolos/ui/tokens.css";
import "./globals.css";

import { SessionBootstrap } from "../src/components/session-bootstrap";
import { locale, messages } from "../src/i18n";
import { OG_DEFAULTS } from "../src/og/defaults";
import { siteOrigin } from "../src/site-origin";
import { themeScript } from "../src/theme/theme";

const fraunces = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--font-fraunces",
  display: "swap",
});

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  style: ["normal"],
  variable: "--font-instrument-sans",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F2E9" },
    { media: "(prefers-color-scheme: dark)", color: "#16130F" },
  ],
};

export const metadata: Metadata = {
  metadataBase: siteOrigin(),
  title: messages.meta.title,
  description: messages.meta.description,

  appleWebApp: {
    capable: true,
    title: messages.brand.wordmark,
    statusBarStyle: "default",
  },

  openGraph: {
    ...OG_DEFAULTS,
    title: messages.meta.title,
    description: messages.meta.description,
  },

  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang={locale}
      className={`${fraunces.variable} ${instrumentSans.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <SessionBootstrap />
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from "next";
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

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  title: messages.meta.title,
  description: messages.meta.description,
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

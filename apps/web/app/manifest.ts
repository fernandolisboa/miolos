import type { MetadataRoute } from "next";

import { locale, messages } from "../src/i18n";

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

    background_color: "#F7F2E9",
    theme_color: "#F7F2E9",
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

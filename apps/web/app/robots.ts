import type { MetadataRoute } from "next";

import { routes } from "../src/i18n";
import { absoluteUrl } from "../src/site-origin";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: [routes.attach] },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}

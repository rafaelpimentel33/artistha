import type { MetadataRoute } from "next";
import { absoluteUrl, previewSite } from "../lib/store-seo";

export default function robots(): MetadataRoute.Robots {
  if (previewSite) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: ["/", "/api/media/"], disallow: "/api/" },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}

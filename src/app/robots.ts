import type {
  MetadataRoute
} from "next";
import {
  getBaseUrl
} from "@/lib/seo";

// Written once at build: the static export requires it, and the content
// only changes with a deploy anyway.
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getBaseUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/_next/",
          "/sw.js"
        ]
      }
    ],
    sitemap: `${ baseUrl }/sitemap.xml`
  };
}

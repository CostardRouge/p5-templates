import type {
  MetadataRoute
} from "next";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_SHORT_NAME,
  THEME_COLOR_DARK,
  THEME_COLOR_LIGHT
} from "@/lib/seo";

// Written once at build: the static export requires it, and the content
// only changes with a deploy anyway.
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_SHORT_NAME,
    description: SITE_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: THEME_COLOR_LIGHT,
    theme_color: THEME_COLOR_DARK,
    categories: [
      "multimedia",
      "design",
      "social"
    ],
    icons: [
      {
        src: "/assets/images/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/assets/images/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/assets/images/icon-192x192-maskable.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable"
      },
      {
        src: "/assets/images/icon-512x512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      }
    ]
  };
}

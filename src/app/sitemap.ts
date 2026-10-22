import type {
  MetadataRoute
} from "next";
import {
  listIndexableSketches
} from "@/engines/metadata";
import {
  getBaseUrl
} from "@/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getBaseUrl();
  const now = new Date();

  // Always-present pages. The home page carries the studio tour (the only
  // page documenting the editor), so it belongs here at top priority — it was
  // missing entirely before that tour existed.
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0
    },
    {
      url: `${ baseUrl }/sketches`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0
    },
    // `/recordings` is deliberately absent: its page declares
    // `robots: { index: false }`, and submitting a URL you then tell crawlers
    // not to index is a contradiction Search Console reports as an error.
    // The human-readable site map (`app/sitemap/page.tsx`): one crawlable page
    // linking every sketch route, so it is worth listing here too.
    {
      url: `${ baseUrl }/sitemap`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.5
    },
    // The legal notice: indexable, rarely changed, and nothing a visitor is
    // looking for first.
    {
      url: `${ baseUrl }/legal`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3
    }
  ];

  // Studio pages — all engines, derived from unified metadata, minus the
  // `.hidden-template` sketches in production (`listIndexableSketches`, the
  // rule `/llms.txt` shares).
  const visible = listIndexableSketches();

  const studioPages: MetadataRoute.Sitemap = visible.map( ( m ) => ( {
    url: `${ baseUrl }/sketches/${ m.engine }/${ m.category ? `${ m.category }/` : "" }${ m.name }`,
    lastModified: new Date( m.mtime ),
    changeFrequency: "monthly" as const,
    priority: 0.8
  } ) );

  return [
    ...staticPages,
    ...studioPages
  ];
}

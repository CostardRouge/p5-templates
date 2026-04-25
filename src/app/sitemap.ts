import type {
  MetadataRoute
} from "next";
import {
  getMetadata
} from "@/engines/metadata";
import {
  getAllTemplates
} from "@/lib/gsap/templateRegistry";
import {
  getBaseUrl
} from "@/lib/seo";

// HTML templates not yet in the unified registry — list here so the loop is
// easy to extend without adding new hardcoded sitemap entries.
const HTML_TEMPLATES = [
  { name: "exif-detail" },
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getBaseUrl();
  const now = new Date();

  // Always-present pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: `${ baseUrl }/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${ baseUrl }/recordings`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.6,
    },
  ];

  // Studio pages — all engines, derived from unified metadata
  const studioPages: MetadataRoute.Sitemap = getMetadata().map( ( m ) => ( {
    url: `${ baseUrl }/studio/${ m.engine }/${ m.category ? `${ m.category }/` : "" }${ m.name }`,
    lastModified: new Date( m.mtime ),
    changeFrequency: "monthly" as const,
    priority: 0.8,
  } ) );

  // GSAP — listing page (only when templates exist) + individual template pages
  const gsapTemplates = getAllTemplates();
  const gsapPages: MetadataRoute.Sitemap = [
    ...( gsapTemplates.length > 0
      ? [
          {
            url: `${ baseUrl }/gsap`,
            lastModified: now,
            changeFrequency: "weekly" as const,
            priority: 0.8,
          },
        ]
      : [] ),
    ...gsapTemplates.map( ( t ) => ( {
      url: `${ baseUrl }/gsap/${ t.id }`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    } ) ),
  ];

  // HTML templates
  const htmlPages: MetadataRoute.Sitemap = HTML_TEMPLATES.map( ( t ) => ( {
    url: `${ baseUrl }/html/${ t.name }`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  } ) );

  return [
    ...staticPages,
    ...studioPages,
    ...gsapPages,
    ...htmlPages,
  ];
}

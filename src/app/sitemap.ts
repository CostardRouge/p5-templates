import type {
  MetadataRoute
} from "next";
import {
  getMetadata
} from "@/engines/metadata";
import {
  getBaseUrl
} from "@/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getBaseUrl();
  const now = new Date();

  // Always-present pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: `${ baseUrl }/templates`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0
    },
    {
      url: `${ baseUrl }/recordings`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.6
    }
  ];

  // Studio pages — all engines, derived from unified metadata
  const studioPages: MetadataRoute.Sitemap = getMetadata().map( ( m ) => ( {
    url: `${ baseUrl }/templates/${ m.engine }/${ m.category ? `${ m.category }/` : "" }${ m.name }`,
    lastModified: new Date( m.mtime ),
    changeFrequency: "monthly" as const,
    priority: 0.8
  } ) );

  return [
    ...staticPages,
    ...studioPages
  ];
}

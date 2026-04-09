import type {
  MetadataRoute
} from "next";
import {
  getAllTemplates
} from "@/lib/gsap/templateRegistry";
import {
  getBaseUrl
} from "@/lib/seo";
import getSketchList from "@/utils/getSketchList";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getBaseUrl();
  const now = new Date();

  // Static pages
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
    {
      url: `${ baseUrl }/gsap`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${ baseUrl }/html/exif-detail`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ];

  // Dynamic p5.js sketch pages
  const sketches = ( await getSketchList() ) ?? [
  ];
  const sketchPages: MetadataRoute.Sitemap = sketches.map( ( sketch ) => ( {
    url: `${ baseUrl }/p5/${ sketch.name }`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.8,
  } ) );

  // GSAP template pages
  const gsapTemplates = getAllTemplates();
  const gsapPages: MetadataRoute.Sitemap = gsapTemplates.map( ( template ) => ( {
    url: `${ baseUrl }/gsap/${ template.id }`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.8,
  } ) );

  return [
    ...staticPages,
    ...sketchPages,
    ...gsapPages
  ];
}

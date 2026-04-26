import type {
  Metadata
} from "next";
import {
  getBaseUrl, SITE_NAME
} from "@/lib/seo";
import getSketchThumbnailURL from "@/utils/getSketchThumbnailURL";

/**
 * Formats a sketch name slug into a human-readable title.
 * e.g. "text-morphing-depth" -> "Text Morphing Depth"
 */
function formatSketchTitle( sketchName: string ): string {
  return sketchName
    .split( "-" )
    .map( ( word ) => word.charAt( 0 ).toUpperCase() + word.slice( 1 ) )
    .join( " " );
}

/**
 * Derives a category keyword from the sketch name for SEO.
 * e.g. "photo-3d-cylinder" -> "photo", "text-morphing-depth" -> "text"
 */
function deriveCategory( sketchName: string ): string {
  const prefix = sketchName.split( "-" )[ 0 ];
  const categoryMap: Record<string, string> = {
    photo: "photo effects",
    text: "text animation",
    kinetic: "kinetic typography",
    slides: "slideshow",
    hand: "hand tracking",
    neon: "neon effects",
    mask: "masking effects",
    dominant: "color analysis",
    hello: "starter template",
    empty: "blank template",
  };

  return categoryMap[ prefix ] || "creative coding";
}

export function generateSketchMetadata(
  engine: string, sketchName: string
): Metadata {
  const sketchTitle = formatSketchTitle( sketchName );
  const category = deriveCategory( sketchName );
  const baseUrl = getBaseUrl();

  const description = `Create ${ sketchTitle } videos and images. A ${ category } template for generating social media content.`;

  const thumbnailPath = getSketchThumbnailURL(
    engine,
    sketchName
  );
  const thumbnailUrl = `${ baseUrl }/${ thumbnailPath }`;
  const pageUrl = `${ baseUrl }/${ engine }/${ sketchName }`;

  return {
    title: sketchTitle,
    description,
    keywords: [
      sketchTitle,
      engine,
      category,
      "social media template",
      "video generator",
      "creative coding",
      "generative art",
      ...sketchName.split( "-" ),
    ],
    alternates: {
      canonical: `/${ engine }/${ sketchName }`,
    },
    openGraph: {
      title: `${ sketchTitle } | ${ SITE_NAME }`,
      description,
      url: pageUrl,
      siteName: SITE_NAME,
      images: [
        {
          url: thumbnailUrl,
          width: 1200,
          height: 630,
          alt: `${ sketchTitle } - ${ engine } template preview`,
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${ sketchTitle } | ${ SITE_NAME }`,
      description,
      images: [
        thumbnailUrl
      ],
    },
  };
}

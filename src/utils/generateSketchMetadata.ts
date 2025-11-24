import type {
  Metadata
} from "next";
import getP5SketchThumbnailURL from "@/utils/getP5SketchThumbnailURL";

export function generateSketchMetadata( sketchName: string ): Metadata {
  const siteTitle = "Social-pipeline";
  const sketchTitle = sketchName
    .split( "-" )
    .map( ( word ) => word.charAt( 0 ).toUpperCase() + word.slice( 1 ) )
    .join( " " );

  const title = `${ sketchTitle } | ${ siteTitle }`;
  const description = `Generate ${ sketchTitle } sketch videos with p5.js`;

  // Get the base URL from environment or use a default
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    ( process.env.VERCEL_URL ? `https://${ process.env.VERCEL_URL }` : "http://localhost:3000" );

  const thumbnailPath = getP5SketchThumbnailURL( sketchName );
  const thumbnailUrl = `${ baseUrl }/${ thumbnailPath }`;
  const pageUrl = `${ baseUrl }/templates/p5/${ sketchName }`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: pageUrl,
      siteName: siteTitle,
      images: [
        {
          url: thumbnailUrl,
          width: 1200,
          height: 630,
          alt: `${ sketchTitle } preview`,
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [
        thumbnailUrl
      ],
    },
  };
}

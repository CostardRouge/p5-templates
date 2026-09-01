import type {
  Metadata
} from "next";
import {
  notFound
} from "next/navigation";
import React from "react";

import {
  isKnownEngine, getEngineLabel
} from "@/engines/engineCatalog";
import {
  findSketchMeta
} from "@/engines/metadata";
import {
  buildCanonicalPath,
  buildOgTitle,
  buildShareDescription,
  buildShareTitle,
  buildThumbnailUrl,
  formatSketchTitle,
  getBaseUrl,
  SITE_NAME
} from "@/lib/seo";
import {
  OptionsSchema
} from "@/types/sketch.types";
import {
  getJSONSketchOptions,
  getSketchMeta
} from "@/utils/getSketchOptions";
import getSketchThumbnailURL from "@/utils/getSketchThumbnailURL";
import EmbedSketchClient from "@/components/EmbedSketch/EmbedSketchClient";

/* ------------------------------------------------------------------ */
/*  Route params                                                       */
/* ------------------------------------------------------------------ */
type RouteParams = {
  engine: string;
  sketch: string[]; // catch-all: ["category", "name"] or ["name"]
};

export const revalidate = 0;

/* ------------------------------------------------------------------ */
/*  Metadata — an /embed URL doubles as the share link pasted on       */
/*  social networks, so it carries sketch-specific title/description   */
/*  and OG/Twitter tags (phrased as a *share*, unlike the studio       */
/*  page). It stays noindex — the canonical studio page is what        */
/*  search engines should rank — and the canonical link points there.  */
/* ------------------------------------------------------------------ */
export async function generateMetadata( {
  params
}: {
  params: Promise<RouteParams>;
} ): Promise<Metadata> {
  const {
    engine: engineId, sketch: sketchSegments
  } = await params;
  const robots = {
    index: false,
    follow: false
  };

  if ( !isKnownEngine( engineId ) ) {
    return {
      robots
    };
  }

  const sketchName = sketchSegments[ sketchSegments.length - 1 ];
  const sketchMeta = findSketchMeta(
    sketchName,
    engineId
  );

  if ( !sketchMeta ) {
    return {
      robots
    };
  }

  const baseUrl = getBaseUrl();
  const engineLabel = getEngineLabel( engineId );
  const sketchTitle = formatSketchTitle( sketchName );
  const title = buildShareTitle( sketchTitle );
  const description = buildShareDescription(
    sketchTitle,
    engineLabel
  );
  const canonicalPath = buildCanonicalPath(
    engineId,
    sketchName,
    sketchMeta.category
  );
  const thumbnailUrl = sketchMeta.hasThumbnail
    ? buildThumbnailUrl(
      engineId,
      sketchName,
      baseUrl
    )
    : undefined;

  return {
    // Let the root layout template handle "| SITE_NAME" — only pass the page title
    title,
    description,
    robots,
    alternates: {
      canonical: canonicalPath
    },
    openGraph: {
      title: buildOgTitle( title ),
      description,
      url: canonicalPath,
      siteName: SITE_NAME,
      type: "website",
      ...( thumbnailUrl && {
        images: [
          {
            url: thumbnailUrl,
            width: 1200,
            height: 630,
            alt: `${ sketchTitle } sketch preview`
          }
        ]
      } )
    },
    twitter: {
      card: "summary_large_image",
      title: buildOgTitle( title ),
      description,
      ...( thumbnailUrl && {
        images: [
          thumbnailUrl
        ]
      } )
    }
  };
}

/* ------------------------------------------------------------------ */
/*  Page — a chrome-free, stateless sketch host.                       */
/*                                                                     */
/*  Mirrors the studio page's base-option construction (schema         */
/*  defaults + persisted options.json + form defaults on `.sketch`)    */
/*  so a sketch boots identically, then hands off to the client, which */
/*  layers the URL-fragment delta on top. No job, no snapshot, no DB.  */
/* ------------------------------------------------------------------ */
export default async function EmbedPage( {
  params
}: {
  params: Promise<RouteParams>;
} ) {
  const {
    engine: engineId, sketch: sketchSegments
  } = await params;

  if ( !isKnownEngine( engineId ) ) {
    return notFound();
  }

  const sketchName = sketchSegments[ sketchSegments.length - 1 ];
  const sketchMeta = findSketchMeta(
    sketchName,
    engineId
  );

  if ( !sketchMeta ) {
    return notFound();
  }

  const sketchOptions = OptionsSchema.parse( {} );

  const {
    formValues, formConfiguration
  } = await getSketchMeta(
    sketchName,
    engineId
  );

  const jsonOptions = await getJSONSketchOptions(
    sketchName,
    engineId
  );

  if ( jsonOptions ) {
    Object.assign(
      sketchOptions,
      jsonOptions
    );
  }

  if ( formValues ) {
    Object.assign(
      sketchOptions,
      {
        sketch: structuredClone( formValues )
      }
    );
  }

  sketchOptions.name = sketchName;

  return (
    <EmbedSketchClient
      engineId={ engineId }
      name={ sketchName }
      baseOptions={ sketchOptions }
      formConfiguration={ formConfiguration }
      thumbnailUrl={ getSketchThumbnailURL(
        engineId,
        sketchName
      ) }
      hasThumbnail={ sketchMeta.hasThumbnail }
      width={ sketchOptions.size.width }
      height={ sketchOptions.size.height }
    />
  );
}

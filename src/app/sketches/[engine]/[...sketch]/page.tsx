import type {
  Metadata
} from "next";
import {
  notFound, redirect
} from "next/navigation";
import React from "react";

import {
  isKnownEngine, getEngineLabel
} from "@/engines/engineCatalog";
import {
  findSketchMeta
} from "@/engines/metadata";
import SketchContextProvider from "@/components/ClientProcessingSketch/components/SketchProvider/SketchContextProvider";
import SketchPage from "@/components/SketchPage/SketchPage";
import SketchJsonLd from "@/components/SketchJsonLd/SketchJsonLd";
import BreadcrumbJsonLd from "@/components/BreadcrumbJsonLd/BreadcrumbJsonLd";
import {
  getJobById
} from "@/lib/jobStore";
import {
  buildCanonicalPath,
  buildOgTitle,
  buildSketchDescription,
  buildSketchKeywords,
  buildThumbnailUrl,
  formatSketchTitle,
  getBaseUrl,
  SITE_NAME
} from "@/lib/seo";
import {
  OptionsSchema
} from "@/types/sketch.types";
import getCaptureOptions from "@/utils/getCaptureOptions";
import migrateLegacyHudItems from "@/utils/migrateLegacyHudItems";
import {
  getJSONSketchOptions,
  getSketchMeta
} from "@/utils/getSketchOptions";

/* ------------------------------------------------------------------ */
/*  Route params type                                                  */
/* ------------------------------------------------------------------ */
type RouteParams = {
  engine: string;
  sketch: string[]; // catch-all: ["category", "name"] or ["name"]
};

/* ------------------------------------------------------------------ */
/*  Metadata                                                           */
/* ------------------------------------------------------------------ */
export async function generateMetadata( {
  params
}: {
  params: Promise<RouteParams>;
} ): Promise<Metadata> {
  const {
    engine: engineId, sketch
  } = await params;
  const sketchName = sketch[ sketch.length - 1 ];
  const sketchMeta = findSketchMeta(
    sketchName,
    engineId
  );
  const baseUrl = getBaseUrl();

  const engineLabel = getEngineLabel( engineId );
  const title = formatSketchTitle( sketchName );
  const description = buildSketchDescription(
    title,
    engineLabel
  );
  const canonicalPath = buildCanonicalPath(
    engineId,
    sketchName,
    sketchMeta?.category
  );
  const thumbnailUrl = sketchMeta?.hasThumbnail
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
    keywords: buildSketchKeywords(
      sketchName,
      engineLabel
    ),
    alternates: {
      canonical: canonicalPath
    },
    openGraph: {
      // Always set page-specific OG so bots get the right title/description
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
            alt: `${ title } sketch preview`
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
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export const revalidate = 0;

export default async function StudioPage( {
  params,
  searchParams
}: {
  params: Promise<RouteParams>;
  searchParams: Promise<{
    id?: string;
    capturing?: string;
    previewFramerate?: string;
    previewDuration?: string;
  }>;
} ) {
  const {
    engine: engineId, sketch: sketchSegments
  } = await params;

  /* ---- validate engine ------------------------------------------- */
  if ( !isKnownEngine( engineId ) ) {
    return notFound();
  }

  /* ---- resolve template name from catch-all segments ------------- */
  const sketchName = sketchSegments[ sketchSegments.length - 1 ];

  /* ---- validate sketch exists in metadata ------------------------ */
  const sketchMeta = findSketchMeta(
    sketchName,
    engineId
  );

  if ( !sketchMeta ) {
    return notFound();
  }

  /* ---- canonical URL redirect ----------------------------------- */
  if ( sketchMeta.category && sketchSegments.length === 1 ) {
    redirect( `/sketches/${ engineId }/${ sketchMeta.category }/${ sketchName }` );
  }

  /* ---- engine label for structured data -------------------------- */
  const engineLabel = getEngineLabel( engineId );
  const baseUrl = getBaseUrl();

  /* ---- load options & form meta ---------------------------------- */
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

  /* ---- persisted job? -------------------------------------------- */
  const resolvedSearchParams = await searchParams;
  const jobIdSearchParams = resolvedSearchParams.id;
  let persistedJob;

  if ( jobIdSearchParams ) {
    persistedJob = await getJobById( jobIdSearchParams );

    if ( !persistedJob ) {
      return notFound();
    }

    Object.assign(
      sketchOptions,
      await getCaptureOptions( `${ persistedJob.id }/options.json` )
    );
    sketchOptions.id = persistedJob.id;
  }

  sketchOptions.name = sketchName;

  /* ---- preview-capture animation overrides -----------------------
     When the headless preview generator hits this page with
     ?capturing&previewFramerate=20&previewDuration=3, force the sketch's
     animation settings to the override values. time.js reads framerate to
     advance its clock per captured frame, and getAnimationProgression()
     divides elapsed seconds by duration — so a 20fps × 3s capture maps
     one full animation loop into the 60-frame preview, regardless of the
     sketch's native duration. */
  const previewFramerateRaw = resolvedSearchParams.previewFramerate;
  const previewDurationRaw = resolvedSearchParams.previewDuration;

  if ( resolvedSearchParams.capturing === "" && previewFramerateRaw && previewDurationRaw ) {
    const previewFramerate = Number.parseInt(
      previewFramerateRaw,
      10
    );
    const previewDuration = Number.parseFloat( previewDurationRaw );

    if ( Number.isFinite( previewFramerate ) && previewFramerate > 0
      && Number.isFinite( previewDuration ) && previewDuration > 0 ) {
      sketchOptions.animation = {
        ...sketchOptions.animation,
        framerate: previewFramerate,
        duration: previewDuration
      };
    }
  }

  /* ---- legacy-shape migration ------------------------------------
     The provider seeds the engine's option store from this object directly —
     initOptions only runs later, in the form layer — so persisted jobs and
     sketch JSON carrying the legacy single "hud" content item must be
     expanded here or the engine (and headless recording, which drives this
     same page) would silently skip them. */
  const migratedSketchOptions = migrateLegacyHudItems( sketchOptions );

  /* ---- breadcrumb items ------------------------------------------ */
  const sketchTitle = formatSketchTitle( sketchName );
  const breadcrumbItems = [
    {
      name: "Home",
      url: baseUrl
    },
    {
      name: "Sketches",
      url: `${ baseUrl }/sketches`
    },
    {
      name: `${ engineLabel } Sketches`,
      url: `${ baseUrl }/sketches/${ engineId }`
    },
    {
      name: sketchTitle,
      url: `${ baseUrl }${ buildCanonicalPath(
        engineId,
        sketchName,
        sketchMeta.category
      ) }`
    }
  ];

  /* ---- render ---------------------------------------------------- */
  return (
    <>
      <SketchJsonLd
        sketchName={ sketchName }
        engineId={ engineId }
        engineLabel={ engineLabel }
        category={ sketchMeta.category }
        hasThumbnail={ sketchMeta.hasThumbnail }
      />
      <BreadcrumbJsonLd items={ breadcrumbItems } />

      <SketchContextProvider
        name={ sketchName }
        engineId={ engineId }
        category={ sketchMeta.category }
        options={ migratedSketchOptions }
        persistedJob={ persistedJob }
        sketchFormValues={ formValues }
        sketchFormConfiguration={ formConfiguration }
        capturing={ resolvedSearchParams.capturing === "" }
        backendRecording={ process.env.BACKEND_RECORDING === "true" }
        activeSlideIndex={
          migratedSketchOptions.slides?.length > 0 ? 0 : undefined
        }
      >
        <SketchPage />
      </SketchContextProvider>
    </>
  );
}

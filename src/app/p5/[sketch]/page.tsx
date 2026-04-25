import type {
  Metadata
} from "next";
import {
  notFound
} from "next/navigation";
import React from "react";
import ClientProcessingSketch from "@/components/ClientProcessingSketch/ClientProcessingSketch";
import SketchContextProvider from "@/components/ClientProcessingSketch/components/SketchProvider/SketchContextProvider";
import {
  getJobById
} from "@/lib/jobStore";
import {
  getBaseUrl, getBreadcrumbJsonLd, getTemplateJsonLd
} from "@/lib/seo";

import {
  OptionsSchema
} from "@/types/sketch.types";
import {
  generateSketchMetadata
} from "@/utils/generateSketchMetadata";
import getCaptureOptions from "@/utils/getCaptureOptions";
import getP5SketchThumbnailURL from "@/utils/getP5SketchThumbnailURL";
import type {
  FieldConfig
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";
import {
  getJSONSketchOptions, getSketchMeta
} from "@/utils/getSketchOptions";
import listDirectory from "@/utils/listDirectory";

export async function generateMetadata( {
  params,
}: {
  params: Promise<{
    sketch: string;
  }>;
} ): Promise<Metadata> {
  const sketchName = ( await params ).sketch;

  return generateSketchMetadata( sketchName );
}

const acceptedImageTypes = [
  "png",
  "jpg",
  "arw",
  "jpeg",
  "webp"
];

/**
 * When `consumeTestImages` is active, pre-populate sketch form fields with
 * test image paths so they appear in the form UI exactly as if the user had
 * added them through the classic form (thumbnails, drag-drop, delete, etc.).
 *
 * Rules:
 * - `images-stack` fields: append test paths to any existing defaults.
 * - `image` (single) fields: set the first test path only when the field is empty.
 * - Slide-scoped fields (scope: { slide: number }) are skipped; only global
 *   sketch fields are populated.
 */
function injectTestImagesIntoSketchFields(
  sketch: Record<string, unknown>,
  formConfiguration: Record<string, FieldConfig>,
  testImagePaths: string[]
): void {
  for ( const [
    key,
    config
  ] of Object.entries( formConfiguration ) ) {
    if ( config.component === "images-stack" ) {
      if ( typeof config.scope === "object" ) continue;
      const existing = Array.isArray( sketch[ key ] )
        ? ( sketch[ key ] as string[] )
        : [
        ];

      sketch[ key ] = [
        ...existing,
        ...testImagePaths
      ];
    } else if ( config.component === "image" ) {
      if ( typeof config.scope === "object" ) continue;
      if ( !sketch[ key ] ) {
        sketch[ key ] = testImagePaths[ 0 ] ?? null;
      }
    }
  }
}

export const revalidate = 0;

async function ProcessingSketch( {
  params,
  searchParams,
}: {
  params: Promise<{
    sketch: string;
  }>;
  searchParams: Promise<{
    id?: string;
    capturing?: string;
  }>;
} ) {
  const sketchName = ( await params ).sketch;
  const jobIdSearchParams = ( await searchParams ).id;
  const sketchOptions = OptionsSchema.parse( {
  } );
  const {
    formValues, formConfiguration
  } = await getSketchMeta( sketchName, "p5" );

  const jsonOptions = await getJSONSketchOptions( sketchName, "p5" );

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
        sketch: structuredClone( formValues ),
      }
    );
  }

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

  if ( sketchOptions.consumeTestImages && !jobIdSearchParams ) {
    delete sketchOptions.consumeTestImages;

    sketchOptions.assets = sketchOptions.assets || {
      images: [
      ]
    };

    const testImageFileNames = await listDirectory( "public/assets/images/test" );

    const testImagePaths = testImageFileNames
      .filter( ( testImageFileName ) =>
        acceptedImageTypes.includes( testImageFileName.split( "." )[ 1 ] ) )
      .map( ( testImageFileName ) => `/assets/images/test/${ testImageFileName }` );

    sketchOptions.assets.images = testImagePaths;

    if ( formConfiguration ) {
      sketchOptions.sketch =
        ( sketchOptions.sketch as Record<string, unknown> ) ?? {
        };
      injectTestImagesIntoSketchFields(
        sketchOptions.sketch as Record<string, unknown>,
        formConfiguration,
        testImagePaths
      );
    }
  }

  sketchOptions.name = sketchName;

  const baseUrl = getBaseUrl();
  const sketchTitle = sketchName
    .split( "-" )
    .map( ( word: string ) => word.charAt( 0 ).toUpperCase() + word.slice( 1 ) )
    .join( " " );

  const templateJsonLd = getTemplateJsonLd( {
    name: sketchTitle,
    description: `Create ${ sketchTitle } videos and images with p5.js.`,
    url: `${ baseUrl }/p5/${ sketchName }`,
    thumbnailUrl: `${ baseUrl }/${ getP5SketchThumbnailURL( sketchName ) }`,
    category: "p5.js",
  } );

  const breadcrumbJsonLd = getBreadcrumbJsonLd( [
    {
      name: "Templates",
      url: `${ baseUrl }`,
    },
    {
      name: sketchTitle,
      url: `${ baseUrl }/p5/${ sketchName }`,
    },
  ] );

  return (
    <>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data */}
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: JSON.stringify( templateJsonLd ),
        }}
      />
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data */}
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: JSON.stringify( breadcrumbJsonLd ),
        }}
      />
      <SketchContextProvider
        name={sketchName}
        engineId="p5"
        options={sketchOptions}
        persistedJob={persistedJob}
        sketchFormValues={formValues}
        sketchFormConfiguration={formConfiguration}
        capturing={( await searchParams ).capturing === ""}
        backendRecording={process.env.BACKEND_RECORDING === "true"}
        activeSlideIndex={sketchOptions.slides?.length > 0 ? 0 : undefined}
      >
        <ClientProcessingSketch />
      </SketchContextProvider>
    </>
  );
}

export default ProcessingSketch;

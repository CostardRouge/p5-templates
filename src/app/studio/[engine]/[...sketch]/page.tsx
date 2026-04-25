import type {
  Metadata
} from "next";
import {
  notFound, redirect
} from "next/navigation";
import React from "react";

import "@/engines/index"; // register all engines

import {
  getEngine, hasEngine
} from "@/engines/registry";
import {
  findSketchMeta
} from "@/engines/metadata";
import SketchContextProvider from "@/components/ClientProcessingSketch/components/SketchProvider/SketchContextProvider";
import StudioSketchPage from "@/components/StudioSketchPage/StudioSketchPage";
import {
  getJobById
} from "@/lib/jobStore";
import {
  OptionsSchema
} from "@/types/sketch.types";
import getCaptureOptions from "@/utils/getCaptureOptions";
import {
  getJSONSketchOptions,
  getSketchMeta,
} from "@/utils/getSketchOptions";
import type {
  FieldConfig,
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";
import listDirectory from "@/utils/listDirectory";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const acceptedImageTypes = [
  "png",
  "jpg",
  "arw",
  "jpeg",
  "webp"
];

function injectTestImagesIntoSketchFields(
  sketch: Record<string, unknown>,
  formConfiguration: Record<string, FieldConfig>,
  testImagePaths: string[],
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
  params,
}: {
  params: Promise<RouteParams>;
} ): Promise<Metadata> {
  const {
    engine, sketch
  } = await params;
  const sketchName = sketch[ sketch.length - 1 ];

  return {
    title: `${ sketchName } — ${ engine } | Studio`,
  };
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export const revalidate = 0;

export default async function StudioPage( {
  params,
  searchParams,
}: {
  params: Promise<RouteParams>;
  searchParams: Promise<{
 id?: string; capturing?: string
}>;
} ) {
  const {
    engine: engineId, sketch: sketchSegments
  } = await params;

  /* ---- validate engine ------------------------------------------- */
  if ( !hasEngine( engineId ) ) {
    return notFound();
  }

  /* ---- resolve template name from catch-all segments ------------- */
  // e.g. ["photo", "photo-balloons"] → name = "photo-balloons"
  //      ["hello-world"]             → name = "hello-world"
  const sketchName = sketchSegments[ sketchSegments.length - 1 ];

  /* ---- validate sketch exists in metadata ------------------------ */
  const sketchMeta = findSketchMeta( sketchName, engineId );

  if ( !sketchMeta ) {
    return notFound();
  }

  /* ---- canonical URL redirect ----------------------------------- */
  // If the sketch has a category but the URL is missing it,
  // redirect to the canonical path: /studio/<engine>/<category>/<name>
  if ( sketchMeta.category && sketchSegments.length === 1 ) {
    redirect( `/studio/${ engineId }/${ sketchMeta.category }/${ sketchName }` );
  }

  /* ---- load options & form meta (reuses existing p5 utils) ------- */
  const sketchOptions = OptionsSchema.parse( {

  } );

  const {
    formValues, formConfiguration
  } = await getSketchMeta( sketchName, engineId );

  const jsonOptions = await getJSONSketchOptions( sketchName, engineId );

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
  const jobIdSearchParams = ( await searchParams ).id;
  let persistedJob;

  if ( jobIdSearchParams ) {
    persistedJob = await getJobById( jobIdSearchParams );

    if ( !persistedJob ) {
      return notFound();
    }

    Object.assign(
      sketchOptions,
      await getCaptureOptions( `${ persistedJob.id }/options.json` ),
    );
    sketchOptions.id = persistedJob.id;
  }

  /* ---- test images injection ------------------------------------- */
  if ( sketchOptions.consumeTestImages && !jobIdSearchParams ) {
    delete sketchOptions.consumeTestImages;

    sketchOptions.assets = sketchOptions.assets || {
      images: [
      ]
    };

    const testImageFileNames = await listDirectory( "public/assets/images/test", );

    const testImagePaths = testImageFileNames
      .filter( ( f ) => acceptedImageTypes.includes( f.split( "." )[ 1 ] ) )
      .map( ( f ) => `/assets/images/test/${ f }` );

    sketchOptions.assets.images = testImagePaths;

    if ( formConfiguration ) {
      sketchOptions.sketch =
        ( sketchOptions.sketch as Record<string, unknown> ) ?? {

        };
      injectTestImagesIntoSketchFields(
        sketchOptions.sketch as Record<string, unknown>,
        formConfiguration,
        testImagePaths,
      );
    }
  }

  sketchOptions.name = sketchName;

  /* ---- render ---------------------------------------------------- */
  return (
    <SketchContextProvider
      name={sketchName}
      engineId={engineId}
      options={sketchOptions}
      persistedJob={persistedJob}
      sketchFormValues={formValues}
      sketchFormConfiguration={formConfiguration}
      capturing={( await searchParams ).capturing === ""}
      backendRecording={process.env.BACKEND_RECORDING === "true"}
      activeSlideIndex={
        sketchOptions.slides?.length > 0 ? 0 : undefined
      }
    >
      <StudioSketchPage engineId={engineId} />
    </SketchContextProvider>
  );
}

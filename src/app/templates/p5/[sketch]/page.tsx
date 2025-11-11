import React from "react";

import type {
  Metadata
} from "next";
import listDirectory from "@/utils/listDirectory";
import ClientProcessingSketch from "@/components/ClientProcessingSketch/ClientProcessingSketch";

import getCaptureOptions from "@/utils/getCaptureOptions";
import {
  getJobById
} from "@/lib/jobStore";
import {
  notFound
} from "next/navigation";

import {
  OptionsSchema
} from "@/types/sketch.types";
import SketchContextProvider from "@/components/ClientProcessingSketch/components/SketchProvider/SketchContextProvider";
import {
  getJSONSketchOptions, getSketchMeta
} from "@/utils/getSketchOptions";

export const metadata: Metadata = {
  title: "My p5*js templates | @costardrouge.jpg",
  description: "Generate p5js sketch videos",
};

const acceptedImageTypes = [
  "png",
  "jpg",
  "arw",
  "jpeg",
  "webp"
];

export const revalidate = 0;

async function ProcessingSketch( {
  params, searchParams
}: {
  params: Promise<{
    sketch: string
  }>,
  searchParams: Promise<{
    id?: string
    capturing?: string
  }>
} ) {
  const sketchName = ( await params ).sketch;
  const jobIdSearchParams = ( await searchParams ).id;
  const sketchOptions = OptionsSchema.parse( {
  } );
  const {
    formValues, formConfiguration
  } = await getSketchMeta( sketchName );

  const jsonOptions = await getJSONSketchOptions( sketchName );

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
        sketch: formValues
      }
    );
  }

  let persistedJob = undefined;

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

    sketchOptions.assets.images = testImageFileNames
      .filter( testImageFileName => acceptedImageTypes.includes( testImageFileName.split( "." )[ 1 ] ) )
      .map( testImageFileName => `/assets/images/test/${ testImageFileName }` );
  }

  sketchOptions.name = sketchName;

  return (
    <SketchContextProvider
      name={ sketchName }
      options={ sketchOptions }
      persistedJob={ persistedJob }
      sketchFormValues={ formValues }
      sketchFormConfiguration={ formConfiguration }
      capturing={ ( await searchParams ).capturing === ""}
      backendRecording={process.env.BACKEND_RECORDING === "true"}
      activeSlideIndex={ sketchOptions.slides?.length > 0 ? 0 : undefined}
    >
      <ClientProcessingSketch/>
    </SketchContextProvider>

  );
}

export default ProcessingSketch;
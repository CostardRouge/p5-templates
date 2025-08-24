import React from "react";

import type {
  Metadata
} from "next";
import listDirectory from "@/utils/listDirectory";
import getSketchOptions from "@/utils/getSketchOptions";
import ClientProcessingSketch, {
  ClientProcessingSketchProps
} from "@/components/ClientProcessingSketch/ClientProcessingSketch";

import getCaptureOptions from "@/utils/getCaptureOptions";
import {
  getJobById
} from "@/lib/jobStore";
import {
  notFound
} from "next/navigation";
import {
  SketchOption
} from "@/types/sketch.types";
import initOptions from "@/components/utils/initOptions";

export const metadata: Metadata = {
  title: "Social-templates-renderer | p5js",
  description: "Generate social-templates with 5js",
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
  const testImageFileNames = await listDirectory( "public/assets/images/test" );

  const sketchName = ( await params ).sketch;
  const jobIdSearchParams = ( await searchParams ).id;
  const capturingSearchParams = ( await searchParams ).capturing;
  const sketchOptions = getSketchOptions( sketchName ) ?? ( {
  } as SketchOption );

  const processingSketchProps: ClientProcessingSketchProps = {
    capturing: capturingSearchParams !== undefined,
    persistedJob: undefined,
    options: sketchOptions,
    name: sketchName,
  };

  if ( jobIdSearchParams ) {
    const persistedJob = await getJobById( jobIdSearchParams );

    if ( !persistedJob ) {
      return notFound();
    }

    processingSketchProps.persistedJob = persistedJob;

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

    sketchOptions.assets.images = testImageFileNames
      .filter( testImageFileName => acceptedImageTypes.includes( testImageFileName.split( "." )[ 1 ] ) )
      .map( testImageFileName => `/assets/images/test/${ testImageFileName }` );
  }

  sketchOptions.name = sketchName;
  // processingSketchProps.options = initOptions( sketchOptions );

  return (
    <ClientProcessingSketch
      {...processingSketchProps}
    />
  );
}

export default ProcessingSketch;
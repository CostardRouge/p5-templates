import React from "react";

import type {
  Metadata
} from "next";
import listDirectory from "@/utils/listDirectory";
import getSketchOptions from "@/utils/getSketchOptions";

import ClientProcessingSketch from "@/components/ClientProcessingSketch";
import getCaptureOptions from "@/utils/getCaptureOptions";
import {
  getJobById
} from "@/lib/jobStore";
import {
  notFound
} from "next/navigation";

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
  const sketchOptions = getSketchOptions( sketchName );

  if ( jobIdSearchParams ) {
    const persistedJob = await getJobById( jobIdSearchParams );

    if ( !persistedJob || !persistedJob?.optionsKey ) {
      return notFound();
    }

    Object.assign(
      sketchOptions,
      await getCaptureOptions( persistedJob.optionsKey )
    );

    sketchOptions.id = jobIdSearchParams;
  }

  if ( capturingSearchParams !== undefined ) {
    sketchOptions.capturing = true;
  }

  if ( sketchOptions.consumeTestImages && !jobIdSearchParams ) {
    delete sketchOptions.consumeTestImages;

    sketchOptions.assets = testImageFileNames
      .filter( testImageFileName => acceptedImageTypes.includes( testImageFileName.split( "." )[ 1 ] ) )
      .map( testImageFileName => `/assets/images/test/${ testImageFileName }` );
  }

  sketchOptions.name = sketchName;

  return (
    <ClientProcessingSketch
      name={sketchName}
      options={sketchOptions}
    />
  );
}

export default ProcessingSketch;
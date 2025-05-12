import React from "react";

import listDirectory from "@/utils/listDirectory";
import getSketchOptions from "@/utils/getSketchOptions";

import ClientProcessingSketch from "@/components/ClientProcessingSketch";

const acceptedImageTypes = [
  "png",
  "jpg",
  "arw",
  "jpeg",
  "webp"
];
const defaultSketchOptions = {
  size: {
    width: 1080,
    height: 1350
  },
  animation: {
    duration: 12,
    framerate: 60
  }
};

export const revalidate = 0;

function decodeBase64Json( base64: string ): any {
  try {
    const jsonString = Buffer.from(
      base64,
      "base64"
    ).toString( "utf-8" );

    return JSON.parse( jsonString );
  } catch ( e ) {
    console.error(
      "Failed to decode captureOptions:",
      e
    );
    return {
    };
  }
}

async function ProcessingSketch( {
  params, searchParams
}: {
 params: Promise<{
 sketch: string
}>, searchParams: Promise<{
 captureOptions?: string
}>
} ) {
  const testImageFileNames = await listDirectory( "public/assets/images/test" );

  const sketchName = ( await params ).sketch;
  const captureOptionsBase64 = ( await searchParams ).captureOptions;
  const sketchOptions = getSketchOptions( sketchName ) || {
  };

  if ( captureOptionsBase64 ) {
    const captureOptions = decodeBase64Json( captureOptionsBase64 );

    Object.assign(
      sketchOptions,
      captureOptions
    );
    sketchOptions.capturing = true;
  }

  if ( !sketchOptions?.assets ) {
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
import React from "react";
import "./p5.css";

import type {
  Metadata
} from "next";

export const metadata: Metadata = {
  title: "Social-templates-renderer | p5js",
  description: "Generate social-templates with 5js",
};

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

export const revalidate = 0;

function decodeBase64Json( base64: string ): any {
  try {
    const jsonString = Buffer.from(
      base64,
      "base64"
    ).toString( "utf-8" );

    return JSON.parse( jsonString );
  } catch ( error ) {
    console.error(
      "Failed to decode captureOptions:",
      error
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

  if ( sketchOptions.consumeTestImages ) {
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
"use client";

import React, {
  useState, useEffect, Fragment
} from "react";
import Script from "next/script";
import CaptureBanner from "@/components/CaptureBanner";

import {
  setSketchOptions, subscribeSketchOptions, getSketchOptions
} from "@/shared/syncSketchOptions.js";

function ClientProcessingSketch( {
  name, options
}: {
 name: string, options: Record<string, unknown>
} ) {
  const [
    clientOptions,
    setClientOptions
  ] = useState( () => ( {
    ...getSketchOptions(),
    ...options
  } ) );

  /* push local edits → p5 */
  useEffect(
    () => setSketchOptions(
      clientOptions,
      "react"
    ),
    [
      clientOptions
    ]
  );

  /* listen for p5 edits → React state */
  useEffect(
    () => subscribeSketchOptions( ( options: any ) => setClientOptions( options ) ),
    [
    ]
  );

  return (
    <Fragment>
      <script
        dangerouslySetInnerHTML={{
          __html: `window.sketchOptions = ${ JSON.stringify( clientOptions ) };`,
        }}
      />

      <Script
        type="module"
        crossOrigin="anonymous"
        src={`/assets/scripts/p5-sketches/sketches/${ name }/index.js`}
      />

      { options.capturing !== true && (
        <CaptureBanner
          name={name}
          options={clientOptions}
          setOptions={options => setClientOptions( options as Record<string, unknown> ) }
        />
      ) }
    </Fragment>
  );
}

export default ClientProcessingSketch;
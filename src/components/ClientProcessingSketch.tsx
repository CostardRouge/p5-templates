"use client";

import React, {
  useState, useEffect, Fragment
} from "react";

import dynamic from "next/dynamic";

import {
  setSketchOptions, subscribeSketchOptions, getSketchOptions
} from "@/shared/syncSketchOptions.js";

import useP5Template from "@/hooks/useP5Template";
import {
  RecordingSketchOptions
} from "@/types/recording.types";

const CaptureBanner = dynamic(
  () => import( "@/components/CaptureBanner" ),
  {
    ssr: false,
  }
);

function ClientProcessingSketch( {
  name, options
}: {
 name: string, options: RecordingSketchOptions
} ) {
  const [
    clientOptions,
    setClientOptions
  ] = useState<RecordingSketchOptions>( () => ( {
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

  useP5Template( name );

  return (
    <Fragment>
      <script
        dangerouslySetInnerHTML={{
          __html: `window.sketchOptions = ${ JSON.stringify( clientOptions ) };`,
        }}
      />

      <div id="sketch-ui-drawer"></div>
      <span id="sketch-ui-icon"></span>

      {options.capturing !== true && (
        <CaptureBanner
          name={name}
          options={clientOptions}
          setOptions={options => setClientOptions( options as RecordingSketchOptions )}
        />
      )}
    </Fragment>
  );
}

export default ClientProcessingSketch;
"use client";

import React, {
  Fragment, useEffect, useState
} from "react";
import dynamic from "next/dynamic";

import {
  getSketchOptions, setSketchOptions, subscribeSketchOptions,
} from "@/shared/syncSketchOptions";

import {
  JobModel
} from "@/types/recording.types";

import type {
  SketchOption
} from "@/types/sketch.types";

import P5Sketch from "@/components/ClientProcessingSketch/components/P5Sketch";
import ScalableViewport from "@/components/ScalableViewport/ScalableViewport";
import {
  P5Controls
} from "@/components/ClientProcessingSketch/components/P5Controls";

const TemplateOptions = dynamic(
  () => import( "@/components/ClientProcessingSketch/components/TemplateOptions/TemplateOptions" ),
  {
    ssr: false,
  }
);

export type ClientProcessingSketchProps = {
  name: string;
  capturing: boolean,
  options: SketchOption;
  persistedJob?: JobModel
}

export default function ClientProcessingSketch( {
  name,
  options,
  capturing,
  persistedJob
}: ClientProcessingSketchProps ) {
  const [
    currentOptions,
    setCurrentOptions
  ] = useState<SketchOption>( () => ( {
    ...getSketchOptions(),
    ...options,
  } ), );

  const [
    sketchLoaded,
    setSketchLoaded
  ] = useState<boolean>( false );

  useEffect(
    () => {
      setSketchOptions(
        currentOptions,
        "react"
      );
    },
    [
      currentOptions
    ]
  );

  useEffect(
    () => subscribeSketchOptions( ( updatedOptions: any ) => {
      setCurrentOptions( updatedOptions );
    } ),
    [
    ]
  );

  return (
    <Fragment>
      <script
        dangerouslySetInnerHTML={{
          __html: `window.sketchOptions = ${ JSON.stringify( currentOptions ) };`,
        }}
      />

      {!sketchLoaded && (
        <div className="flex items-center justify-center">
          <p>⏳ loading p5.js</p>
        </div>
      )}

      <ScalableViewport showZoomControls={!capturing && sketchLoaded}>
        <P5Sketch
          name={name}
          onLoaded={() => {
            setSketchLoaded( true );
          }}
        />
      </ScalableViewport>

      {!capturing && (
        <>
          {sketchLoaded ? <P5Controls name={name}/> : null}

          <TemplateOptions
            name={name}
            persistedJob={persistedJob}
            options={currentOptions}
            setOptions={( updated ) =>
              setCurrentOptions( updated as SketchOption )
            }
          />
        </>
      )}
    </Fragment>
  );
}
"use client";

import React, {
  Fragment, useEffect, useState
} from "react";
import dynamic from "next/dynamic";

import {
  getSketchOptions,
  setSketchOptions,
  subscribeSketchOptions,
} from "@/shared/syncSketchOptions";

import {
  JobModel
} from "@/types/recording.types";

import type {
  SketchOption
} from "@/types/sketch.types";

import P5Sketch from "@/components/P5Sketch";
import ScalableViewport from "@/components/ScalableViewport";

const TemplateOptions = dynamic(
  () => import( "@/components/TemplateOptions/TemplateOptions" ),
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

      <ScalableViewport>
        <P5Sketch name={name} />
      </ScalableViewport>

      {!capturing && (
        <TemplateOptions
          name={name}
          persistedJob={persistedJob}
          options={currentOptions}
          setOptions={( updated ) =>
            setCurrentOptions( updated as SketchOption )
          }
        />
      )}
    </Fragment>
  );
}

"use client";

import React, {
  useCallback, useEffect, useState,
} from "react";
import dynamic from "next/dynamic";

import {
  getSketchOptions, setSketchOptions, subscribeSketchOptions,
} from "@/p5-sketches/shared/syncSketchOptions";

import {
  JobModel
} from "@/types/recording.types";

import type {
  SketchOption
} from "@/types/sketch.types";
import {
  P5Controls
} from "@/components/ClientProcessingSketch/components/P5Controls";
import ScalableViewport from "@/components/ScalableViewport/ScalableViewport";
import P5Sketch from "@/components/ClientProcessingSketch/components/P5Sketch";

const TemplateOptions = dynamic( () => import( "@/components/ClientProcessingSketch/components/TemplateOptions/TemplateOptions" ) );

export type ClientProcessingSketchProps = {
  name: string;
  capturing: boolean,
  options?: SketchOption | Partial<SketchOption> | null;
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

  const [
    activeSlideIndex,
    setActiveSlideIndex
  ] = useState<number | null>( null );

  const handleActiveSlideChange = useCallback(
    ( index: number ) => {
      setActiveSlideIndex( index );
    },
    [
    ]
  );

  return (
    <>
      {!sketchLoaded && (
        <div className="flex items-center justify-center absolute h-full w-full">
          <p className="text-foreground">→ loading <strong>{name}</strong>...</p>
        </div>
      )}

      <div className="h-full w-full bg-hover/50">
        <ScalableViewport
          showZoomControls={!capturing && sketchLoaded}
        >
          {sketchLoaded && (
            <div className="flex justify-between font-mono">
              <p>{name} {activeSlideIndex !== null && `· slide ${ activeSlideIndex + 1 }`}</p>
              <p id="p5-sketch-fps-counter"></p>
            </div>
          )}

          <P5Sketch
            name={name}
            onLoaded={() => {
              setSketchLoaded( true );
            }}
          />
        </ScalableViewport>
      </div>

      {sketchLoaded && (
        <>
          {!capturing && <P5Controls name={name} /> }

          <TemplateOptions
            name={name}
            options={currentOptions}
            persistedJob={persistedJob}
            onOptionsChange={( updatedOptions ) =>
              setCurrentOptions( updatedOptions as SketchOption )
            }
            onActiveSlideChange={handleActiveSlideChange}
          />
        </>
      )}
    </>
  );
}
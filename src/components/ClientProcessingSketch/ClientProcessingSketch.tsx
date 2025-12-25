"use client";

import React, {
  useCallback, useEffect, useState
} from "react";
import dynamic from "next/dynamic";

import {
  setSketchOptions, subscribeSketchOptions,
} from "@/p5-sketches/shared/syncSketchOptions";

import type {
  SketchOption
} from "@/types/sketch.types";
import {
  P5Controls
} from "@/components/ClientProcessingSketch/components/P5Controls";
import ScalableViewport from "@/components/ScalableViewport/ScalableViewport";
import P5Sketch from "@/components/ClientProcessingSketch/components/P5Sketch";
import AnimationProgressionBar from "@/components/AnimationProgressionBar";
import useSketch from "./components/SketchProvider/hooks/useSketch";
import Link from "next/link";

const TemplateOptions = dynamic( () =>
  import( "@/components/ClientProcessingSketch/components/TemplateOptions/TemplateOptions" ) );

export default function ClientProcessingSketch() {
  const {
    name, capturing, options, persistedJob
  } = useSketch();

  // Initialize with options from context, which includes persisted data
  const [
    currentOptions,
    setCurrentOptions
  ] = useState<SketchOption>( options );

  const [
    sketchLoaded,
    setSketchLoaded
  ] = useState<boolean>( false );

  // Sync global sketch options when currentOptions changes
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

  // Update currentOptions when options prop changes (e.g., from persisted data loading)
  useEffect(
    () => {
      setCurrentOptions( options );
    },
    [
      options
    ]
  );

  useEffect(
    () =>
      subscribeSketchOptions( (
        updatedOptions: any, origin?: string
      ) => {
        setCurrentOptions( updatedOptions );
      } ),
    [
    ]
  );

  const [
    activeSlideIndex,
    setActiveSlideIndex
  ] = useState<number | undefined>( undefined );

  const handleActiveSlideChange = useCallback(
    ( index: number | undefined ) => {
      setActiveSlideIndex( index );
    },
    [
    ]
  );

  return (
    <>
      {!sketchLoaded && (
        <div className="flex items-center justify-center absolute h-full w-full">
          <p className="text-foreground">
            → loading <span className="font-bold">{name}</span>...
          </p>
        </div>
      )}

      <div
        className="h-full w-full relative select-none"
        hidden={!sketchLoaded}
      >
        <ScalableViewport
          disable={capturing}
          showZoomControls={!capturing && sketchLoaded}
          resolutionKey={`${ currentOptions.size.width }x${ currentOptions.size.height }`}
          isReady={sketchLoaded}
        >
          {sketchLoaded && !capturing && (
            <div
              onClick={( e ) => e.stopPropagation()}
              className="flex justify-between font-mono text-sm select-none mt-2"
              style={
                {
                  "--scale-factor": "var(--viewport-scale, 1)",
                  transform: "scale(calc(1 / var(--scale-factor)))",
                  transformOrigin: "bottom left",
                  width: "calc(100% * var(--scale-factor))",
                } as React.CSSProperties
              }
            >
              <p className="truncate">
                <Link href={`/templates/p5/${ name }`} target="_blank">
                  {name}
                </Link>

                <span>
                  {activeSlideIndex !== undefined && `· slide ${ activeSlideIndex + 1 }`}
                </span>
              </p>

              <p id="p5-sketch-fps-counter"></p>
            </div>
          )}

          <P5Sketch
            name={name}
            onLoaded={() => {
              setSketchLoaded( true );
            }}
          />

          {sketchLoaded && !capturing && (
            <div
              className="mt-2 mb-4 truncate"
              style={
                {
                  "--scale-factor": "var(--viewport-scale, 1)",
                  transform: "scale(calc(1 / var(--scale-factor)))",
                  transformOrigin: "top left",
                  width: "calc(100% * var(--scale-factor))",
                } as React.CSSProperties
              }
            >
              <AnimationProgressionBar />
            </div>
          )}
        </ScalableViewport>
      </div>

      {sketchLoaded && !capturing && (
        <>
          <P5Controls name={name} />

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

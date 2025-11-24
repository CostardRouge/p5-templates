"use client";

import React, {
  useCallback, useEffect, useState,
} from "react";
import dynamic from "next/dynamic";

import {
  getSketchOptions, setSketchOptions, subscribeSketchOptions,
} from "@/p5-sketches/shared/syncSketchOptions";

import type {
  SketchOption
} from "@/types/sketch.types";
import {
  P5Controls
} from "@/components/ClientProcessingSketch/components/P5Controls";
import ScalableViewport from "@/components/ScalableViewport/ScalableViewport";
import P5Sketch from "@/components/ClientProcessingSketch/components/P5Sketch";
import useSketch from "./components/SketchProvider/hooks/useSketch";

const TemplateOptions = dynamic(() => import("@/components/ClientProcessingSketch/components/TemplateOptions/TemplateOptions"));

export default function ClientProcessingSketch() {
  const {
    name, capturing, options, persistedJob
  } = useSketch();
  const [
    currentOptions,
    setCurrentOptions
  ] = useState<SketchOption>(() => ({
    ...getSketchOptions(),
    ...options,
  }),);

  const [
    sketchLoaded,
    setSketchLoaded
  ] = useState<boolean>(false);

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
    () => subscribeSketchOptions((updatedOptions: any) => {
      setCurrentOptions(updatedOptions);
    }),
    [
    ]
  );

  const [
    activeSlideIndex,
    setActiveSlideIndex
  ] = useState<number | undefined>(undefined);

  const handleActiveSlideChange = useCallback(
    (index: number | undefined) => {
      setActiveSlideIndex(index);
    },
    [
    ]
  );

  return (
    <>
      {!sketchLoaded && (
        <div className="flex items-center justify-center absolute h-full w-full">
          <p className="text-foreground">→ loading <span className="font-bold">{name}</span>...</p>
        </div>
      )}

      <div className="h-full w-full">
        <ScalableViewport
          showZoomControls={!capturing && sketchLoaded}
          resolutionKey={`${currentOptions.size.width}x${currentOptions.size.height}`}
          isReady={sketchLoaded}
        >
          {sketchLoaded && (
            <div
              className="keep-scale flex justify-between font-mono text-sm"
              style={
                {
                  "--scale-factor": "var(--viewport-scale, 1)",
                  transform: "scale(calc(1 / var(--scale-factor)))",
                  transformOrigin: "bottom left",
                  width: "calc(100% * var(--scale-factor))",
                } as React.CSSProperties
              }
            >
              <p>{name} {activeSlideIndex !== undefined && `· slide ${activeSlideIndex + 1}`}</p>
              <p id="p5-sketch-fps-counter"></p>
            </div>
          )}

          <P5Sketch
            name={name}
            onLoaded={() => {
              setSketchLoaded(true);
            }}
          />
        </ScalableViewport>
      </div>

      {sketchLoaded && (
        <>
          {!capturing && <P5Controls name={name} />}

          <TemplateOptions
            name={name}
            options={currentOptions}
            persistedJob={persistedJob}
            onOptionsChange={(updatedOptions) =>
              setCurrentOptions(updatedOptions as SketchOption)
            }
            onActiveSlideChange={handleActiveSlideChange}
          />
        </>
      )}
    </>
  );
}
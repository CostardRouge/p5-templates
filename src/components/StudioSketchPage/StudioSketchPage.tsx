"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import type React from "react";
import {
  useCallback, useEffect, useState
} from "react";
import AnimationProgressionBar from "@/components/AnimationProgressionBar";
import EngineSketchRenderer from "@/components/StudioSketchPage/EngineSketchRenderer";
import {
  EngineControls
} from "@/components/StudioSketchPage/EngineControls";
import ScalableViewport from "@/components/ScalableViewport/ScalableViewport";
import {
  setSketchOptions,
  subscribeSketchOptions,
} from "@/lib/syncSketchOptions";
import type {
  SketchOption
} from "@/types/sketch.types";
import useSketch from "@/components/ClientProcessingSketch/components/SketchProvider/hooks/useSketch";
import {
  useSketchThumbnail
} from "@/components/ClientProcessingSketch/components/SketchProvider/hooks/useSketchThumbnail";

const TemplateOptions = dynamic( () =>
  import( "@/components/ClientProcessingSketch/components/TemplateOptions/TemplateOptions" ), );

type Props = {
  engineId: string;
};

export default function StudioSketchPage( {
  engineId
}: Props ) {
  const {
    name, capturing, options, persistedJob
  } = useSketch();

  const {
    thumbnailUrl
  } = useSketchThumbnail( {
    name,
    persistedJob
  } );

  const [
    currentOptions,
    setCurrentOptions
  ] = useState<SketchOption>( options );
  const [
    sketchLoaded,
    setSketchLoaded
  ] = useState( false );

  /* ---- sync options ---------------------------------------------- */

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
    () => {
      setCurrentOptions( options );
    },
    [
      options
    ]
  );

  useEffect(
    () =>
      subscribeSketchOptions( ( updatedOptions: any ) => {
        setCurrentOptions( updatedOptions );
      } ),
    [
    ],
  );

  /* ---- slide management ------------------------------------------ */

  const [
    activeSlideIndex,
    setActiveSlideIndex
  ] = useState<
    number | undefined
  >( undefined );

  const handleActiveSlideChange = useCallback(
    ( index: number | undefined ) => setActiveSlideIndex( index ),
    [
    ],
  );

  return (
    <>
      {/* Loading placeholder */}
      {!sketchLoaded && (
        <div className="flex items-center justify-center absolute h-full w-full">
          <div className="flex flex-col items-center gap-4">
            {thumbnailUrl && (
              <img
                src={thumbnailUrl}
                alt={`${ name } thumbnail`}
                className="w-60 h-auto rounded-lg shadow-lg"
              />
            )}

            <p className="text-foreground">
              → loading{" "}
              <span className="font-bold">{name}</span> ({engineId})…
            </p>
          </div>
        </div>
      )}

      {/* Sketch viewport */}
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
                <Link
                  href={`/templates/${ engineId }/${ name }`}
                  target="_blank"
                >
                  {name}
                </Link>

                <span>
                  {activeSlideIndex !== undefined &&
                    ` · slide ${ activeSlideIndex + 1 }`}
                </span>
              </p>

              <p id="p5-sketch-fps-counter" />
            </div>
          )}

          <EngineSketchRenderer
            engineId={engineId}
            templateName={name}
            options={currentOptions}
            capturing={capturing}
            onLoaded={() => setSketchLoaded( true )}
          />

          {sketchLoaded && !capturing && (
            <div
              className="mt-2 mb-4 truncate"
              data-no-drag="true"
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

      {/* Controls & options panel */}
      {sketchLoaded && !capturing && (
        <>
          <EngineControls name={name} engineId={engineId} />

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

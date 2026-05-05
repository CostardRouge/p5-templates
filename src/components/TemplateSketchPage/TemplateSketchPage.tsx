"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import type React from "react";
import {
  useCallback, useMemo
} from "react";
import AnimationProgressionBar from "@/components/AnimationProgressionBar";
import EngineSketchRenderer from "@/components/TemplateSketchPage/EngineSketchRenderer";
import {
  EngineControls
} from "@/components/TemplateSketchPage/EngineControls";
import ScalableViewport from "@/components/ScalableViewport/ScalableViewport";
import type {
  SketchOption
} from "@/types/sketch.types";
import {
  getEffectiveSlideSettings
} from "@/lib/effectiveSlideSettings";
import useSketch from "@/components/ClientProcessingSketch/components/SketchProvider/hooks/useSketch";
import {
  useSketchThumbnail
} from "@/components/ClientProcessingSketch/components/SketchProvider/hooks/useSketchThumbnail";
import useSketchDevWatch from "@/hooks/useSketchDevWatch";
import getSketchThumbnailURL from "@/utils/getSketchThumbnailURL";

const TemplateOptions = dynamic( () =>
  import( "@/components/ClientProcessingSketch/components/TemplateOptions/TemplateOptions" ) );

export default function TemplateSketchPage() {
  const [
    {
      name, capturing, options, persistedJob, engineId, sketchLoaded, activeSlideIndex
    },
    dispatch
  ] = useSketch();

  const {
    thumbnailUrl
  } = useSketchThumbnail( {
    name,
    persistedJob,
    engine: engineId
  } );

  useSketchDevWatch(
    name,
    engineId,
    capturing
  );

  const handleOptionsChange = useCallback(
    ( updatedOptions: SketchOption | ( ( existingOptions: SketchOption ) => void ) ) => {
      dispatch( {
        type: "SET_OPTIONS",
        payload: updatedOptions as SketchOption
      } );
    },
    [
      dispatch
    ]
  );

  const handleActiveSlideChange = useCallback(
    ( index: number | undefined ) => {
      dispatch( {
        type: "SET_ACTIVE_SLIDE",
        payload: index
      } );
    },
    [
      dispatch
    ]
  );

  const effectiveSettings = useMemo(
    () => getEffectiveSlideSettings(
      options,
      activeSlideIndex
    ),
    [
      options,
      activeSlideIndex
    ]
  );

  return (
    <>
      {/* Loading placeholder */}
      {!sketchLoaded && (
        <div className="flex items-center justify-center absolute h-full w-full">
          <div className="flex flex-col items-center gap-4">
            <img
              src={ thumbnailUrl }
              alt={ `${ name } thumbnail` }
              className="w-60 h-auto rounded-lg shadow-lg"
              onError={ ( e ) => {
                const fallback = getSketchThumbnailURL(
                  engineId,
                  name
                );

                if ( e.currentTarget.src !== window.location.origin + fallback ) {
                  e.currentTarget.src = fallback;
                }
              } }
            />

            <p className="text-foreground">
              {" → loading "}
              <span className="font-bold">{name}</span> ({engineId})
            </p>
          </div>
        </div>
      )}

      {/* Sketch viewport */}
      <div
        className="h-full w-full relative"
        hidden={ !sketchLoaded }
      >
        <ScalableViewport
          disable={ capturing }
          showZoomControls={ !capturing && sketchLoaded }
          resolutionKey={ `${ effectiveSettings.size.width }x${ effectiveSettings.size.height }` }
          isReady={ sketchLoaded }
        >
          {sketchLoaded && !capturing && (
            <div
              onClick={ ( e ) => e.stopPropagation() }
              className="flex justify-between font-mono text-sm mt-2"
              style={
                {
                  "--scale-factor": "var(--viewport-scale, 1)",
                  transform: "scale(calc(1 / var(--scale-factor)))",
                  transformOrigin: "bottom left",
                  width: "calc(100% * var(--scale-factor))"
                } as React.CSSProperties
              }
            >
              <p className="truncate">
                <Link
                  href={ `/templates/${ engineId }/${ name }` }
                  target="_blank"
                >
                  {name}
                </Link>

                <span>
                  {activeSlideIndex !== undefined && ` · slide ${ activeSlideIndex + 1 }`}
                </span>
              </p>

              <p id="sketch-fps-counter" />
            </div>
          )}

          <EngineSketchRenderer />

          {sketchLoaded && !capturing && (
            <div
              className="mt-2 mb-4 truncate"
              data-no-drag="true"
              style={
                {
                  "--scale-factor": "var(--viewport-scale, 1)",
                  transform: "scale(calc(1 / var(--scale-factor)))",
                  transformOrigin: "top left",
                  width: "calc(100% * var(--scale-factor))"
                } as React.CSSProperties
              }
            >
              <AnimationProgressionBar />
            </div>
          )}
        </ScalableViewport>
      </div>

      {/* Controls & options panel */}
      { sketchLoaded && !capturing && (
        <>
          <EngineControls />

          <TemplateOptions
            name={ name }
            options={ options }
            persistedJob={ persistedJob }
            onOptionsChange={ handleOptionsChange }
            onActiveSlideChange={ handleActiveSlideChange }
          />
        </>
      ) }
    </>
  );
}

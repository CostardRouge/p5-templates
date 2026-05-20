"use client";

import {
  useEffect,
  useMemo,
  useState
} from "react";
import type {
  EnginePerformanceSample
} from "@/engines/types";
import useSketch from "@/components/ClientProcessingSketch/components/SketchProvider/hooks/useSketch";

type SketchPerformanceLabelProps = {
  targetFps: number;
  interactionMode?: "panning" | "zooming" | "seeking" | null;
};

const RED_THRESHOLD = 0.55;
const WARNING_THRESHOLD = 0.85;

export default function SketchPerformanceLabel( {
  targetFps,
  interactionMode
}: SketchPerformanceLabelProps ) {
  const [
    {
      engine,
      looping
    }
  ] = useSketch();

  const [
    performance,
    setPerformance
  ] = useState<EnginePerformanceSample>( {
    fps: 0,
    paused: false,
    timestamp: 0
  } );

  useEffect(
    () => {
      if ( !engine ) {
        setPerformance( {
          fps: 0,
          paused: false,
          timestamp: 0
        } );
        return;
      }

      const handlePerformance = ( sample: EnginePerformanceSample ) => {
        setPerformance( sample );
      };

      engine.on(
        "performance",
        handlePerformance
      );

      return () => {
        engine.off(
          "performance",
          handlePerformance
        );
      };
    },
    [
      engine
    ]
  );

  const value = useMemo(
    () => Math.max(
      0,
      Math.round( performance.fps )
    ),
    [
      performance.fps
    ]
  );

  const ratio = targetFps > 0
    ? value / targetFps
    : 1;

  const color = !looping || value <= 0
    ? undefined
    : ratio < RED_THRESHOLD
      ? "#ef4444"
      : ratio < WARNING_THRESHOLD
        ? "#f97316"
        : undefined;

  if ( interactionMode ) {
    return (
      <p className="opacity-50">{interactionMode}</p>
    );
  }

  return (
    <p style={ color ? {
      color
    } : undefined }>
      {looping ? value : "paused"}
    </p>
  );
}
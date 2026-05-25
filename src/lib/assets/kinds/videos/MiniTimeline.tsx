"use client";
import {
  useEffect, useRef
} from "react";

import {
  computeVideoPhase, type VideoParams
} from "./types";

type Props = {
  params: VideoParams;
  width?: number;
  height?: number;
  samples?: number;
};

/**
 * Plots `videoPhase(p)` for p ∈ [0, 1] so the user sees how repeat /
 * speed / offset / loopMode combine into the actual playback curve.
 * The X axis is sketch progression, Y is the normalized video time.
 */
export default function MiniTimeline( {
  params,
  width = 220,
  height = 56,
  samples = 200
}: Props ) {
  const canvasRef = useRef<HTMLCanvasElement>( null );

  useEffect(
    () => {
      const canvas = canvasRef.current;

      if ( !canvas ) {
        return;
      }

      const dpr = window.devicePixelRatio || 1;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${ width }px`;
      canvas.style.height = `${ height }px`;

      const ctx = canvas.getContext( "2d" );

      if ( !ctx ) {
        return;
      }

      ctx.scale(
        dpr,
        dpr
      );
      ctx.clearRect(
        0,
        0,
        width,
        height
      );

      // Frame
      ctx.strokeStyle = "rgba(127,127,127,0.3)";
      ctx.lineWidth = 1;
      ctx.strokeRect(
        0.5,
        0.5,
        width - 1,
        height - 1
      );

      // Curve
      ctx.beginPath();
      for ( let i = 0; i <= samples; i++ ) {
        const p = i / samples;
        const phase = computeVideoPhase(
          p,
          params
        );
        const x = p * ( width - 2 ) + 1;
        const y = ( 1 - phase ) * ( height - 2 ) + 1;

        if ( i === 0 ) {
          ctx.moveTo(
            x,
            y
          );
        } else {
          ctx.lineTo(
            x,
            y
          );
        }
      }
      ctx.strokeStyle = "currentColor";
      ctx.lineWidth = 1.25;
      ctx.stroke();
    },
    [
      params,
      width,
      height,
      samples
    ]
  );

  return (
    <canvas
      ref={ canvasRef }
      className="text-foreground block"
      aria-label="Video time mapping preview"
    />
  );
}

import {
  useEffect, useRef
} from "react";
import useSketch from "@/components/ClientProcessingSketch/components/SketchProvider/hooks/useSketch";
import {
  getActiveSketchCanvas
} from "./thumbnailUtils";

// Resolved once at module load — zero runtime cost when disabled.
const LIVE_THUMBNAIL_ENABLED =
  process.env.NEXT_PUBLIC_LIVE_THUMBNAIL === "true";

const TARGET_FPS = 30;
const FRAME_INTERVAL = 1000 / TARGET_FPS;

/** Blit an engine frame into the thumbnail canvas, sizing it to its CSS box. */
function blitToThumbnail(
  frame: CanvasImageSource,
  thumbCanvas: HTMLCanvasElement
): void {
  const displayW = thumbCanvas.offsetWidth;
  const displayH = thumbCanvas.offsetHeight;

  // Skip if the element isn't laid out yet
  if ( displayW === 0 || displayH === 0 ) {
    return;
  }

  // Sync internal buffer to CSS display size (only when it changes)
  if ( thumbCanvas.width !== displayW || thumbCanvas.height !== displayH ) {
    thumbCanvas.width = displayW;
    thumbCanvas.height = displayH;
  }

  const ctx = thumbCanvas.getContext( "2d" );

  if ( !ctx ) {
    return;
  }

  ctx.drawImage(
    frame,
    0,
    0,
    displayW,
    displayH
  );
}

/**
 * When NEXT_PUBLIC_LIVE_THUMBNAIL=true, mirrors the active sketch's current
 * frame into `thumbCanvasRef` at ~30 fps. Only runs while `isActive` is true;
 * completely idle for inactive slides.
 *
 * It goes through the engine's capture source rather than a raw canvas query so
 * it works for every engine: canvas engines (p5, Three.js) hand back their live
 * canvas as-is, while GSAP — which renders to the DOM and has no live canvas —
 * rasterises its current stage on demand. Rasterisation is async and can be
 * slow, so overlapping reads are skipped (the mirror self-throttles). When no
 * engine is available yet it falls back to a direct canvas lookup.
 *
 * Returns `LIVE_THUMBNAIL_ENABLED` so the consumer knows which element to render.
 */
export function useLiveThumbnail( {
  thumbCanvasRef,
  isActive
}: {
  thumbCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  isActive: boolean;
} ): boolean {
  const [
    {
      engine, browserRecording
    }
  ] = useSketch();
  // Stable ref for the rAF id so we can cancel without adding to deps
  const rafIdRef = useRef<number | null>( null );

  useEffect(
    () => {
      // While a browser recording/export is running, stay completely idle. For
      // a DOM engine (GSAP) `readFrame()` rasterises the *same* singleton mirror
      // canvas the recorder is driving, so mirroring here would double the
      // per-frame rasterisation cost and race the recorder's own writes.
      if ( !LIVE_THUMBNAIL_ENABLED || !isActive || browserRecording ) {
        return;
      }

      // Captured once: for GSAP its methods delegate to the runtime singleton,
      // so a single instance stays valid for the effect's lifetime.
      const captureSource = engine?.getCaptureSource() ?? null;

      let lastTime = 0;
      let readInFlight = false;
      let cancelled = false;

      const loop = ( time: number ) => {
        rafIdRef.current = requestAnimationFrame( loop );

        // Throttle to TARGET_FPS
        if ( time - lastTime < FRAME_INTERVAL ) {
          return;
        }

        lastTime = time;

        const thumbCanvas = thumbCanvasRef.current;

        if ( !thumbCanvas ) {
          return;
        }

        // No engine yet (still initialising): blit whatever live canvas is in
        // the preview container. Canvas engines paint it continuously; for a
        // DOM engine this is the last-primed mirror until the engine is ready.
        if ( !captureSource ) {
          const srcCanvas = getActiveSketchCanvas();

          if ( srcCanvas ) {
            blitToThumbnail(
              srcCanvas,
              thumbCanvas
            );
          }

          return;
        }

        // Don't stack rasterisations: if a (potentially slow) read is still
        // running, let it finish before starting the next.
        if ( readInFlight ) {
          return;
        }

        readInFlight = true;
        captureSource
          .readFrame()
          .then( ( frame ) => {
            readInFlight = false;

            const live = thumbCanvasRef.current;

            if ( cancelled || !frame || !live ) {
              return;
            }

            blitToThumbnail(
              frame,
              live
            );
          } )
          .catch( () => {
            readInFlight = false;
          } );
      };

      rafIdRef.current = requestAnimationFrame( loop );

      return () => {
        cancelled = true;

        if ( rafIdRef.current !== null ) {
          cancelAnimationFrame( rafIdRef.current );
          rafIdRef.current = null;
        }
      };
    },
    [
      isActive,
      thumbCanvasRef,
      engine,
      browserRecording
    ]
  );

  return LIVE_THUMBNAIL_ENABLED;
}

import {
  useEffect, useRef
} from "react";

// Resolved once at module load — zero runtime cost when disabled.
const LIVE_THUMBNAIL_ENABLED =
  process.env.NEXT_PUBLIC_LIVE_THUMBNAIL === "true";

const TARGET_FPS = 30;
const FRAME_INTERVAL = 1000 / TARGET_FPS;

/**
 * When NEXT_PUBLIC_LIVE_THUMBNAIL=true, mirrors the main p5 canvas into
 * `thumbCanvasRef` at ~15 fps using a GPU-accelerated drawImage blit.
 * Only runs while `isActive` is true; completely idle for inactive slides.
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
  // Stable ref for the rAF id so we can cancel without adding to deps
  const rafIdRef = useRef<number | null>( null );

  useEffect(
    () => {
      if ( !LIVE_THUMBNAIL_ENABLED || !isActive ) {
        return;
      }

      let lastTime = 0;

      const loop = ( time: number ) => {
        rafIdRef.current = requestAnimationFrame( loop );

        // Throttle to TARGET_FPS
        if ( time - lastTime < FRAME_INTERVAL ) {
          return;
        }

        lastTime = time;

        const srcCanvas = document.querySelector( "canvas.p5Canvas, canvas#defaultCanvas0" ) as HTMLCanvasElement | null;
        const thumbCanvas = thumbCanvasRef.current;

        if ( !srcCanvas || !thumbCanvas ) {
          return;
        }

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
          srcCanvas,
          0,
          0,
          displayW,
          displayH
        );
      };

      rafIdRef.current = requestAnimationFrame( loop );

      return () => {
        if ( rafIdRef.current !== null ) {
          cancelAnimationFrame( rafIdRef.current );
          rafIdRef.current = null;
        }
      };
    },
    [
      isActive,
      thumbCanvasRef
    ]
  );

  return LIVE_THUMBNAIL_ENABLED;
}

import {
  useCallback, useRef
} from "react";
import easing from "@/p5-sketches/utils/easing";
import type {
  TransformState
} from "./useTransformState";

const ANIMATION_CONFIG = {
  duration: 250,
  easing: easing.easeOutCubic,
};

export function useViewportAnimation(
  setTransform: (
    values: Partial<TransformState>,
    contentElement: HTMLDivElement | null
  ) => void,
  transform: React.MutableRefObject<TransformState>,
  contentRef: React.RefObject<HTMLDivElement | null>
) {
  const animationFrameRef = useRef<number | null>( null );

  const cancelAnimation = useCallback(
    () => {
      if ( animationFrameRef.current ) {
        cancelAnimationFrame( animationFrameRef.current );
        animationFrameRef.current = null;
      }
    },
    [
    ]
  );

  const animateTo = useCallback(
    (
      targetX: number, targetY: number, targetScale: number
    ) => {
      cancelAnimation();

      const startX = transform.current.x;
      const startY = transform.current.y;
      const startScale = transform.current.scale;
      const startTime = performance.now();

      const animate = ( currentTime: number ) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(
          elapsed / ANIMATION_CONFIG.duration,
          1
        );
        const easedProgress = ANIMATION_CONFIG.easing( progress );

        const currentX = startX + ( targetX - startX ) * easedProgress;
        const currentY = startY + ( targetY - startY ) * easedProgress;
        const currentScale =
          startScale + ( targetScale - startScale ) * easedProgress;

        setTransform(
          {
            x: currentX,
            y: currentY,
            scale: currentScale,
          },
          contentRef.current
        );

        if ( progress < 1 ) {
          animationFrameRef.current = requestAnimationFrame( animate );
        } else {
          animationFrameRef.current = null;
        }
      };

      animationFrameRef.current = requestAnimationFrame( animate );
    },
    [
      setTransform,
      cancelAnimation,
      transform,
      contentRef
    ]
  );

  return {
    animateTo,
    cancelAnimation,
  };
}

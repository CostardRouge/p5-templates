"use client";

import React, {
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useGesture } from "@use-gesture/react";
import clamp from "@/utils/clamp";
import ZoomControls from "@/components/ScalableViewport/components/ZoomControls";

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */
const MIN_SCALE = 0.1;
const MAX_SCALE = 6;
const ZOOM_STEP = 0.5;

const ANIMATION_CONFIG = {
  duration: 300, // ms
  easing: (t: number) => 1 - Math.pow(1 - t, 3), // easeOutCubic
};

export default function ScalableViewport({
  children,
  initialScale,
  showZoomControls = true,
  resolutionKey,
  isReady = true,
}: {
  children: ReactNode;
  initialScale?: number;
  resolutionKey?: string;
  showZoomControls?: boolean;
  isReady?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // State for high-performance transforms
  const transform = useRef({
    x: 0,
    y: 0,
    scale: initialScale || 1,
  });

  // Sync scale to React state for UI (ZoomControls)
  const [displayScale, setDisplayScale] = useState(initialScale || 1);

  // Animation frame ref
  const animationFrameRef = useRef<number | null>(null);

  /* ---------------------------------------------------------------- */
  /*  DOM Manipulation                                                */
  /* ---------------------------------------------------------------- */
  const updateDom = useCallback(() => {
    if (contentRef.current) {
      const { x, y, scale } = transform.current;
      contentRef.current.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    }
  }, []);

  const setTransform = useCallback(
    (newValues: Partial<typeof transform.current>) => {
      transform.current = { ...transform.current, ...newValues };
      updateDom();
      if (newValues.scale !== undefined) {
        setDisplayScale(newValues.scale);
      }
    },
    [updateDom]
  );

  /* ---------------------------------------------------------------- */
  /*  Animation Logic                                                 */
  /* ---------------------------------------------------------------- */
  const cancelAnimation = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const animateTo = useCallback(
    (targetX: number, targetY: number, targetScale: number) => {
      cancelAnimation();

      const startX = transform.current.x;
      const startY = transform.current.y;
      const startScale = transform.current.scale;
      const startTime = performance.now();

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / ANIMATION_CONFIG.duration, 1);
        const easedProgress = ANIMATION_CONFIG.easing(progress);

        const currentX = startX + (targetX - startX) * easedProgress;
        const currentY = startY + (targetY - startY) * easedProgress;
        const currentScale =
          startScale + (targetScale - startScale) * easedProgress;

        setTransform({ x: currentX, y: currentY, scale: currentScale });

        if (progress < 1) {
          animationFrameRef.current = requestAnimationFrame(animate);
        } else {
          animationFrameRef.current = null;
        }
      };

      animationFrameRef.current = requestAnimationFrame(animate);
    },
    [setTransform, cancelAnimation]
  );

  /* ---------------------------------------------------------------- */
  /*  Zoom Logic (Focal Point)                                        */
  /* ---------------------------------------------------------------- */
  const getZoomTarget = useCallback(
    (newScale: number, clientX: number, clientY: number) => {
      const container = containerRef.current;
      if (!container) return null;

      const rect = container.getBoundingClientRect();
      const { x, y, scale } = transform.current;

      const clampedScale = clamp(newScale, MIN_SCALE, MAX_SCALE);

      // Calculate local coordinates relative to container
      const relX = clientX - rect.left;
      const relY = clientY - rect.top;

      // Calculate the translation adjustment to keep the focal point fixed
      const scaleRatio = clampedScale / scale;
      const nextX = relX - (relX - x) * scaleRatio;
      const nextY = relY - (relY - y) * scaleRatio;

      return { x: nextX, y: nextY, scale: clampedScale };
    },
    []
  );

  const zoomToPoint = useCallback(
    (newScale: number, clientX: number, clientY: number) => {
      const target = getZoomTarget(newScale, clientX, clientY);
      if (target) {
        setTransform(target);
      }
    },
    [getZoomTarget, setTransform]
  );

  /* ---------------------------------------------------------------- */
  /*  Gestures                                                        */
  /* ---------------------------------------------------------------- */
  useGesture(
    {
      onDragStart: () => cancelAnimation(),
      onPinchStart: () => cancelAnimation(),
      onWheelStart: () => cancelAnimation(),

      // 1. Mouse Click + Drag = Pan
      onDrag: ({ delta: [dx, dy] }) => {
        const { x, y } = transform.current;
        setTransform({
          x: x + dx,
          y: y + dy,
        });
      },

      // 2. Trackpad Pinch / Touch Pinch = Zoom
      onPinch: ({ origin: [ox, oy], offset: [s], first, memo }) => {
        const container = containerRef.current;
        if (!container) return;

        if (first) {
          const rect = container.getBoundingClientRect();
          // 1. Capture the initial state at the start of the gesture
          const { x, y, scale } = transform.current;

          // Calculate the "focal point" relative to the container
          // This is the point we want to remain fixed visually
          const tx = ox - rect.left;
          const ty = oy - rect.top;

          // Return these values to be used in subsequent frames as 'memo'
          return {
            initialScale: scale,
            initialX: x,
            initialY: y,
            focalX: tx,
            focalY: ty,
          };
        }

        // 2. Retrieve the initial state from memo
        const { initialScale, initialX, initialY, focalX, focalY } = memo;

        // 3. Calculate new position based on the FIXED focal point
        // Math: The point under the cursor (focalX) must remain at focalX.
        // Current world position of focal point: (focalX - initialX) / initialScale
        // New Screen Position = NewWorldPos * NewScale + NewTranslate
        // focalX = ((focalX - initialX) / initialScale) * s + newX

        const newScale = s;
        const nextX = focalX - ((focalX - initialX) / initialScale) * newScale;
        const nextY = focalY - ((focalY - initialY) / initialScale) * newScale;

        setTransform({
          x: nextX,
          y: nextY,
          scale: newScale,
        });

        return memo;
      },

      // 3. Trackpad 2-finger Move / Mouse Wheel = Pan
      onWheel: ({ event, delta: [dx, dy], ctrlKey }) => {
        // If ctrlKey is pressed, it is technically a "pinch" on some trackpads/browsers.
        // We can let onPinch handle that, or handle it here if onPinch doesn't fire.
        // For Figma behavior, standard wheel events (no ctrl) should PAN.

        if (ctrlKey) {
          // Optional: Handle "Ctrl + Wheel" as zoom if onPinch doesn't catch it.
          // Most modern browsers map Ctrl+Wheel to pinch automatically.
          // If you specifically want Ctrl+Wheel to Zoom manually:
          event.preventDefault();
          const { scale } = transform.current;
          const zoomFactor = Math.exp(-dy * 0.01);
          zoomToPoint(scale * zoomFactor, event.clientX, event.clientY);
          return;
        }

        // Standard Pan Logic
        event.preventDefault(); // Prevent browser history navigation (swipe back)
        const { x, y } = transform.current;

        // Subtract delta to mimic "natural" scrolling or Add depending on preference.
        // Standard Figma/Maps: Wheel Down (positive dy) moves view down (content moves up).
        // So we subtract delta.
        setTransform({
          x: x - dx,
          y: y - dy,
        });
      },
    },
    {
      target: containerRef,
      drag: {
        from: () => [transform.current.x, transform.current.y],
        filterTaps: true,
      },
      pinch: {
        scaleBounds: { min: MIN_SCALE, max: MAX_SCALE },
        // Important: 'from' must sync with current scale to avoid jumping
        from: () => [transform.current.scale, 0],
      },
      wheel: {
        eventOptions: { passive: false },
        from: () => [transform.current.x, transform.current.y],
      },
    }
  );

  /* ---------------------------------------------------------------- */
  /*  Fit to Viewport                                                 */
  /* ---------------------------------------------------------------- */
  const getFitToViewportTarget = useCallback(() => {
    const viewport = containerRef.current;
    const canvas = contentRef.current;
    if (!viewport || !canvas) return null;

    const contentWidth = canvas.offsetWidth;
    const contentHeight = canvas.offsetHeight;
    const viewportWidth = viewport.clientWidth;
    const viewportHeight = viewport.clientHeight;

    if (contentWidth === 0 || contentHeight === 0) return null;

    const widthRatio = viewportWidth / contentWidth;
    const heightRatio = viewportHeight / contentHeight;
    const bestFitScale = Math.min(widthRatio, heightRatio) * 0.9;

    const newScale = clamp(bestFitScale, MIN_SCALE, MAX_SCALE);

    const newX = (viewportWidth - contentWidth * newScale) / 2;
    const newY = (viewportHeight - contentHeight * newScale) / 2;

    return { x: newX, y: newY, scale: newScale };
  }, []);

  const fitToViewport = useCallback(
    (animate = false) => {
      const target = getFitToViewportTarget();
      if (!target) return;

      if (animate) {
        animateTo(target.x, target.y, target.scale);
      } else {
        setTransform(target);
      }
    },
    [getFitToViewportTarget, setTransform, animateTo]
  );

  const getResetTarget = useCallback(() => {
    const viewport = containerRef.current;
    const canvas = contentRef.current;
    if (!viewport || !canvas) return null;

    const newScale = 1;
    const newX = (viewport.clientWidth - canvas.offsetWidth) / 2;
    const newY = (viewport.clientHeight - canvas.offsetHeight) / 2;

    return { x: newX, y: newY, scale: newScale };
  }, []);

  const resetToActualPixels = useCallback(
    (animate = false) => {
      const target = getResetTarget();
      if (!target) return;

      if (animate) {
        animateTo(target.x, target.y, target.scale);
      } else {
        setTransform(target);
      }
    },
    [getResetTarget, setTransform, animateTo]
  );

  /* ---------------------------------------------------------------- */
  /*  Lifecycle                                                       */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    if (!isReady) return;
    const timer = setTimeout(() => {
      fitToViewport(false);
    }, 100);
    return () => clearTimeout(timer);
  }, [resolutionKey, isReady, fitToViewport]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      // Optional: Handle resize logic
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-hidden touch-none relative cursor-grab active:cursor-grabbing"
      style={{ touchAction: "none" }}
    >
      {showZoomControls && (
        <ZoomControls
          onPlus={() => {
            const { scale } = transform.current;
            const container = containerRef.current;
            if (container) {
              const rect = container.getBoundingClientRect();
              const target = getZoomTarget(
                scale + ZOOM_STEP,
                rect.left + rect.width / 2,
                rect.top + rect.height / 2
              );
              if (target) animateTo(target.x, target.y, target.scale);
            }
          }}
          onMinus={() => {
            const { scale } = transform.current;
            const container = containerRef.current;
            if (container) {
              const rect = container.getBoundingClientRect();
              const target = getZoomTarget(
                scale - ZOOM_STEP,
                rect.left + rect.width / 2,
                rect.top + rect.height / 2
              );
              if (target) animateTo(target.x, target.y, target.scale);
            }
          }}
          onFit={() => fitToViewport(true)}
          onReset={() => resetToActualPixels(true)}
        />
      )}

      <div
        ref={contentRef}
        className="origin-top-left absolute top-0 left-0 will-change-transform"
      >
        {children}
      </div>
    </div>
  );
}

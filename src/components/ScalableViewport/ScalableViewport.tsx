"use client";

import React, {
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  useGesture
} from "@use-gesture/react";
import clamp from "@/utils/clamp";
import ZoomControls from "@/components/ScalableViewport/components/ZoomControls";

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */
const MIN_SCALE = 0.1;
const MAX_SCALE = 6;

export default function ScalableViewport({
  children,
  initialScale,
  showZoomControls = true,
  resolutionKey,
}: {
  children: ReactNode;
  initialScale?: number;
  resolutionKey?: string;
  showZoomControls?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // We use a ref for the transform state to ensure high-performance updates
  // without triggering React renders on every frame.
  const transform = useRef({
    x: 0,
    y: 0,
    scale: initialScale || 1,
  });

  // We sync the scale to React state occasionally for the UI (ZoomControls)
  const [
    displayScale,
    setDisplayScale
  ] = useState(initialScale || 1);

  /* ---------------------------------------------------------------- */
  /*  DOM Manipulation                                                */
  /* ---------------------------------------------------------------- */
  const updateDom = useCallback(
    () => {
      if (contentRef.current) {
        const {
          x, y, scale
        } = transform.current;

        contentRef.current.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
      }
    },
    [
    ]
  );

  const setTransform = useCallback(
    (newValues: Partial<typeof transform.current>) => {
      transform.current = {
        ...transform.current,
        ...newValues
      };
      updateDom();
      // Sync display scale if it changed
      if (newValues.scale !== undefined) {
        setDisplayScale(newValues.scale);
      }
    },
    [
      updateDom
    ]
  );

  /* ---------------------------------------------------------------- */
  /*  Zoom Logic (Focal Point)                                        */
  /* ---------------------------------------------------------------- */
  const zoomToPoint = useCallback(
    (
      newScale: number, clientX: number, clientY: number
    ) => {
      const container = containerRef.current;

      if (!container) return;

      const rect = container.getBoundingClientRect();
      const {
        x, y, scale
      } = transform.current;

      // Clamp scale
      const clampedScale = clamp(
        newScale,
        MIN_SCALE,
        MAX_SCALE
      );

      // Calculate the point relative to the container
      const relX = clientX - rect.left;
      const relY = clientY - rect.top;

      // Calculate the translation adjustment to keep the focal point fixed
      // Formula: nextX = relX - (relX - currentX) * (nextScale / currentScale)
      const scaleRatio = clampedScale / scale;
      const nextX = relX - (relX - x) * scaleRatio;
      const nextY = relY - (relY - y) * scaleRatio;

      setTransform({
        x: nextX,
        y: nextY,
        scale: clampedScale,
      });
    },
    [
      setTransform
    ]
  );

  /* ---------------------------------------------------------------- */
  /*  Gestures                                                        */
  /* ---------------------------------------------------------------- */
  useGesture(
    {
      onDrag: ({
        offset: [
          x,
          y
        ]
      }) => {
        setTransform({
          x,
          y
        });
      },
      onPinch: ({
        origin: [
          ox,
          oy
        ], offset: [
          s
        ], memo
      }) => {
        // use-gesture handles the scale accumulation in `offset`
        // We need to handle the focal point translation manually.
        // `memo` stores the previous scale to calculate delta.

        const previousScale = memo ?? transform.current.scale;
        const newScale = s;

        // Re-implement focal logic for incremental updates:
        const container = containerRef.current;

        if (!container) return previousScale;

        const rect = container.getBoundingClientRect();
        const relX = ox - rect.left;
        const relY = oy - rect.top;

        const {
          x, y
        } = transform.current;
        const scaleRatio = newScale / previousScale;

        const nextX = relX - (relX - x) * scaleRatio;
        const nextY = relY - (relY - y) * scaleRatio;

        setTransform({
          x: nextX,
          y: nextY,
          scale: newScale
        });

        return newScale;
      },
      onWheel: ({
        event, delta: [
          dx,
          dy
        ], ctrlKey
      }) => {
        // If ctrlKey is pressed, it's a trackpad pinch (handled by onPinch usually).
        if (ctrlKey) return;

        // Ignore horizontal scrolling for zoom
        if (Math.abs(dx) > Math.abs(dy)) return;

        event.preventDefault();

        const {
          scale
        } = transform.current;
        // Determine zoom factor.
        // dy > 0 means scrolling down (zoom out usually), dy < 0 means scrolling up (zoom in).
        // Adjust sensitivity as needed.
        const zoomFactor = Math.exp(-dy * 0.002);
        const newScale = scale * zoomFactor;

        zoomToPoint(
          newScale,
          event.clientX,
          event.clientY
        );
      },
    },
    {
      target: containerRef,
      drag: {
        from: () => [
          transform.current.x,
          transform.current.y
        ],
        // Prevent text selection while dragging
        filterTaps: true,
      },
      pinch: {
        scaleBounds: {
          min: MIN_SCALE,
          max: MAX_SCALE
        },
        modifierKey: null, // Handle all pinches (touch + trackpad)
        from: () => [
          transform.current.scale,
          0
        ], // 0 is rotation, we ignore it
      },
      wheel: {
        eventOptions: {
          passive: false
        },
        // Only prevent default if we are actually zooming (vertical)
        preventDefault: true,
      },
    }
  );

  /* ---------------------------------------------------------------- */
  /*  Fit to Viewport                                                 */
  /* ---------------------------------------------------------------- */
  const fitToViewport = useCallback(
    () => {
      const viewport = containerRef.current;
      const canvas = contentRef.current;

      if (!viewport || !canvas) return;

      // Reset transform temporarily to get natural size?
      // Or just use offsetWidth/Height which are unscaled?
      // offsetWidth/Height include scale transforms in some browsers/contexts,
      // but usually clientWidth/Height on the element itself are pre-transform if we measure correctly.
      // Actually, `getBoundingClientRect` is affected by transform. `offsetWidth` is usually not?
      // Let's use the natural dimensions.

      const contentWidth = canvas.offsetWidth;
      const contentHeight = canvas.offsetHeight;
      const viewportWidth = viewport.clientWidth;
      const viewportHeight = viewport.clientHeight;

      if (contentWidth === 0 || contentHeight === 0) return;

      const widthRatio = viewportWidth / contentWidth;
      const heightRatio = viewportHeight / contentHeight;
      const bestFitScale = Math.min(
        widthRatio,
        heightRatio
      ) * 0.9; // 90% fit

      const newScale = clamp(
        bestFitScale,
        MIN_SCALE,
        MAX_SCALE
      );

      // Center it
      const newX = (viewportWidth - contentWidth * newScale) / 2;
      const newY = (viewportHeight - contentHeight * newScale) / 2;

      setTransform({
        x: newX,
        y: newY,
        scale: newScale
      });
    },
    [
      setTransform
    ]
  );

  const resetToActualPixels = useCallback(
    () => {
      const viewport = containerRef.current;
      const canvas = contentRef.current;

      if (!viewport || !canvas) return;

      const newScale = 1;
      // Center
      const newX = (viewport.clientWidth - canvas.offsetWidth) / 2;
      const newY = (viewport.clientHeight - canvas.offsetHeight) / 2;

      setTransform({
        x: newX,
        y: newY,
        scale: newScale
      });
    },
    [
      setTransform
    ]
  );

  /* ---------------------------------------------------------------- */
  /*  Lifecycle                                                       */
  /* ---------------------------------------------------------------- */
  // Initial fit and fit on resolution change
  useEffect(
    () => {
      // Small timeout to ensure layout is ready
      const timer = setTimeout(
        () => {
          // Always fit to viewport when resolution changes or on initial load
          fitToViewport();
        },
        100 // Increased timeout to ensure canvas is rendered with new dimensions
      );

      return () => clearTimeout(timer);
    },
    [
      resolutionKey,
      fitToViewport,
      setTransform
    ]
  );

  // Resize observer
  useEffect(
    () => {
      if (!containerRef.current) return;
      const observer = new ResizeObserver(() => {
        // Optional: Refit on resize? Or just keep current scale/pos?
        // Usually keeping relative pos is hard.
        // Let's just do nothing or maybe clamp bounds?
        // User asked for "stable".
        // Let's leave it as is, or maybe re-center if it was centered?
        // For now, let's not force re-fit to avoid annoying jumps during window resize.
      });

      observer.observe(containerRef.current);
      return () => observer.disconnect();
    },
    [
    ]
  );

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-hidden touch-none relative cursor-grab active:cursor-grabbing"
      style={{
        touchAction: "none"
      }}
    >
      {showZoomControls && (
        <ZoomControls
          onPlus={() => {
            const {
              scale, x, y
            } = transform.current;
            const container = containerRef.current;

            if (container) {
              const rect = container.getBoundingClientRect();

              // Zoom to center of viewport
              zoomToPoint(
                scale + 0.5,
                rect.left + rect.width / 2,
                rect.top + rect.height / 2
              );
            }
          }}
          onMinus={() => {
            const {
              scale
            } = transform.current;
            const container = containerRef.current;

            if (container) {
              const rect = container.getBoundingClientRect();

              zoomToPoint(
                scale - 0.5,
                rect.left + rect.width / 2,
                rect.top + rect.height / 2
              );
            }
          }}
          onFit={fitToViewport}
          onReset={resetToActualPixels}
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

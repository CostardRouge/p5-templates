import {
  useCallback
} from "react";
import type {
  TransformState
} from "./useTransformState";
import {
  calculateFitToViewport,
  calculateActualPixels,
  calculateZoomTarget,
  FIT_MARGIN_FACTOR,
  ZOOM_STEP_FACTOR
} from "../utils/zoomCalculations";

type LayoutCalculation = (
  contentWidth: number,
  contentHeight: number,
  viewportWidth: number,
  viewportHeight: number
) => TransformState;

interface UseViewportActionsProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
  transform: React.MutableRefObject<TransformState>;
  setTransform: (
    values: Partial<TransformState>,
    contentElement: HTMLDivElement | null
  ) => void;
  animateTo: ( targetX: number, targetY: number, targetScale: number ) => void;
  /** Fraction of the viewport a fit fills — 1 puts the content flush with the edges. */
  fitMarginFactor?: number;
}

export function useViewportActions( {
  containerRef,
  contentRef,
  transform,
  setTransform,
  animateTo,
  fitMarginFactor = FIT_MARGIN_FACTOR
}: UseViewportActionsProps ) {
  const applyLayout = useCallback(
    (
      calculate: LayoutCalculation, animate: boolean
    ) => {
      const viewport = containerRef.current;
      const canvas = contentRef.current;

      if ( !viewport || !canvas ) {
        return;
      }

      const {
        x, y, scale
      } = calculate(
        canvas.offsetWidth,
        canvas.offsetHeight,
        viewport.clientWidth,
        viewport.clientHeight
      );

      if ( animate ) {
        animateTo(
          x,
          y,
          scale
        );
      } else {
        setTransform(
          {
            x,
            y,
            scale
          },
          canvas
        );
      }
    },
    [
      containerRef,
      contentRef,
      setTransform,
      animateTo
    ]
  );

  const fitToViewport = useCallback(
    ( animate = false ) => applyLayout(
      (
        contentWidth, contentHeight, viewportWidth, viewportHeight
      ) => calculateFitToViewport(
        contentWidth,
        contentHeight,
        viewportWidth,
        viewportHeight,
        fitMarginFactor
      ),
      animate
    ),
    [
      applyLayout,
      fitMarginFactor
    ]
  );

  const resetToActualPixels = useCallback(
    ( animate = false ) => applyLayout(
      calculateActualPixels,
      animate
    ),
    [
      applyLayout
    ]
  );

  const zoomBy = useCallback(
    ( factor: number ) => {
      const container = containerRef.current;

      if ( !container ) {
        return;
      }

      const rect = container.getBoundingClientRect();
      const target = calculateZoomTarget(
        transform.current.scale * factor,
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
        rect,
        transform.current
      );

      animateTo(
        target.x,
        target.y,
        target.scale
      );
    },
    [
      containerRef,
      transform,
      animateTo
    ]
  );

  const zoomIn = useCallback(
    () => zoomBy( ZOOM_STEP_FACTOR ),
    [
      zoomBy
    ]
  );

  const zoomOut = useCallback(
    () => zoomBy( 1 / ZOOM_STEP_FACTOR ),
    [
      zoomBy
    ]
  );

  return {
    fitToViewport,
    resetToActualPixels,
    zoomIn,
    zoomOut
  };
}

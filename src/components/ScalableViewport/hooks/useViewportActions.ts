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
  ZOOM_STEP
} from "../utils/zoomCalculations";

interface UseViewportActionsProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
  transform: React.MutableRefObject<TransformState>;
  setTransform: (
    values: Partial<TransformState>,
    contentElement: HTMLDivElement | null
  ) => void;
  animateTo: ( targetX: number, targetY: number, targetScale: number ) => void;
}

export function useViewportActions( {
  containerRef,
  contentRef,
  transform,
  setTransform,
  animateTo
}: UseViewportActionsProps ) {
  const fitToViewport = useCallback(
    ( animate = false ) => {
      const viewport = containerRef.current;
      const canvas = contentRef.current;

      if ( !viewport || !canvas ) {
        return;
      }

      const contentWidth = canvas.offsetWidth;
      const contentHeight = canvas.offsetHeight;
      const viewportWidth = viewport.clientWidth;
      const viewportHeight = viewport.clientHeight;

      const {
        x, y, scale
      } = calculateFitToViewport(
        contentWidth,
        contentHeight,
        viewportWidth,
        viewportHeight
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
          contentRef.current
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

  const resetToActualPixels = useCallback(
    ( animate = false ) => {
      const viewport = containerRef.current;
      const canvas = contentRef.current;

      if ( !viewport || !canvas ) {
        return;
      }

      const contentWidth = canvas.offsetWidth;
      const contentHeight = canvas.offsetHeight;
      const viewportWidth = viewport.clientWidth;
      const viewportHeight = viewport.clientHeight;

      const {
        x, y, scale
      } = calculateActualPixels(
        contentWidth,
        contentHeight,
        viewportWidth,
        viewportHeight
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
          contentRef.current
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

  const zoomIn = useCallback(
    () => {
      const {
        scale
      } = transform.current;
      const container = containerRef.current;

      if ( container ) {
        const rect = container.getBoundingClientRect();
        const target = calculateZoomTarget(
          scale + ZOOM_STEP,
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
      }
    },
    [
      containerRef,
      transform,
      animateTo
    ]
  );

  const zoomOut = useCallback(
    () => {
      const {
        scale
      } = transform.current;
      const container = containerRef.current;

      if ( container ) {
        const rect = container.getBoundingClientRect();
        const target = calculateZoomTarget(
          scale - ZOOM_STEP,
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
      }
    },
    [
      containerRef,
      transform,
      animateTo
    ]
  );

  return {
    fitToViewport,
    resetToActualPixels,
    zoomIn,
    zoomOut
  };
}

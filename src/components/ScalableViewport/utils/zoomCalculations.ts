import clamp from "@/utils/clamp";
import type {
  TransformState
} from "../hooks/useTransformState";

export const MIN_SCALE = 0.1;
export const MAX_SCALE = 6;
export const ZOOM_STEP = 0.2;

export function calculateZoomTarget(
  newScale: number,
  clientX: number,
  clientY: number,
  containerRect: DOMRect,
  currentTransform: TransformState
): TransformState {
  const {
    x, y, scale
  } = currentTransform;
  const clampedScale = clamp(
    newScale,
    MIN_SCALE,
    MAX_SCALE
  );

  const relativeX = clientX - containerRect.left;
  const relativeY = clientY - containerRect.top;

  // Standard point-zoom math:
  // NewOffset = MousePos - (MousePos - OldOffset) * (NewScale / OldScale)
  const scaleRatio = clampedScale / scale;
  const nextX = relativeX - ( relativeX - x ) * scaleRatio;
  const nextY = relativeY - ( relativeY - y ) * scaleRatio;

  return {
    x: nextX,
    y: nextY,
    scale: clampedScale
  };
}

export function calculateFitToViewport(
  contentWidth: number,
  contentHeight: number,
  viewportWidth: number,
  viewportHeight: number
): TransformState {
  if ( contentWidth === 0 || contentHeight === 0 ) {
    return {
      x: 0,
      y: 0,
      scale: 1
    };
  }

  const widthRatio = viewportWidth / contentWidth;
  const heightRatio = viewportHeight / contentHeight;
  const bestFitScale = Math.min(
    widthRatio,
    heightRatio
  ) * 0.9;
  const newScale = clamp(
    bestFitScale,
    MIN_SCALE,
    MAX_SCALE
  );

  const newX = ( viewportWidth - contentWidth * newScale ) / 2;
  const newY = ( viewportHeight - contentHeight * newScale ) / 2;

  return {
    x: newX,
    y: newY,
    scale: newScale
  };
}

export function calculateActualPixels(
  contentWidth: number,
  contentHeight: number,
  viewportWidth: number,
  viewportHeight: number
): TransformState {
  const newScale = 1;
  const newX = ( viewportWidth - contentWidth ) / 2;
  const newY = ( viewportHeight - contentHeight ) / 2;

  return {
    x: newX,
    y: newY,
    scale: newScale
  };
}

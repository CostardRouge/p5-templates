import {
  setSketchOptions
} from "@/p5/shared/syncSketchOptions.js";

import options from "@/p5/utils/options.js";
import animation from "@/p5/utils/animation.js";
import * as common from "@/p5/utils/common.js";
import mappers from "@/p5/utils/mappers.js";
import easing from "@/p5/utils/easing.js";
import events from "@/p5/utils/events.js";
import graphics from "@/p5/utils/graphics.js";
import imageUtils from "@/p5/utils/imageUtils.js";
import sketch from "@/p5/utils/sketch.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";

const sketchState = {
  photoGraphics: null,
  photoRect: null,
  focusUV: null,
  viewTransform: {
    scale: 1,
    tx: 0,
    ty: 0,
  },
  lastPointer: {
    at: 0,
  },
  lastSelectedCanvasPoint: null,
};

function getClientPositionFromEvent( event ) {
  if ( !event ) return null;

  // TouchEvent (mobile)
  const anyEvent = event;
  const touch = anyEvent.touches?.[ 0 ] ?? anyEvent.changedTouches?.[ 0 ];

  if ( touch ) {
    return {
      clientX: touch.clientX,
      clientY: touch.clientY,
    };
  }

  // MouseEvent / PointerEvent
  if (
    typeof anyEvent.clientX === "number" &&
    typeof anyEvent.clientY === "number"
  ) {
    return {
      clientX: anyEvent.clientX,
      clientY: anyEvent.clientY,
    };
  }

  return null;
}

function getCanvasPositionFromEvent( event ) {
  const canvasElement = sketch.engine?.getCanvasElement?.();

  if ( !canvasElement ) {
    return {
      x: mouseX,
      y: mouseY,
    };
  }

  const clientPos = getClientPositionFromEvent( event );

  if ( !clientPos ) {
    return {
      x: mouseX,
      y: mouseY,
    };
  }

  const rect = canvasElement.getBoundingClientRect();

  if ( rect.width === 0 || rect.height === 0 ) {
    return {
      x: mouseX,
      y: mouseY,
    };
  }

  // Map DOM pixels (post-CSS transform) → canvas pixels
  return {
    x: ( ( clientPos.clientX - rect.left ) * width ) / rect.width,
    y: ( ( clientPos.clientY - rect.top ) * height ) / rect.height,
  };
}

function setZoomFocusFromCanvasPoint( canvasPoint ) {
  const {
    photoRect, viewTransform
  } = sketchState;

  if ( !photoRect ) return;

  // Inverse of the photoGraphics transform applied in draw()
  const unscaledX = ( canvasPoint.x - viewTransform.tx ) / viewTransform.scale;
  const unscaledY = ( canvasPoint.y - viewTransform.ty ) / viewTransform.scale;

  const isInsidePhoto =
    unscaledX >= photoRect.x &&
    unscaledX <= photoRect.x + photoRect.w &&
    unscaledY >= photoRect.y &&
    unscaledY <= photoRect.y + photoRect.h;

  if ( !isInsidePhoto ) return;

  sketchState.focusUV = {
    u: ( unscaledX - photoRect.x ) / photoRect.w,
    v: ( unscaledY - photoRect.y ) / photoRect.h,
  };
}

function handlePointerSelect( canvasPoint ) {
  const now = performance.now();

  // Avoid double-firing (canvas + window handlers)
  if ( now - sketchState.lastPointer.at < 50 ) {
    return;
  }

  sketchState.lastPointer.at = now;
  sketchState.lastSelectedCanvasPoint = canvasPoint;

  setZoomFocusFromCanvasPoint( canvasPoint );

  setSketchOptions( {
    ...options,
    sketch: {
      ...options.sketch,
      point: {
        x: canvasPoint.x,
        y: canvasPoint.y,
      },
    },
  } );
}

sketch.setup( () => {
  background( ...options.sketch.backgroundColor );

  sketchState.photoGraphics = graphics.createAutoResizableGraphics(
    width,
    height
  );

  // Restore persisted point (if any)
  if ( options.sketch?.point ) {
    sketchState.lastSelectedCanvasPoint = {
      x: options.sketch.point.x,
      y: options.sketch.point.y,
    };
  }
} );

events.register(
  "engine-canvas-mouse-clicked",
  ( event ) => {
    const canvasPoint = getCanvasPositionFromEvent( event );

    handlePointerSelect( canvasPoint );
  }
);

// Fallback for environments where canvas mouseClicked isn’t available
// (this can fire too on some platforms, so handlePointerSelect dedupes)
events.register(
  "engine-mouse-clicked",
  ( event ) => {
    const canvasPoint = getCanvasPositionFromEvent( event );

    handlePointerSelect( canvasPoint );
  }
);

sketch.draw( () => {
  clear();
  background( ...options.sketch.backgroundColor );

  const photo = common.getAsset( options.sketch.photo );

  if ( !photo?.img ) {
    return;
  }

  sketchState.photoGraphics.clear();

  // If a point was persisted, convert it to UV once
  if ( !sketchState.focusUV && options.sketch?.point ) {
    setZoomFocusFromCanvasPoint( options.sketch.point );
  }

  // Required timing snippet
  const images = [
    photo
  ];
  const zoomStep = mappers.fn(
    animation.triangleProgression( options.sketch.zoom.count ?? 1 ),
    0,
    1,
    0,
    images.length,
    easing?.[ options.sketch.zoom.easing ] ?? easing.easeInOutExpo
  );

  const zoomProgress = constrain(
    zoomStep / Math.max(
      1,
      images.length
    ),
    0,
    1
  );

  const zoomScale = lerp(
    options.sketch.zoom.minZoomScale ?? 1,
    options.sketch.zoom.maxZoomScale ?? 3,
    zoomProgress
  );

  const previousRect = sketchState.photoRect;
  const focusPoint = previousRect
    ? sketchState.focusUV
      ? {
        x: previousRect.x + sketchState.focusUV.u * previousRect.w,
        y: previousRect.y + sketchState.focusUV.v * previousRect.h,
      }
      : {
        x: previousRect.x + previousRect.w / 2,
        y: previousRect.y + previousRect.h / 2,
      }
    : {
      x: width / 2,
      y: height / 2,
    };

  // Translation to keep focusPoint centered during zoom
  const tx = width / 2 - focusPoint.x * zoomScale;
  const ty = height / 2 - focusPoint.y * zoomScale;

  sketchState.viewTransform = {
    scale: zoomScale,
    tx,
    ty,
  };

  sketchState.photoGraphics.push();
  sketchState.photoGraphics.translate(
    tx,
    ty
  );
  sketchState.photoGraphics.scale( zoomScale );

  imageUtils.marginImage( {
    position: createVector(
      width / 2,
      height / 2
    ),
    graphics: sketchState.photoGraphics,
    margin: width * options.sketch?.imageSettings?.margin,
    scale: options.sketch?.imageSettings?.scale ?? 1,
    center: options.sketch?.imageSettings?.center ?? true,
    clip: options.sketch?.imageSettings?.clip ?? false,
    fill: options.sketch?.imageSettings?.fill ?? true,
    img: photo.img,
    callback: (
      x, y, w, h
    ) => {
      sketchState.photoRect = {
        x,
        y,
        w,
        h,
      };
    },
  } );

  sketchState.photoGraphics.pop();

  image(
    sketchState.photoGraphics,
    0,
    0
  );

  if ( sketchState.photoRect && sketchState.focusUV ) {
    const focusX =
      sketchState.photoRect.x + sketchState.focusUV.u * sketchState.photoRect.w;
    const focusY =
      sketchState.photoRect.y + sketchState.focusUV.v * sketchState.photoRect.h;

    const focusScreenX =
      focusX * sketchState.viewTransform.scale + sketchState.viewTransform.tx;
    const focusScreenY =
      focusY * sketchState.viewTransform.scale + sketchState.viewTransform.ty;

    if ( options.sketch.circle.draw ?? true ) {
      push();
      noFill();
      stroke( ...( options.sketch.circle.stroke ?? [
        255
      ] ) );
      strokeWeight( options.sketch.circle.strokeWeight ?? 3 );
      circle(
        focusScreenX,
        focusScreenY,
        options.sketch.circle.radius ?? 24
      );
      pop();
    }
  }

  renderTitle();
} );

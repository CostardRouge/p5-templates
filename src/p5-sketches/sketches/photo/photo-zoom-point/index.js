import options from "@/p5/utils/options.js";

import animation from "@/p5/utils/animation.js";
import * as common from "@/p5/utils/common.js";
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
    type: null,
    at: 0,
  },
  touchTap: {
    active: false,
    moved: false,
    at: 0,
    startCanvasPoint: null,
  },
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

function handlePointerSelect(
  canvasPoint, pointerType
) {
  const now = performance.now();

  // A tap on mobile often triggers a synthetic mouse event.
  if (
    sketchState.lastPointer.type === "touch" &&
    pointerType === "mouse" &&
    now - sketchState.lastPointer.at < 750
  ) {
    return;
  }

  sketchState.lastPointer = {
    type: pointerType,
    at: now,
  };

  setZoomFocusFromCanvasPoint( canvasPoint );
}

sketch.setup( () => {
  background( ...options.sketch.backgroundColor );

  sketchState.photoGraphics = graphics.createAutoResizableGraphics(
    width,
    height
  );
} );

events.register(
  "engine-canvas-mouse-clicked",
  ( event ) => {
    const canvasPoint = getCanvasPositionFromEvent( event );

    handlePointerSelect(
      canvasPoint,
      "mouse"
    );
  }
);

// Fallback for environments where canvas mouseClicked isn’t available
events.register(
  "engine-mouse-clicked",
  ( event ) => {
    const canvasPoint = getCanvasPositionFromEvent( event );

    handlePointerSelect(
      canvasPoint,
      "mouse"
    );
  }
);

// Mobile tap detection (avoid triggering while panning/pinching the viewport)
events.register(
  "engine-touch-started",
  ( event ) => {
    const touchCount = event?.touches?.length ?? 0;

    if ( touchCount !== 1 ) {
      sketchState.touchTap.active = false;
      return;
    }

    sketchState.touchTap.active = true;
    sketchState.touchTap.moved = false;
    sketchState.touchTap.at = performance.now();
    sketchState.touchTap.startCanvasPoint = getCanvasPositionFromEvent( event );
  }
);

events.register(
  "engine-touch-moved",
  ( event ) => {
    if ( !sketchState.touchTap.active || sketchState.touchTap.moved ) return;

    const touchCount = event?.touches?.length ?? 0;

    if ( touchCount !== 1 ) {
      sketchState.touchTap.active = false;
      return;
    }

    const currentCanvasPoint = getCanvasPositionFromEvent( event );
    const startCanvasPoint = sketchState.touchTap.startCanvasPoint;

    if ( !startCanvasPoint ) return;

    const dx = currentCanvasPoint.x - startCanvasPoint.x;
    const dy = currentCanvasPoint.y - startCanvasPoint.y;

    if ( Math.hypot(
      dx,
      dy
    ) > 12 ) {
      sketchState.touchTap.moved = true;
    }
  }
);

events.register(
  "engine-touch-ended",
  ( event ) => {
    if ( !sketchState.touchTap.active ) return;

    const elapsed = performance.now() - sketchState.touchTap.at;
    const startCanvasPoint = sketchState.touchTap.startCanvasPoint;

    sketchState.touchTap.active = false;

    if ( sketchState.touchTap.moved || elapsed > 400 || !startCanvasPoint ) {
      return;
    }

    const endCanvasPoint = getCanvasPositionFromEvent( event ) ?? startCanvasPoint;

    handlePointerSelect(
      endCanvasPoint,
      "touch"
    );
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

  // Required timing snippet
  const images = [
    photo
  ];
  const zoomStep = map(
    animation.triangleProgression( 2 ),
    0,
    1,
    0,
    images.length,
    easing.easeInOutBack
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
    1,
    6,
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
    margin: width * options.sketch?.margin,
    scale: options.sketch?.scale ?? 1,
    center: options.sketch?.center ?? true,
    clip: options.sketch?.clip ?? false,
    fill: options.sketch?.fill ?? true,
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

  renderTitle();
} );

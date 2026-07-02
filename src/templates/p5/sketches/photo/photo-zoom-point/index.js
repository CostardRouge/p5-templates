import options from "@/p5/utils/options.js";
import {
  setSketchOptions
} from "@/p5/shared/syncSketchOptions.js";
import animation from "@/p5/utils/animation.js";
import * as common from "@/p5/utils/common.js";
import string from "@/p5/utils/string.js";
import easing from "@/p5/utils/easing.js";
import events from "@/p5/utils/events.js";
import graphics from "@/p5/utils/graphics.js";
import imageUtils from "@/p5/utils/imageUtils.js";
import mappers from "@/p5/utils/mappers.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";

const sketchState = {
  photoGraphics: null,
  // Where the image sits inside the unscaled buffer
  photoRect: {
    x: 0,
    y: 0,
    w: 0,
    h: 0
  },
  // The current visual transform (updated every draw loop)
  // We need this to "reverse math" where you clicked
  viewTransform: {
    x: 0,
    y: 0,
    scale: 1
  }
};

/**
 * 1. ROBUST p.SCREEN-TO-CANVAS MAPPING
 * Handles the canvas being inside a draggable/zoomable div.
 */
function getInternalCanvasPoint( event ) {
  const p = getP5();
  const canvasElement = sketch.engine?.getCanvasElement?.();

  if ( !canvasElement ) {
    return null;
  }

  // getBoundingClientRect gives the actual size/pos on screen,
  // accounting for any CSS scaling or parent transforms.
  const rect = canvasElement.getBoundingClientRect();

  const clientX = event.touches?.[ 0 ]?.clientX ?? event.changedTouches?.[ 0 ]?.clientX ?? event.clientX;
  const clientY = event.touches?.[ 0 ]?.clientY ?? event.changedTouches?.[ 0 ]?.clientY ?? event.clientY;

  if ( typeof clientX !== "number" || typeof clientY !== "number" ) {
    return null;
  }

  // Normalize to 0-1 based on the DOM element size
  const relX = ( clientX - rect.left ) / rect.width;
  const relY = ( clientY - rect.top ) / rect.height;

  // Scale up to the internal P5 canvas resolution
  return {
    x: relX * p.width,
    y: relY * p.height
  };
}

/**
 * 2. REVERSE TRANSFORM LOGIC
 * We take the screen click, reverse the zoom/pan, and find the UV on the photo.
 */
function handlePointerSelect( screenPoint ) {
  if ( !screenPoint ) {
    return;
  }

  // Retrieve the transform active at the moment of the click
  const {
    x: tx,
    y: ty,
    scale: currentScale
  } = sketchState.viewTransform;
  const {
    x: imgX,
    y: imgY,
    w: imgW,
    h: imgH
  } = sketchState.photoRect;

  // A. Un-project: Convert Screen Pixel -> Buffer Pixel
  // Formula: (Screen - Translate) / Scale
  const bufferX = ( screenPoint.x - tx ) / currentScale;
  const bufferY = ( screenPoint.y - ty ) / currentScale;

  // B. Check collision with the photo inside the buffer
  const isInside =
    bufferX >= imgX &&
    bufferX <= imgX + imgW &&
    bufferY >= imgY &&
    bufferY <= imgY + imgH;

  if ( !isInside ) {
    return;
  }

  // C. Calculate UV (0.0 to 1.0)
  const uvPoint = {
    x: ( bufferX - imgX ) / imgW,
    y: ( bufferY - imgY ) / imgH
  };

  // D. Save Update
  const currentSlideIndex = getP5().getCurrentSlide?.().index;
  const sketchUpdate = {
    point: uvPoint
  };

  if (
    typeof currentSlideIndex === "number" &&
    Array.isArray( options.slides ) &&
    options.slides[ currentSlideIndex ]
  ) {
    const nextSlides = options.slides.map( (
      slide, idx
    ) =>
      idx === currentSlideIndex
        ? {
          ...slide,
          sketch: {
            ...( slide?.sketch ?? {} ),
            ...sketchUpdate
          }
        }
        : slide );

    setSketchOptions(
      {
        slides: nextSlides
      },
      "p5"
    );
  } else {
    setSketchOptions(
      {
        sketch: sketchUpdate
      },
      "p5"
    );
  }
}

sketch.setup( () => {
  const p = getP5();

  p.background( ...options.sketch.backgroundColor );
  sketchState.photoGraphics = graphics.createAutoResizableGraphics(
    p.width,
    p.height
  );

  // Initialize Rect immediately to prevent null errors on start
  const photo = common.getAsset( options.sketch.photo );

  if ( photo?.img ) {
    displayPhoto( photo.img );
  }
} );

events.register(
  "engine-canvas-mouse-clicked",
  ( event ) => {
    const p = getP5();
    const screenPoint = getInternalCanvasPoint( event );

    handlePointerSelect( screenPoint );
  }
);

function displayPhoto( img ) {
  const p = getP5();

  sketchState.photoGraphics.clear();
  imageUtils.marginImage( {
    position: p.createVector(
      p.width / 2,
      p.height / 2
    ),
    graphics: sketchState.photoGraphics,
    margin: p.width * ( options.sketch?.imageSettings?.margin ?? 0 ),
    scale: options.sketch?.imageSettings?.scale ?? 1,
    center: options.sketch?.imageSettings?.center ?? true,
    clip: options.sketch?.imageSettings?.clip ?? false,
    fill: options.sketch?.imageSettings?.fill ?? true,
    img,
    callback: (
      cx, cy, w, h
    ) => {
      // marginImage passes the anchor point (center when center:true).
      // Normalize to top-left so collision and UV math are consistent.
      const isCenter = options.sketch?.imageSettings?.center ?? true;

      sketchState.photoRect = {
        x: isCenter ? cx - w / 2 : cx,
        y: isCenter ? cy - h / 2 : cy,
        w,
        h
      };
    }
  } );
}

sketch.draw( () => {
  const p = getP5();

  p.clear();
  p.background( ...options.sketch.backgroundColor );

  const photo = common.getAsset( options.sketch.photo );

  if ( !photo?.img ) {
    string.write(
      "photo-zoom-point:\n\nadd a photo :)",
      0,
      0,
      {
        size: 72,
        stroke: p.color(
          0,
          0,
          0,
          0
        ),
        fill: p.color( 0 ),
        textHeight: p.height,
        font: string.fonts.martian,
        textAlign: [
          p.CENTER,
          p.CENTER
        ]
      }
    );
    return;
  }

  // 1. Draw Image to Buffer (Unscaled)
  displayPhoto( photo.img );

  // 2. Animation Logic
  // Loop-exact clock: triangleProgression only lands back on its start value
  // when the cycle count completes a WHOLE number of triangle waves per loop
  // (a fractional count leaves progress = count % 1 !== 0 at the seam) — so
  // the raw slider count is snapped to whole cycles per loop.
  const zoomCycles = Math.round( options.sketch.zoom.count ?? 1 );

  const zoomStep = mappers.fn(
    animation.triangleProgression( zoomCycles ),
    0,
    1,
    0,
    1,
    easing?.[ options.sketch.zoom.easing ] ?? easing.easeInOutExpo
  );

  const zoomScale = p.lerp(
    options.sketch.zoom.minZoomScale ?? 1,
    options.sketch.zoom.maxZoomScale ?? 3,
    zoomStep
  );

  // 3. Focus Point Logic
  const uvPoint = options.sketch.point ?? {
    x: 0.5,
    y: 0.5
  };
  const {
    x,
    y,
    w,
    h
  } = sketchState.photoRect;

  // Convert UV -> Buffer Pixel
  const focusX = x + ( uvPoint.x * w );
  const focusY = y + ( uvPoint.y * h );

  // 4. Calculate Center Transform
  // We want the focusPoint to land exactly at (p.width/2, p.height/2)
  const tx = ( p.width / 2 ) - ( focusX * zoomScale );
  const ty = ( p.height / 2 ) - ( focusY * zoomScale );

  // 5. IMPORTANT: Update State for the Click Handler
  // This allows handlePointerSelect to know "where" the image was during this frame
  sketchState.viewTransform = {
    x: tx,
    y: ty,
    scale: zoomScale
  };

  // 6. Apply & Draw
  p.push();
  p.translate(
    tx,
    ty
  );
  p.scale( zoomScale );

  p.image(
    sketchState.photoGraphics,
    0,
    0
  );

  // Draw Marker (Circle) at the specific focus point in Buffer Space
  if ( options.sketch.circle?.draw ?? true ) {
    p.noFill();
    p.stroke( ...( options.sketch.circle.stroke ?? [
      255
    ] ) );
    p.strokeWeight( ( options.sketch.circle.strokeWeight ?? 3 ) / zoomScale );
    p.circle(
      focusX,
      focusY,
      ( options.sketch.circle.radius ?? 24 ) / zoomScale
    );
  }
  p.pop();

  renderTitle();
} );
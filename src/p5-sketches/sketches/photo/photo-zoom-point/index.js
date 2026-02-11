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
import sketch from "@/p5/utils/sketch.js";
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
  },
};

/**
 * 1. ROBUST SCREEN-TO-CANVAS MAPPING
 * Handles the canvas being inside a draggable/zoomable div.
 */
function getInternalCanvasPoint( event ) {
  const canvasElement = sketch.engine?.getCanvasElement?.();

  if ( !canvasElement ) return null;

  // getBoundingClientRect gives the actual size/pos on screen,
  // accounting for any CSS scaling or parent transforms.
  const rect = canvasElement.getBoundingClientRect();

  const clientX = event.touches?.[ 0 ]?.clientX ?? event.changedTouches?.[ 0 ]?.clientX ?? event.clientX;
  const clientY = event.touches?.[ 0 ]?.clientY ?? event.changedTouches?.[ 0 ]?.clientY ?? event.clientY;

  if ( typeof clientX !== "number" || typeof clientY !== "number" ) return null;

  // Normalize to 0-1 based on the DOM element size
  const relX = ( clientX - rect.left ) / rect.width;
  const relY = ( clientY - rect.top ) / rect.height;

  // Scale up to the internal P5 canvas resolution
  return {
    x: relX * width,
    y: relY * height,
  };
}

/**
 * 2. REVERSE TRANSFORM LOGIC
 * We take the screen click, reverse the zoom/pan, and find the UV on the photo.
 */
function handlePointerSelect( screenPoint ) {
  if ( !screenPoint ) return;

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

  if ( !isInside ) return;

  // C. Calculate UV (0.0 to 1.0)
  const uvPoint = {
    x: ( bufferX - imgX ) / imgW,
    y: ( bufferY - imgY ) / imgH,
  };

  // D. Save Update
  const currentSlideIndex = window.getCurrentSlide?.().index;
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
            ...( slide?.sketch ?? {
            } ),
            ...sketchUpdate
          },
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
  background( ...options.sketch.backgroundColor );
  sketchState.photoGraphics = graphics.createAutoResizableGraphics(
    width,
    height
  );

  // Initialize Rect immediately to prevent null errors on start
  const photo = common.getAsset( options.sketch.photo );

  if ( photo?.img ) displayPhoto( photo.img );
} );

events.register(
  "engine-canvas-mouse-clicked",
  ( event ) => {
    const screenPoint = getInternalCanvasPoint( event );

    handlePointerSelect( screenPoint );
  }
);

function displayPhoto( img ) {
  sketchState.photoGraphics.clear();
  imageUtils.marginImage( {
    position: createVector(
      width / 2,
      height / 2
    ),
    graphics: sketchState.photoGraphics,
    margin: width * ( options.sketch?.imageSettings?.margin ?? 0 ),
    scale: options.sketch?.imageSettings?.scale ?? 1,
    center: options.sketch?.imageSettings?.center ?? true,
    clip: options.sketch?.imageSettings?.clip ?? false,
    fill: options.sketch?.imageSettings?.fill ?? true,
    img,
    callback: (
      x, y, w, h
    ) => {
      // Store the image bounds relative to the UNZOOMED buffer
      sketchState.photoRect = {
        x,
        y,
        w,
        h
      };
    },
  } );
}

sketch.draw( () => {
  clear();
  background( ...options.sketch.backgroundColor );

  const photo = common.getAsset( options.sketch.photo );

  if ( !photo?.img ) {
    string.write(
      "photo-zoom-point:\n\nadd a photo :)",
      0,
      0,
      {
        size: 72,
        stroke: color(
          0,
          0,
          0,
          0
        ),
        fill: color( 0 ),
        textHeight: height,
        font: string.fonts.martian,
        textAlign: [
          CENTER,
          CENTER
        ],
      }
    );
    return;
  }

  // 1. Draw Image to Buffer (Unscaled)
  displayPhoto( photo.img );

  // 2. Animation Logic
  const zoomStep = mappers.fn(
    animation.triangleProgression( options.sketch.zoom.count ?? 1 ),
    0,
    1,
    0,
    1,
    easing?.[ options.sketch.zoom.easing ] ?? easing.easeInOutExpo
  );

  const zoomScale = lerp(
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
  // We want the focusPoint to land exactly at (width/2, height/2)
  const tx = ( width / 2 ) - ( focusX * zoomScale );
  const ty = ( height / 2 ) - ( focusY * zoomScale );

  // 5. IMPORTANT: Update State for the Click Handler
  // This allows handlePointerSelect to know "where" the image was during this frame
  sketchState.viewTransform = {
    x: tx,
    y: ty,
    scale: zoomScale
  };

  console.log(
    uvPoint,
    options.sketch.point
  );

  // 6. Apply & Draw
  push();
  translate(
    tx,
    ty
  );
  scale( zoomScale );

  image(
    sketchState.photoGraphics,
    0,
    0
  );

  // Draw Marker (Circle) at the specific focus point in Buffer Space
  if ( options.sketch.circle?.draw ?? true ) {
    noFill();
    stroke( ...( options.sketch.circle.stroke ?? [
      255
    ] ) );
    strokeWeight( ( options.sketch.circle.strokeWeight ?? 3 ) / zoomScale );
    circle(
      focusX,
      focusY,
      ( options.sketch.circle.radius ?? 24 ) / zoomScale
    );
  }
  pop();

  renderTitle();
} );
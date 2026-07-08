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

const sketchState = {
  photoGraphics: null,
  // Which photo (index into options.sketch.items) is on screen this frame.
  // The click handler needs it so a click lands on the right photo's point.
  activeIndex: 0,
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
 * Symmetric 0 → 1 → 0 wave. `t` is a phase in loop units; the fractional part
 * drives one full zoom-in-then-out, so `t` running 0→N gives N in/out cycles.
 */
function triangleWave( t ) {
  const phase = ( ( t % 1 ) + 1 ) % 1;

  return phase < 0.5
    ? phase * 2 // Linear up (0 → 1)
    : ( 1 - phase ) * 2; // Linear down (1 → 0)
}

/**
 * Read the photo list from options, tolerating a missing/empty value.
 */
function getItems() {
  return Array.isArray( options.sketch.items ) ? options.sketch.items : [];
}

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
 * We take the screen click, reverse the zoom/pan, and find the UV on the
 * photo — then store it as the zoom point of the photo currently on screen.
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

  // D. Save the point on the photo that was on screen when the click happened
  const items = getItems();
  const activeIndex = sketchState.activeIndex;

  if ( !items[ activeIndex ] ) {
    return;
  }

  const nextItems = items.map( (
    item, idx
  ) =>
    idx === activeIndex
      ? {
        ...item,
        point: uvPoint
      }
      : item );

  setSketchOptions(
    {
      sketch: {
        items: nextItems
      }
    },
    "p5"
  );
}

sketch.setup( () => {
  const p = getP5();

  p.background( ...options.sketch.backgroundColor );
  sketchState.photoGraphics = graphics.createAutoResizableGraphics(
    p.width,
    p.height
  );
} );

events.register(
  "engine-canvas-mouse-clicked",
  ( event ) => {
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

  const items = getItems();

  if ( !items.length ) {
    string.write(
      "photo-zoom-point:\n\nadd photos :)",
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

  // 1. Split the loop into one equal slice per photo, so every photo is seen
  // once over the sketch duration. `local` is 0→1 progress within the slice.
  const count = items.length;
  const scaled = animation.progression * count;
  const activeIndex = Math.min(
    count - 1,
    Math.floor( scaled )
  ) % count;
  const local = scaled - Math.floor( scaled );

  sketchState.activeIndex = activeIndex;

  const item = items[ activeIndex ];
  const photo = common.getAsset( item?.photo );

  if ( !photo?.img ) {
    // Asset not resolved yet (still loading / removed) — skip this frame.
    return;
  }

  // 2. Draw Image to Buffer (Unscaled)
  displayPhoto( photo.img );

  // 3. Animation Logic — `count` zoom in/out cycles inside this photo's slice
  const zoomStep = mappers.fn(
    triangleWave( local * ( options.sketch.zoom.count ?? 1 ) ),
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

  // 4. Focus Point Logic — this photo's own point
  const uvPoint = item.point ?? {
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

  // 5. Calculate Center Transform
  // We want the focusPoint to land exactly at (p.width/2, p.height/2)
  const tx = ( p.width / 2 ) - ( focusX * zoomScale );
  const ty = ( p.height / 2 ) - ( focusY * zoomScale );

  // 6. IMPORTANT: Update State for the Click Handler
  // This allows handlePointerSelect to know "where" the image was during this frame
  sketchState.viewTransform = {
    x: tx,
    y: ty,
    scale: zoomScale
  };

  // 7. Apply & Draw
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
} );

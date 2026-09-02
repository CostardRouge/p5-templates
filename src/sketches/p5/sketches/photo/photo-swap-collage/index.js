import options from "@/p5/utils/options.js";
import {
  setSketchOptions
} from "@/p5/shared/syncSketchOptions.js";

import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import events from "@/p5/utils/events.js";
import animation from "@/p5/utils/animation.js";
import * as common from "@/p5/utils/common.js";

// seam-hugging default swap-zone position per collage direction
const SEAM_DEFAULTS = {
  horizontal: {
    x: 1,
    y: 0.5
  },
  vertical: {
    x: 0.5,
    y: 1
  }
};

const sketchState = sketch.state( () => ( {
  lastDirection: null,
  // which entry of the photo list owns the zone currently on screen, so a
  // click writes onto the pair the user is actually looking at
  activeIndex: 0
} ) );

function isPoint( value ) {
  return Boolean( value ) && typeof value.x === "number" && typeof value.y === "number";
}

// The photo list. Each entry carries its own swap-zone position, so the value a
// click stores travels with the photo when the list is reordered.
function getItems() {
  return Array.isArray( options.sketch.items ) ? options.sketch.items : [];
}

// Rewrite one entry of the list. The whole array goes back through the option
// sync (it replaces arrays wholesale rather than merging them element by
// element), so the other entries are passed through untouched.
function setItemPosition(
  index, position
) {
  const items = getItems();

  if ( !items[ index ] ) {
    return;
  }

  setSketchOptions(
    {
      sketch: {
        items: items.map( (
          item, itemIndex
        ) => ( itemIndex === index
          ? {
            ...item,
            position
          }
          : item ) )
      }
    },
    "p5"
  );
}

// object-fit: cover via the 9-arg p5 image() — the crop happens at the
// source rect, so a zoomed background never bleeds outside its half.
// `frame` is the virtual cover area the image is fitted to and `sample` the
// canvas-space region of that frame to read; both default to the drawn rect,
// which makes the plain call a simple cover fit.
function drawImageCover( {
  img,
  x,
  y,
  width,
  height,
  zoom = 1,
  frame = null,
  sample = null
} ) {
  const p = getP5();
  const sampleRect = sample ?? {
    x,
    y,
    width,
    height
  };
  const coverFrame = frame ?? sampleRect;

  const coverScale = Math.max(
    coverFrame.width / img.width,
    coverFrame.height / img.height
  ) * zoom;
  const frameSourceWidth = coverFrame.width / coverScale;
  const frameSourceHeight = coverFrame.height / coverScale;
  const frameSourceX = ( img.width - frameSourceWidth ) / 2;
  const frameSourceY = ( img.height - frameSourceHeight ) / 2;

  p.image(
    img,
    x,
    y,
    width,
    height,
    frameSourceX + ( sampleRect.x - coverFrame.x ) / coverScale,
    frameSourceY + ( sampleRect.y - coverFrame.y ) / coverScale,
    sampleRect.width / coverScale,
    sampleRect.height / coverScale
  );
}

function getDirection() {
  return options.sketch.layout?.direction === "vertical" ? "vertical" : "horizontal";
}

function getHalves( direction ) {
  const p = getP5();

  if ( direction === "vertical" ) {
    const halfHeight = p.height / 2;

    return [
      {
        x: 0,
        y: 0,
        width: p.width,
        height: halfHeight
      },
      {
        x: 0,
        y: halfHeight,
        width: p.width,
        height: halfHeight
      }
    ];
  }

  const halfWidth = p.width / 2;

  return [
    {
      x: 0,
      y: 0,
      width: halfWidth,
      height: p.height
    },
    {
      x: halfWidth,
      y: 0,
      width: halfWidth,
      height: p.height
    }
  ];
}

// axis-wise involution: applying it twice gives the identity, so the same
// function maps first-half -> second-half positions and back
function mirrorPosition( position ) {
  const {
    horizontalMirror = true,
    verticalMirror = true
  } = options.sketch.swapZone ?? {};

  return {
    x: horizontalMirror ? 1 - position.x : position.x,
    y: verticalMirror ? 1 - position.y : position.y
  };
}

function clampCenter(
  value, min, max
) {
  if ( min > max ) {
    return ( min + max ) / 2;
  }

  return Math.min(
    Math.max(
      value,
      min
    ),
    max
  );
}

// resolve the swap rect (top-left based) for one half, keeping it fully inside
function placeSwapRect(
  half, position, rectWidth, rectHeight
) {
  const centerX = clampCenter(
    half.x + position.x * half.width,
    half.x + rectWidth / 2,
    half.x + half.width - rectWidth / 2
  );
  const centerY = clampCenter(
    half.y + position.y * half.height,
    half.y + rectHeight / 2,
    half.y + half.height - rectHeight / 2
  );

  return {
    x: centerX - rectWidth / 2,
    y: centerY - rectHeight / 2,
    width: rectWidth,
    height: rectHeight
  };
}

function getInternalCanvasPoint( event ) {
  const p = getP5();
  const canvasElement = sketch.engine?.getCanvasElement?.();

  if ( !canvasElement ) {
    return null;
  }

  // getBoundingClientRect accounts for the editor's CSS scaling/transforms
  const rect = canvasElement.getBoundingClientRect();

  const clientX = event.touches?.[ 0 ]?.clientX ?? event.changedTouches?.[ 0 ]?.clientX ?? event.clientX;
  const clientY = event.touches?.[ 0 ]?.clientY ?? event.changedTouches?.[ 0 ]?.clientY ?? event.clientY;

  if ( typeof clientX !== "number" || typeof clientY !== "number" ) {
    return null;
  }

  return {
    x: ( clientX - rect.left ) / rect.width * p.width,
    y: ( clientY - rect.top ) / rect.height * p.height
  };
}

function handleCanvasClick( event ) {
  const p = getP5();
  const point = getInternalCanvasPoint( event );

  if ( !point || point.x < 0 || point.x > p.width || point.y < 0 || point.y > p.height ) {
    return;
  }

  const direction = getDirection();
  const [
    halfA,
    halfB
  ] = getHalves( direction );
  const clickedSecondHalf = direction === "vertical" ? point.y >= halfB.y : point.x >= halfB.x;
  const half = clickedSecondHalf ? halfB : halfA;

  let position = {
    x: ( point.x - half.x ) / half.width,
    y: ( point.y - half.y ) / half.height
  };

  if ( clickedSecondHalf ) {
    // inverse-mirror back onto the first half, so the zone lands where you click
    position = mirrorPosition( position );
  }

  // the zone belongs to the pair on screen, and the pair is named by its first
  // photo — the one whose entry the form shows the position on
  setItemPosition(
    sketchState.activeIndex,
    position
  );
}

// when the direction flips, every photo still sitting on the previous
// direction's untouched seam default follows the new seam; positions that were
// actually placed are kept
function syncSeamDefaultOnDirectionChange( direction ) {
  if ( sketchState.lastDirection === null || sketchState.lastDirection === direction ) {
    sketchState.lastDirection = direction;
    return;
  }

  const previousDefault = SEAM_DEFAULTS[ sketchState.lastDirection ];
  const nextDefault = SEAM_DEFAULTS[ direction ];
  const items = getItems();
  const stale = items.some( ( item ) =>
    item?.position?.x === previousDefault.x && item?.position?.y === previousDefault.y );

  sketchState.lastDirection = direction;

  if ( !stale ) {
    return;
  }

  setSketchOptions(
    {
      sketch: {
        items: items.map( ( item ) =>
          ( item?.position?.x === previousDefault.x && item?.position?.y === previousDefault.y
            ? {
              ...item,
              position: {
                ...nextDefault
              }
            }
            : item ) )
      }
    },
    "p5"
  );
}

sketch.setup( () => {
  const p = getP5();

  p.background( ...options.sketch.backgroundColor );

  events.register(
    "engine-canvas-mouse-clicked",
    handleCanvasClick
  );
} );

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch;

  p.clear();
  p.background( ...o.backgroundColor );

  const direction = getDirection();

  syncSeamDefaultOnDirectionChange( direction );

  const items = getItems();

  if ( items.length < 2 ) {
    return;
  }

  // fixed, non-overlapping pairs (1-2, 3-4, …): a single pair displays
  // statically, extra pairs share the loop; an odd leftover image is ignored
  const pairCount = Math.max(
    1,
    Math.floor( items.length / 2 )
  );
  const pairPosition = animation.progression * pairCount;
  const pairIndex = Math.min(
    pairCount - 1,
    Math.floor( pairPosition )
  );
  const pairProgression = pairPosition - Math.floor( pairPosition );

  const firstItem = items[ pairIndex * 2 ];
  const firstImage = common.getAsset( firstItem?.photo )?.img;
  const secondImage = common.getAsset( items[ pairIndex * 2 + 1 ]?.photo )?.img;

  if ( !firstImage || !secondImage ) {
    // an asset still loading, or a row with no photo picked yet
    return;
  }

  // a click writes onto the photo that owns this pair's zone
  sketchState.activeIndex = pairIndex * 2;

  const [
    halfA,
    halfB
  ] = getHalves( direction );
  const backgroundZoom = o.background.zoom * ( 1 + o.background.zoomAmplitude * pairProgression );

  // swapped backgrounds: each half shows the *opposite* photo, zoomed in
  drawImageCover( {
    img: secondImage,
    ...halfA,
    zoom: backgroundZoom
  } );

  drawImageCover( {
    img: firstImage,
    ...halfB,
    zoom: backgroundZoom
  } );

  // swap zone: one rect per half. In "crop" mode the rects exchange what
  // they hide: rect A reveals the patch of the first photo's background
  // (drawn on half B) that rect B covers, and vice versa — a true swap
  const rectWidth = o.swapZone.width * p.width;
  const rectHeight = o.swapZone.height * p.height;
  const positionA = isPoint( firstItem.position )
    ? firstItem.position
    : SEAM_DEFAULTS[ direction ];
  const positionB = mirrorPosition( positionA );
  const cropContent = ( o.swapZone.content ?? "crop" ) === "crop";

  const rectA = placeSwapRect(
    halfA,
    positionA,
    rectWidth,
    rectHeight
  );
  const rectB = placeSwapRect(
    halfB,
    positionB,
    rectWidth,
    rectHeight
  );

  drawImageCover( {
    img: firstImage,
    ...rectA,
    frame: cropContent ? halfB : null,
    sample: cropContent ? rectB : null,
    zoom: cropContent ? backgroundZoom : 1
  } );

  drawImageCover( {
    img: secondImage,
    ...rectB,
    frame: cropContent ? halfA : null,
    sample: cropContent ? rectA : null,
    zoom: cropContent ? backgroundZoom : 1
  } );
} );

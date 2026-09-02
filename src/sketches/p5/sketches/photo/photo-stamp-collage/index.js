import options from "@/p5/utils/options.js";
import {
  setSketchOptions
} from "@/p5/shared/syncSketchOptions.js";

import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import events from "@/p5/utils/events.js";
import graphics from "@/p5/utils/graphics.js";
import animation from "@/p5/utils/animation.js";
import * as common from "@/p5/utils/common.js";

// Paper speckles are decorative, but they must be identical on every frame and
// in headless capture: they are painted once into a buffer from a fixed seed
// and blitted, never re-randomised per frame.
const GRAIN_SEED = 20250824;
// speck count at full amount, for the 1080×1350 baseline canvas
const GRAIN_DENSITY = 2600;

const CENTER_FOCUS = {
  x: 0.5,
  y: 0.5
};

const DEFAULT_POSITION = {
  x: 0.5,
  y: 0.27
};

function isPoint( value ) {
  return Boolean( value ) && typeof value.x === "number" && typeof value.y === "number";
}

// The photo list. Each entry carries its own stamp placement, so the values a
// click stores travel with the photo when the list is reordered.
function getItems() {
  return Array.isArray( options.sketch.items ) ? options.sketch.items : [];
}

// Rewrite one entry of the list. The whole array goes back through the option
// sync (it replaces arrays wholesale rather than merging them element by
// element), so the other entries are passed through untouched.
function setItemValue(
  index, key, value
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
            [ key ]: value
          }
          : item ) )
      }
    },
    "p5"
  );
}

const sketchState = sketch.state( () => ( {
  grainLayer: null,
  grainKey: null,
  // what the last drawn frame put on screen, so a click maps against the
  // pixels the user actually aimed at (zoom included) rather than the defaults
  lastFrame: null
} ) );

function clamp(
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

function toCssColor( color ) {
  const [
    r = 255,
    g = 255,
    b = 255,
    a = 255
  ] = color ?? [];

  return `rgba(${ r }, ${ g }, ${ b }, ${ a / 255 })`;
}

// Source rect of `img` that covers a `frameWidth` × `frameHeight` destination
// at `zoom`, centred on the normalised source point `focus` and kept inside the
// image — the crop happens at the source, so nothing bleeds outside the rect.
function coverSourceRect(
  img, frameWidth, frameHeight, zoom, focus
) {
  const coverScale = Math.max(
    frameWidth / img.width,
    frameHeight / img.height
  ) * zoom;
  const width = frameWidth / coverScale;
  const height = frameHeight / coverScale;

  return {
    x: clamp(
      focus.x * img.width - width / 2,
      0,
      img.width - width
    ),
    y: clamp(
      focus.y * img.height - height / 2,
      0,
      img.height - height
    ),
    width,
    height
  };
}

function drawImageRegion(
  img, rect, source
) {
  getP5().image(
    img,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    source.x,
    source.y,
    source.width,
    source.height
  );
}

// Postage-stamp silhouette: walk the rectangle clockwise and bite a half-circle
// out of the paper at every tooth centre. Built on the raw Canvas2D path so the
// same shape can be filled (with its drop shadow) and reused as a clip for the
// photo — a p5 shape could do neither.
function tracePerforatedPath(
  ctx, rect, toothRadius, pitch
) {
  const left = rect.x;
  const top = rect.y;
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;

  // Real stamps keep a square of flat paper at each corner. Without that inset
  // the first notch of two adjacent edges overlap, the corner is eaten away and
  // what is left of it renders as a hairline spike.
  const corner = Math.min(
    toothRadius * 1.6,
    rect.width / 4,
    rect.height / 4
  );
  const columnSpan = rect.width - 2 * corner;
  const rowSpan = rect.height - 2 * corner;
  const columns = Math.max(
    1,
    Math.round( columnSpan / pitch )
  );
  const rows = Math.max(
    1,
    Math.round( rowSpan / pitch )
  );
  const columnStep = columnSpan / columns;
  const rowStep = rowSpan / rows;
  // two notches must not swallow the flat paper between them
  const radius = Math.min(
    toothRadius,
    columnStep * 0.45,
    rowStep * 0.45
  );

  ctx.beginPath();
  ctx.moveTo(
    left,
    top
  );

  // Every arc runs anticlockwise (decreasing angle) so its bulge points into
  // the paper: that is what makes the notch a bite rather than a bump.
  for ( let i = 0; i < columns; i++ ) {
    const x = left + corner + ( i + 0.5 ) * columnStep;

    ctx.lineTo(
      x - radius,
      top
    );
    ctx.arc(
      x,
      top,
      radius,
      Math.PI,
      0,
      true
    );
  }

  ctx.lineTo(
    right,
    top
  );

  for ( let i = 0; i < rows; i++ ) {
    const y = top + corner + ( i + 0.5 ) * rowStep;

    ctx.lineTo(
      right,
      y - radius
    );
    ctx.arc(
      right,
      y,
      radius,
      -Math.PI / 2,
      Math.PI / 2,
      true
    );
  }

  ctx.lineTo(
    right,
    bottom
  );

  for ( let i = columns - 1; i >= 0; i-- ) {
    const x = left + corner + ( i + 0.5 ) * columnStep;

    ctx.lineTo(
      x + radius,
      bottom
    );
    ctx.arc(
      x,
      bottom,
      radius,
      0,
      Math.PI,
      true
    );
  }

  ctx.lineTo(
    left,
    bottom
  );

  for ( let i = rows - 1; i >= 0; i-- ) {
    const y = top + corner + ( i + 0.5 ) * rowStep;

    ctx.lineTo(
      left,
      y + radius
    );
    ctx.arc(
      left,
      y,
      radius,
      Math.PI / 2,
      -Math.PI / 2,
      true
    );
  }

  ctx.closePath();
}

function paintGrain(
  layer, amount
) {
  const p = getP5();

  layer.clear();

  if ( amount <= 0 ) {
    return;
  }

  const count = Math.round( GRAIN_DENSITY * amount * ( layer.width * layer.height ) / ( 1080 * 1350 ) );

  p.randomSeed( GRAIN_SEED );

  layer.push();
  layer.noStroke();

  for ( let i = 0; i < count; i++ ) {
    const size = p.random(
      0.8,
      2.6
    );

    layer.fill(
      64,
      44,
      32,
      p.random(
        20,
        90
      )
    );
    layer.rect(
      p.random( layer.width ),
      p.random( layer.height ),
      size,
      size
    );
  }

  layer.pop();
}

function drawGrain( amount ) {
  const p = getP5();
  const layer = sketchState.grainLayer;

  if ( !layer || amount <= 0 ) {
    return;
  }

  const key = `${ layer.width }x${ layer.height }:${ amount }`;

  if ( sketchState.grainKey !== key ) {
    paintGrain(
      layer,
      amount
    );
    sketchState.grainKey = key;
  }

  p.image(
    layer,
    0,
    0,
    p.width,
    p.height
  );
}

// The big photo: full width, a fraction of the height, flush against one edge.
function getPhotoRect() {
  const p = getP5();
  const layout = options.sketch.layout ?? {};
  const height = p.height * ( layout.height ?? 0.52 );
  const align = layout.align ?? "bottom";

  let y = p.height - height;

  if ( align === "top" ) {
    y = 0;
  } else if ( align === "center" ) {
    y = ( p.height - height ) / 2;
  }

  return {
    x: 0,
    y,
    width: p.width,
    height
  };
}

// The stamp, centred on its position and kept fully inside the canvas.
function getStampRect( position ) {
  const p = getP5();
  const stamp = options.sketch.stamp ?? {};
  const width = ( stamp.size ?? 0.3 ) * p.width;
  const height = width / Math.max(
    0.2,
    stamp.aspect ?? 1.2
  );

  return {
    centerX: clamp(
      position.x * p.width,
      width / 2,
      p.width - width / 2
    ),
    centerY: clamp(
      position.y * p.height,
      height / 2,
      p.height - height / 2
    ),
    width,
    height
  };
}

// Notch geometry for a stamp-shaped rect of any size, so the hole punched in
// the photo is a scaled copy of the stamp holding the piece.
function getPerforation( rect ) {
  const o = options.sketch.stamp ?? {};
  const pitch = Math.max(
    4,
    ( o.perforationSize ?? 0.13 ) * Math.min(
      rect.width,
      rect.height
    )
  );

  return {
    pitch,
    // half a pitch of radius would swallow the flat paper between two notches
    toothRadius: pitch * Math.min(
      0.45,
      o.perforationDepth ?? 0.4
    )
  };
}

// The piece the stamp lifted, back in the big photo's canvas space. The crop
// travels as a fraction of its image rather than as pixels, so a stamp and a
// photo of different resolutions still line up, and the hole takes the stamp's
// own aspect: that makes it the exact region in "same" mode, and a
// stamp-shaped window onto the same part of the frame in "pair" mode.
function getCutoutRect( {
  photoImage,
  photoRect,
  photoSource,
  stampImage,
  stampSource,
  stampAspect
} ) {
  const scale = photoRect.width / photoSource.width;
  const width = stampSource.width / stampImage.width * photoImage.width * scale;
  const height = width / stampAspect;
  const centerX = photoRect.x
    + ( ( stampSource.x + stampSource.width / 2 ) / stampImage.width * photoImage.width - photoSource.x ) * scale;
  const centerY = photoRect.y
    + ( ( stampSource.y + stampSource.height / 2 ) / stampImage.height * photoImage.height - photoSource.y ) * scale;

  return {
    x: centerX - width / 2,
    y: centerY - height / 2,
    width,
    height
  };
}

// Punch the stamp silhouette out of the photo and put back what was underneath
// it — the paper and its grain — so the piece reads as lifted out, not painted
// over. Clipped to the photo: the hole belongs to the photo, not to the paper.
function drawCutout(
  rect, photoRect
) {
  const p = getP5();
  const ctx = p.drawingContext;
  const {
    pitch,
    toothRadius
  } = getPerforation( rect );

  ctx.save();
  ctx.beginPath();
  ctx.rect(
    photoRect.x,
    photoRect.y,
    photoRect.width,
    photoRect.height
  );
  ctx.clip();

  tracePerforatedPath(
    ctx,
    rect,
    toothRadius,
    pitch
  );
  ctx.clip();

  p.push();
  p.noStroke();
  p.fill( ...options.sketch.backgroundColor );
  p.rect(
    photoRect.x,
    photoRect.y,
    photoRect.width,
    photoRect.height
  );
  p.pop();

  drawGrain( options.sketch.paper?.grain ?? 0 );

  ctx.restore();
}

function drawStamp( {
  img,
  rect,
  margin,
  source
} ) {
  const p = getP5();
  const o = options.sketch.stamp ?? {};
  const ctx = p.drawingContext;
  const body = {
    x: -rect.width / 2,
    y: -rect.height / 2,
    width: rect.width,
    height: rect.height
  };
  const {
    pitch,
    toothRadius
  } = getPerforation( rect );
  const shadow = o.shadow ?? 0;

  p.push();
  p.translate(
    rect.centerX,
    rect.centerY
  );
  p.rotate( p.radians( o.rotation ?? 0 ) );

  // Paper first, so the drop shadow follows the perforated silhouette instead
  // of a plain rectangle.
  ctx.save();

  if ( shadow > 0 ) {
    ctx.shadowColor = `rgba(0, 0, 0, ${ 0.45 * shadow })`;
    ctx.shadowBlur = rect.width * 0.09 * shadow;
    ctx.shadowOffsetY = rect.width * 0.025 * shadow;
  }

  tracePerforatedPath(
    ctx,
    body,
    toothRadius,
    pitch
  );
  ctx.fillStyle = toCssColor( o.color );
  ctx.fill();
  ctx.restore();

  // Photo, clipped to the paper — or to the inner rect when a paper margin is
  // asked for, which gives the classic white-framed stamp.
  ctx.save();

  if ( margin > 0 ) {
    ctx.beginPath();
    ctx.rect(
      body.x + margin,
      body.y + margin,
      body.width - 2 * margin,
      body.height - 2 * margin
    );
  } else {
    tracePerforatedPath(
      ctx,
      body,
      toothRadius,
      pitch
    );
  }

  ctx.clip();

  drawImageRegion(
    img,
    {
      x: body.x + margin,
      y: body.y + margin,
      width: body.width - 2 * margin,
      height: body.height - 2 * margin
    },
    source
  );

  ctx.restore();
  p.pop();
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

// Click the big photo to aim the stamp at that detail, click the paper to move
// the stamp there. Both write back into the photo that is on screen, so every
// photo keeps its own framing and the result is a saved option, not a transient
// state the recorder would miss.
function handleCanvasClick( event ) {
  const p = getP5();

  // the instance is module-level state and is nulled on teardown
  if ( !p ) {
    return;
  }

  const point = getInternalCanvasPoint( event );

  if ( !point || point.x < 0 || point.x > p.width || point.y < 0 || point.y > p.height ) {
    return;
  }

  const frame = sketchState.lastFrame;
  const photoRect = frame?.photoRect ?? getPhotoRect();
  const insidePhoto = point.x >= photoRect.x
    && point.x <= photoRect.x + photoRect.width
    && point.y >= photoRect.y
    && point.y <= photoRect.y + photoRect.height;

  if ( !insidePhoto ) {
    // the stamp is placed on the paper of the beat on screen, and the beat is
    // named by its big photo
    setItemValue(
      frame?.photoIndex ?? 0,
      "position",
      {
        x: point.x / p.width,
        y: point.y / p.height
      }
    );

    return;
  }

  if ( !frame?.photoImage ) {
    return;
  }

  // Walk the click back through the photo's own cover mapping, so the stamp
  // magnifies exactly the region that was clicked.
  const source = coverSourceRect(
    frame.photoImage,
    photoRect.width,
    photoRect.height,
    frame.photoZoom,
    CENTER_FOCUS
  );

  // the focus is a point *inside* the stamped image, so it is stored on the
  // photo the stamp crops — the same entry in "same" mode, the pair's second
  // photo when the stamp shows its own image
  setItemValue(
    frame?.stampIndex ?? 0,
    "focus",
    {
      x: ( source.x + ( point.x - photoRect.x ) / photoRect.width * source.width ) / frame.photoImage.width,
      y: ( source.y + ( point.y - photoRect.y ) / photoRect.height * source.height ) / frame.photoImage.height
    }
  );
}

sketch.setup( () => {
  const p = getP5();

  sketchState.grainKey = null;
  sketchState.lastFrame = null;
  sketchState.grainLayer = graphics.createAutoResizableGraphics(
    p.width,
    p.height,
    "p2d",
    () => {
      sketchState.grainKey = null;
    }
  );

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

  drawGrain( o.paper?.grain ?? 0 );

  const items = getItems();

  if ( items.length < 1 ) {
    return;
  }

  // One beat per photo, or per non-overlapping pair when the stamp shows its
  // own photo (1-2, 3-4, …); a single beat displays statically.
  const paired = ( o.stamp?.source ?? "same" ) === "pair";
  const beatCount = Math.max(
    1,
    paired ? Math.floor( items.length / 2 ) : items.length
  );
  const beatPosition = animation.progression * beatCount;
  const beatIndex = Math.min(
    beatCount - 1,
    Math.floor( beatPosition )
  );
  const beatProgression = beatPosition - Math.floor( beatPosition );

  // Which entries of the list this beat shows: its big photo, and the photo the
  // stamp crops — the same one unless the pair mode gives the stamp its own.
  const photoIndex = paired ? beatIndex * 2 : beatIndex;
  const stampIndex = paired ? beatIndex * 2 + 1 : photoIndex;
  const photoItem = items[ photoIndex ];
  const stampItem = items[ stampIndex ];
  const photoImage = common.getAsset( photoItem?.photo )?.img;
  const stampImage = common.getAsset( stampItem?.photo )?.img;

  if ( !photoImage || !stampImage ) {
    // an asset still loading, or a row with no photo picked yet
    return;
  }

  const photoRect = getPhotoRect();
  const photoZoom = ( o.layout?.zoom ?? 1 )
    * ( 1 + ( o.layout?.zoomAmplitude ?? 0 ) * beatProgression );
  const photoSource = coverSourceRect(
    photoImage,
    photoRect.width,
    photoRect.height,
    photoZoom,
    CENTER_FOCUS
  );

  drawImageRegion(
    photoImage,
    photoRect,
    photoSource
  );

  const stampZoom = ( o.stamp?.zoom ?? 1 )
    * ( 1 + ( o.stamp?.zoomAmplitude ?? 0 ) * beatProgression );
  const stampRect = getStampRect( isPoint( photoItem.position )
    ? photoItem.position
    : DEFAULT_POSITION );
  const stampMargin = ( o.stamp?.border ?? 0 ) * stampRect.width;
  // resolved once and shared: the hole must be the very piece the stamp holds
  const stampSource = coverSourceRect(
    stampImage,
    stampRect.width - 2 * stampMargin,
    stampRect.height - 2 * stampMargin,
    stampZoom,
    isPoint( stampItem.focus ) ? stampItem.focus : CENTER_FOCUS
  );

  if ( o.stamp?.cutout ) {
    drawCutout(
      getCutoutRect( {
        photoImage,
        photoRect,
        photoSource,
        stampImage,
        stampSource,
        stampAspect: ( stampRect.width - 2 * stampMargin ) / ( stampRect.height - 2 * stampMargin )
      } ),
      photoRect
    );
  }

  drawStamp( {
    img: stampImage,
    rect: stampRect,
    margin: stampMargin,
    source: stampSource
  } );

  sketchState.lastFrame = {
    photoRect,
    photoImage,
    photoZoom,
    // a click must write onto the photos that were on screen, not onto
    // whichever ones the defaults imply
    photoIndex,
    stampIndex
  };
} );

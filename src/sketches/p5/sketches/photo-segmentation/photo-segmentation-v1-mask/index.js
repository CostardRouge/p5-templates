import options from "@/p5/utils/options.js";
import events from "@/p5/utils/events.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import string from "@/p5/utils/string.js";
import imageUtils from "@/p5/utils/imageUtils.js";
import * as common from "@/p5/utils/common.js";
import mediapipe, {
  init as mediapipeInit
} from "@/p5/utils/mediapipe/mediapipe.js";
import {
  drawSegmentationMask
} from "@/p5/utils/segmentation.js";
import {
  createMultiMaskSegmenter,
  drawFocusMarkers,
  hitFocusMarker
} from "@/p5/utils/multiSegmentation.js";
import {
  setSketchOptions,
  subscribeSketchOptions
} from "@/p5/shared/syncSketchOptions.js";

/* ------------------------------------------------------------------ */
/*  Sketch state                                                       */
/* ------------------------------------------------------------------ */

const state = {
  // Path of the photo currently driving the segmenter (normalized to a string
  // even when the option is stored as a single-element array by the picker).
  imagePath: null,

  // Working copy of the focus points, normalized (0-1) image space. One
  // segmentation mask is kept per point; the subject is their union.
  points: [],
  // JSON of the points we last took from / wrote to the store, so we can
  // tell an external edit (form, reload) apart from our own click write.
  pointsSyncHash: null,

  // Finished cut-out (photo with the feathered union mask applied).
  subject: null,
  // Settings the cached subject was built with, so we only rebuild when
  // they actually change.
  builtWith: {
    inverse: null,
    softness: null,
    expand: null
  },
  // Segmenter mask-set version the cached subject was built from.
  builtVersion: -1,
  maskDirty: false,

  // Where the (unscaled) photo sits on the canvas — the reference rectangle
  // used to translate a click into a point on the image.
  photoRect: {
    x: 0,
    y: 0,
    w: 0,
    h: 0
  },

  // Reused graphics buffers.
  photoG: null, // full photo, drawn to measure photoRect / "original" backdrop
  bgG: null, // full-bleed backdrop for the blur / dim modes
  binaryMaskG: null, // hard 1-bit union mask
  softMaskG: null // feathered + grown/shrunk mask actually used to cut out
};

// One inference per focus point, run sequentially; masks cached per point.
const segmenter = createMultiMaskSegmenter();

/* ------------------------------------------------------------------ */
/*  Small helpers                                                       */
/* ------------------------------------------------------------------ */

function clamp(
  value, min, max
) {
  return value < min ? min : value > max ? max : value;
}

// The `image` option is a plain path, but the asset picker may persist it as a
// single-element array — accept either so the sketch never loses the photo.
function resolveImagePath( value ) {
  if ( Array.isArray( value ) ) {
    return value.find( Boolean ) ?? null;
  }

  return value || null;
}

function isPoint( value ) {
  return !!value && typeof value.x === "number" && typeof value.y === "number";
}

function sanitizePoint( value ) {
  if ( !isPoint( value ) ) {
    // A fresh, not-yet-edited form item — park it in the middle.
    return {
      x: 0.5,
      y: 0.5
    };
  }

  return {
    x: clamp(
      value.x,
      0,
      1
    ),
    y: clamp(
      value.y,
      0,
      1
    )
  };
}

// The stored focus points. Templates saved before multi-mask kept a single
// `roi` point — adopt it as the first (and only) point. An explicit empty
// `points` array means "no subject picked" and is respected.
function storedPoints() {
  const seg = options.sketch?.segmentation ?? {};

  if ( Array.isArray( seg.points ) ) {
    return seg.points.map( sanitizePoint );
  }

  if ( isPoint( seg.roi ) ) {
    return [
      sanitizePoint( seg.roi )
    ];
  }

  return [];
}

function photoSettings() {
  const photo = options.sketch?.photo ?? {};

  return {
    margin: photo.margin ?? 0,
    scale: photo.scale ?? 1,
    center: photo.center ?? true,
    clip: photo.clip ?? false,
    fill: photo.fill ?? false
  };
}

function ensureCanvasGraphics( p ) {
  for ( const key of [
    "photoG",
    "bgG"
  ] ) {
    let g = state[ key ];

    if ( !g ) {
      state[ key ] = p.createGraphics(
        p.width,
        p.height
      );
    } else if ( g.width !== p.width || g.height !== p.height ) {
      g.resizeCanvas(
        p.width,
        p.height
      );
    }
  }
}

function ensureMaskGraphics(
  key, width, height
) {
  const p = getP5();
  let g = state[ key ];

  if ( !g ) {
    g = p.createGraphics(
      width,
      height
    );
    state[ key ] = g;
  } else if ( g.width !== width || g.height !== height ) {
    g.resizeCanvas(
      width,
      height
    );
  }

  // Pixel manipulation in drawSegmentationMask / the feather pass assumes a
  // 1:1 pixel buffer.
  g.pixelDensity( 1 );

  return g;
}

/* ------------------------------------------------------------------ */
/*  Point list sync                                                     */
/* ------------------------------------------------------------------ */

// Reconcile the working copy with the stored options (form edit, reload,
// preset): adopt whenever the stored list differs from what we last synced.
function syncPoints() {
  const seg = options.sketch?.segmentation ?? {};
  const raw = Array.isArray( seg.points ) ? seg.points : null;
  const rawHash = JSON.stringify( raw );

  if ( rawHash === state.pointsSyncHash ) {
    return;
  }

  state.pointsSyncHash = rawHash;
  state.points = storedPoints();
  segmenter.setPoints( state.points );
}

// Persist the working copy so the picked zones survive reloads and are
// exported with the template. Origin "p5" so the options module skips its
// own change handler while React still picks the new values up.
function persistPoints() {
  const points = state.points.map( ( pt ) => ( {
    x: pt.x,
    y: pt.y
  } ) );

  state.pointsSyncHash = JSON.stringify( points );

  setSketchOptions(
    {
      sketch: {
        segmentation: {
          points
        }
      }
    },
    "p5"
  );
}

/* ------------------------------------------------------------------ */
/*  Click → image-point mapping (robust to CSS scaling / margins / zoom) */
/* ------------------------------------------------------------------ */

// Convert a DOM pointer event to a point in the p5 canvas' internal resolution,
// accounting for any CSS scaling applied to the canvas element (the studio
// viewport renders the canvas at an arbitrary display size).
function getInternalCanvasPoint( event ) {
  const p = getP5();
  const canvasElement = sketch.engine?.getCanvasElement?.();

  if ( !canvasElement ) {
    return null;
  }

  const rect = canvasElement.getBoundingClientRect();
  const clientX =
    event.touches?.[ 0 ]?.clientX ??
    event.changedTouches?.[ 0 ]?.clientX ??
    event.clientX;
  const clientY =
    event.touches?.[ 0 ]?.clientY ??
    event.changedTouches?.[ 0 ]?.clientY ??
    event.clientY;

  if ( typeof clientX !== "number" || typeof clientY !== "number" ) {
    return null;
  }

  if ( rect.width === 0 || rect.height === 0 ) {
    return null;
  }

  return {
    x: ( ( clientX - rect.left ) / rect.width ) * p.width,
    y: ( ( clientY - rect.top ) / rect.height ) * p.height
  };
}

// A click on a focus marker (the circle with the minus) unpicks that zone;
// a click anywhere else on the photo picks a new one.
function handlePointerSelect( point ) {
  if ( !point ) {
    return;
  }

  const marker = options.sketch?.marker ?? {};

  if ( marker.show ) {
    const hit = hitFocusMarker(
      state.points,
      state.photoRect,
      point,
      marker.radius ?? 16
    );

    if ( hit !== -1 ) {
      state.points.splice(
        hit,
        1
      );
      segmenter.setPoints( state.points );
      persistPoints();
      state.maskDirty = true;

      return;
    }
  }

  const {
    x, y, w, h
  } = state.photoRect;

  if ( w <= 0 || h <= 0 ) {
    return;
  }

  if ( point.x < x || point.x > x + w || point.y < y || point.y > y + h ) {
    return;
  }

  state.points.push( {
    x: clamp(
      ( point.x - x ) / w,
      0,
      1
    ),
    y: clamp(
      ( point.y - y ) / h,
      0,
      1
    )
  } );
  segmenter.setPoints( state.points );
  persistPoints();
}

/* ------------------------------------------------------------------ */
/*  Subject rebuild                                                     */
/* ------------------------------------------------------------------ */

function smoothstep( t ) {
  const c = clamp(
    t,
    0,
    1
  );

  return c * c * ( 3 - 2 * c );
}

// Build the cut-out from the union of every picked mask using the current
// edge settings. Feathering and grow/shrink are done in one pass: the
// binary union is blurred, then its alpha is remapped through a smoothstep
// whose centre shifts the edge (expand) and whose width controls the
// softness.
function rebuildSubject() {
  const photo = common.getAsset( state.imagePath );
  const seg = options.sketch?.segmentation ?? {};
  const inverse = seg.inverse ?? true;
  const combined = segmenter.combined( inverse );

  if ( !photo?.img?.width || !combined ) {
    state.subject = null;

    return;
  }

  const {
    data, width, height
  } = combined;
  const softness = clamp(
    seg.edgeSoftness ?? 0,
    0,
    1
  );
  const expand = clamp(
    seg.edgeExpand ?? 0,
    -1,
    1
  );

  const binary = ensureMaskGraphics(
    "binaryMaskG",
    width,
    height
  );

  // White where kept, fully transparent elsewhere — p5's mask() keys off the
  // alpha channel (destination-in), so only the alpha matters here. The
  // union already applied `inverse` per raw mask, so it is passed as false.
  drawSegmentationMask(
    binary,
    data,
    [
      255,
      255,
      255,
      255
    ],
    false
  );

  let mask = binary;
  const minDimension = Math.min(
    width,
    height
  );
  const radius = Math.round( 0.05 * minDimension * Math.max(
    softness,
    Math.abs( expand )
  ) );

  if ( radius > 0 ) {
    const soft = ensureMaskGraphics(
      "softMaskG",
      width,
      height
    );

    soft.clear();
    soft.drawingContext.filter = `blur(${ radius }px)`;
    soft.image(
      binary,
      0,
      0
    );
    soft.drawingContext.filter = "none";

    // Remap the blurred alpha: centre < 0.5 grows the mask, > 0.5 shrinks it;
    // the band width sets how soft the transition reads.
    const centre = clamp(
      0.5 - expand * 0.5,
      0.02,
      0.98
    );
    const half = Math.max(
      softness * 0.5,
      0.03
    );
    const lo = clamp(
      centre - half,
      0,
      1
    );
    const hi = clamp(
      centre + half,
      0,
      1
    );
    const span = Math.max(
      hi - lo,
      1e-4
    );

    soft.loadPixels();
    const pixels = soft.pixels;

    for ( let i = 3; i < pixels.length; i += 4 ) {
      pixels[ i ] = smoothstep( ( pixels[ i ] / 255 - lo ) / span ) * 255;
    }

    soft.updatePixels();
    mask = soft;
  }

  const subject = photo.img.get();

  subject.mask( mask );

  state.subject = subject;
  state.builtWith = {
    inverse,
    softness,
    expand
  };
}

/* ------------------------------------------------------------------ */
/*  Rendering                                                           */
/* ------------------------------------------------------------------ */

// Draw the full photo into the offscreen buffer and record where it landed.
function drawPhotoLayer( photo ) {
  const p = getP5();
  const {
    margin, scale, center, clip, fill
  } = photoSettings();
  const g = state.photoG;

  g.clear();
  imageUtils.marginImage( {
    img: photo.img,
    graphics: g,
    position: p.createVector(
      p.width / 2,
      p.height / 2
    ),
    margin: p.width * margin,
    scale,
    center,
    clip,
    fill,
    callback: (
      cx, cy, w, h
    ) => {
      state.photoRect = {
        x: center ? cx - w / 2 : cx,
        y: center ? cy - h / 2 : cy,
        w,
        h
      };
    }
  } );
}

function drawBackground(
  p, photo
) {
  const bg = options.sketch?.background ?? {};
  const mode = bg.mode ?? "transparent";

  if ( mode === "transparent" ) {
    return;
  }

  if ( mode === "color" ) {
    p.push();
    p.noStroke();
    p.fill( ...( bg.color ?? [
      0,
      0,
      0
    ] ) );
    p.rect(
      0,
      0,
      p.width,
      p.height
    );
    p.pop();

    return;
  }

  if ( mode === "original" ) {
    p.image(
      state.photoG,
      0,
      0
    );

    return;
  }

  // blur / dim: a full-bleed copy of the photo behind the cut-out.
  const g = state.bgG;

  g.clear();

  if ( mode === "blur" ) {
    g.drawingContext.filter = `blur(${ bg.blur ?? 0 }px)`;
  }

  imageUtils.marginImage( {
    img: photo.img,
    graphics: g,
    position: p.createVector(
      p.width / 2,
      p.height / 2
    ),
    margin: 0,
    scale: 1,
    center: true,
    fill: true
  } );

  g.drawingContext.filter = "none";

  p.image(
    g,
    0,
    0,
    p.width,
    p.height
  );

  if ( mode === "dim" ) {
    p.push();
    p.noStroke();
    p.fill(
      0,
      0,
      0,
      clamp(
        bg.dim ?? 0,
        0,
        1
      ) * 255
    );
    p.rect(
      0,
      0,
      p.width,
      p.height
    );
    p.pop();
  }
}

function drawSubject( p ) {
  if ( !state.subject ) {
    return;
  }

  const {
    margin, scale, center, fill
  } = photoSettings();
  const subjectScale = options.sketch?.subject?.scale ?? 1;
  const shadow = options.sketch?.subject?.shadow ?? {};

  p.push();

  if ( shadow.enabled ) {
    const [
      r = 0,
      g = 0,
      b = 0,
      a = 255
    ] = shadow.color ?? [];

    p.drawingContext.shadowColor = `rgba(${ r }, ${ g }, ${ b }, ${ a / 255 })`;
    p.drawingContext.shadowBlur = shadow.blur ?? 0;
    p.drawingContext.shadowOffsetX = shadow.offsetX ?? 0;
    p.drawingContext.shadowOffsetY = shadow.offsetY ?? 0;
  }

  imageUtils.marginImage( {
    img: state.subject,
    position: p.createVector(
      p.width / 2,
      p.height / 2
    ),
    margin: p.width * margin,
    scale: scale * subjectScale,
    center,
    clip: false,
    fill
  } );

  p.pop();
}

/* ------------------------------------------------------------------ */
/*  Lifecycle                                                           */
/* ------------------------------------------------------------------ */

sketch.setup( () => {
  const p = getP5();

  p.background( ...options.sketch.backgroundColor );

  state.imagePath = resolveImagePath( options.sketch?.photo?.image );
  state.points = [];
  state.pointsSyncHash = null;
  state.subject = null;
  state.builtVersion = -1;
  state.maskDirty = false;

  segmenter.reset();
  segmenter.setImage( state.imagePath );
  syncPoints();

  subscribeSketchOptions( (
    newOptions, origin
  ) => {
    // Only react to user edits from the form; sketch-origin writes (the click
    // handler) are already applied locally.
    if ( origin !== "react" ) {
      return;
    }

    const sk = newOptions.sketch ?? {};
    const nextImage = resolveImagePath( sk.photo?.image );

    if ( nextImage !== state.imagePath ) {
      state.imagePath = nextImage;
      state.subject = null;
      segmenter.setImage( nextImage );

      return;
    }

    // Point-list edits are adopted from the draw loop via syncPoints().

    const seg = sk.segmentation ?? {};

    if (
      ( seg.inverse ?? true ) !== state.builtWith.inverse ||
      ( seg.edgeSoftness ?? 0 ) !== state.builtWith.softness ||
      ( seg.edgeExpand ?? 0 ) !== state.builtWith.expand
    ) {
      state.maskDirty = true;
    }
  } );

  // Fire-and-forget: awaiting init would block setup (and therefore the first
  // draw) on the ~4s model-load + prewarm. Instead the photo renders right away
  // and the draw loop segments each focus point as soon as the processor is
  // ready.
  mediapipeInit( {
    enableIdle: false,
    worker: false,
    enableCapture: false, // image-based interactive segmentation: no camera
    tasks: [
      "interactive"
    ]
  } ).catch( ( error ) => {
    console.error(
      "[photo-segmentation] mediapipe init failed",
      error
    );
  } );
} );

events.register(
  "engine-canvas-mouse-clicked",
  ( event ) => {
    handlePointerSelect( getInternalCanvasPoint( event ) );
  }
);

sketch.draw( () => {
  const p = getP5();

  p.background( ...options.sketch.backgroundColor );

  const photo = common.getAsset( state.imagePath );

  if ( !photo?.img?.width ) {
    p.frameRate( 1 );
    string.write(
      "photo-segmentation:\n\nadd a photo :)",
      0,
      0,
      {
        size: 72,
        stroke: p.color( 255 ),
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

  p.frameRate( options.animation.framerate );
  ensureCanvasGraphics( p );

  // Adopt external point edits, then let the segmenter pump one inference
  // per point that is still missing its mask.
  syncPoints();
  segmenter.update( photo );

  if ( state.maskDirty || state.builtVersion !== segmenter.version ) {
    state.maskDirty = false;
    state.builtVersion = segmenter.version;
    rebuildSubject();
  }

  drawPhotoLayer( photo );
  drawBackground(
    p,
    photo
  );

  // Backdrop → subject → markers: the union cut-out sits on top.

  drawSubject( p );

  const marker = options.sketch?.marker ?? {};

  if ( marker.show ) {
    drawFocusMarkers(
      p,
      state.points,
      state.photoRect,
      marker
    );
  }
} );

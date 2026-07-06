import options from "@/p5/utils/options.js";
import events from "@/p5/utils/events.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import string from "@/p5/utils/string.js";
import imageUtils from "@/p5/utils/imageUtils.js";
import easing from "@/p5/utils/easing.js";
import * as common from "@/p5/utils/common.js";
import mediapipe, {
  init as mediapipeInit,
  interact
} from "@/p5/utils/mediapipe/mediapipe.js";
import {
  drawSegmentationMask
} from "@/p5/utils/segmentation.js";
import {
  setSketchOptions,
  subscribeSketchOptions
} from "@/p5/shared/syncSketchOptions.js";
import {
  initInteraction,
  getPointerGroups
} from "@/p5/utils/interaction/index.js";
import {
  createDraggable
} from "@/p5/utils/interaction/draggable.js";

/* ------------------------------------------------------------------ */
/*  What this sketch does                                              */
/* ------------------------------------------------------------------ */
//
// The "photo trail" IG trend: pick a photo, click the subject to cut it out
// (MediaPipe interactive segmentation, reused from photo-segmentation), then a
// flowing colour trail is painted UNDER the cut-out subject but OVER the rest of
// the photo — so the streaks look like they pour out from behind the subject.
//
// Three things make the trail feel handmade:
//   1. A draggable spline sets the trail's direction. The control points are a
//      persisted, normalized (0..1) list you drag on the canvas (same drag layer
//      the splines sketches use), so the trail survives resizes / export.
//   2. Size progression with easing: the band's half-width is interpolated from
//      `widthStart` → `widthEnd` through a chosen easing along the trail length,
//      so it can fan out, pinch to a point, or swell in the middle.
//   3. The strand colours are sampled from the photo itself at the trail root,
//      so the streaks carry the subject's own colours (like a smear of it).

/* ------------------------------------------------------------------ */
/*  Sketch state                                                       */
/* ------------------------------------------------------------------ */

const state = {
  imagePath: null,

  // Last focus point sent to the segmenter, normalized (0-1) image space.
  roi: {
    x: 0.5,
    y: 0.5
  },

  rawMask: null,
  lastResultAt: null,
  subject: null,
  builtWith: {
    inverse: null,
    softness: null,
    expand: null
  },
  maskDirty: false,
  pendingSegment: false,

  // Where the (unscaled) photo sits on the canvas — used to translate a click
  // into a point on the image and to sample photo colours for the trail.
  photoRect: {
    x: 0,
    y: 0,
    w: 0,
    h: 0
  },

  // Trail spline control points, normalized [0..1]. Working copy of
  // options.sketch.trail.spline.items.
  points: [],
  // JSON of the items we last read from / wrote to the store, so an external
  // edit (form, reload) is told apart from our own drag write.
  syncHash: null,

  // Cached per-strand colours + the signature they were built with.
  palette: null,
  paletteSig: null,

  // Reused graphics buffers.
  photoG: null,
  bgG: null,
  binaryMaskG: null,
  softMaskG: null
};

// Shared grab → move → release drag layer (mouse + touch built in).
const draggable = createDraggable();

/* ------------------------------------------------------------------ */
/*  Small helpers                                                       */
/* ------------------------------------------------------------------ */

function clamp(
  value, min, max
) {
  return value < min ? min : value > max ? max : value;
}

function clamp01( value ) {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function lerp(
  a, b, t
) {
  return a + ( b - a ) * t;
}

function isPoint( value ) {
  return !!value && typeof value.x === "number" && typeof value.y === "number";
}

// The `image` option is a plain path, but the asset picker may persist it as a
// single-element array — accept either so the sketch never loses the photo.
function resolveImagePath( value ) {
  if ( Array.isArray( value ) ) {
    return value.find( Boolean ) ?? null;
  }

  return value || null;
}

function currentRoi() {
  const roi = options.sketch?.segmentation?.roi;

  if ( roi && typeof roi.x === "number" && typeof roi.y === "number" ) {
    return {
      x: clamp(
        roi.x,
        0,
        1
      ),
      y: clamp(
        roi.y,
        0,
        1
      )
    };
  }

  return {
    x: 0.5,
    y: 0.5
  };
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
    const g = state[ key ];

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

  g.pixelDensity( 1 );

  return g;
}

/* ------------------------------------------------------------------ */
/*  Trail spline points (draggable, persisted)                          */
/* ------------------------------------------------------------------ */

function adoptPoints( items ) {
  state.points = items.map( ( n ) => ( {
    x: n.x,
    y: n.y
  } ) );
  state.syncHash = JSON.stringify( items );
}

// Persist the working copy back into the saved options so it survives reloads
// and is exported with the template. Origin "p5" so the options module skips its
// own change handler (no feedback loop), while React still picks the new values.
function persistPoints() {
  const items = state.points.map( ( n ) => ( {
    x: n.x,
    y: n.y
  } ) );

  state.syncHash = JSON.stringify( items );

  setSketchOptions(
    {
      sketch: {
        trail: {
          spline: {
            items
          }
        }
      }
    },
    "p5"
  );
}

// Reconcile the working copy with the stored options (skipped while a drag is in
// flight so the grabbed point isn't snapped back to a stale value).
function syncPoints( cfg ) {
  const items = Array.isArray( cfg?.items ) ? cfg.items : [];
  const valid = items.length >= 2 && items.every( isPoint );

  if ( !valid ) {
    if ( state.points.length < 2 ) {
      state.points = [
        {
          x: 0.3,
          y: 0.6
        },
        {
          x: 0.7,
          y: 0.4
        }
      ];
    }

    return;
  }

  if ( state.syncHash === null || JSON.stringify( items ) !== state.syncHash ) {
    adoptPoints( items );
  }
}

/* ------------------------------------------------------------------ */
/*  Click → image-point mapping (robust to CSS scaling / margins / zoom) */
/* ------------------------------------------------------------------ */

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

// A click that lands on a trail handle is a drag, not a focus pick — the handle
// hit-test keeps the two gestures from fighting.
function nearHandle( point ) {
  const p = getP5();
  const grabRadius = options.sketch?.trail?.grabRadius ?? 44;

  return state.points.some( ( n ) => {
    const dx = n.x * p.width - point.x;
    const dy = n.y * p.height - point.y;

    return Math.hypot(
      dx,
      dy
    ) <= grabRadius;
  } );
}

// Map a canvas point onto the photo and, if it lands on the image, store the
// focus point and re-run the segmenter exactly where the user clicked.
function handlePointerSelect( point ) {
  if ( !point || draggable.dragging || nearHandle( point ) ) {
    return;
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

  const roi = {
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
  };

  state.roi = roi;

  setSketchOptions(
    {
      sketch: {
        segmentation: {
          roi
        }
      }
    },
    "p5"
  );

  triggerSegmentation();
}

/* ------------------------------------------------------------------ */
/*  Segmentation                                                        */
/* ------------------------------------------------------------------ */

function triggerSegmentation() {
  const photo = common.getAsset( state.imagePath );

  if ( !photo?.img?.width || !mediapipe.processor.ready ) {
    state.pendingSegment = true;

    return;
  }

  const roi = currentRoi();
  const imageElement = photo.img.canvas || photo.img.elt || photo.img;

  interact(
    roi.x * photo.img.width,
    roi.y * photo.img.height,
    imageElement
  );
}

function smoothstep( t ) {
  const c = clamp(
    t,
    0,
    1
  );

  return c * c * ( 3 - 2 * c );
}

// Build the cut-out from the latest raw mask using the current edge settings.
function rebuildSubject() {
  const photo = common.getAsset( state.imagePath );
  const raw = state.rawMask;

  if ( !photo?.img?.width || !raw?.data ) {
    return;
  }

  const {
    data, width, height
  } = raw;
  const seg = options.sketch?.segmentation ?? {};
  const inverse = seg.inverse ?? true;
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

  drawSegmentationMask(
    binary,
    data,
    [
      255,
      255,
      255,
      255
    ],
    inverse
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
/*  Trail geometry                                                      */
/* ------------------------------------------------------------------ */

// One Catmull-Rom sample between p1 and p2 (p0 / p3 are the neighbours that give
// the segment its tangents). Uniform, tension 0.5 — the classic smooth spline.
function catmullPoint(
  p0, p1, p2, p3, t
) {
  const t2 = t * t;
  const t3 = t2 * t;

  return {
    x:
      0.5 *
      ( 2 * p1.x +
        ( -p0.x + p2.x ) * t +
        ( 2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x ) * t2 +
        ( -p0.x + 3 * p1.x - 3 * p2.x + p3.x ) * t3 ),
    y:
      0.5 *
      ( 2 * p1.y +
        ( -p0.y + p2.y ) * t +
        ( 2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y ) * t2 +
        ( -p0.y + 3 * p1.y - 3 * p2.y + p3.y ) * t3 )
  };
}

// Densify the control points into a smooth open polyline (pixel space).
function buildCenterline(
  pointsPx, samplesPerSegment
) {
  const n = pointsPx.length;

  if ( n < 2 ) {
    return pointsPx.slice();
  }

  const at = ( i ) => pointsPx[ clamp(
    i,
    0,
    n - 1
  ) ];
  const out = [];

  for ( let i = 0; i < n - 1; i++ ) {
    const p0 = at( i - 1 );
    const p1 = at( i );
    const p2 = at( i + 1 );
    const p3 = at( i + 2 );

    for ( let s = 0; s < samplesPerSegment; s++ ) {
      out.push( catmullPoint(
        p0,
        p1,
        p2,
        p3,
        s / samplesPerSegment
      ) );
    }
  }

  out.push( {
    x: pointsPx[ n - 1 ].x,
    y: pointsPx[ n - 1 ].y
  } );

  return out;
}

// Unit normals per centreline vertex (perpendicular to the local tangent).
function buildNormals( center ) {
  const n = center.length;
  const normals = new Array( n );

  for ( let i = 0; i < n; i++ ) {
    const a = center[ Math.max(
      0,
      i - 1
    ) ];
    const b = center[ Math.min(
      n - 1,
      i + 1
    ) ];
    let tx = b.x - a.x;
    let ty = b.y - a.y;
    const len = Math.hypot(
      tx,
      ty
    ) || 1;

    tx /= len;
    ty /= len;
    normals[ i ] = {
      x: -ty,
      y: tx
    };
  }

  return normals;
}

// Half-width of the band at position t (0 = root/subject, 1 = tip), driven by
// the size-progression easing between the start and end multipliers.
function halfWidthAt(
  t, baseHalf, cfg, easeFn
) {
  const startMul = cfg.widthStart ?? 1;
  const endMul = cfg.widthEnd ?? 0.15;
  const eased = easeFn( clamp01( t ) );

  return baseHalf * lerp(
    startMul,
    endMul,
    eased
  );
}

/* ------------------------------------------------------------------ */
/*  Trail colours                                                       */
/* ------------------------------------------------------------------ */

function hueToRgb(
  h, s, l
) {
  const a = s * Math.min(
    l,
    1 - l
  );
  const f = ( n ) => {
    const k = ( n + h / 30 ) % 12;

    return l - a * Math.max(
      -1,
      Math.min(
        k - 3,
        9 - k,
        1
      )
    );
  };

  return [
    Math.round( f( 0 ) * 255 ),
    Math.round( f( 8 ) * 255 ),
    Math.round( f( 4 ) * 255 )
  ];
}

// Sample the source photo at a canvas point, mapped through photoRect. Returns
// null when the point falls outside the image.
function samplePhotoColor(
  photo, cx, cy
) {
  const {
    x, y, w, h
  } = state.photoRect;

  if ( w <= 0 || h <= 0 ) {
    return null;
  }

  const u = ( cx - x ) / w;
  const v = ( cy - y ) / h;

  if ( u < 0 || u > 1 || v < 0 || v > 1 ) {
    return null;
  }

  const ix = clamp(
    Math.floor( u * photo.img.width ),
    0,
    photo.img.width - 1
  );
  const iy = clamp(
    Math.floor( v * photo.img.height ),
    0,
    photo.img.height - 1
  );
  const c = photo.img.get(
    ix,
    iy
  );

  if ( !c || c[ 3 ] === 0 ) {
    return null;
  }

  return [
    c[ 0 ],
    c[ 1 ],
    c[ 2 ]
  ];
}

// Build one colour per strand. In "photo" mode each strand samples the photo at
// its offset near the trail root, so the streaks carry the subject's own colours;
// "gradient" lerps between two picks; "rainbow" sweeps the hue wheel.
function buildPalette(
  photo, strands, center, normals, baseHalf, cfg
) {
  const mode = cfg.colorMode ?? "photo";
  const startMul = cfg.widthStart ?? 1;
  const rootHalf = baseHalf * startMul;
  const palette = [];
  const fallback = [
    255,
    255,
    255
  ];

  for ( let s = 0; s < strands; s++ ) {
    const u = strands > 1 ? s / ( strands - 1 ) : 0.5;
    const offset = ( u - 0.5 ) * 2;

    if ( mode === "rainbow" ) {
      const hue =
        ( ( cfg.hueOffset ?? 0 ) + u * 360 * ( cfg.hueSpread ?? 1 ) ) % 360;

      palette.push( hueToRgb(
        ( hue + 360 ) % 360,
        0.8,
        0.6
      ) );

      continue;
    }

    if ( mode === "gradient" ) {
      const a = cfg.colorA ?? [
        255,
        120,
        40
      ];
      const b = cfg.colorB ?? [
        40,
        180,
        255
      ];

      palette.push( [
        Math.round( lerp(
          a[ 0 ],
          b[ 0 ],
          u
        ) ),
        Math.round( lerp(
          a[ 1 ],
          b[ 1 ],
          u
        ) ),
        Math.round( lerp(
          a[ 2 ],
          b[ 2 ],
          u
        ) )
      ] );

      continue;
    }

    // "photo": sample the image across the band at the root.
    const rx = center[ 0 ].x + normals[ 0 ].x * offset * rootHalf;
    const ry = center[ 0 ].y + normals[ 0 ].y * offset * rootHalf;
    const sampled =
      samplePhotoColor(
        photo,
        rx,
        ry
      ) ||
      samplePhotoColor(
        photo,
        center[ 0 ].x,
        center[ 0 ].y
      ) ||
      palette[ s - 1 ] ||
      fallback;

    palette.push( sampled );
  }

  return palette;
}

function paletteSignature(
  photo, strands, cfg
) {
  const p = getP5();
  const root = state.points[ 0 ] ?? {
    x: 0.5,
    y: 0.5
  };

  return [
    state.imagePath,
    strands,
    cfg.colorMode ?? "photo",
    cfg.width ?? 0,
    cfg.widthStart ?? 1,
    Math.round( root.x * 200 ),
    Math.round( root.y * 200 ),
    p.width,
    p.height,
    JSON.stringify( cfg.colorA ?? [] ),
    JSON.stringify( cfg.colorB ?? [] ),
    cfg.hueOffset ?? 0,
    cfg.hueSpread ?? 1
  ].join( "|" );
}

/* ------------------------------------------------------------------ */
/*  Rendering                                                           */
/* ------------------------------------------------------------------ */

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
  const mode = bg.mode ?? "original";

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

// The trail itself: a bundle of colour strands flowing along the spline, each
// offset perpendicular to the centreline so the band tapers/fans with the
// size-progression easing, fading and thinning toward its tip.
function drawTrail(
  p, photo
) {
  const cfg = options.sketch?.trail ?? {};

  if ( !cfg.enabled || state.points.length < 2 ) {
    return;
  }

  const pointsPx = state.points.map( ( n ) => ( {
    x: n.x * p.width,
    y: n.y * p.height
  } ) );
  const center = buildCenterline(
    pointsPx,
    24
  );
  const normals = buildNormals( center );
  const n = center.length;

  if ( n < 2 ) {
    return;
  }

  const strands = Math.max(
    1,
    Math.round( cfg.strands ?? 24 )
  );
  const baseHalf =
    ( cfg.width ?? 0.22 ) * Math.min(
      p.width,
      p.height
    ) * 0.5;
  const easeFn = easing[ cfg.widthEasing ] ?? easing.easeOutQuad;
  const weight = cfg.weight ?? 4;
  const glow = Math.max(
    0,
    Math.round( cfg.glow ?? 1 )
  );
  const opacity = clamp(
    cfg.opacity ?? 1,
    0,
    1
  );
  const fade = clamp(
    cfg.fade ?? 0.6,
    0,
    1
  );
  const lengthFrac = clamp(
    cfg.length ?? 1,
    0.05,
    1
  );
  const tipSpread = clamp(
    cfg.tipSpread ?? 0.35,
    0,
    1
  );

  const sig = paletteSignature(
    photo,
    strands,
    cfg
  );

  if ( sig !== state.paletteSig || !state.palette ) {
    state.palette = buildPalette(
      photo,
      strands,
      center,
      normals,
      baseHalf,
      cfg
    );
    state.paletteSig = sig;
  }

  const palette = state.palette;

  // Pre-compute band half-widths per centreline vertex once.
  const halfWidths = new Array( n );

  for ( let i = 0; i < n; i++ ) {
    halfWidths[ i ] = halfWidthAt(
      i / ( n - 1 ),
      baseHalf,
      cfg,
      easeFn
    );
  }

  p.push();
  p.noFill();
  p.strokeCap( p.ROUND );
  p.strokeJoin( p.ROUND );
  p.drawingContext.globalCompositeOperation =
    cfg.blend === "screen" ? "screen" : "source-over";

  for ( let s = 0; s < strands; s++ ) {
    const u = strands > 1 ? s / ( strands - 1 ) : 0.5;
    const offset = ( u - 0.5 ) * 2;
    const color = palette[ s ] ?? [
      255,
      255,
      255
    ];

    // Outer strands stop shorter so the tip fans out instead of ending square.
    const strandLength = lengthFrac * lerp(
      1,
      1 - tipSpread,
      Math.abs( offset )
    );
    const lastIndex = Math.max(
      1,
      Math.floor( strandLength * ( n - 1 ) )
    );

    for ( let layer = glow; layer >= 0; layer-- ) {
      const layerWeight = weight * ( 1 + layer * 1.6 );
      const layerAlpha = layer === 0 ? 1 : 0.28;

      for ( let i = 0; i < lastIndex; i++ ) {
        const t = i / ( n - 1 );
        const localT = strandLength > 0 ? t / strandLength : 1;
        const tipAlpha = 1 - fade * clamp01( localT );
        const a = center[ i ];
        const b = center[ i + 1 ];
        const hwA = halfWidths[ i ];
        const hwB = halfWidths[ i + 1 ];

        p.stroke(
          color[ 0 ],
          color[ 1 ],
          color[ 2 ],
          opacity * layerAlpha * tipAlpha * 255
        );
        p.strokeWeight( layerWeight );
        p.line(
          a.x + normals[ i ].x * offset * hwA,
          a.y + normals[ i ].y * offset * hwA,
          b.x + normals[ i + 1 ].x * offset * hwB,
          b.y + normals[ i + 1 ].y * offset * hwB
        );
      }
    }
  }

  p.drawingContext.globalCompositeOperation = "source-over";
  p.pop();
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

// Draggable handles + the raw spline path, drawn on top so the user can shape
// the trail. Hidden for a clean final render via `spline.showHandles`.
function drawHandles(
  p, hovers, grabbed
) {
  const cfg = options.sketch?.trail?.spline ?? {};

  if ( !cfg.showHandles ) {
    return;
  }

  const pointsPx = state.points.map( ( n ) => ( {
    x: n.x * p.width,
    y: n.y * p.height
  } ) );

  p.push();

  // Dashed guide through the raw control points.
  p.noFill();
  p.stroke(
    255,
    255,
    255,
    120
  );
  p.strokeWeight( 1.5 );
  p.drawingContext.setLineDash( [
    8,
    8
  ] );
  p.beginShape();
  pointsPx.forEach( ( v ) => p.vertex(
    v.x,
    v.y
  ) );
  p.endShape();
  p.drawingContext.setLineDash( [] );

  pointsPx.forEach( (
    v, index
  ) => {
    const isGrabbed = grabbed.has( index );
    const isHover = hovers.has( index );

    p.noStroke();
    p.fill(
      255,
      255,
      255,
      isGrabbed || isHover ? 255 : 200
    );
    p.circle(
      v.x,
      v.y,
      isGrabbed ? 22 : 16
    );
    p.fill(
      10,
      12,
      18,
      255
    );
    p.circle(
      v.x,
      v.y,
      isGrabbed ? 10 : 7
    );

    if ( isGrabbed || isHover ) {
      p.noFill();
      p.stroke(
        120,
        200,
        255,
        230
      );
      p.strokeWeight( 2 );
      p.circle(
        v.x,
        v.y,
        30
      );
    }
  } );

  p.pop();
}

function drawMarker( p ) {
  const marker = options.sketch?.marker ?? {};

  if ( !marker.show ) {
    return;
  }

  const roi = currentRoi();
  const {
    x, y, w, h
  } = state.photoRect;

  if ( w <= 0 || h <= 0 ) {
    return;
  }

  p.push();
  p.noFill();
  p.stroke( ...( marker.color ?? [
    255
  ] ) );
  p.strokeWeight( marker.weight ?? 3 );
  p.circle(
    x + roi.x * w,
    y + roi.y * h,
    ( marker.radius ?? 16 ) * 2
  );
  p.pop();
}

/* ------------------------------------------------------------------ */
/*  Lifecycle                                                           */
/* ------------------------------------------------------------------ */

sketch.setup( async() => {
  const p = getP5();

  p.background( ...options.sketch.backgroundColor );

  state.imagePath = resolveImagePath( options.sketch?.photo?.image );
  state.roi = currentRoi();
  state.points = [];
  state.syncHash = null;
  state.palette = null;
  state.paletteSig = null;

  // Re-arm the drag layer's listeners (the engine's event registry is cleared
  // on reset).
  draggable.attach();

  subscribeSketchOptions( (
    newOptions, origin
  ) => {
    if ( origin !== "react" ) {
      return;
    }

    const sk = newOptions.sketch ?? {};
    const nextImage = resolveImagePath( sk.photo?.image );

    if ( nextImage !== state.imagePath ) {
      state.imagePath = nextImage;
      state.rawMask = null;
      state.subject = null;
      state.lastResultAt = null;
      state.pendingSegment = true;
      state.paletteSig = null;

      return;
    }

    const roi = sk.segmentation?.roi;

    if ( roi && ( roi.x !== state.roi.x || roi.y !== state.roi.y ) ) {
      state.roi = {
        x: roi.x,
        y: roi.y
      };
      triggerSegmentation();
    }

    const seg = sk.segmentation ?? {};

    if (
      ( seg.inverse ?? true ) !== state.builtWith.inverse ||
      ( seg.edgeSoftness ?? 0 ) !== state.builtWith.softness ||
      ( seg.edgeExpand ?? 0 ) !== state.builtWith.expand
    ) {
      state.maskDirty = true;
    }
  } );

  state.pendingSegment = true;

  await initInteraction( options.sketch?.interaction ?? {} ).catch( () => {} );

  // Fire-and-forget: awaiting the model load would block the first draw.
  mediapipeInit( {
    enableIdle: false,
    worker: false,
    enableCapture: false,
    tasks: [
      "interactive"
    ]
  } ).catch( ( error ) => {
    console.error(
      "[photo-trail] mediapipe init failed",
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
      "photo-trail:\n\nadd a photo :)",
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

  const cfg = options.sketch?.trail?.spline ?? {};

  // Re-sync spline points from the store only when nothing is being dragged.
  if ( !draggable.dragging ) {
    syncPoints( cfg );
  }

  // Kick off a deferred segmentation once everything it needs is available.
  if (
    state.pendingSegment &&
    mediapipe.processor.ready &&
    !mediapipe.processor.busy
  ) {
    state.pendingSegment = false;
    triggerSegmentation();
  }

  const result = mediapipe.tasks.interactive;

  if ( result?.result && result.updatedAt !== state.lastResultAt ) {
    state.lastResultAt = result.updatedAt;
    state.rawMask = result.result;
    state.maskDirty = true;
  }

  if ( state.maskDirty && state.rawMask ) {
    state.maskDirty = false;
    rebuildSubject();
  }

  drawPhotoLayer( photo );
  drawBackground(
    p,
    photo
  );

  // Trail sits between the backdrop and the cut-out subject.
  drawTrail(
    p,
    photo
  );

  drawSubject( p );

  // Drag the spline handles (mouse + touch). Points move in normalized space.
  const interaction = options.sketch?.interaction ?? {};
  const grabRadius = options.sketch?.trail?.grabRadius ?? 44;
  const pointsPx = state.points.map( ( n ) => p.createVector(
    n.x * p.width,
    n.y * p.height
  ) );
  const groups = getPointerGroups( interaction );

  const {
    hovers,
    grabbed,
    released
  } = draggable.update( {
    targets: pointsPx,
    radius: grabRadius,
    groups,
    onMove: (
      index, pointer
    ) => {
      const moved = {
        x: clamp01( pointer.x / p.width ),
        y: clamp01( pointer.y / p.height )
      };

      state.points[ index ] = moved;
    }
  } );

  if ( released ) {
    persistPoints();
  }

  drawHandles(
    p,
    hovers,
    grabbed
  );
  drawMarker( p );
} );

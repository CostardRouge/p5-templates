import options from "@/p5/utils/options.js";
import events from "@/p5/utils/events.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import string from "@/p5/utils/string.js";
import imageUtils from "@/p5/utils/imageUtils.js";
import * as common from "@/p5/utils/common.js";
import animation from "@/p5/utils/animation.js";
import easing from "@/p5/utils/easing.js";
import {
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
import {
  createDraggable,
  nearestTargetIndex
} from "@/p5/utils/interaction/draggable.js";

/* ------------------------------------------------------------------ */
/*  photo-trail-effect-v1                                              */
/*                                                                     */
/*  The Instagram "trail effect": ribbons of pixels sampled across a   */
/*  band of the photo are stretched along a curve until they leave the */
/*  canvas, and the segmented subject is drawn back on top so the      */
/*  trails appear to pass BEHIND it. Layer stack, bottom to top:       */
/*                                                                     */
/*    1. the full photo (original / blur / dim / color backdrop),      */
/*    2. the trails,                                                   */
/*    3. the subject cut out with MediaPipe's interactive segmenter.   */
/*       Click the photo to pick a subject (an animal, a person, …) —  */
/*       every click adds a focus point with its own mask, the cut-out */
/*       is their union, and clicking a focus marker (the circle with  */
/*       the minus) unpicks that zone again.                           */
/*                                                                     */
/*  Every trail is defined by draggable, persisted handles             */
/*  (normalized 0..1 so they survive resizes and exports):             */
/*                                                                     */
/*    - band A/B: the cross-section whose pixels become the ribbon's   */
/*      colours. Its length IS the ribbon width, so the band can take  */
/*      just the body of a bird and leave the head and legs out.       */
/*    - guide 1/2 (spline direction mode): control points that steer   */
/*      the ribbon toward the canvas edge, rounded with the same       */
/*      Chaikin corner-cutting as the splines category.                */
/* ------------------------------------------------------------------ */

// Slices overlap a hair so the ribbon has no seams on tight curves.
const SLICE_OVERLAP = 1.5;
// The wave offset eases in over this fraction of the ribbon so the root
// stays glued to the band.
const WAVE_RAMP = 0.18;
const MAX_TRAILS = 12;

/* ------------------------------------------------------------------ */
/*  Sketch state                                                       */
/* ------------------------------------------------------------------ */

const state = {
  // Path of the photo currently driving the segmenter.
  imagePath: null,

  // Working copy of the focus points, normalized (0-1) image space. One
  // mask per point; the subject is their union.
  focusPoints: [],
  focusSyncHash: null,

  // Finished cut-out (photo with the feathered union mask applied).
  subject: null,
  builtWith: {
    inverse: null,
    softness: null,
    expand: null
  },
  // Segmenter mask-set version the cached subject was built from.
  builtVersion: -1,
  maskDirty: false,

  // Where the photo sits on the canvas — used both to map clicks onto the
  // image and to detect layout changes that invalidate the pixel samples.
  photoRect: {
    x: 0,
    y: 0,
    w: 0,
    h: 0
  },

  // Working copy of the trails (normalized handles), synced with
  // options.sketch.trails.items like splines-v2 does with its points.
  trails: [],
  trailsSyncHash: null,

  // Per-trail 1px-tall colour strips (the ribbon cross-sections).
  strips: [],

  // Dirty flags: the trail layer is cached and only re-rendered when
  // something actually changed (or the wave is animated).
  sampleDirty: true,
  stripsDirty: true,
  trailsDirty: true,
  samplePixelsReady: false,

  // Last frame's handle targets, kept for the click-vs-drag arbitration.
  handleTargets: [],
  handleMeta: [],
  handleRadius: 44,

  // Reused graphics buffers.
  photoG: null, // full photo, measures photoRect / "original" backdrop
  bgG: null, // full-bleed backdrop for the blur / dim modes
  sampleG: null, // density-1 copy of the photo layer for pixel sampling
  trailsG: null, // the composited trail layer
  scratchG: null, // one trail at a time, composited with its opacity
  binaryMaskG: null,
  softMaskG: null,

  unregisterClick: null,
  unsubscribe: null
};

const draggable = createDraggable();

// One inference per focus point, run sequentially; masks cached per point.
const segmenter = createMultiMaskSegmenter();

/* ------------------------------------------------------------------ */
/*  Small helpers                                                      */
/* ------------------------------------------------------------------ */

function clamp(
  value, min, max
) {
  return value < min ? min : value > max ? max : value;
}

function clamp01( value ) {
  return clamp(
    value,
    0,
    1
  );
}

function smoothstep( t ) {
  const c = clamp01( t );

  return c * c * ( 3 - 2 * c );
}

// Shortest signed angular difference, in [-PI, PI].
function wrapAngle( delta ) {
  return ( ( delta + Math.PI ) % ( Math.PI * 2 ) + Math.PI * 2 ) % ( Math.PI * 2 ) - Math.PI;
}

// The `image` option is a plain path, but the asset picker may persist it as
// a single-element array — accept either.
function resolveImagePath( value ) {
  if ( Array.isArray( value ) ) {
    return value.find( Boolean ) ?? null;
  }

  return value || null;
}

function sanitizeFocusPoint( value ) {
  if ( !isPoint( value ) ) {
    // A fresh, not-yet-edited form item — park it in the middle.
    return {
      x: 0.5,
      y: 0.5
    };
  }

  return {
    x: clamp01( value.x ),
    y: clamp01( value.y )
  };
}

// The stored focus points. Templates saved before multi-mask kept a single
// `roi` point — adopt it as the first (and only) point. An explicit empty
// `points` array means "no subject picked" and is respected.
function storedFocusPoints() {
  const seg = options.sketch?.segmentation ?? {};

  if ( Array.isArray( seg.points ) ) {
    return seg.points.map( sanitizeFocusPoint );
  }

  if ( isPoint( seg.roi ) ) {
    return [
      sanitizeFocusPoint( seg.roi )
    ];
  }

  return [];
}

// Reconcile the working copy with the stored options (form edit, reload,
// preset): adopt whenever the stored list differs from what we last synced.
function syncFocusPoints() {
  const seg = options.sketch?.segmentation ?? {};
  const raw = Array.isArray( seg.points ) ? seg.points : null;
  const rawHash = JSON.stringify( raw );

  if ( rawHash === state.focusSyncHash ) {
    return;
  }

  state.focusSyncHash = rawHash;
  state.focusPoints = storedFocusPoints();
  segmenter.setPoints( state.focusPoints );
}

// Persist the picked zones so they survive reloads and are exported with
// the template. Origin "p5" so the options module skips its own change
// handler while React still picks the new values up.
function persistFocusPoints() {
  const points = state.focusPoints.map( ( pt ) => ( {
    x: pt.x,
    y: pt.y
  } ) );

  state.focusSyncHash = JSON.stringify( points );

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

function toPx(
  point, p
) {
  return {
    x: point.x * p.width,
    y: point.y * p.height
  };
}

/* ------------------------------------------------------------------ */
/*  Graphics buffers                                                   */
/* ------------------------------------------------------------------ */

function ensureCanvasGraphics( p ) {
  for ( const key of [
    "photoG",
    "bgG",
    "trailsG",
    "scratchG",
    "sampleG"
  ] ) {
    let g = state[ key ];

    if ( !g ) {
      g = p.createGraphics(
        p.width,
        p.height
      );
      state[ key ] = g;

      if ( key === "sampleG" ) {
        // The sampling buffer is read back pixel by pixel — keep it 1:1.
        g.pixelDensity( 1 );
      }
    } else if ( g.width !== p.width || g.height !== p.height ) {
      g.resizeCanvas(
        p.width,
        p.height
      );

      if ( key === "sampleG" ) {
        g.pixelDensity( 1 );
      }

      state.sampleDirty = true;
      state.trailsDirty = true;
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
/*  Click → image-point mapping                                        */
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

// Route a canvas click: a trail handle wins (the drag layer owns it), then
// a focus marker (the circle with the minus) unpicks its zone, and anywhere
// else on the photo picks a new one.
function handleCanvasClick( event ) {
  const point = getInternalCanvasPoint( event );

  if ( !point || draggable.dragging ) {
    return;
  }

  if (
    state.handleTargets.length > 0 &&
    nearestTargetIndex(
      state.handleTargets,
      point.x,
      point.y,
      state.handleRadius
    ) !== -1
  ) {
    return;
  }

  const marker = options.sketch?.marker ?? {};

  if ( marker.show ) {
    const hit = hitFocusMarker(
      state.focusPoints,
      state.photoRect,
      point,
      marker.radius ?? 16
    );

    if ( hit !== -1 ) {
      state.focusPoints.splice(
        hit,
        1
      );
      segmenter.setPoints( state.focusPoints );
      persistFocusPoints();
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

  state.focusPoints.push( {
    x: clamp01( ( point.x - x ) / w ),
    y: clamp01( ( point.y - y ) / h )
  } );
  segmenter.setPoints( state.focusPoints );
  persistFocusPoints();
}

/* ------------------------------------------------------------------ */
/*  Segmentation (same pipeline as photo-segmentation-v1-mask)         */
/* ------------------------------------------------------------------ */

// Build the cut-out from the union of every picked mask using the current
// edge settings: blur the binary union, then remap its alpha through a
// smoothstep whose centre shifts the edge (expand) and whose width sets the
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
  const softness = clamp01( seg.edgeSoftness ?? 0 );
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

  // The union already applied `inverse` per raw mask, so it is passed as
  // false here.
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

    const centre = clamp(
      0.5 - expand * 0.5,
      0.02,
      0.98
    );
    const half = Math.max(
      softness * 0.5,
      0.03
    );
    const lo = clamp01( centre - half );
    const hi = clamp01( centre + half );
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
/*  Photo layers                                                       */
/* ------------------------------------------------------------------ */

// Draw the full photo into the offscreen buffer, record where it landed and
// invalidate the pixel samples when the layout moved.
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
      const rect = {
        x: center ? cx - w / 2 : cx,
        y: center ? cy - h / 2 : cy,
        w,
        h
      };
      const previous = state.photoRect;

      if (
        rect.x !== previous.x ||
        rect.y !== previous.y ||
        rect.w !== previous.w ||
        rect.h !== previous.h
      ) {
        state.sampleDirty = true;
        state.stripsDirty = true;
        state.trailsDirty = true;
      }

      state.photoRect = rect;
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

  // blur / dim: a full-bleed copy of the photo behind everything.
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
      clamp01( bg.dim ?? 0 ) * 255
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

function drawMarkers( p ) {
  const marker = options.sketch?.marker ?? {};

  if ( !marker.show ) {
    return;
  }

  drawFocusMarkers(
    p,
    state.focusPoints,
    state.photoRect,
    marker
  );
}

/* ------------------------------------------------------------------ */
/*  Trail list sync (count-driven, handles persisted like splines-v2)  */
/* ------------------------------------------------------------------ */

function isPoint( value ) {
  return !!value && typeof value.x === "number" && typeof value.y === "number";
}

// A pleasant default for trail `index`: a vertical band around the canvas
// centre, launched toward alternating sides.
function defaultTrail( index ) {
  const side = index % 2 === 0 ? 1 : -1;
  const shift = Math.floor( index / 2 ) * 0.06;

  return {
    band: {
      a: {
        x: clamp01( 0.46 + shift ),
        y: 0.36
      },
      b: {
        x: clamp01( 0.5 + shift ),
        y: 0.64
      }
    },
    guides: {
      a: {
        x: clamp01( 0.5 + 0.22 * side ),
        y: 0.32
      },
      b: {
        x: clamp01( 0.5 + 0.42 * side ),
        y: 0.6
      }
    },
    flip: side < 0,
    phase: ( index * 0.27 ) % 1
  };
}

function sanitizePoint(
  value, fallback
) {
  if ( !isPoint( value ) ) {
    return {
      ...fallback
    };
  }

  return {
    x: clamp01( value.x ),
    y: clamp01( value.y )
  };
}

function sanitizeTrail(
  item, index
) {
  const fallback = defaultTrail( index );

  return {
    band: {
      a: sanitizePoint(
        item?.band?.a,
        fallback.band.a
      ),
      b: sanitizePoint(
        item?.band?.b,
        fallback.band.b
      )
    },
    guides: {
      a: sanitizePoint(
        item?.guides?.a,
        fallback.guides.a
      ),
      b: sanitizePoint(
        item?.guides?.b,
        fallback.guides.b
      )
    },
    flip: typeof item?.flip === "boolean" ? item.flip : fallback.flip,
    phase: typeof item?.phase === "number" ? clamp01( item.phase ) : fallback.phase
  };
}

// Persist the working copy so the handles survive reloads and are exported
// with the template. Origin "p5" so the options module skips its own change
// handler while React still picks the new values up.
function persistTrails() {
  const items = state.trails.map( ( trail ) => ( {
    band: {
      a: {
        ...trail.band.a
      },
      b: {
        ...trail.band.b
      }
    },
    guides: {
      a: {
        ...trail.guides.a
      },
      b: {
        ...trail.guides.b
      }
    },
    flip: trail.flip,
    phase: trail.phase
  } ) );

  state.trailsSyncHash = JSON.stringify( items );

  setSketchOptions(
    {
      sketch: {
        trails: {
          items
        }
      }
    },
    "p5"
  );
}

// Reconcile the working copy with the stored options each frame (skipped
// while a drag is in flight). The count slider is authoritative: growing
// appends generated defaults, shrinking drops the tail — surviving trails
// keep their handles.
function syncTrails( cfg ) {
  const count = clamp(
    Math.round( cfg.count ?? 1 ),
    1,
    MAX_TRAILS
  );
  const rawItems = Array.isArray( cfg.items ) ? cfg.items : [];
  const rawHash = JSON.stringify( rawItems );

  // External edit (form field, reload, preset) → adopt the stored list.
  if ( rawHash !== state.trailsSyncHash ) {
    state.trails = rawItems.map( (
      item, index
    ) => sanitizeTrail(
      item,
      index
    ) );
    state.trailsSyncHash = rawHash;
    state.stripsDirty = true;
    state.trailsDirty = true;
  }

  if ( state.trails.length !== count ) {
    const next = state.trails.slice(
      0,
      count
    );

    while ( next.length < count ) {
      next.push( defaultTrail( next.length ) );
    }

    state.trails = next;
    state.stripsDirty = true;
    state.trailsDirty = true;
    persistTrails();
  }
}

/* ------------------------------------------------------------------ */
/*  Spine geometry                                                     */
/* ------------------------------------------------------------------ */

// Chaikin corner-cutting on an open polyline of plain {x, y} points (same
// algorithm as the splines category, without the p5.Vector churn).
function chaikinOpen(
  points, iterations
) {
  let result = points;

  for ( let i = 0; i < iterations; i++ ) {
    const count = result.length;
    const out = [
      {
        ...result[ 0 ]
      }
    ];

    for ( let j = 0; j < count - 1; j++ ) {
      const a = result[ j ];
      const b = result[ j + 1 ];

      out.push( {
        x: 0.75 * a.x + 0.25 * b.x,
        y: 0.75 * a.y + 0.25 * b.y
      } );
      out.push( {
        x: 0.25 * a.x + 0.75 * b.x,
        y: 0.25 * a.y + 0.75 * b.y
      } );
    }

    out.push( {
      ...result[ count - 1 ]
    } );
    result = out;
  }

  return result;
}

// Resample a polyline at a fixed step so every ribbon slice has the same
// length (even slice spacing = no visible density changes on curves).
function resamplePolyline(
  points, step
) {
  if ( points.length < 2 ) {
    return points;
  }

  const out = [
    {
      ...points[ 0 ]
    }
  ];
  let prev = points[ 0 ];
  let need = step;

  for ( let i = 1; i < points.length; i++ ) {
    const curr = points[ i ];
    let segLen = Math.hypot(
      curr.x - prev.x,
      curr.y - prev.y
    );

    while ( segLen >= need ) {
      const t = need / segLen;
      const next = {
        x: prev.x + ( curr.x - prev.x ) * t,
        y: prev.y + ( curr.y - prev.y ) * t
      };

      out.push( next );
      prev = next;
      segLen -= need;
      need = step;
    }

    need -= segLen;
    prev = curr;
  }

  const last = points[ points.length - 1 ];
  const tail = out[ out.length - 1 ];

  if ( Math.hypot(
    last.x - tail.x,
    last.y - tail.y
  ) > step * 0.25 ) {
    out.push( {
      ...last
    } );
  }

  return out;
}

// Build one trail's spine: an even polyline starting at the band centre and
// running off the canvas. `reverse` mirrors it for the bidirectional mode.
//
//   - "angles" mode integrates a heading that eases from the launch angle
//     (band perpendicular + start angle) to launch + bend: a clean swoosh
//     with no control points at all.
//   - "spline" mode rounds band-centre → guide 1 → guide 2 → exit with
//     Chaikin, so the two guide handles literally steer the ribbon.
function buildSpine(
  trail, direction, step, p, reverse
) {
  const A = toPx(
    trail.band.a,
    p
  );
  const B = toPx(
    trail.band.b,
    p
  );
  const mid = {
    x: ( A.x + B.x ) / 2,
    y: ( A.y + B.y ) / 2
  };
  const diagonal = Math.hypot(
    p.width,
    p.height
  );
  const length = Math.max(
    0.05,
    direction.length ?? 0.75
  ) * diagonal;

  if ( ( direction.mode ?? "angles" ) === "spline" ) {
    let g1 = toPx(
      trail.guides.a,
      p
    );
    let g2 = toPx(
      trail.guides.b,
      p
    );

    if ( reverse ) {
      g1 = {
        x: 2 * mid.x - g1.x,
        y: 2 * mid.y - g1.y
      };
      g2 = {
        x: 2 * mid.x - g2.x,
        y: 2 * mid.y - g2.y
      };
    }

    const exitAngle = Math.atan2(
      g2.y - g1.y,
      g2.x - g1.x
    );
    const exit = {
      x: g2.x + Math.cos( exitAngle ) * length * 0.6,
      y: g2.y + Math.sin( exitAngle ) * length * 0.6
    };
    const dense = chaikinOpen(
      [
        mid,
        g1,
        g2,
        exit
      ],
      clamp(
        Math.round( direction.iterations ?? 4 ),
        0,
        6
      )
    );

    return resamplePolyline(
      dense,
      step
    );
  }

  const bandAngle = Math.atan2(
    B.y - A.y,
    B.x - A.x
  );
  // flip picks which side of the band the ribbon leaves from; reverse (the
  // bidirectional twin) mirrors everything so the pair is point-symmetric.
  const sign = ( trail.flip ? -1 : 1 ) * ( reverse ? -1 : 1 );
  const launch =
    bandAngle -
    Math.PI / 2 +
    ( trail.flip ? Math.PI : 0 ) +
    ( reverse ? Math.PI : 0 ) +
    ( ( direction.startAngle ?? 0 ) * Math.PI / 180 ) * sign;
  const bend = ( ( direction.bend ?? 0 ) * Math.PI / 180 ) * sign;
  const easeFn = easing[ direction.easing ] ?? easing.linear;
  const steps = Math.max(
    2,
    Math.ceil( length / step )
  );
  const ds = length / steps;
  const spine = [
    {
      ...mid
    }
  ];
  let x = mid.x;
  let y = mid.y;

  for ( let i = 1; i <= steps; i++ ) {
    const heading = launch + bend * easeFn( i / steps );

    x += Math.cos( heading ) * ds;
    y += Math.sin( heading ) * ds;
    spine.push( {
      x,
      y
    } );
  }

  return spine;
}

// Push the spine sideways on a sine wave: `twists` full oscillations along
// the ribbon, `warp` bunches them toward the start (>1) or the end (<1),
// `speed` (whole loops per animation cycle) keeps exports seamless.
function applyWave(
  spine, wave, trail, p
) {
  const amplitude = ( wave.amplitude ?? 0 ) * Math.min(
    p.width,
    p.height
  );

  if ( amplitude === 0 || spine.length < 3 ) {
    return spine;
  }

  const twists = wave.twists ?? 1;
  const warp = Math.max(
    0.1,
    wave.warp ?? 1
  );
  const speed = Math.round( wave.speed ?? 0 );
  const animPhase = animation.angle * speed;
  const basePhase = trail.phase * Math.PI * 2;
  const total = spine.length - 1;

  return spine.map( (
    point, index
  ) => {
    const t = index / total;
    const prev = spine[ Math.max(
      0,
      index - 1
    ) ];
    const next = spine[ Math.min(
      total,
      index + 1
    ) ];
    const tx = next.x - prev.x;
    const ty = next.y - prev.y;
    const len = Math.hypot(
      tx,
      ty
    ) || 1;
    const ramp = smoothstep( Math.min(
      1,
      t / WAVE_RAMP
    ) );
    const offset =
      Math.sin( Math.PI * 2 * twists * Math.pow(
        t,
        warp
      ) + basePhase + animPhase ) *
      amplitude *
      ramp;

    return {
      x: point.x - ( ty / len ) * offset,
      y: point.y + ( tx / len ) * offset
    };
  } );
}

/* ------------------------------------------------------------------ */
/*  Colour strips (the ribbon cross-sections)                          */
/* ------------------------------------------------------------------ */

// Redraw the photo into the density-1 sampling buffer and read its pixels
// back once. Only runs when the photo or its layout actually changed.
function rebuildSample( photo ) {
  const p = getP5();
  const {
    margin, scale, center, clip, fill
  } = photoSettings();
  const g = state.sampleG;

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
    fill
  } );
  g.loadPixels();
  state.samplePixelsReady = true;
}

// One strip per trail: a (resolution × 1) buffer whose pixels are the photo
// colours sampled along the band segment A → B. Pixel 0 is the sample at A.
function rebuildStrips(
  p, ribbon
) {
  const resolution = clamp(
    Math.round( ribbon.resolution ?? 96 ),
    2,
    512
  );
  const pixels = state.sampleG.pixels;
  const gw = state.sampleG.width;
  const gh = state.sampleG.height;

  state.trails.forEach( (
    trail, index
  ) => {
    let strip = state.strips[ index ];

    // Reuse the buffer across resolution changes — p5.Graphics.remove() is
    // not safe in this engine context, so never dispose, only resize.
    if ( !strip ) {
      strip = p.createGraphics(
        resolution,
        1
      );
      strip.pixelDensity( 1 );
      state.strips[ index ] = strip;
    } else if ( strip.width !== resolution ) {
      strip.resizeCanvas(
        resolution,
        1
      );
      strip.pixelDensity( 1 );
    }

    const A = toPx(
      trail.band.a,
      p
    );
    const B = toPx(
      trail.band.b,
      p
    );

    strip.loadPixels();

    for ( let i = 0; i < resolution; i++ ) {
      const t = ( i + 0.5 ) / resolution;
      const sx = clamp(
        Math.round( A.x + ( B.x - A.x ) * t ),
        0,
        gw - 1
      );
      const sy = clamp(
        Math.round( A.y + ( B.y - A.y ) * t ),
        0,
        gh - 1
      );
      const si = ( sy * gw + sx ) * 4;
      const di = i * 4;

      strip.pixels[ di ] = pixels[ si ];
      strip.pixels[ di + 1 ] = pixels[ si + 1 ];
      strip.pixels[ di + 2 ] = pixels[ si + 2 ];
      strip.pixels[ di + 3 ] = pixels[ si + 3 ];
    }

    strip.updatePixels();
  } );

  // Drop references to strips beyond the trail count (GC reclaims the
  // offscreen canvases — no explicit dispose, see above).
  state.strips.length = state.trails.length;
}

/* ------------------------------------------------------------------ */
/*  Ribbon painting                                                    */
/* ------------------------------------------------------------------ */

// Stamp the colour strip along the spine, one slightly-overlapping slice
// per segment, each rotated to the local tangent and stretched to the local
// ribbon width. The taper profile scales the width from start to end.
function paintRibbon(
  g, spine, strip, A, B, bandLength, ribbon
) {
  if ( spine.length < 2 ) {
    return;
  }

  const widthStart = ribbon.widthStart ?? 1;
  const widthEnd = ribbon.widthEnd ?? 1;
  const widthEase = easing[ ribbon.widthEasing ] ?? easing.linear;
  const theta0 = Math.atan2(
    spine[ 1 ].y - spine[ 0 ].y,
    spine[ 1 ].x - spine[ 0 ].x
  );
  // Keep the colour sampled at band end A on the A side whatever the launch
  // direction, so a bidirectional pair meets seamlessly at the band.
  const mirror =
    Math.sin( theta0 ) * ( B.x - A.x ) - Math.cos( theta0 ) * ( B.y - A.y ) < 0;
  const total = spine.length - 1;

  // Per-segment tangent angles, needed both for the slice rotation and for
  // the curvature-adaptive overlap below.
  const angles = new Float32Array( total );

  for ( let i = 0; i < total; i++ ) {
    angles[ i ] = Math.atan2(
      spine[ i + 1 ].y - spine[ i ].y,
      spine[ i + 1 ].x - spine[ i ].x
    );
  }

  g.push();
  g.drawingContext.imageSmoothingEnabled = ribbon.smoothing ?? true;

  for ( let i = 0; i < total; i++ ) {
    const a = spine[ i ];
    const b = spine[ i + 1 ];
    const segLen = Math.hypot(
      b.x - a.x,
      b.y - a.y
    );

    if ( segLen === 0 ) {
      continue;
    }

    const t = ( i + 0.5 ) / total;
    const width =
      bandLength *
      ( widthStart + ( widthEnd - widthStart ) * widthEase( t ) );

    if ( width <= 0 ) {
      continue;
    }

    // On tight curves adjacent slices fan apart at the outer edge; lengthen
    // the slice by (width / 2) · turn angle so neighbours keep overlapping.
    const turn = Math.max(
      i > 0 ? Math.abs( wrapAngle( angles[ i ] - angles[ i - 1 ] ) ) : 0,
      i < total - 1 ? Math.abs( wrapAngle( angles[ i + 1 ] - angles[ i ] ) ) : 0
    );
    const overlap = SLICE_OVERLAP + Math.min(
      width,
      width * 0.5 * turn
    );

    g.push();
    g.translate(
      ( a.x + b.x ) / 2,
      ( a.y + b.y ) / 2
    );
    g.rotate( angles[ i ] - Math.PI / 2 );

    if ( mirror ) {
      g.scale(
        -1,
        1
      );
    }

    g.image(
      strip,
      -width / 2,
      -( segLen + overlap ) / 2,
      width,
      segLen + overlap
    );
    g.pop();
  }

  g.pop();
}

// Re-render the cached trail layer when something changed (or every frame
// while the wave is animated).
function renderTrails(
  p, o, photo
) {
  const ribbon = o.ribbon ?? {};
  const wave = o.wave ?? {};
  const direction = o.direction ?? {};
  const animated = ( wave.speed ?? 0 ) > 0 && ( wave.amplitude ?? 0 ) > 0;

  if ( !state.trailsDirty && !animated ) {
    return;
  }

  if ( state.sampleDirty ) {
    rebuildSample( photo );
    state.sampleDirty = false;
    state.stripsDirty = true;
  }

  if ( !state.samplePixelsReady ) {
    return;
  }

  if ( state.stripsDirty ) {
    rebuildStrips(
      p,
      ribbon
    );
    state.stripsDirty = false;
  }

  const step = clamp(
    ribbon.sliceStep ?? 4,
    2,
    16
  );
  const opacity = clamp01( ribbon.opacity ?? 1 );
  const g = state.trailsG;
  const scratch = state.scratchG;

  g.clear();

  state.trails.forEach( (
    trail, index
  ) => {
    const strip = state.strips[ index ];

    if ( !strip ) {
      return;
    }

    const A = toPx(
      trail.band.a,
      p
    );
    const B = toPx(
      trail.band.b,
      p
    );
    const bandLength = Math.hypot(
      B.x - A.x,
      B.y - A.y
    );

    if ( bandLength < 2 ) {
      return;
    }

    scratch.clear();

    const spines = [
      buildSpine(
        trail,
        direction,
        step,
        p,
        false
      )
    ];

    if ( direction.bidirectional ) {
      spines.push( buildSpine(
        trail,
        direction,
        step,
        p,
        true
      ) );
    }

    spines.forEach( ( spine ) => paintRibbon(
      scratch,
      applyWave(
        spine,
        wave,
        trail,
        p
      ),
      strip,
      A,
      B,
      bandLength,
      ribbon
    ) );

    // Each trail composites once with its opacity so the overlapping slices
    // inside the ribbon never show through each other.
    g.drawingContext.globalAlpha = opacity;
    g.image(
      scratch,
      0,
      0
    );
    g.drawingContext.globalAlpha = 1;
  } );

  state.trailsDirty = false;
}

/* ------------------------------------------------------------------ */
/*  Handles overlay                                                    */
/* ------------------------------------------------------------------ */

// Flatten every visible handle into the draggable layer's target list.
// meta[i] tells onMove which trail / which point target i belongs to.
function collectHandles(
  p, o
) {
  const targets = [];
  const meta = [];
  const splineMode = ( o.direction?.mode ?? "angles" ) === "spline";

  state.trails.forEach( (
    trail, index
  ) => {
    targets.push( toPx(
      trail.band.a,
      p
    ) );
    meta.push( {
      trail: index,
      group: "band",
      key: "a"
    } );
    targets.push( toPx(
      trail.band.b,
      p
    ) );
    meta.push( {
      trail: index,
      group: "band",
      key: "b"
    } );

    if ( splineMode ) {
      targets.push( toPx(
        trail.guides.a,
        p
      ) );
      meta.push( {
        trail: index,
        group: "guides",
        key: "a"
      } );
      targets.push( toPx(
        trail.guides.b,
        p
      ) );
      meta.push( {
        trail: index,
        group: "guides",
        key: "b"
      } );
    }
  } );

  return {
    targets,
    meta
  };
}

function drawHandles(
  p, o, hovers, grabbed
) {
  const handles = o.handles ?? {};
  const size = handles.size ?? 16;
  const splineMode = ( o.direction?.mode ?? "angles" ) === "spline";

  p.push();

  state.trails.forEach( ( trail ) => {
    const A = toPx(
      trail.band.a,
      p
    );
    const B = toPx(
      trail.band.b,
      p
    );
    const mid = {
      x: ( A.x + B.x ) / 2,
      y: ( A.y + B.y ) / 2
    };

    // The band itself: the segment whose pixels feed the ribbon.
    p.stroke(
      255,
      255,
      255,
      160
    );
    p.strokeWeight( 2 );
    p.line(
      A.x,
      A.y,
      B.x,
      B.y
    );

    if ( splineMode ) {
      const g1 = toPx(
        trail.guides.a,
        p
      );
      const g2 = toPx(
        trail.guides.b,
        p
      );

      p.stroke(
        120,
        200,
        255,
        120
      );
      p.strokeWeight( 1.5 );
      p.line(
        mid.x,
        mid.y,
        g1.x,
        g1.y
      );
      p.line(
        g1.x,
        g1.y,
        g2.x,
        g2.y
      );

      p.noStroke();

      for ( const guide of [
        g1,
        g2
      ] ) {
        p.push();
        p.translate(
          guide.x,
          guide.y
        );
        p.rotate( Math.PI / 4 );
        p.fill(
          120,
          200,
          255,
          230
        );
        p.rectMode( p.CENTER );
        p.rect(
          0,
          0,
          size * 0.8,
          size * 0.8
        );
        p.pop();
      }
    }

    p.noStroke();

    for ( const end of [
      A,
      B
    ] ) {
      p.fill(
        255,
        255,
        255,
        255
      );
      p.circle(
        end.x,
        end.y,
        size
      );
      p.fill(
        10,
        10,
        14,
        255
      );
      p.circle(
        end.x,
        end.y,
        size * 0.4
      );
    }
  } );

  // Hover / grab rings, same affordance as splines-v2.
  p.noFill();

  hovers.forEach( ( index ) => {
    const target = state.handleTargets[ index ];

    if ( !target || grabbed.has( index ) ) {
      return;
    }

    p.stroke(
      255,
      255,
      255,
      170
    );
    p.strokeWeight( 2 );
    p.circle(
      target.x,
      target.y,
      size * 1.8 + 10
    );
  } );

  grabbed.forEach( ( index ) => {
    const target = state.handleTargets[ index ];

    if ( !target ) {
      return;
    }

    p.stroke(
      120,
      200,
      255,
      230
    );
    p.strokeWeight( 3 );
    p.circle(
      target.x,
      target.y,
      size * 2.1 + 12
    );
  } );

  p.pop();
}

/* ------------------------------------------------------------------ */
/*  Lifecycle                                                          */
/* ------------------------------------------------------------------ */

sketch.setup( () => {
  const p = getP5();

  p.background( ...options.sketch.backgroundColor );

  state.imagePath = resolveImagePath( options.sketch?.photo?.image );

  // Every buffer belongs to the previous p5 instance after a sketch reset —
  // drop them so they are recreated lazily against the fresh one.
  state.photoG = null;
  state.bgG = null;
  state.sampleG = null;
  state.trailsG = null;
  state.scratchG = null;
  state.binaryMaskG = null;
  state.softMaskG = null;
  state.strips = [];
  state.trails = [];
  state.trailsSyncHash = null;
  state.sampleDirty = true;
  state.stripsDirty = true;
  state.trailsDirty = true;
  state.samplePixelsReady = false;
  state.handleTargets = [];
  state.handleMeta = [];
  state.subject = null;
  state.focusPoints = [];
  state.focusSyncHash = null;
  state.builtVersion = -1;
  state.maskDirty = false;

  segmenter.reset();
  segmenter.setImage( state.imagePath );
  syncFocusPoints();

  // Re-arm the listeners (the engine's registries are cleared on reset).
  draggable.attach();
  state.unregisterClick?.();
  state.unregisterClick = events.register(
    "engine-canvas-mouse-clicked",
    handleCanvasClick
  );

  state.unsubscribe?.();
  state.unsubscribe = subscribeSketchOptions( (
    newOptions, origin
  ) => {
    // Only react to user edits from the form; sketch-origin writes (drag
    // persistence, the click handler) are already applied locally.
    if ( origin !== "react" ) {
      return;
    }

    // Any form edit may restyle the trails — cheap to just re-render.
    state.stripsDirty = true;
    state.trailsDirty = true;

    const sk = newOptions.sketch ?? {};
    const nextImage = resolveImagePath( sk.photo?.image );

    if ( nextImage !== state.imagePath ) {
      state.imagePath = nextImage;
      state.subject = null;
      state.sampleDirty = true;
      segmenter.setImage( nextImage );

      return;
    }

    // Point-list edits are adopted from the draw loop via syncFocusPoints().

    const seg = sk.segmentation ?? {};

    if (
      ( seg.inverse ?? true ) !== state.builtWith.inverse ||
      ( seg.edgeSoftness ?? 0 ) !== state.builtWith.softness ||
      ( seg.edgeExpand ?? 0 ) !== state.builtWith.expand
    ) {
      state.maskDirty = true;
    }
  } );

  // Fire-and-forget: awaiting init would block the first draw on the ~4s
  // model load, so the photo and trails render right away and the draw loop
  // segments each focus point as soon as the processor is ready.
  mediapipeInit( {
    enableIdle: false,
    worker: false,
    enableCapture: false, // image-based interactive segmentation: no camera
    tasks: [
      "interactive"
    ]
  } ).catch( ( error ) => {
    console.error(
      "[photo-trail-effect] mediapipe init failed",
      error
    );
  } );
} );

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};

  p.background( ...( o.backgroundColor ?? [
    0
  ] ) );

  const photo = common.getAsset( state.imagePath );

  if ( !photo?.img?.width ) {
    p.frameRate( 1 );
    string.write(
      "photo-trail-effect:\n\nadd a photo :)",
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
  // per focus point that is still missing its mask.
  syncFocusPoints();
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

  // Re-sync the trail list from the store only when nothing is being
  // dragged, so a live drag is never snapped back to a stale value.
  if ( !draggable.dragging ) {
    syncTrails( o.trails ?? {} );
  }

  const showHandles = o.handles?.show ?? true;
  let hovers = new Set();
  let grabbed = new Set();

  if ( showHandles ) {
    const {
      targets, meta
    } = collectHandles(
      p,
      o
    );

    state.handleTargets = targets;
    state.handleMeta = meta;
    state.handleRadius = o.handles?.radius ?? 44;

    const dragResult = draggable.update( {
      targets,
      radius: state.handleRadius,
      onMove: (
        index, pointer
      ) => {
        const info = meta[ index ];
        const trail = state.trails[ info.trail ];

        if ( !trail ) {
          return;
        }

        const moved = {
          x: clamp01( pointer.x / p.width ),
          y: clamp01( pointer.y / p.height )
        };

        trail[ info.group ][ info.key ] = moved;
        targets[ index ] = {
          x: moved.x * p.width,
          y: moved.y * p.height
        };

        if ( info.group === "band" ) {
          state.stripsDirty = true;
        }

        state.trailsDirty = true;
      }
    } );

    hovers = dragResult.hovers;
    grabbed = dragResult.grabbed;

    if ( dragResult.released ) {
      persistTrails();
    }
  } else {
    state.handleTargets = [];
    state.handleMeta = [];
    draggable.idle();
  }

  // Layer 2: the trails, behind the cut-out subject.
  renderTrails(
    p,
    o,
    photo
  );
  p.image(
    state.trailsG,
    0,
    0
  );

  // Layer 3: the segmented subject on top, so the ribbons pass behind it.
  drawSubject( p );

  if ( showHandles ) {
    drawHandles(
      p,
      o,
      hovers,
      grabbed
    );
  }

  drawMarkers( p );
} );

import options from "@/p5/utils/options.js";
import events from "@/p5/utils/events.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import string from "@/p5/utils/string.js";
import * as common from "@/p5/utils/common.js";
import animation from "@/p5/utils/animation.js";
import easing from "@/p5/utils/easing.js";
import {
  init as mediapipeInit
} from "@/p5/utils/mediapipe/mediapipe.js";
import {
  createMultiMaskSegmenter
} from "@/p5/utils/multiSegmentation.js";
import {
  setSketchOptions,
  subscribeSketchOptions
} from "@/p5/shared/syncSketchOptions.js";
import {
  createDraggable,
  nearestTargetIndex
} from "@/p5/utils/interaction/draggable.js";
import {
  clamp,
  clamp01,
  smoothstep,
  wrapAngle,
  sanitizePoint,
  resolveImagePath,
  toPx,
  mirrorPoint,
  ensureLayerGraphics,
  getInternalCanvasPoint,
  createFocusPointStore,
  createSubjectBuilder,
  drawPhotoLayer,
  drawBackdrop,
  drawSubjectLayer,
  drawMarkersLayer,
  buildAngleSpine,
  buildSplineSpine,
  applyWave
} from "../_shared.js";

/* ------------------------------------------------------------------ */
/*  photo-trail-effect-v2-echo                                         */
/*                                                                     */
/*  The "echo" trail: instead of v1's pixel ribbons, the segmented     */
/*  subject ITSELF is stamped repeatedly along a curve — fading,       */
/*  shrinking, optionally rotating and tinted ghost copies trailing    */
/*  behind the cut-out. Layer stack, bottom to top:                    */
/*                                                                     */
/*    1. the full photo (original / blur / dim / color backdrop),      */
/*    2. the ghost copies, far → near,                                 */
/*    3. the subject cut out with MediaPipe's interactive segmenter    */
/*       (same click-to-pick / click-a-marker-to-unpick interaction    */
/*       as v1).                                                       */
/*                                                                     */
/*  The path is defined by draggable, persisted handles (normalized    */
/*  0..1 so they survive resizes and exports):                         */
/*                                                                     */
/*    - anchor: where the ghost trail leaves the subject — drop it on  */
/*      the subject's centre.                                          */
/*    - guide 1/2 (spline direction mode): control points that steer   */
/*      the trail, rounded with the same Chaikin corner-cutting as v1. */
/*                                                                     */
/*  Two loop-safe animations: the shared sideways wave, and `travel`   */
/*  (whole cycles per loop) that marches the ghosts along the path,    */
/*  fading them in at the subject and out at the tail.                 */
/* ------------------------------------------------------------------ */

// Spine sampling step (px) — ghosts only need positions and tangents, not
// v1's slice-dense geometry.
const SPINE_STEP = 6;
const MAX_COPIES = 24;
// While `travel` animates, ghosts fade in/out over this fraction of the
// path so a copy wrapping from the tail back to the subject never pops.
const TRAVEL_RAMP = 0.12;

/* ------------------------------------------------------------------ */
/*  Sketch state                                                       */
/* ------------------------------------------------------------------ */

const state = {
  // Path of the photo currently driving the segmenter.
  imagePath: null,

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
  // image and to size the ghost stamps like the subject layer.
  photoRect: {
    x: 0,
    y: 0,
    w: 0,
    h: 0
  },

  // Working copy of the path handles (normalized), synced with
  // options.sketch.trail like v1 does with its trail list.
  trail: null,
  trailSyncHash: null,

  // The ghost layer is cached and only re-rendered when something actually
  // changed (or the wave / travel is animated).
  echoDirty: true,

  // Last frame's handle targets, kept for the click-vs-drag arbitration.
  handleTargets: [],
  handleMeta: [],
  handleRadius: 44,

  // Reused graphics buffers.
  photoG: null, // full photo, measures photoRect / "original" backdrop
  bgG: null, // full-bleed backdrop for the blur / dim modes
  echoG: null, // the composited ghost layer
  scratchG: null, // one tinted ghost at a time

  unregisterClick: null,
  unsubscribe: null
};

const draggable = createDraggable();

// One inference per focus point, run sequentially; masks cached per point.
const segmenter = createMultiMaskSegmenter();

// Click-to-pick focus points + the feathered cut-out, shared with v1.
const focus = createFocusPointStore( segmenter );
const subjectBuilder = createSubjectBuilder();

/* ------------------------------------------------------------------ */
/*  Clicks & subject                                                   */
/* ------------------------------------------------------------------ */

// Route a canvas click: a path handle wins (the drag layer owns it), then
// the focus store picks / unpicks a zone.
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

  const result = focus.handleClick(
    point,
    state.photoRect,
    options.sketch?.marker ?? {}
  );

  if ( result === "removed" ) {
    state.maskDirty = true;
  }
}

function rebuildSubject() {
  const photo = common.getAsset( state.imagePath );
  const seg = options.sketch?.segmentation ?? {};
  const built = subjectBuilder.build(
    photo,
    segmenter,
    seg
  );

  state.subject = built?.image ?? null;

  if ( built ) {
    state.builtWith = built.builtWith;
  }
}

// Draw the full photo into the offscreen buffer, record where it landed and
// invalidate the ghost layer when the layout moved.
function updatePhotoLayer( photo ) {
  const rect = drawPhotoLayer(
    state.photoG,
    photo
  );

  if ( !rect ) {
    return;
  }

  const previous = state.photoRect;

  if (
    rect.x !== previous.x ||
    rect.y !== previous.y ||
    rect.w !== previous.w ||
    rect.h !== previous.h
  ) {
    state.echoDirty = true;
  }

  state.photoRect = rect;
}

/* ------------------------------------------------------------------ */
/*  Path handle sync (persisted like v1's trail list)                  */
/* ------------------------------------------------------------------ */

function defaultTrailHandles() {
  return {
    anchor: {
      x: 0.47,
      y: 0.35
    },
    guides: {
      a: {
        x: 0.3,
        y: 0.3
      },
      b: {
        x: 0.12,
        y: 0.5
      }
    }
  };
}

function sanitizeTrailHandles( raw ) {
  const fallback = defaultTrailHandles();

  return {
    anchor: sanitizePoint(
      raw?.anchor,
      fallback.anchor
    ),
    guides: {
      a: sanitizePoint(
        raw?.guides?.a,
        fallback.guides.a
      ),
      b: sanitizePoint(
        raw?.guides?.b,
        fallback.guides.b
      )
    }
  };
}

// Persist the working copy so the handles survive reloads and are exported
// with the template. Origin "p5" so the options module skips its own change
// handler while React still picks the new values up.
function persistTrail() {
  const trail = {
    anchor: {
      ...state.trail.anchor
    },
    guides: {
      a: {
        ...state.trail.guides.a
      },
      b: {
        ...state.trail.guides.b
      }
    }
  };

  state.trailSyncHash = JSON.stringify( trail );

  setSketchOptions(
    {
      sketch: {
        trail
      }
    },
    "p5"
  );
}

// Reconcile the working copy with the stored options each frame (skipped
// while a drag is in flight).
function syncTrail( cfg ) {
  const rawHash = JSON.stringify( cfg ?? null );

  if ( rawHash === state.trailSyncHash ) {
    return;
  }

  state.trailSyncHash = rawHash;
  state.trail = sanitizeTrailHandles( cfg );
  state.echoDirty = true;
}

/* ------------------------------------------------------------------ */
/*  Spine geometry                                                     */
/* ------------------------------------------------------------------ */

// Build the ghost path: an even polyline starting at the anchor. `reverse`
// mirrors it through the anchor for the bidirectional mode.
//
//   - "angles" mode integrates a heading that eases from the launch angle
//     (0° = up, clockwise) to launch + bend: a clean swoosh with no
//     control points at all.
//   - "spline" mode rounds anchor → guide 1 → guide 2 → exit with Chaikin,
//     so the two guide handles literally steer the trail.
function buildEchoSpine(
  direction, p, reverse
) {
  const anchor = toPx(
    state.trail.anchor,
    p
  );
  const diagonal = Math.hypot(
    p.width,
    p.height
  );
  const length = Math.max(
    0.05,
    direction.length ?? 0.45
  ) * diagonal;

  if ( ( direction.mode ?? "angles" ) === "spline" ) {
    let g1 = toPx(
      state.trail.guides.a,
      p
    );
    let g2 = toPx(
      state.trail.guides.b,
      p
    );

    if ( reverse ) {
      g1 = mirrorPoint(
        g1,
        anchor
      );
      g2 = mirrorPoint(
        g2,
        anchor
      );
    }

    return buildSplineSpine( {
      start: anchor,
      g1,
      g2,
      length,
      iterations: direction.iterations,
      step: SPINE_STEP
    } );
  }

  const launch =
    ( ( direction.startAngle ?? 0 ) * Math.PI / 180 ) -
    Math.PI / 2 +
    ( reverse ? Math.PI : 0 );
  const bend = ( ( direction.bend ?? 0 ) * Math.PI / 180 ) * ( reverse ? -1 : 1 );

  return buildAngleSpine( {
    start: anchor,
    launch,
    bend,
    easingName: direction.easing,
    length,
    step: SPINE_STEP
  } );
}

// Local path direction at a spine index, from the neighbouring points.
function spineTangent(
  spine, index
) {
  const prev = spine[ Math.max(
    0,
    index - 1
  ) ];
  const next = spine[ Math.min(
    spine.length - 1,
    index + 1
  ) ];

  return Math.atan2(
    next.y - prev.y,
    next.x - prev.x
  );
}

/* ------------------------------------------------------------------ */
/*  Ghost rendering                                                    */
/* ------------------------------------------------------------------ */

// One ghost: the subject image at a spine position, scaled / rotated /
// faded, optionally pushed toward the tint colour (composited in the
// scratch buffer with source-atop so only the subject's pixels are tinted).
function stampGhost(
  layer, stamp, size, tintColor
) {
  const alpha = clamp01( stamp.opacity );
  const w = size.w * stamp.scale;
  const h = size.h * stamp.scale;

  if ( alpha <= 0 || w <= 0 || h <= 0 ) {
    return;
  }

  if ( stamp.tintAmount <= 0 ) {
    layer.push();
    layer.translate(
      stamp.x,
      stamp.y
    );
    layer.rotate( stamp.rotation );
    layer.drawingContext.globalAlpha = alpha;
    layer.image(
      state.subject,
      -w / 2,
      -h / 2,
      w,
      h
    );
    layer.drawingContext.globalAlpha = 1;
    layer.pop();

    return;
  }

  const scratch = state.scratchG;

  scratch.clear();
  scratch.push();
  scratch.translate(
    stamp.x,
    stamp.y
  );
  scratch.rotate( stamp.rotation );
  scratch.image(
    state.subject,
    -w / 2,
    -h / 2,
    w,
    h
  );
  scratch.pop();

  const [
    r = 255,
    g = 255,
    b = 255
  ] = tintColor;
  const ctx = scratch.drawingContext;

  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  ctx.globalAlpha = stamp.tintAmount;
  ctx.fillStyle = `rgb(${ r }, ${ g }, ${ b })`;
  ctx.fillRect(
    0,
    0,
    scratch.width,
    scratch.height
  );
  ctx.restore();

  layer.drawingContext.globalAlpha = alpha;
  layer.image(
    scratch,
    0,
    0
  );
  layer.drawingContext.globalAlpha = 1;
}

// Re-render the cached ghost layer when something changed (or every frame
// while the wave / travel is animated).
function renderEchoes(
  p, o
) {
  const echo = o.echo ?? {};
  const wave = o.wave ?? {};
  const direction = o.direction ?? {};
  const travel = Math.round( echo.travel ?? 0 );
  const animated =
    travel > 0 || ( ( wave.speed ?? 0 ) > 0 && ( wave.amplitude ?? 0 ) > 0 );

  if ( !state.echoDirty && !animated ) {
    return;
  }

  const layer = state.echoG;

  layer.clear();
  state.echoDirty = false;

  if ( !state.subject || state.photoRect.w <= 0 || state.photoRect.h <= 0 ) {
    return;
  }

  const copies = clamp(
    Math.round( echo.copies ?? 6 ),
    1,
    MAX_COPIES
  );
  const easeFn = easing[ echo.easing ] ?? easing.linear;
  const opacityStart = clamp01( echo.opacityStart ?? 0.55 );
  const opacityEnd = clamp01( echo.opacityEnd ?? 0.1 );
  const scaleStart = echo.scaleStart ?? 0.95;
  const scaleEnd = echo.scaleEnd ?? 0.7;
  const rotate = ( echo.rotate ?? 0 ) * Math.PI / 180;
  const alignToPath = echo.alignToPath ?? false;
  const tint = echo.tint ?? {};
  const tintBase = clamp01( tint.amount ?? 0 );
  const tintColor = tint.color ?? [
    255,
    255,
    255
  ];
  const subjectScale = o.subject?.scale ?? 1;
  const size = {
    w: state.photoRect.w * subjectScale,
    h: state.photoRect.h * subjectScale
  };
  // `travel` whole cycles per animation loop keeps the exported video
  // seamless, exactly like the wave speed.
  const progress = travel > 0 ? animation.angle / ( Math.PI * 2 ) * travel : 0;

  const spines = [
    applyWave(
      buildEchoSpine(
        direction,
        p,
        false
      ),
      wave,
      0,
      p
    )
  ];

  if ( direction.bidirectional ) {
    spines.push( applyWave(
      buildEchoSpine(
        direction,
        p,
        true
      ),
      wave,
      0,
      p
    ) );
  }

  const stamps = [];

  spines.forEach( ( spine ) => {
    if ( spine.length < 2 ) {
      return;
    }

    const tangent0 = spineTangent(
      spine,
      0
    );

    for ( let i = 1; i <= copies; i++ ) {
      let t = i / copies;

      if ( travel > 0 ) {
        t = ( t + progress ) % 1;
      }

      const eased = easeFn( t );
      let opacity = opacityStart + ( opacityEnd - opacityStart ) * eased;

      // While travelling, ghosts fade in at the subject and out at the
      // tail so the wrap from t=1 back to t=0 never pops.
      if ( travel > 0 ) {
        opacity *=
          smoothstep( Math.min(
            1,
            t / TRAVEL_RAMP
          ) ) *
          smoothstep( Math.min(
            1,
            ( 1 - t ) / TRAVEL_RAMP
          ) );
      }

      const index = Math.round( t * ( spine.length - 1 ) );
      const point = spine[ index ];
      let rotation = rotate * eased;

      if ( alignToPath ) {
        rotation += wrapAngle( spineTangent(
          spine,
          index
        ) - tangent0 );
      }

      stamps.push( {
        t,
        x: point.x,
        y: point.y,
        scale: scaleStart + ( scaleEnd - scaleStart ) * eased,
        rotation,
        opacity,
        tintAmount: tintBase * eased
      } );
    }
  } );

  // Farthest ghosts first so nearer copies stack on top of them.
  stamps.sort( (
    a, b
  ) => b.t - a.t );
  stamps.forEach( ( stamp ) => stampGhost(
    layer,
    stamp,
    size,
    tintColor
  ) );
}

/* ------------------------------------------------------------------ */
/*  Handles overlay                                                    */
/* ------------------------------------------------------------------ */

// Flatten every visible handle into the draggable layer's target list.
// meta[i] tells onMove which point target i belongs to.
function collectHandles(
  p, o
) {
  const targets = [];
  const meta = [];

  if ( !state.trail ) {
    return {
      targets,
      meta
    };
  }

  targets.push( toPx(
    state.trail.anchor,
    p
  ) );
  meta.push( {
    group: "anchor",
    key: null
  } );

  if ( ( o.direction?.mode ?? "angles" ) === "spline" ) {
    targets.push( toPx(
      state.trail.guides.a,
      p
    ) );
    meta.push( {
      group: "guides",
      key: "a"
    } );
    targets.push( toPx(
      state.trail.guides.b,
      p
    ) );
    meta.push( {
      group: "guides",
      key: "b"
    } );
  }

  return {
    targets,
    meta
  };
}

function drawHandles(
  p, o, hovers, grabbed
) {
  if ( !state.trail ) {
    return;
  }

  const handles = o.handles ?? {};
  const size = handles.size ?? 16;
  const splineMode = ( o.direction?.mode ?? "angles" ) === "spline";
  const anchor = toPx(
    state.trail.anchor,
    p
  );

  p.push();

  if ( splineMode ) {
    const g1 = toPx(
      state.trail.guides.a,
      p
    );
    const g2 = toPx(
      state.trail.guides.b,
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
      anchor.x,
      anchor.y,
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

  // The anchor: where the ghost trail leaves the subject.
  p.noStroke();
  p.fill(
    255,
    255,
    255,
    255
  );
  p.circle(
    anchor.x,
    anchor.y,
    size
  );
  p.fill(
    10,
    10,
    14,
    255
  );
  p.circle(
    anchor.x,
    anchor.y,
    size * 0.4
  );

  // Hover / grab rings, same affordance as v1.
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
  state.echoG = null;
  state.scratchG = null;
  state.trail = null;
  state.trailSyncHash = null;
  state.echoDirty = true;
  state.handleTargets = [];
  state.handleMeta = [];
  state.subject = null;
  state.builtVersion = -1;
  state.maskDirty = false;

  subjectBuilder.reset();
  segmenter.reset();
  segmenter.setImage( state.imagePath );
  focus.reset();
  focus.sync();

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

    // Any form edit may restyle the ghosts — cheap to just re-render.
    state.echoDirty = true;

    const sk = newOptions.sketch ?? {};
    const nextImage = resolveImagePath( sk.photo?.image );

    if ( nextImage !== state.imagePath ) {
      state.imagePath = nextImage;
      state.subject = null;
      segmenter.setImage( nextImage );

      return;
    }

    // Point-list edits are adopted from the draw loop via focus.sync().

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
  // model load, so the photo renders right away and the draw loop segments
  // each focus point as soon as the processor is ready.
  mediapipeInit( {
    enableIdle: false,
    worker: false,
    enableCapture: false, // image-based interactive segmentation: no camera
    tasks: [
      "interactive"
    ]
  } ).catch( ( error ) => {
    console.error(
      "[photo-trail-effect-v2-echo] mediapipe init failed",
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
      "photo-trail-effect-v2:\n\nadd a photo :)",
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
  ensureLayerGraphics(
    state,
    [
      "photoG",
      "bgG",
      "echoG",
      "scratchG"
    ],
    {
      onResize: () => {
        state.echoDirty = true;
      }
    }
  );

  // Adopt external point edits, then let the segmenter pump one inference
  // per focus point that is still missing its mask.
  focus.sync();
  segmenter.update( photo );

  if ( state.maskDirty || state.builtVersion !== segmenter.version ) {
    state.maskDirty = false;
    state.builtVersion = segmenter.version;
    rebuildSubject();
    state.echoDirty = true;
  }

  updatePhotoLayer( photo );
  drawBackdrop(
    p,
    photo,
    {
      photoG: state.photoG,
      bgG: state.bgG
    }
  );

  // Re-sync the handles from the store only when nothing is being dragged,
  // so a live drag is never snapped back to a stale value.
  if ( !draggable.dragging ) {
    syncTrail( o.trail );
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

        if ( !info || !state.trail ) {
          return;
        }

        const moved = {
          x: clamp01( pointer.x / p.width ),
          y: clamp01( pointer.y / p.height )
        };

        if ( info.group === "anchor" ) {
          state.trail.anchor = moved;
        } else {
          state.trail.guides[ info.key ] = moved;
        }

        targets[ index ] = {
          x: moved.x * p.width,
          y: moved.y * p.height
        };

        state.echoDirty = true;
      }
    } );

    hovers = dragResult.hovers;
    grabbed = dragResult.grabbed;

    if ( dragResult.released ) {
      persistTrail();
    }
  } else {
    state.handleTargets = [];
    state.handleMeta = [];
    draggable.idle();
  }

  // Layer 2: the ghost copies, behind the cut-out subject.
  renderEchoes(
    p,
    o
  );
  p.image(
    state.echoG,
    0,
    0
  );

  // Layer 3: the segmented subject on top, so the ghosts pass behind it.
  drawSubjectLayer(
    p,
    state.subject
  );

  if ( showHandles ) {
    drawHandles(
      p,
      o,
      hovers,
      grabbed
    );
  }

  drawMarkersLayer(
    p,
    focus.points,
    state.photoRect
  );
} );

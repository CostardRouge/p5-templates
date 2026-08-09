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
  subscribeSketchOptions
} from "@/p5/shared/syncSketchOptions.js";
import {
  createDraggable
} from "@/p5/utils/interaction/draggable.js";
import {
  clamp,
  clamp01,
  resolveImagePath,
  toPx,
  ensureLayerGraphics,
  createCanvasClickRouter,
  createFocusPointStore,
  createSubjectBuilder,
  rebuildSubjectFor,
  updatePhotoRect,
  drawBackdrop,
  drawSubjectLayer,
  drawMarkersLayer,
  applyWave,
  sliceSpine
} from "../_shared.js";
import {
  createBandTrails,
  createStripSampler,
  buildBandSpine,
  paintRibbon,
  fadeRibbonEnd,
  collectBandHandles,
  drawBandHandles
} from "../_ribbon.js";

/* ------------------------------------------------------------------ */
/*  photo-trail-effect-v3-growth                                       */
/*                                                                     */
/*  v1's pixel ribbons, but drawn over time: instead of standing there */
/*  fully formed, each ribbon is revealed along its own length as the  */
/*  loop plays. Same layer stack (photo → trails → segmented subject   */
/*  on top), same draggable bands and guides, same colour sampling —   */
/*  what is new is WHERE along the ribbon the paint currently is.      */
/*                                                                     */
/*  Three reveal modes, all driven by the loop phase so the live       */
/*  preview and a deterministic frame capture agree exactly:           */
/*                                                                     */
/*    - grow   : the ribbon extrudes out of the band and stays. Ends   */
/*               the loop full and restarts empty, so it is the one    */
/*               mode with a visible seam — `hold` parks it at full    */
/*               length for a while first, which is usually what you   */
/*               want for a single-shot reveal.                        */
/*    - pulse  : grows out over the first half of the cycle, then the  */
/*               tail catches up and swallows it over the second. No   */
/*               seam — the ribbon is empty at both ends of the loop.  */
/*    - comet  : a fixed-length span travels the whole ribbon and      */
/*               leaves at the tip. No seam either.                    */
/*                                                                     */
/*  `stagger` offsets each trail's cycle so a fan of ribbons fires in  */
/*  sequence rather than in lockstep.                                  */
/* ------------------------------------------------------------------ */

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
  // image and to detect layout changes that invalidate the pixel samples.
  photoRect: {
    x: 0,
    y: 0,
    w: 0,
    h: 0
  },

  // Dirty flags. The trail layer re-renders every frame while the reveal
  // is running; these cover the paused case (cycles = 0).
  sampleDirty: true,
  stripsDirty: true,
  trailsDirty: true,

  // Last frame's handle targets, kept for the click-vs-drag arbitration.
  handleTargets: [],
  handleMeta: [],
  handleRadius: 44,

  // Reused graphics buffers.
  photoG: null, // full photo, measures photoRect / "original" backdrop
  bgG: null, // full-bleed backdrop for the blur / dim modes
  trailsG: null, // the composited trail layer
  scratchG: null, // one trail at a time, composited with its opacity

  unregisterClick: null,
  unsubscribe: null
};

const draggable = createDraggable();

// One inference per focus point, run sequentially; masks cached per point.
const segmenter = createMultiMaskSegmenter();

// Click-to-pick focus points + the feathered cut-out.
const focus = createFocusPointStore( segmenter );
const subjectBuilder = createSubjectBuilder();

// The trail list and the photo-pixel strips that colour the ribbons.
const trails = createBandTrails( {
  onChange: () => {
    state.stripsDirty = true;
    state.trailsDirty = true;
  }
} );
const sampler = createStripSampler();

const handleCanvasClick = createCanvasClickRouter(
  state,
  focus,
  draggable
);

/* ------------------------------------------------------------------ */
/*  The reveal window                                                  */
/* ------------------------------------------------------------------ */

/**
 * Where trail `index` is painted this frame, as a [tail, head] span in
 * 0..1 along the ribbon. Returns null when nothing of it is visible.
 *
 * `cycles` whole reveals per animation loop keeps an exported video
 * seamless, exactly like the wave speed does.
 */
function revealSpan(
  growth, index
) {
  const cycles = Math.round( growth.cycles ?? 1 );

  // Paused: the ribbon simply stands there whole, i.e. v1's look.
  if ( cycles <= 0 ) {
    return [
      0,
      1
    ];
  }

  const mode = growth.mode ?? "grow";
  const easeFn = easing[ growth.easing ] ?? easing.linear;
  const stagger = growth.stagger ?? 0;
  // Local cycle phase for this trail, wrapped into 0..1.
  const u = ( ( animation.progression * cycles - stagger * index ) % 1 + 1 ) % 1;

  if ( mode === "comet" ) {
    const window = clamp(
      growth.window ?? 0.35,
      0.02,
      1
    );
    // The span enters at the band and leaves past the tip, so the ribbon
    // is empty at both ends of the cycle — no seam on the loop.
    const head = easeFn( u ) * ( 1 + window );

    return [
      clamp01( head - window ),
      clamp01( head )
    ];
  }

  if ( mode === "pulse" ) {
    // Grow over the first half, then let the tail swallow it.
    return u < 0.5
      ? [
        0,
        easeFn( u * 2 )
      ]
      : [
        easeFn( ( u - 0.5 ) * 2 ),
        1
      ];
  }

  // "grow": extrude out of the band, then hold at full length for the
  // tail of the cycle.
  const hold = clamp01( growth.hold ?? 0 );
  const span = Math.max(
    1e-3,
    1 - hold
  );

  return [
    0,
    easeFn( Math.min(
      1,
      u / span
    ) )
  ];
}

/* ------------------------------------------------------------------ */
/*  Trail layer                                                        */
/* ------------------------------------------------------------------ */

// Paint one ribbon's visible span into the scratch buffer, softening
// whichever ends are not sitting against the band or the tip.
function paintSpan(
  scratch, spine, strip, A, B, bandLength, ribbon, growth, span
) {
  const [
    from,
    to
  ] = span;
  const visible = sliceSpine(
    spine,
    from,
    to
  );

  if ( visible.length < 2 ) {
    return;
  }

  paintRibbon(
    scratch,
    visible,
    strip,
    A,
    B,
    bandLength,
    ribbon,
    [
      from,
      to
    ]
  );

  const headFade = growth.headFade ?? 0;
  const tailFade = growth.tailFade ?? 0;
  // A fade is a fraction of the ribbon, so rescale it to the span actually
  // drawn — otherwise a short span would be faded away entirely.
  const drawn = Math.max(
    to - from,
    1e-4
  );

  // The tip only needs softening while it is still travelling; once the
  // ribbon reaches its end the hard edge IS the end of the ribbon.
  if ( headFade > 0 && to < 0.999 ) {
    fadeRibbonEnd(
      scratch,
      visible,
      "end",
      headFade / drawn
    );
  }

  // Likewise the tail: at the band it is the ribbon's root, not a cut.
  if ( tailFade > 0 && from > 0.001 ) {
    fadeRibbonEnd(
      scratch,
      visible,
      "start",
      tailFade / drawn
    );
  }
}

// Re-render the cached trail layer. While the reveal (or the wave) is
// running this happens every frame; paused, only when something changed.
function renderTrails(
  p, o, photo
) {
  const ribbon = o.ribbon ?? {};
  const wave = o.wave ?? {};
  const direction = o.direction ?? {};
  const growth = o.growth ?? {};
  const animated =
    Math.round( growth.cycles ?? 1 ) > 0 ||
    ( ( wave.speed ?? 0 ) > 0 && ( wave.amplitude ?? 0 ) > 0 );

  if ( !state.trailsDirty && !animated ) {
    return;
  }

  if ( state.sampleDirty ) {
    sampler.sample( photo );
    state.sampleDirty = false;
    state.stripsDirty = true;
  }

  if ( !sampler.pixelsReady ) {
    return;
  }

  if ( state.stripsDirty ) {
    sampler.rebuild(
      trails.items,
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

  trails.items.forEach( (
    trail, index
  ) => {
    const strip = sampler.strips[ index ];

    if ( !strip ) {
      return;
    }

    const span = revealSpan(
      growth,
      index
    );

    if ( !span || span[ 1 ] - span[ 0 ] <= 1e-4 ) {
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
      buildBandSpine(
        trail,
        direction,
        step,
        p,
        false
      )
    ];

    if ( direction.bidirectional ) {
      spines.push( buildBandSpine(
        trail,
        direction,
        step,
        p,
        true
      ) );
    }

    spines.forEach( ( spine ) => paintSpan(
      scratch,
      applyWave(
        spine,
        wave,
        trail.phase,
        p
      ),
      strip,
      A,
      B,
      bandLength,
      ribbon,
      growth,
      span
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
  state.trailsG = null;
  state.scratchG = null;
  state.sampleDirty = true;
  state.stripsDirty = true;
  state.trailsDirty = true;
  state.handleTargets = [];
  state.handleMeta = [];
  state.subject = null;
  state.builtVersion = -1;
  state.maskDirty = false;

  trails.reset();
  sampler.reset();
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
      "[photo-trail-effect-v3-growth] mediapipe init failed",
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
      "photo-trail-effect-v3:\n\nadd a photo :)",
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
      "trailsG",
      "scratchG"
    ],
    {
      onResize: () => {
        state.sampleDirty = true;
        state.trailsDirty = true;
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
    rebuildSubjectFor(
      state,
      subjectBuilder,
      segmenter
    );
  }

  if ( updatePhotoRect(
    state,
    photo
  ) ) {
    state.sampleDirty = true;
    state.stripsDirty = true;
    state.trailsDirty = true;
  }

  drawBackdrop(
    p,
    photo,
    {
      photoG: state.photoG,
      bgG: state.bgG
    }
  );

  // Re-sync the trail list from the store only when nothing is being
  // dragged, so a live drag is never snapped back to a stale value.
  if ( !draggable.dragging ) {
    trails.sync( o.trails ?? {} );
  }

  const showHandles = o.handles?.show ?? true;
  let hovers = new Set();
  let grabbed = new Set();

  if ( showHandles ) {
    const {
      targets, meta
    } = collectBandHandles(
      trails.items,
      p,
      ( o.direction?.mode ?? "angles" ) === "spline"
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
        const trail = trails.items[ info.trail ];

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
      trails.persist();
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
  drawSubjectLayer(
    p,
    state.subject
  );

  if ( showHandles ) {
    drawBandHandles(
      p,
      trails.items,
      {
        targets: state.handleTargets,
        hovers,
        grabbed,
        size: o.handles?.size ?? 16,
        splineMode: ( o.direction?.mode ?? "angles" ) === "spline"
      }
    );
  }

  drawMarkersLayer(
    p,
    focus.points,
    state.photoRect
  );
} );

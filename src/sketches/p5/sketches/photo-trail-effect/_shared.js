import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import imageUtils from "@/p5/utils/imageUtils.js";
import animation from "@/p5/utils/animation.js";
import easing from "@/p5/utils/easing.js";
import {
  drawSegmentationMask
} from "@/p5/utils/segmentation.js";
import {
  drawFocusMarkers,
  hitFocusMarker
} from "@/p5/utils/multiSegmentation.js";
import {
  setSketchOptions
} from "@/p5/shared/syncSketchOptions.js";

/* ------------------------------------------------------------------ */
/*  Shared plumbing for the `photo-trail-effect` category.             */
/*                                                                     */
/*  Every variant layers the same photo stack — full photo (original / */
/*  blur / dim / color backdrop), a trail layer, then the MediaPipe-   */
/*  segmented subject drawn back on top so the trails pass BEHIND it — */
/*  and shares the click-to-pick / click-a-marker-to-unpick focus-     */
/*  point interaction. What differs per variant is the trail layer     */
/*  itself (pixel ribbons in v1, ghost copies of the subject in v2),   */
/*  so this module holds everything BUT that layer:                    */
/*                                                                     */
/*    - small numeric / point helpers,                                 */
/*    - spine geometry (Chaikin, resampling, the angle / spline        */
/*      builders, the sideways wave),                                  */
/*    - the photo layer + backdrop + subject + marker drawing,         */
/*    - the focus-point store (sync / persist / click routing) and the */
/*      subject builder (union mask → feathered cut-out).              */
/* ------------------------------------------------------------------ */

// The wave offset eases in over this fraction of the spine so the root
// stays glued to its start.
const WAVE_RAMP = 0.18;

/* ------------------------------------------------------------------ */
/*  Small helpers                                                      */
/* ------------------------------------------------------------------ */

export function clamp(
  value, min, max
) {
  return value < min ? min : value > max ? max : value;
}

export function clamp01( value ) {
  return clamp(
    value,
    0,
    1
  );
}

export function smoothstep( t ) {
  const c = clamp01( t );

  return c * c * ( 3 - 2 * c );
}

// Shortest signed angular difference, in [-PI, PI].
export function wrapAngle( delta ) {
  return ( ( delta + Math.PI ) % ( Math.PI * 2 ) + Math.PI * 2 ) % ( Math.PI * 2 ) - Math.PI;
}

export function isPoint( value ) {
  return !!value && typeof value.x === "number" && typeof value.y === "number";
}

export function sanitizePoint(
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

// The `image` option is a plain path, but the asset picker may persist it as
// a single-element array — accept either.
export function resolveImagePath( value ) {
  if ( Array.isArray( value ) ) {
    return value.find( Boolean ) ?? null;
  }

  return value || null;
}

export function toPx(
  point, p
) {
  return {
    x: point.x * p.width,
    y: point.y * p.height
  };
}

export function mirrorPoint(
  point, center
) {
  return {
    x: 2 * center.x - point.x,
    y: 2 * center.y - point.y
  };
}

export function photoSettings() {
  const photo = options.sketch?.photo ?? {};

  return {
    margin: photo.margin ?? 0,
    scale: photo.scale ?? 1,
    center: photo.center ?? true,
    clip: photo.clip ?? false,
    fill: photo.fill ?? false
  };
}

/* ------------------------------------------------------------------ */
/*  Graphics buffers                                                   */
/* ------------------------------------------------------------------ */

// Lazily create / resize the sketch's full-canvas layers on `store` (the
// sketch state object). `density1` names buffers that are read back pixel by
// pixel and must stay 1:1; `onResize` fires once when any buffer resized.
export function ensureLayerGraphics(
  store, keys, {
    density1 = [],
    onResize
  } = {}
) {
  const p = getP5();
  let resized = false;

  for ( const key of keys ) {
    let g = store[ key ];

    if ( !g ) {
      g = p.createGraphics(
        p.width,
        p.height
      );
      store[ key ] = g;

      if ( density1.includes( key ) ) {
        g.pixelDensity( 1 );
      }
    } else if ( g.width !== p.width || g.height !== p.height ) {
      g.resizeCanvas(
        p.width,
        p.height
      );

      if ( density1.includes( key ) ) {
        g.pixelDensity( 1 );
      }

      resized = true;
    }
  }

  if ( resized ) {
    onResize?.();
  }
}

/* ------------------------------------------------------------------ */
/*  Click → image-point mapping                                        */
/* ------------------------------------------------------------------ */

export function getInternalCanvasPoint( event ) {
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

/* ------------------------------------------------------------------ */
/*  Focus points (segmentation zones)                                  */
/* ------------------------------------------------------------------ */

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

/**
 * Working copy of the focus points, kept in sync with the stored options
 * and with the segmenter's point list. One instance per sketch, wired to
 * that sketch's `createMultiMaskSegmenter()`.
 */
export function createFocusPointStore( segmenter ) {
  const store = {
    // Normalized (0-1) image space. One mask per point; the subject is
    // their union.
    points: [],
    syncHash: null,

    reset() {
      store.points = [];
      store.syncHash = null;
    },

    // Reconcile with the stored options (form edit, reload, preset): adopt
    // whenever the stored list differs from what we last synced.
    sync() {
      const seg = options.sketch?.segmentation ?? {};
      const raw = Array.isArray( seg.points ) ? seg.points : null;
      const rawHash = JSON.stringify( raw );

      if ( rawHash === store.syncHash ) {
        return;
      }

      store.syncHash = rawHash;
      store.points = storedFocusPoints();
      segmenter.setPoints( store.points );
    },

    // Persist the picked zones so they survive reloads and are exported
    // with the template. Origin "p5" so the options module skips its own
    // change handler while React still picks the new values up.
    persist() {
      const points = store.points.map( ( pt ) => ( {
        x: pt.x,
        y: pt.y
      } ) );

      store.syncHash = JSON.stringify( points );

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
    },

    // Route a photo click: a focus marker (the circle with the minus)
    // unpicks its zone, anywhere else on the photo picks a new one.
    // Returns "removed" / "added" (already persisted), or null when the
    // click landed outside the photo.
    handleClick(
      point, photoRect, markerOptions
    ) {
      if ( markerOptions?.show ) {
        const hit = hitFocusMarker(
          store.points,
          photoRect,
          point,
          markerOptions.radius ?? 16
        );

        if ( hit !== -1 ) {
          store.points.splice(
            hit,
            1
          );
          segmenter.setPoints( store.points );
          store.persist();

          return "removed";
        }
      }

      const {
        x, y, w, h
      } = photoRect;

      if ( w <= 0 || h <= 0 ) {
        return null;
      }

      if ( point.x < x || point.x > x + w || point.y < y || point.y > y + h ) {
        return null;
      }

      store.points.push( {
        x: clamp01( ( point.x - x ) / w ),
        y: clamp01( ( point.y - y ) / h )
      } );
      segmenter.setPoints( store.points );
      store.persist();

      return "added";
    }
  };

  return store;
}

/* ------------------------------------------------------------------ */
/*  Subject builder (union mask → feathered cut-out)                   */
/* ------------------------------------------------------------------ */

/**
 * Owns the two mask buffers and builds the cut-out from the union of every
 * picked mask using the current edge settings: blur the binary union, then
 * remap its alpha through a smoothstep whose centre shifts the edge
 * (expand) and whose width sets the softness.
 */
export function createSubjectBuilder() {
  const buffers = {
    binary: null,
    soft: null
  };

  function ensureMaskGraphics(
    key, width, height
  ) {
    const p = getP5();
    let g = buffers[ key ];

    if ( !g ) {
      g = p.createGraphics(
        width,
        height
      );
      buffers[ key ] = g;
    } else if ( g.width !== width || g.height !== height ) {
      g.resizeCanvas(
        width,
        height
      );
    }

    g.pixelDensity( 1 );

    return g;
  }

  return {
    // The buffers belong to the previous p5 instance after a sketch reset —
    // drop them so they are recreated lazily against the fresh one.
    reset() {
      buffers.binary = null;
      buffers.soft = null;
    },

    // Returns { image, builtWith } (the settings the cut-out was built
    // from, for cheap change detection), or null while the photo or the
    // combined mask is still missing.
    build(
      photo, segmenter, seg = {}
    ) {
      const inverse = seg.inverse ?? true;
      const combined = segmenter.combined( inverse );

      if ( !photo?.img?.width || !combined ) {
        return null;
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
        "binary",
        width,
        height
      );

      // The union already applied `inverse` per raw mask, so it is passed
      // as false here.
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
          "soft",
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

      const image = photo.img.get();

      image.mask( mask );

      return {
        image,
        builtWith: {
          inverse,
          softness,
          expand
        }
      };
    }
  };
}

/* ------------------------------------------------------------------ */
/*  Photo layers                                                       */
/* ------------------------------------------------------------------ */

// Draw the full photo into the offscreen buffer and return where it landed
// on the canvas ({x, y, w, h}), or null when the layout callback did not
// fire. The caller diffs the rect against the previous frame to invalidate
// whatever it derived from the photo layout.
export function drawPhotoLayer(
  g, photo
) {
  const p = getP5();
  const {
    margin, scale, center, clip, fill
  } = photoSettings();
  let rect = null;

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
      rect = {
        x: center ? cx - w / 2 : cx,
        y: center ? cy - h / 2 : cy,
        w,
        h
      };
    }
  } );

  return rect;
}

// The backdrop behind the trails: nothing (transparent), the photo layer
// as-is (original), a solid color, or a full-bleed blurred / dimmed copy.
export function drawBackdrop(
  p, photo, {
    photoG, bgG
  }
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
      photoG,
      0,
      0
    );

    return;
  }

  // blur / dim: a full-bleed copy of the photo behind everything.
  bgG.clear();

  if ( mode === "blur" ) {
    bgG.drawingContext.filter = `blur(${ bg.blur ?? 0 }px)`;
  }

  imageUtils.marginImage( {
    img: photo.img,
    graphics: bgG,
    position: p.createVector(
      p.width / 2,
      p.height / 2
    ),
    margin: 0,
    scale: 1,
    center: true,
    fill: true
  } );

  bgG.drawingContext.filter = "none";

  p.image(
    bgG,
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

// The segmented subject on top, so the trails pass behind it.
export function drawSubjectLayer(
  p, subject
) {
  if ( !subject ) {
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
    img: subject,
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

export function drawMarkersLayer(
  p, points, photoRect
) {
  const marker = options.sketch?.marker ?? {};

  if ( !marker.show ) {
    return;
  }

  drawFocusMarkers(
    p,
    points,
    photoRect,
    marker
  );
}

/* ------------------------------------------------------------------ */
/*  Spine geometry                                                     */
/* ------------------------------------------------------------------ */

// Chaikin corner-cutting on an open polyline of plain {x, y} points (same
// algorithm as the splines category, without the p5.Vector churn).
export function chaikinOpen(
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

// Resample a polyline at a fixed step so every point along the spine is
// evenly spaced (even spacing = no visible density changes on curves).
export function resamplePolyline(
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

// "Angles" spine: integrate a heading that eases from `launch` to
// launch + bend over `length` pixels — a clean swoosh with no control
// points at all. Returns an even polyline starting at `start`.
export function buildAngleSpine( {
  start,
  launch,
  bend,
  easingName,
  length,
  step
} ) {
  const easeFn = easing[ easingName ] ?? easing.linear;
  const steps = Math.max(
    2,
    Math.ceil( length / step )
  );
  const ds = length / steps;
  const spine = [
    {
      ...start
    }
  ];
  let x = start.x;
  let y = start.y;

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

// "Spline" spine: round start → guide 1 → guide 2 → exit with Chaikin, so
// two draggable guide handles literally steer the path. The exit point
// extends the guides' direction so the spine leaves the canvas.
export function buildSplineSpine( {
  start,
  g1,
  g2,
  length,
  iterations,
  step
} ) {
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
      start,
      g1,
      g2,
      exit
    ],
    clamp(
      Math.round( iterations ?? 4 ),
      0,
      6
    )
  );

  return resamplePolyline(
    dense,
    step
  );
}

// Push the spine sideways on a sine wave: `twists` full oscillations along
// the path, `warp` bunches them toward the start (>1) or the end (<1),
// `speed` (whole loops per animation cycle) keeps exports seamless.
// `phase` (0..1) offsets the wave so parallel spines don't oscillate in
// sync.
export function applyWave(
  spine, wave, phase, p
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
  const basePhase = phase * Math.PI * 2;
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

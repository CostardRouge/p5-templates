import {
  getP5
} from "@/p5/utils/sketch.js";
import easing from "@/p5/utils/easing.js";
import {
  setSketchOptions
} from "@/p5/shared/syncSketchOptions.js";
import {
  clamp,
  clamp01,
  wrapAngle,
  sanitizePoint,
  toPx,
  mirrorPoint,
  drawPhotoLayer,
  drawHandleRings,
  buildAngleSpine,
  buildSplineSpine
} from "./_shared.js";

/* ------------------------------------------------------------------ */
/*  The pixel-ribbon pipeline, shared by the ribbon variants.          */
/*                                                                     */
/*  A "band" is a draggable cross-section of the photo (handles A/B).  */
/*  Its pixels are read into a 1px-tall colour strip whose length IS   */
/*  the ribbon width, and that strip is then stamped along a spine —   */
/*  slice by slightly-overlapping slice, each rotated to the local     */
/*  tangent — until it leaves the canvas.                              */
/*                                                                     */
/*  v1 paints the whole ribbon every time; v3 paints a moving span of  */
/*  it, which is why `paintRibbon` takes the span's place in the FULL  */
/*  ribbon (`tRange`) rather than assuming the spine it is handed is   */
/*  the entire thing.                                                  */
/* ------------------------------------------------------------------ */

// Slices overlap a hair so the ribbon has no seams on tight curves.
const SLICE_OVERLAP = 1.5;

export const MAX_TRAILS = 12;

/* ------------------------------------------------------------------ */
/*  Trail list (count-driven, handles persisted like splines-v2)       */
/* ------------------------------------------------------------------ */

// A pleasant default for trail `index`: a vertical band around the canvas
// centre, launched toward alternating sides.
export function defaultTrail( index ) {
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

/**
 * The working copy of the trail list, reconciled with
 * `options.sketch.trails` every frame. The count slider is authoritative:
 * growing appends generated defaults, shrinking drops the tail — surviving
 * trails keep their dragged handles.
 *
 * @param {object} [config]
 * @param {() => void} [config.onChange] - Called whenever the list or a
 *   handle changed, so the sketch can mark its own dirty flags.
 */
export function createBandTrails( {
  onChange
} = {} ) {
  const store = {
    items: [],
    syncHash: null,

    reset() {
      store.items = [];
      store.syncHash = null;
    },

    // Persist the working copy so the handles survive reloads and are
    // exported with the template. Origin "p5" so the options module skips
    // its own change handler while React still picks the new values up.
    persist() {
      const items = store.items.map( ( trail ) => ( {
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

      store.syncHash = JSON.stringify( items );

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
    },

    sync( cfg = {} ) {
      const count = clamp(
        Math.round( cfg.count ?? 1 ),
        1,
        MAX_TRAILS
      );
      const rawItems = Array.isArray( cfg.items ) ? cfg.items : [];
      const rawHash = JSON.stringify( rawItems );

      // External edit (form field, reload, preset) → adopt the stored list.
      if ( rawHash !== store.syncHash ) {
        store.items = rawItems.map( (
          item, index
        ) => sanitizeTrail(
          item,
          index
        ) );
        store.syncHash = rawHash;
        onChange?.();
      }

      if ( store.items.length !== count ) {
        const next = store.items.slice(
          0,
          count
        );

        while ( next.length < count ) {
          next.push( defaultTrail( next.length ) );
        }

        store.items = next;
        onChange?.();
        store.persist();
      }
    }
  };

  return store;
}

/* ------------------------------------------------------------------ */
/*  Band spine                                                         */
/* ------------------------------------------------------------------ */

/**
 * One trail's spine: an even polyline starting at the band centre and
 * running off the canvas. `reverse` mirrors it for the bidirectional mode.
 *
 *   - "angles" mode integrates a heading that eases from the launch angle
 *     (band perpendicular + start angle) to launch + bend: a clean swoosh
 *     with no control points at all.
 *   - "spline" mode rounds band-centre → guide 1 → guide 2 → exit with
 *     Chaikin, so the two guide handles literally steer the ribbon.
 */
export function buildBandSpine(
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
      g1 = mirrorPoint(
        g1,
        mid
      );
      g2 = mirrorPoint(
        g2,
        mid
      );
    }

    return buildSplineSpine( {
      start: mid,
      g1,
      g2,
      length,
      iterations: direction.iterations,
      step
    } );
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

  return buildAngleSpine( {
    start: mid,
    launch,
    bend,
    easingName: direction.easing,
    length,
    step
  } );
}

/* ------------------------------------------------------------------ */
/*  Colour strips (the ribbon cross-sections)                          */
/* ------------------------------------------------------------------ */

/**
 * Owns the density-1 copy of the photo layer that is read back pixel by
 * pixel, plus one (resolution × 1) colour strip per trail. Pixel 0 of a
 * strip is the sample at band end A.
 */
export function createStripSampler() {
  const sampler = {
    sampleG: null,
    strips: [],
    pixelsReady: false,

    // The buffers belong to the previous p5 instance after a sketch reset.
    reset() {
      sampler.sampleG = null;
      sampler.strips = [];
      sampler.pixelsReady = false;
    },

    // Redraw the photo into the sampling buffer and read its pixels back
    // once. Only worth calling when the photo or its layout changed.
    sample( photo ) {
      const p = getP5();
      let g = sampler.sampleG;

      if ( !g ) {
        g = p.createGraphics(
          p.width,
          p.height
        );
        sampler.sampleG = g;
      } else if ( g.width !== p.width || g.height !== p.height ) {
        g.resizeCanvas(
          p.width,
          p.height
        );
      }

      // Read back 1:1 — a denser buffer would shift every sample index.
      g.pixelDensity( 1 );

      drawPhotoLayer(
        g,
        photo
      );
      g.loadPixels();
      sampler.pixelsReady = true;
    },

    // One strip per trail, sampled along that trail's band segment A → B.
    rebuild(
      trails, ribbon = {}
    ) {
      const p = getP5();
      const resolution = clamp(
        Math.round( ribbon.resolution ?? 96 ),
        2,
        512
      );
      const pixels = sampler.sampleG.pixels;
      const gw = sampler.sampleG.width;
      const gh = sampler.sampleG.height;

      trails.forEach( (
        trail, index
      ) => {
        let strip = sampler.strips[ index ];

        // Reuse the buffer across resolution changes — p5.Graphics.remove()
        // is not safe in this engine context, so never dispose, only resize.
        if ( !strip ) {
          strip = p.createGraphics(
            resolution,
            1
          );
          strip.pixelDensity( 1 );
          sampler.strips[ index ] = strip;
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
      sampler.strips.length = trails.length;
    }
  };

  return sampler;
}

/* ------------------------------------------------------------------ */
/*  Ribbon painting                                                    */
/* ------------------------------------------------------------------ */

/**
 * Stamp the colour strip along `spine`, one slightly-overlapping slice per
 * segment, each rotated to the local tangent and stretched to the local
 * ribbon width.
 *
 * @param {Array} tRange - Where the passed spine sits inside the FULL
 *   ribbon, as [from, to] in 0..1. The width taper is evaluated against
 *   this, so a partial span (the growth variant) keeps the same profile it
 *   would have had as part of the whole ribbon.
 */
export function paintRibbon(
  g, spine, strip, A, B, bandLength, ribbon, tRange = [
    0,
    1
  ]
) {
  if ( spine.length < 2 ) {
    return;
  }

  const widthStart = ribbon.widthStart ?? 1;
  const widthEnd = ribbon.widthEnd ?? 1;
  const widthEase = easing[ ribbon.widthEasing ] ?? easing.linear;
  const [
    tFrom,
    tTo
  ] = tRange;
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

    const t = tFrom + ( tTo - tFrom ) * ( ( i + 0.5 ) / total );
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

/**
 * Soften one end of an already-painted ribbon by erasing it through a
 * linear alpha gradient (`destination-out`) running along the spine.
 *
 * Fading the slices individually as they are stamped would double-darken
 * every overlap; erasing once afterwards keeps the ribbon flat. The
 * gradient axis is the straight line between the two spine points that
 * bracket the fade — exact on a straight run, and smooth on a curved one
 * because a fade is only ever a short span of the ribbon.
 *
 * @param {"start"|"end"} side - Which end of the spine to fade out.
 * @param {number} span - Fade length as a fraction of the spine.
 */
export function fadeRibbonEnd(
  g, spine, side, span
) {
  if ( spine.length < 2 || span <= 0 ) {
    return;
  }

  const total = spine.length - 1;
  const steps = clamp(
    Math.round( total * clamp01( span ) ),
    1,
    total
  );
  const tip = side === "start" ? spine[ 0 ] : spine[ total ];
  const inner = side === "start" ? spine[ steps ] : spine[ total - steps ];

  if ( tip.x === inner.x && tip.y === inner.y ) {
    return;
  }

  const ctx = g.drawingContext;
  const gradient = ctx.createLinearGradient(
    tip.x,
    tip.y,
    inner.x,
    inner.y
  );

  // Opaque at the tip (erases everything) → transparent at the inner end
  // (leaves the ribbon untouched). Past either stop the gradient holds its
  // end colour, which is exactly what both sides want.
  gradient.addColorStop(
    0,
    "rgba(0, 0, 0, 1)"
  );
  gradient.addColorStop(
    1,
    "rgba(0, 0, 0, 0)"
  );

  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = gradient;
  ctx.fillRect(
    0,
    0,
    g.width,
    g.height
  );
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/*  Band handles overlay                                               */
/* ------------------------------------------------------------------ */

/**
 * Flatten every visible handle into the draggable layer's target list.
 * `meta[i]` tells the caller's `onMove` which trail / which point target
 * `i` belongs to.
 */
export function collectBandHandles(
  trails, p, splineMode
) {
  const targets = [];
  const meta = [];

  trails.forEach( (
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

/**
 * The band segment (whose pixels feed the ribbon), the spline guides and
 * their chain, the band end discs, then the hover / grab rings.
 */
export function drawBandHandles(
  p, trails, {
    targets,
    hovers,
    grabbed,
    size = 16,
    splineMode = false
  }
) {
  p.push();

  trails.forEach( ( trail ) => {
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

  p.pop();

  drawHandleRings(
    p,
    targets,
    hovers,
    grabbed,
    size
  );
}

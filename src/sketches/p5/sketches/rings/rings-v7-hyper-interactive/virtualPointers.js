import cache from "@/p5/utils/cache.js";
import easing from "@/p5/utils/easing.js";
import {
  hashedRandom
} from "@/p5/utils/letterPaths.js";

// ── Virtual pointers: the automated sculpting troupe ────────────────────────
// A crowd of fictional cursors that performs what a user would do by hand:
// each one enters from outside the canvas, walks to a sculpt handle, hovers
// it, grabs it, drags it to a spot it picked (random, biased outward), lets
// go, moves on to its next handle, and finally retreats off-canvas. The
// handles are split evenly between the cursors, so together they displace
// every point of the letter.
//
// Each cursor is drawn as one of the three artworks from the options
// (interaction → virtualPointers → images), swapped by what it is doing:
//
//   pointing — travelling (entering, between handles, leaving)
//   open     — hovering a handle before the grab, and just after releasing
//   grabbing — actually dragging the handle
//
// ── How the handles actually move ──
// The troupe doesn't touch the sculpt state itself. update() returns plain
// drag-layer pointers ({ key, x, y, pressed, kind: "virtual" }) that the
// sketch feeds to draggable.update's `extraPointers` — the exact same grab →
// move → release path as the mouse, touch and camera pinches. What you watch
// is therefore a real multi-pointer drag session, just performed by scripted
// hands; hover rings and grab accents light up for free.
//
// ── Timing / determinism ──
// The machine advances on the sketch's loop clock (animation.time — a
// duration-scaled seconds clock that spans one loop), so the performance
// plays identically in the live preview and in a deterministic capture, and
// pauses when the loop pauses. When the clock wraps (or scrubs backward) the
// troupe restores the sculpt offsets it snapshotted at curtain-up and replays
// the same show — every loop is the same performance. All randomness is
// hashed per handle/cursor index (no shared RNG stream), so the timing of
// frames can never change what the cursors decide.
//
// The displacements deliberately do NOT persist to the saved options: the
// sketch skips persistOffsets for virtual-only releases, so the performance
// never rewrites the sculpt you authored by hand.

const POINTING = "pointing";
const OPEN = "open";
const GRABBING = "grabbing";

// Where the artwork sits on the pointer position, normalized within the
// image: the index fingertip of the shipped hand icons (measured on the
// 256 px artworks — the finger tops at ~(0.42, 0.25)).
const HOTSPOT_X = 0.42;
const HOTSPOT_Y = 0.25;

export const VIRTUAL_POINTER_PREFIX = "vp-";

const DEFAULTS = {
  count: 8,
  scale: 0.18,
  seed: 7,
  easing: "easeInOutCubic",
  timing: {
    stagger: 0.25,
    entryPause: 0.35,
    travel: 0.45,
    hover: 0.2,
    drag: 0.6,
    release: 0.15,
    fade: 0.45
  },
  displacement: {
    amount: 0.35,
    outwardBias: 0.75
  }
};

function clamp(
  value, min, max
) {
  return Math.min(
    max,
    Math.max(
      min,
      value
    )
  );
}

// A loaded p5.Image for an options image path, or null while it is still
// decoding / missing. The options module owns the loading (every image-looking
// string under `sketch.*` lands in this cache).
function loadedImage( path ) {
  const img = cache.get( "imagesMap" )?.get?.( path )?.img;

  return img?.width ? img : null;
}

// First point along `dir` from `pos` that clears the canvas by `margin` —
// where a cursor spawns before entering, and where it retreats to.
function offCanvasPoint(
  pos, dir, width, height, margin
) {
  const crossings = [];

  if ( dir.x > 1e-6 ) {
    crossings.push( ( width - pos.x ) / dir.x );
  } else if ( dir.x < -1e-6 ) {
    crossings.push( -pos.x / dir.x );
  }

  if ( dir.y > 1e-6 ) {
    crossings.push( ( height - pos.y ) / dir.y );
  } else if ( dir.y < -1e-6 ) {
    crossings.push( -pos.y / dir.y );
  }

  const t = ( crossings.length ? Math.min( ...crossings.filter( ( c ) => c > 0 ) ) : 0 ) + margin;

  return {
    x: pos.x + dir.x * t,
    y: pos.y + dir.y * t
  };
}

// Screen-space direction pointing away from the canvas centre through `pos`
// (the letter sits at the centre, so "outward" is where the empty space is).
function outwardDir(
  pos, width, height
) {
  const dx = pos.x - width / 2;
  const dy = pos.y - height / 2;
  const len = Math.hypot(
    dx,
    dy
  );

  if ( len < 1e-3 ) {
    return {
      x: 0,
      y: -1
    };
  }

  return {
    x: dx / len,
    y: dy / len
  };
}

function lerpPoint(
  from, to, u
) {
  return {
    x: from.x + ( to.x - from.x ) * u,
    y: from.y + ( to.y - from.y ) * u
  };
}

/**
 * Create the troupe. Call `update(ctx)` every frame BEFORE the drag layer and
 * feed the returned pointers to draggable.update's `extraPointers`; call
 * `draw(p, config)` after the scene so the hands stack on top of everything.
 * `reset()` from sketch setup.
 */
export function createPointerTroupe() {
  const state = {
    cursors: [],
    // `${geometryKey}|${count}|${seed}` — a change means "new show".
    signature: null,
    // Deep copy of the sculpt offsets at curtain-up, restored on every loop
    // wrap so each loop replays the identical performance.
    snapshot: null,
    prevClock: null
  };

  function rearm() {
    state.cursors = [];
    state.signature = null;
    state.snapshot = null;
    state.prevClock = null;
  }

  // Build one cursor per troupe slot: an even, contiguous split of the handle
  // indices (contiguous means each cursor works one stretch of the outline
  // instead of criss-crossing the letter).
  function buildCursors(
    handleCount, cfg
  ) {
    const count = clamp(
      Math.round( cfg.count ?? DEFAULTS.count ),
      1,
      16
    );
    const per = Math.ceil( handleCount / count );
    const cursors = [];

    for ( let i = 0; i < count; i++ ) {
      const queue = [];

      for ( let h = i * per; h < Math.min(
        ( i + 1 ) * per,
        handleCount
      ); h++ ) {
        queue.push( h );
      }

      cursors.push( {
        index: i,
        queue,
        qi: 0,
        phase: queue.length ? "waiting" : "done",
        phaseT: 0,
        // Travel anchors (screen px). `from` is fixed at phase entry; the
        // destination is re-read live so a moving camera never detaches a
        // cursor from the handle it walks toward.
        from: null,
        pos: null,
        // Glyph-space endpoints of the current drag.
        grabStart: null,
        dragTarget: null,
        alpha: 0
      } );
    }

    return cursors;
  }

  // The random glyph-space offset a cursor decides to drag handle `h` to:
  // current offset plus a hashed displacement, more often outward (away from
  // the glyph centre) than inward, clamped to the sculpt range like any drag.
  function decideTarget(
    h, ctx, cfg, seed
  ) {
    const base = ctx.glyphBase( h );
    const offset = ctx.offsets[ h ] ?? {
      x: 0,
      y: 0,
      z: 0
    };
    const bias = clamp(
      cfg.displacement?.outwardBias ?? DEFAULTS.displacement.outwardBias,
      0,
      1
    );
    const amount = Math.max(
      cfg.displacement?.amount ?? DEFAULTS.displacement.amount,
      0
    );

    const outward = Math.atan2(
      base.y + offset.y,
      base.x + offset.x
    );
    const angle = outward
      + ( hashedRandom( seed + h * 7 + 1 ) * 2 - 1 ) * Math.PI * ( 1 - bias );
    const magnitude = amount * ( 0.35 + 0.65 * hashedRandom( seed + h * 7 + 2 ) );

    const target = {
      x: offset.x + Math.cos( angle ) * magnitude,
      y: offset.y + Math.sin( angle ) * magnitude,
      z: offset.z
    };

    // Mirror the drag layer's clamp so the drag path aims where the handle
    // will actually be allowed to land.
    const len = Math.hypot(
      target.x,
      target.y,
      target.z
    );

    if ( len > ctx.range ) {
      const s = ctx.range / len;

      target.x *= s;
      target.y *= s;
      target.z *= s;
    }

    return target;
  }

  // Advance one cursor by dt, resolving its position/state for this frame.
  // Returns nothing; mutates the cursor. Phase overshoot carries into the next
  // phase so timings stay exact across frames.
  function advance(
    cursor, dt, ctx, cfg, seed
  ) {
    const timing = {
      ...DEFAULTS.timing,
      ...( cfg.timing ?? {} )
    };
    const easeKey = cfg.easing ?? DEFAULTS.easing;
    const ease = typeof easing[ easeKey ] === "function" ? easing[ easeKey ] : ( x ) => x;
    const margin = 80;

    cursor.phaseT += dt;

    // Small helper set shared by the phase handlers.
    const handle = () => cursor.queue[ cursor.qi ];
    const handlePos = () => ctx.targets[ handle() ] ?? {
      x: ctx.width / 2,
      y: ctx.height / 2
    };

    let guard = 8;

    while ( guard-- > 0 ) {
      const t = cursor.phaseT;

      if ( cursor.phase === "waiting" ) {
        const delay = cursor.index * Math.max(
          timing.stagger,
          0
        );

        if ( t < delay ) {
          return;
        }

        // Spawn: stage just outside the letter near the first handle, enter
        // from beyond the nearest edge along the same line.
        const first = handlePos();
        const dir = outwardDir(
          first,
          ctx.width,
          ctx.height
        );
        const staging = {
          x: first.x + dir.x * 0.14 * Math.min(
            ctx.width,
            ctx.height
          ),
          y: first.y + dir.y * 0.14 * Math.min(
            ctx.width,
            ctx.height
          )
        };

        cursor.staging = staging;
        cursor.from = offCanvasPoint(
          staging,
          dir,
          ctx.width,
          ctx.height,
          margin
        );
        cursor.pos = cursor.from;
        cursor.phase = "entering";
        cursor.phaseT = t - delay;
        continue;
      }

      if ( cursor.phase === "entering" ) {
        const duration = Math.max(
          timing.travel,
          0.01
        );

        cursor.alpha = ease( clamp(
          t / Math.max(
            timing.fade,
            0.01
          ),
          0,
          1
        ) );
        cursor.pos = lerpPoint(
          cursor.from,
          cursor.staging,
          ease( clamp(
            t / duration,
            0,
            1
          ) )
        );

        if ( t < duration ) {
          return;
        }

        cursor.phase = "pausing";
        cursor.phaseT = t - duration;
        continue;
      }

      if ( cursor.phase === "pausing" ) {
        cursor.alpha = 1;

        if ( t < timing.entryPause ) {
          return;
        }

        cursor.from = cursor.pos;
        cursor.phase = "approach";
        cursor.phaseT = t - timing.entryPause;
        continue;
      }

      if ( cursor.phase === "approach" ) {
        const duration = Math.max(
          timing.travel,
          0.01
        );

        // Live destination: the handle keeps its screen position even while
        // the camera orbits.
        cursor.pos = lerpPoint(
          cursor.from,
          handlePos(),
          ease( clamp(
            t / duration,
            0,
            1
          ) )
        );

        if ( t < duration ) {
          return;
        }

        cursor.phase = "hover";
        cursor.phaseT = t - duration;
        continue;
      }

      if ( cursor.phase === "hover" ) {
        cursor.pos = handlePos();

        if ( t < timing.hover ) {
          return;
        }

        // Decide the drag as we close the hand: from the handle's current
        // glyph position to the randomly chosen (outward-biased) target.
        const h = handle();
        const base = ctx.glyphBase( h );
        const offset = ctx.offsets[ h ] ?? {
          x: 0,
          y: 0,
          z: 0
        };

        cursor.grabStart = {
          x: base.x + offset.x,
          y: base.y + offset.y,
          z: offset.z
        };
        cursor.dragTarget = decideTarget(
          h,
          ctx,
          cfg,
          seed
        );
        cursor.phase = "drag";
        cursor.phaseT = t - timing.hover;
        continue;
      }

      if ( cursor.phase === "drag" ) {
        const duration = Math.max(
          timing.drag,
          0.01
        );
        const h = handle();
        const base = ctx.glyphBase( h );
        const u = ease( clamp(
          t / duration,
          0,
          1
        ) );

        // Both endpoints are projected fresh every frame, so the drag path
        // stays glued to the letter under camera motion and lands the handle
        // on the decided glyph-space target.
        const from = ctx.projectGlyph( cursor.grabStart );
        const to = ctx.projectGlyph( {
          x: base.x + cursor.dragTarget.x,
          y: base.y + cursor.dragTarget.y,
          z: cursor.dragTarget.z
        } );

        cursor.pos = lerpPoint(
          from,
          to,
          u
        );

        if ( t < duration ) {
          return;
        }

        cursor.phase = "release";
        cursor.phaseT = t - duration;
        continue;
      }

      if ( cursor.phase === "release" ) {
        if ( t < timing.release ) {
          return;
        }

        cursor.qi += 1;
        cursor.from = cursor.pos;
        cursor.phaseT = t - timing.release;

        if ( cursor.qi < cursor.queue.length ) {
          cursor.phase = "approach";
          continue;
        }

        // Show over for this hand: retreat outward and fade away.
        const dir = outwardDir(
          cursor.pos,
          ctx.width,
          ctx.height
        );

        cursor.exit = offCanvasPoint(
          cursor.pos,
          dir,
          ctx.width,
          ctx.height,
          margin
        );
        cursor.phase = "exit";
        continue;
      }

      if ( cursor.phase === "exit" ) {
        const duration = Math.max(
          timing.travel * 1.5,
          timing.fade,
          0.01
        );

        cursor.pos = lerpPoint(
          cursor.from,
          cursor.exit,
          ease( clamp(
            t / duration,
            0,
            1
          ) )
        );
        cursor.alpha = 1 - ease( clamp(
          t / Math.max(
            timing.fade,
            0.01
          ),
          0,
          1
        ) );

        if ( t < duration ) {
          return;
        }

        cursor.phase = "done";
        cursor.alpha = 0;
        return;
      }

      // done
      return;
    }
  }

  // The artwork a cursor shows in its current phase.
  function iconOf( cursor ) {
    if ( cursor.phase === "drag" ) {
      return GRABBING;
    }

    if ( cursor.phase === "hover" || cursor.phase === "release" ) {
      return OPEN;
    }

    return POINTING;
  }

  return {
    /** Live cursors (for tests / debugging). */
    get cursors() {
      return state.cursors;
    },

    /**
     * One frame of the performance.
     *
     * @param {object} ctx
     * @param {number} ctx.now - Loop clock (animation.time).
     * @param {object} ctx.config - The `interaction.virtualPointers` options.
     * @param {Array<{x, y}>} ctx.targets - Handle screen positions (live).
     * @param {Array<{x, y, z}>} ctx.offsets - The sketch's working sculpt copy.
     * @param {(i: number) => {x, y}} ctx.glyphBase - Base glyph point of a handle.
     * @param {(g: {x, y, z}) => {x, y}} ctx.projectGlyph - Glyph → screen.
     * @param {number} ctx.range - Sculpt clamp radius (glyph units).
     * @param {number} ctx.width - Canvas width (px).
     * @param {number} ctx.height - Canvas height (px).
     * @param {string} ctx.geometryKey - Letter build signature.
     * @returns {Array} pointers for draggable.update's `extraPointers`.
     */
    update( ctx ) {
      const cfg = ctx.config ?? {};

      // A non-finite clock would silently NaN the whole machine — refuse it.
      if ( cfg.enabled === false || ctx.targets.length === 0 || !Number.isFinite( ctx.now ) ) {
        rearm();

        return [];
      }

      const seed = Math.round( cfg.seed ?? DEFAULTS.seed ) * 1009;
      const signature = [
        ctx.geometryKey,
        clamp(
          Math.round( cfg.count ?? DEFAULTS.count ),
          1,
          16
        ),
        cfg.seed ?? DEFAULTS.seed
      ].join( "|" );

      if ( state.signature !== signature ) {
        rearm();
        state.signature = signature;
      }

      if ( !state.cursors.length ) {
        state.cursors = buildCursors(
          ctx.targets.length,
          cfg
        );
        // Curtain-up: remember the sculpt as it stands, so every loop can
        // replay the identical show from the identical letter.
        state.snapshot = ctx.offsets.map( ( o ) => ( {
          x: o.x,
          y: o.y,
          z: o.z
        } ) );
        state.prevClock = ctx.now;
      }

      let dt = ctx.now - ( state.prevClock ?? ctx.now );

      state.prevClock = ctx.now;

      // Loop wrapped (or scrubbed backward): restore the curtain-up sculpt and
      // start the same show over.
      if ( dt < -0.05 ) {
        if ( state.snapshot && state.snapshot.length === ctx.offsets.length ) {
          state.snapshot.forEach( (
            snap, i
          ) => {
            ctx.offsets[ i ].x = snap.x;
            ctx.offsets[ i ].y = snap.y;
            ctx.offsets[ i ].z = snap.z;
          } );
        }

        state.cursors = buildCursors(
          ctx.targets.length,
          cfg
        );
        dt = 0;
      }

      dt = Math.max(
        dt,
        0
      );

      const pointers = [];

      state.cursors.forEach( ( cursor ) => {
        advance(
          cursor,
          dt,
          ctx,
          cfg,
          seed
        );

        if ( cursor.phase === "waiting" || cursor.phase === "done" || !cursor.pos ) {
          return;
        }

        // targetIndex names the handle a dragging cursor is holding, so the
        // sketch can bind the drag explicitly instead of relying on the
        // proximity pick (which can miss when a frame lands mid-drag).
        pointers.push( {
          key: `${ VIRTUAL_POINTER_PREFIX }${ cursor.index }`,
          x: cursor.pos.x,
          y: cursor.pos.y,
          pressed: cursor.phase === "drag",
          targetIndex: cursor.phase === "drag" ? cursor.queue[ cursor.qi ] : undefined,
          kind: "virtual"
        } );
      } );

      return pointers;
    },

    /**
     * Draw every visible cursor with its state artwork, faded by its
     * enter/exit alpha and scaled by `config.scale` (× the image's natural
     * size — the shipped artworks are 256 px).
     */
    draw(
      p, config
    ) {
      const cfg = config ?? {};

      if ( cfg.enabled === false || !state.cursors.length ) {
        return;
      }

      const images = cfg.images ?? {};
      const scale = clamp(
        cfg.scale ?? DEFAULTS.scale,
        0.02,
        1
      );

      p.push();
      p.imageMode( p.CORNER );
      p.noStroke();

      state.cursors.forEach( ( cursor ) => {
        if ( cursor.phase === "waiting" || cursor.phase === "done" || !cursor.pos || cursor.alpha <= 0 ) {
          return;
        }

        const img = loadedImage( images[ iconOf( cursor ) ] ) ?? loadedImage( images[ POINTING ] );

        if ( !img ) {
          return;
        }

        const width = img.width * scale;
        const height = img.height * scale;

        p.tint(
          255,
          255 * clamp(
            cursor.alpha,
            0,
            1
          )
        );
        p.image(
          img,
          cursor.pos.x - HOTSPOT_X * width,
          cursor.pos.y - HOTSPOT_Y * height,
          width,
          height
        );
      } );

      p.noTint();
      p.pop();
    },

    /** Forget the whole show (sketch restart). */
    reset() {
      rearm();
    }
  };
}

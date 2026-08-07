import cache from "@/p5/utils/cache.js";
import easing from "@/p5/utils/easing.js";
import {
  hashedRandom
} from "@/p5/utils/letterPaths.js";

// ── Virtual pointers v8: the word-morphing troupe ───────────────────────────
// v7's crowd sculpted one letter at random. Here the cursors are the STAGE
// CREW of a text cycle: the sketch shows word[0], and for every step the
// troupe physically converts the current word's points into the next word's —
// dragging matched points to their new positions, CARRYING IN brand-new points
// from outside the canvas when the next word needs more (add-pointer icon),
// and CARRYING OFF points the next word doesn't need (the cursor grabs one,
// retreats, and its icon flips to the remove-pointer as it leaves). Between
// two conversions the finished word holds legible, and where a cursor waits
// out the gap is the `idle.mode` option: "stay" parks it on the point it just
// finished (optionally spinning as a beach ball), "aside" walks it to a
// hashed spot along the canvas border so the word breathes with the troupe
// still on stage, and "exit" sends it off-canvas entirely — it fades out like
// the exodus and re-enters for its next task.
//
// ── Scheduling (why every loop is the same show) ──
// The whole cycle is laid out ON the loop clock: with W words the loop is cut
// into W beats of [hold][morph]; every cursor's tasks are packed into the
// morph windows with sub-phases sliced from the timing weights, so the last
// task always lands before the beat ends and frame 0 (word[0] legible, no
// cursors) wraps seamlessly. Position/icon/alpha are resolved FROM the clock
// each frame (not accumulated), so pausing, scrubbing and deterministic
// capture all replay the identical performance.
//
// ── How points actually move ──
// Like v7, the troupe emits plain drag-layer pointers: moves press on the
// point and walk it to its destination; removes press and walk off-canvas
// (the point follows, then deactivates); adds first ACTIVATE their new point
// at an off-canvas fetch spot (via ctx.activatePoint), press on it there and
// carry it in. The sketch snaps the pool to the finished word at every beat
// boundary, so the show can never drift.

const POINTING = "pointing";
const OPEN = "open";
const GRABBING = "grabbing";
const ADD = "add";
const REMOVE = "remove";
const WAITING = "waiting";

// Artwork anchors, normalized within each image: the hand icons hang from
// their index fingertip, the add/remove pointers from their arrow tip, and
// the beach ball spins around its own centre.
const HOTSPOTS = {
  [ POINTING ]: [
    0.42,
    0.25
  ],
  [ OPEN ]: [
    0.42,
    0.25
  ],
  [ GRABBING ]: [
    0.42,
    0.25
  ],
  [ ADD ]: [
    0.23,
    0.04
  ],
  [ REMOVE ]: [
    0.23,
    0.04
  ],
  [ WAITING ]: [
    0.51,
    0.51
  ]
};

export const VIRTUAL_POINTER_PREFIX = "vp-";

const DEFAULTS = {
  count: 6,
  scale: 0.18,
  seed: 7,
  easing: "easeInOutCubic",
  timing: {
    stagger: 0.2,
    travel: 0.45,
    hover: 0.2,
    drag: 0.6,
    release: 0.15,
    fade: 0.35
  },
  idle: {
    // Where a cursor waits between jobs: "stay" (on the point it finished),
    // "aside" (a hashed spot along the canvas border), or "exit" (off-canvas,
    // fading out and re-entering like the entrance/exodus).
    mode: "stay",
    beachball: true,
    spinSpeed: 1
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

function loadedImage( path ) {
  const img = cache.get( "imagesMap" )?.get?.( path )?.img;

  return img?.width ? img : null;
}

function lerpPoint(
  from, to, u
) {
  return {
    x: from.x + ( to.x - from.x ) * u,
    y: from.y + ( to.y - from.y ) * u
  };
}

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

// ── Transition plan: how word A's points become word B's ────────────────────
// Contours are paired by rank (both shapes sort theirs longest-first). Within
// a pair, min(n, m) points are MATCHED — the larger side contributes an
// evenly-spaced subset so leftovers spread around the ring instead of
// bunching — and the cyclic alignment that minimises total travel decides who
// goes where (rings-v4's seam trick). Unmatched source points become REMOVES,
// unmatched target points become ADDS; whole unpaired contours go entirely
// one way or the other.

function evenSubset(
  start, total, wanted
) {
  const indices = [];

  for ( let j = 0; j < wanted; j++ ) {
    indices.push( start + Math.floor( j * total / wanted ) );
  }

  return indices;
}

export function buildTransition(
  src, dst
) {
  const moves = [];
  const removes = [];
  const adds = [];
  const pairs = Math.min(
    src.contours.length,
    dst.contours.length
  );

  for ( let c = 0; c < Math.max(
    src.contours.length,
    dst.contours.length
  ); c++ ) {
    const a = src.contours[ c ];
    const b = dst.contours[ c ];

    if ( c >= pairs ) {
      if ( a ) {
        for ( let i = 0; i < a.count; i++ ) {
          removes.push( a.start + i );
        }
      }

      if ( b ) {
        for ( let i = 0; i < b.count; i++ ) {
          adds.push( b.start + i );
        }
      }

      continue;
    }

    const k = Math.min(
      a.count,
      b.count
    );
    const srcIdx = evenSubset(
      a.start,
      a.count,
      k
    );
    const dstIdx = evenSubset(
      b.start,
      b.count,
      k
    );

    // Cyclic shift of the destination ring that minimises total travel.
    let bestShift = 0;
    let bestCost = Infinity;

    for ( let shift = 0; shift < k; shift++ ) {
      let cost = 0;

      for ( let j = 0; j < k; j++ ) {
        const s = src.points[ srcIdx[ j ] ];
        const d = dst.points[ dstIdx[ ( j + shift ) % k ] ];
        const dx = s.x - d.x;
        const dy = s.y - d.y;

        cost += dx * dx + dy * dy;

        if ( cost >= bestCost ) {
          break;
        }
      }

      if ( cost < bestCost ) {
        bestCost = cost;
        bestShift = shift;
      }
    }

    const dstMatched = new Set();

    for ( let j = 0; j < k; j++ ) {
      const to = dstIdx[ ( j + bestShift ) % k ];

      dstMatched.add( to );
      moves.push( {
        from: srcIdx[ j ],
        to
      } );
    }

    const srcMatched = new Set( srcIdx );

    for ( let i = 0; i < a.count; i++ ) {
      if ( !srcMatched.has( a.start + i ) ) {
        removes.push( a.start + i );
      }
    }

    for ( let i = 0; i < b.count; i++ ) {
      if ( !dstMatched.has( b.start + i ) ) {
        adds.push( b.start + i );
      }
    }
  }

  return {
    moves,
    removes,
    adds
  };
}

// ── The troupe ──────────────────────────────────────────────────────────────

/**
 * Create the word-morphing troupe. Call `update(ctx)` every frame BEFORE the
 * drag layer (feed the returned pointers to `extraPointers`), and
 * `draw(p, config, now)` after the scene. `reset()` from sketch setup.
 */
export function createMorphTroupe() {
  const state = {
    signature: null,
    // Per-cursor event lists over the whole cycle, in absolute loop seconds.
    cursors: []
  };
  let lastResolved = [];

  // Lay the whole cycle out on the clock. Step k owns the morph window
  // [k·stepDur + hold, (k+1)·stepDur), whose tasks convert word k into word
  // k+1. Tasks are dealt round-robin across the troupe and sliced evenly
  // inside each cursor's share of the window; the timing weights only shape
  // the rhythm WITHIN a slice — completion is guaranteed by construction, so
  // the loop always closes.
  function buildSchedule( ctx ) {
    const cfg = ctx.config ?? {};
    const count = clamp(
      Math.round( cfg.count ?? DEFAULTS.count ),
      1,
      16
    );
    const timing = {
      ...DEFAULTS.timing,
      ...( cfg.timing ?? {} )
    };
    const cursors = [];

    for ( let c = 0; c < count; c++ ) {
      cursors.push( {
        index: c,
        events: []
      } );
    }

    ctx.steps.forEach( (
      step, k
    ) => {
      const morphStart = k * ctx.stepDur + ctx.holdDur;
      const morphEnd = ( k + 1 ) * ctx.stepDur;
      const lastStep = k === ctx.steps.length - 1;
      // Reserve room at the end of the final window for the exodus, so frame
      // 0 (no cursors) wraps clean.
      const exitReserve = lastStep
        ? Math.min(
          0.3 * ( morphEnd - morphStart ),
          Math.max(
            timing.fade,
            0.3
          ) + 0.3
        )
        : 0;

      // This step's tasks. Removes are dealt first so departures free space
      // while arrivals are still underway.
      const tasks = [
        ...step.transition.removes.map( ( poolIndex ) => ( {
          type: "remove",
          poolIndex
        } ) ),
        ...step.transition.moves.map( ( move ) => ( {
          type: "move",
          poolIndex: move.from,
          dstIndex: move.to
        } ) ),
        ...step.transition.adds.map( (
          dstIndex, ordinal
        ) => ( {
          type: "add",
          poolIndex: step.srcCount + ordinal,
          dstIndex
        } ) )
      ];

      cursors.forEach( ( cursor ) => {
        const mine = tasks.filter( (
          _, i
        ) => i % count === cursor.index );

        if ( !mine.length ) {
          return;
        }

        const window = morphEnd - morphStart - exitReserve;
        const delay = Math.min(
          cursor.index * Math.max(
            timing.stagger,
            0
          ),
          0.25 * window
        );
        const slice = ( window - delay ) / mine.length;

        mine.forEach( (
          task, i
        ) => {
          cursor.events.push( {
            ...task,
            step: k,
            t0: morphStart + delay + i * slice,
            t1: morphStart + delay + ( i + 1 ) * slice
          } );
        } );
      } );
    } );

    // Synthesise each cursor's exit: after its last task, travel off-canvas
    // and fade before the cycle wraps.
    const cycleEnd = ctx.steps.length * ctx.stepDur;

    cursors.forEach( ( cursor ) => {
      if ( !cursor.events.length ) {
        return;
      }

      const last = cursor.events[ cursor.events.length - 1 ];

      cursor.events.push( {
        type: "exit",
        step: ctx.steps.length - 1,
        t0: last.t1,
        t1: Math.min(
          last.t1 + Math.max(
            timing.travel,
            timing.fade,
            0.2
          ),
          cycleEnd - 0.02
        )
      } );
    } );

    return cursors;
  }

  // Sub-phase boundaries within a task slice, from the timing weights.
  function subBounds( timing ) {
    const w = [
      Math.max(
        timing.travel,
        0.01
      ),
      Math.max(
        timing.hover,
        0
      ),
      Math.max(
        timing.drag,
        0.01
      ),
      Math.max(
        timing.release,
        0
      )
    ];
    const total = w[ 0 ] + w[ 1 ] + w[ 2 ] + w[ 3 ];

    return [
      w[ 0 ] / total,
      ( w[ 0 ] + w[ 1 ] ) / total,
      ( w[ 0 ] + w[ 1 ] + w[ 2 ] ) / total,
      1
    ];
  }

  // Where an event leaves its cursor (live-projected each frame).
  function anchorEnd(
    event, ctx
  ) {
    if ( event.type === "move" || event.type === "add" ) {
      return ctx.projectShapePoint(
        ( event.step + 1 ) % ctx.steps.length,
        event.dstIndex
      );
    }

    if ( event.type === "remove" ) {
      const src = ctx.projectShapePoint(
        event.step,
        event.poolIndex
      );

      return offCanvasPoint(
        src,
        outwardDir(
          src,
          ctx.width,
          ctx.height
        ),
        ctx.width,
        ctx.height,
        80
      );
    }

    return null;
  }

  // Where a cursor waits out the gap after `prev`, per the idle mode: the
  // finished point itself ("stay"), a hashed spot along the canvas border
  // ("aside" — deterministic in cursor index and beat, so scrubbing replays
  // it), or an off-canvas point beyond the finished point ("exit").
  function parkSpot(
    prev, ctx, cfg, cursorIndex, mode
  ) {
    const anchor = anchorEnd(
      prev,
      ctx
    );

    if ( !anchor || mode === "stay" ) {
      return anchor;
    }

    if ( mode === "exit" ) {
      return offCanvasPoint(
        anchor,
        outwardDir(
          anchor,
          ctx.width,
          ctx.height
        ),
        ctx.width,
        ctx.height,
        80
      );
    }

    // "aside": a point on the border rectangle inset a little from the canvas
    // edge, picked by perimeter position — visible, but clear of the word.
    const seed = Math.round( cfg.seed ?? DEFAULTS.seed ) * 1009;
    const u = hashedRandom( seed + cursorIndex * 13 + prev.step * 29 + 3 );
    const inset = 0.07 * Math.min(
      ctx.width,
      ctx.height
    );
    const rw = Math.max(
      ctx.width - 2 * inset,
      1
    );
    const rh = Math.max(
      ctx.height - 2 * inset,
      1
    );
    let d = u * 2 * ( rw + rh );

    if ( d < rw ) {
      return {
        x: inset + d,
        y: inset
      };
    }

    d -= rw;

    if ( d < rh ) {
      return {
        x: ctx.width - inset,
        y: inset + d
      };
    }

    d -= rh;

    if ( d < rw ) {
      return {
        x: ctx.width - inset - d,
        y: ctx.height - inset
      };
    }

    d -= rw;

    return {
      x: inset,
      y: ctx.height - inset - d
    };
  }

  // Resolve one cursor at loop time `now`: { pos, icon, alpha, pressed } or
  // null while off-stage. Everything derives from the schedule + the live
  // projections — nothing accumulates frame to frame.
  function resolveCursor(
    cursor, now, ctx, timing, ease
  ) {
    const events = cursor.events;

    if ( !events.length ) {
      return null;
    }

    const cfg = ctx.config ?? {};
    const idleMode = cfg.idle?.mode ?? DEFAULTS.idle.mode;
    const first = events[ 0 ];
    const exit = events[ events.length - 1 ];

    if ( now < first.t0 || now >= exit.t1 ) {
      return null;
    }

    const fade = Math.max(
      timing.fade,
      0.01
    );
    let alpha = Math.min(
      clamp(
        ( now - first.t0 ) / fade,
        0,
        1
      ),
      exit.type === "exit" && now >= exit.t0
        ? 1 - clamp(
          ( now - exit.t0 ) / Math.max(
            exit.t1 - exit.t0,
            0.01
          ),
          0,
          1
        )
        : 1
    );

    // Find the active event, or the gap we're idling in.
    let active = null;
    let prev = null;

    for ( const event of events ) {
      if ( now < event.t0 ) {
        break;
      }

      if ( now < event.t1 ) {
        active = event;
        break;
      }

      prev = event;
    }

    const bounds = subBounds( timing );
    const margin = 80;
    // Did an idle gap precede the active event? (Consecutive tasks touch, so
    // a real gap only opens across a hold beat or an empty morph window.)
    const gapBefore = !!prev && ( active ? active.t0 - prev.t1 : now - prev.t1 ) > 1e-3;

    // A cursor coming back from an off-canvas park fades back in like its
    // first entrance.
    if ( active && gapBefore && idleMode === "exit" ) {
      alpha = Math.min(
        alpha,
        clamp(
          ( now - active.t0 ) / fade,
          0,
          1
        )
      );
    }

    // Idling between tasks (a hold beat): travel to the parking spot of the
    // configured idle mode and wait there.
    if ( !active ) {
      const anchor = prev
        ? anchorEnd(
          prev,
          ctx
        )
        : null;

      if ( !anchor ) {
        return null;
      }

      if ( idleMode === "stay" ) {
        return {
          pos: anchor,
          icon: WAITING,
          alpha,
          pressed: false
        };
      }

      const spot = parkSpot(
        prev,
        ctx,
        cfg,
        cursor.index,
        idleMode
      ) ?? anchor;
      const travelDur = Math.max(
        timing.travel,
        0.01
      );
      const u = clamp(
        ( now - prev.t1 ) / travelDur,
        0,
        1
      );
      const pos = lerpPoint(
        anchor,
        spot,
        ease( u )
      );

      if ( idleMode === "exit" ) {
        return {
          pos,
          icon: POINTING,
          alpha: Math.min(
            alpha,
            1 - clamp(
              ( now - prev.t1 ) / fade,
              0,
              1
            )
          ),
          pressed: false
        };
      }

      return {
        pos,
        icon: u < 1 ? POINTING : WAITING,
        alpha,
        pressed: false
      };
    }

    const u = clamp(
      ( now - active.t0 ) / Math.max(
        active.t1 - active.t0,
        1e-4
      ),
      0,
      1
    );

    // Where this event STARTS: the previous event's end (or, after an idle
    // gap, the parking spot the cursor waited on), or (first appearance)
    // off-canvas beyond the first approach target.
    const startAnchor = () => {
      if ( prev ) {
        const from = gapBefore
          ? parkSpot(
            prev,
            ctx,
            cfg,
            cursor.index,
            idleMode
          )
          : anchorEnd(
            prev,
            ctx
          );

        return from ?? {
          x: ctx.width / 2,
          y: -margin
        };
      }

      const target = active.type === "add"
        ? ctx.projectShapePoint(
          ( active.step + 1 ) % ctx.steps.length,
          active.dstIndex
        )
        : ctx.targets[ active.poolIndex ] ?? {
          x: ctx.width / 2,
          y: ctx.height / 2
        };

      return offCanvasPoint(
        target,
        outwardDir(
          target,
          ctx.width,
          ctx.height
        ),
        ctx.width,
        ctx.height,
        margin
      );
    };

    if ( active.type === "exit" ) {
      const from = startAnchor();
      const away = offCanvasPoint(
        from,
        outwardDir(
          from,
          ctx.width,
          ctx.height
        ),
        ctx.width,
        ctx.height,
        margin
      );

      return {
        pos: lerpPoint(
          from,
          away,
          ease( u )
        ),
        icon: POINTING,
        alpha,
        pressed: false
      };
    }

    if ( active.type === "move" || active.type === "remove" ) {
      const livePoint = ctx.targets[ active.poolIndex ] ?? {
        x: ctx.width / 2,
        y: ctx.height / 2
      };

      if ( u < bounds[ 0 ] ) {
        // Approach the live point (it tracks the camera — and any manual
        // nudge — because targets are re-projected every frame).
        return {
          pos: lerpPoint(
            startAnchor(),
            livePoint,
            ease( u / bounds[ 0 ] )
          ),
          icon: POINTING,
          alpha,
          pressed: false
        };
      }

      if ( u < bounds[ 1 ] ) {
        return {
          pos: livePoint,
          icon: OPEN,
          alpha,
          pressed: false
        };
      }

      if ( u < bounds[ 2 ] ) {
        const v = ease( ( u - bounds[ 1 ] ) / ( bounds[ 2 ] - bounds[ 1 ] ) );
        const from = ctx.projectShapePoint(
          active.step,
          active.poolIndex
        );

        if ( active.type === "move" ) {
          const to = ctx.projectShapePoint(
            ( active.step + 1 ) % ctx.steps.length,
            active.dstIndex
          );

          return {
            pos: lerpPoint(
              from,
              to,
              v
            ),
            icon: GRABBING,
            alpha,
            pressed: true,
            targetIndex: active.poolIndex
          };
        }

        // Remove: carry the point away — the icon flips to the remove
        // pointer once the retreat is clearly underway.
        const away = offCanvasPoint(
          from,
          outwardDir(
            from,
            ctx.width,
            ctx.height
          ),
          ctx.width,
          ctx.height,
          margin
        );

        return {
          pos: lerpPoint(
            from,
            away,
            v
          ),
          icon: v < 0.35 ? GRABBING : REMOVE,
          alpha,
          pressed: true,
          targetIndex: active.poolIndex
        };
      }

      if ( active.type === "remove" ) {
        // Poof: cursor (and point) are off-canvas — retire the point.
        ctx.deactivatePoint( active.poolIndex );

        return {
          pos: anchorEnd(
            active,
            ctx
          ),
          icon: REMOVE,
          alpha,
          pressed: false
        };
      }

      return {
        pos: anchorEnd(
          active,
          ctx
        ),
        icon: OPEN,
        alpha,
        pressed: false
      };
    }

    // Add: travel out to the fetch spot, pick the new point up there (it
    // pops into existence under the add pointer), carry it in as a real
    // drag, place it.
    const dstPos = ctx.projectShapePoint(
      ( active.step + 1 ) % ctx.steps.length,
      active.dstIndex
    );
    const fetch = offCanvasPoint(
      dstPos,
      outwardDir(
        dstPos,
        ctx.width,
        ctx.height
      ),
      ctx.width,
      ctx.height,
      margin
    );

    if ( u < bounds[ 0 ] ) {
      return {
        pos: lerpPoint(
          startAnchor(),
          fetch,
          ease( u / bounds[ 0 ] )
        ),
        icon: POINTING,
        alpha,
        pressed: false
      };
    }

    ctx.activatePoint(
      active.poolIndex,
      fetch
    );

    if ( u < bounds[ 1 ] ) {
      return {
        pos: fetch,
        icon: ADD,
        alpha,
        pressed: false
      };
    }

    if ( u < bounds[ 2 ] ) {
      const v = ease( ( u - bounds[ 1 ] ) / ( bounds[ 2 ] - bounds[ 1 ] ) );

      return {
        pos: lerpPoint(
          fetch,
          dstPos,
          v
        ),
        icon: ADD,
        alpha,
        pressed: true,
        targetIndex: active.poolIndex
      };
    }

    return {
      pos: dstPos,
      icon: ADD,
      alpha,
      pressed: false
    };
  }

  return {
    /** Per-cursor schedules (tests / debugging). */
    get cursors() {
      return state.cursors;
    },

    /**
     * One frame of the show.
     *
     * @param {object} ctx
     * @param {number} ctx.now - Loop clock, wrapped to [0, cycle).
     * @param {object} ctx.config - `interaction.virtualPointers` options.
     * @param {Array} ctx.steps - Per step: { srcCount, transition }.
     * @param {number} ctx.stepDur - Beat length (loop seconds).
     * @param {number} ctx.holdDur - Hold at the start of each beat.
     * @param {Array<{x, y}>} ctx.targets - Live pool projections (sentinel
     *   coordinates for inactive slots).
     * @param {(k: number, i: number) => {x, y}} ctx.projectShapePoint -
     *   Static point i of step k's shape, projected through the camera.
     * @param {(i: number, screenPt: {x, y}) => void} ctx.activatePoint -
     *   Bring pool slot i to life at a screen position (idempotent).
     * @param {(i: number) => void} ctx.deactivatePoint - Retire pool slot i
     *   (idempotent).
     * @param {number} ctx.width - Canvas width (px).
     * @param {number} ctx.height - Canvas height (px).
     * @param {string} ctx.signature - Rebuild the schedule when this changes.
     * @returns {Array} pointers for draggable.update's `extraPointers`.
     */
    update( ctx ) {
      const cfg = ctx.config ?? {};

      if ( cfg.enabled === false || !ctx.steps?.length || !Number.isFinite( ctx.now ) ) {
        state.signature = null;
        state.cursors = [];
        lastResolved = [];

        return [];
      }

      if ( state.signature !== ctx.signature ) {
        state.signature = ctx.signature;
        state.cursors = buildSchedule( ctx );
      }

      const timing = {
        ...DEFAULTS.timing,
        ...( cfg.timing ?? {} )
      };
      const easeKey = cfg.easing ?? DEFAULTS.easing;
      const ease = typeof easing[ easeKey ] === "function" ? easing[ easeKey ] : ( x ) => x;
      const pointers = [];

      lastResolved = state.cursors.map( ( cursor ) => {
        const resolved = resolveCursor(
          cursor,
          ctx.now,
          ctx,
          timing,
          ease
        );

        if ( resolved ) {
          // targetIndex names the pool slot a pressed cursor is carrying, so
          // the sketch can bind the drag explicitly instead of relying on the
          // proximity pick (which can miss when a task slice is compressed).
          pointers.push( {
            key: `${ VIRTUAL_POINTER_PREFIX }${ cursor.index }`,
            x: resolved.pos.x,
            y: resolved.pos.y,
            pressed: resolved.pressed,
            targetIndex: resolved.targetIndex,
            kind: "virtual"
          } );
        }

        return resolved;
      } );

      return pointers;
    },

    /**
     * Draw every visible cursor. The waiting artwork (beach ball) spins
     * around its own centre; when the toggle is off, waiting cursors keep the
     * plain pointing artwork.
     *
     * @param {object} p - p5 instance.
     * @param {object} config - `interaction.virtualPointers` options.
     * @param {number} now - Loop clock (drives the spin).
     */
    draw(
      p, config, now
    ) {
      const cfg = config ?? {};

      if ( cfg.enabled === false || !lastResolved.length ) {
        return;
      }

      const images = cfg.images ?? {};
      const scale = clamp(
        cfg.scale ?? DEFAULTS.scale,
        0.02,
        1
      );
      const beachball = cfg.idle?.beachball ?? DEFAULTS.idle.beachball;
      const spinSpeed = cfg.idle?.spinSpeed ?? DEFAULTS.idle.spinSpeed;

      p.push();
      p.imageMode( p.CORNER );
      p.noStroke();

      lastResolved.forEach( ( cursor ) => {
        if ( !cursor || cursor.alpha <= 0 ) {
          return;
        }

        const wantWaiting = cursor.icon === WAITING && beachball !== false;
        const iconKey = wantWaiting ? WAITING : cursor.icon === WAITING ? POINTING : cursor.icon;
        const img = loadedImage( images[ iconKey ] ) ?? loadedImage( images[ POINTING ] );

        if ( !img ) {
          return;
        }

        const spinning = wantWaiting && !!loadedImage( images[ WAITING ] );
        const width = img.width * scale;
        const height = img.height * scale;
        const [
          hx,
          hy
        ] = HOTSPOTS[ iconKey ] ?? HOTSPOTS[ POINTING ];

        p.tint(
          255,
          255 * clamp(
            cursor.alpha,
            0,
            1
          )
        );

        if ( spinning ) {
          // The waiting artwork rotates around its own centre, which sits ON
          // the cursor position.
          p.push();
          p.translate(
            cursor.pos.x,
            cursor.pos.y
          );
          p.rotate( now * spinSpeed * p.TAU );
          p.image(
            img,
            -hx * width,
            -hy * height,
            width,
            height
          );
          p.pop();
        } else {
          p.image(
            img,
            cursor.pos.x - hx * width,
            cursor.pos.y - hy * height,
            width,
            height
          );
        }
      } );

      p.noTint();
      p.pop();
    },

    /** Forget the schedule (sketch restart). */
    reset() {
      state.signature = null;
      state.cursors = [];
      lastResolved = [];
    }
  };
}

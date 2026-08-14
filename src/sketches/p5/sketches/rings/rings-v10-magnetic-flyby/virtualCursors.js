import cache from "@/p5/utils/cache.js";
import easing from "@/p5/utils/easing.js";

// ── Virtual cursors v10: the fly-by formation ───────────────────────────────
// v7–v9's troupes were stage hands: they pressed on points and dragged (or
// flicked) them around. The v10 cursors never press anything — they are a
// FORMATION flying over the word, and the word reacts to their mere passage
// (the sketch attracts any text point inside a cursor's reach). So this
// module is deliberately dumb and fully stateless: given the loop clock it
// returns where every cursor is, and draws them. No schedule, no events, no
// per-frame accumulation — scrubbing, pausing and deterministic capture all
// resolve the identical formation because there is nothing else to resolve.
//
// ── The three flight plans ──
// "circle"    — the cursors sit evenly spaced on a circle around the canvas
//               centre; the circle's radius breathes from its outer rim to
//               the centre and back (`cycles` breaths per loop, shaped by the
//               easing). `stagger` offsets each cursor's breath so the ring
//               collapses as a spiral cascade instead of one rigid hoop, and
//               `spinTurns` adds whole revolutions per loop.
// "lissajous" — every cursor rides the same Lissajous curve (x = sin, y =
//               cos, integer frequencies, both phases adjustable); `stagger`
//               spreads the cursors along the curve like beads on a wire.
// "sweep"     — the cursors split into parallel lanes and wipe across the
//               canvas (horizontal or vertical), out and back (ping-pong, so
//               the loop closes by construction); `stagger` turns the flat
//               wiper blade into a diagonal wave.
//
// ── Loop safety ──
// Whole numbers everywhere a rate matters: breaths/sweeps per loop, spin
// turns and the Lissajous frequencies all snap to integers, and the easing
// curves land exactly on 0/1 at both ends of every half-cycle — so the
// formation at uT = TAU is pixel-identical to uT = 0, live and in capture.
// Phases and staggers are plain offsets and stay free.

const NORMAL = "normal";
const OVER = "over";

// Artwork anchor, normalized within the image: the hand icons hang from
// their index fingertip (same artwork family as v7–v9).
const HOTSPOTS = {
  [ NORMAL ]: [
    0.42,
    0.25
  ],
  [ OVER ]: [
    0.42,
    0.25
  ]
};

export const VIRTUAL_CURSOR_PREFIX = "vc-";

export const CURSOR_DEFAULTS = {
  count: 8,
  scale: 0.4,
  hoverRadius: 55
};

export const MOVEMENT_DEFAULTS = {
  mode: "circle",
  cycles: 2,
  phase: 0,
  stagger: 0,
  easing: "easeInOutCubic",
  circle: {
    radiusMin: 0.05,
    radiusMax: 0.95,
    rotation: 0,
    spinTurns: 0
  },
  lissajous: {
    freqX: 3,
    freqY: 2,
    phaseX: 0,
    phaseY: 0,
    amplitudeX: 0.85,
    amplitudeY: 0.85
  },
  sweep: {
    direction: "horizontal",
    span: 0.85,
    inset: 0.06
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

function frac( value ) {
  return ( ( value % 1 ) + 1 ) % 1;
}

// 0 → 1 → 0 across u ∈ [0, 1), the easing applied symmetrically to both
// halves (time-reversed on the way back), meeting 1 exactly mid-cycle and 0
// exactly at both ends — the loop-safe travel primitive for sweep and (as
// its complement) the circle breath.
function easedPingPong(
  u, ease
) {
  return u < 0.5 ? ease( u * 2 ) : ease( 2 - u * 2 );
}

function loadedImage( path ) {
  const img = cache.get( "imagesMap" )?.get?.( path )?.img;

  return img?.width ? img : null;
}

/**
 * Resolve the whole formation at one instant of the loop.
 *
 * @param {object} movementCfg - The `movement` options block.
 * @param {number} count - Cursor count (the `cursors.count` option).
 * @param {object} env
 * @param {number} env.progress - Loop progress in [0, 1).
 * @param {number} env.width - Canvas width (px).
 * @param {number} env.height - Canvas height (px).
 * @returns {Array<{key: string, x: number, y: number}>} one entry per cursor.
 */
export function computeCursors(
  movementCfg, count, env
) {
  const movement = {
    ...MOVEMENT_DEFAULTS,
    ...( movementCfg ?? {} )
  };
  const n = clamp(
    Math.round( count ?? CURSOR_DEFAULTS.count ),
    1,
    16
  );
  const cycles = Math.max(
    Math.round( movement.cycles ?? MOVEMENT_DEFAULTS.cycles ),
    1
  );
  const stagger = movement.stagger ?? 0;
  const phase = movement.phase ?? 0;
  const easeKey = movement.easing ?? MOVEMENT_DEFAULTS.easing;
  const ease = typeof easing[ easeKey ] === "function" ? easing[ easeKey ] : ( x ) => x;
  const cx = env.width / 2;
  const cy = env.height / 2;
  const cursors = [];

  for ( let i = 0; i < n; i++ ) {
    // Every mode rides the same per-cursor cycle clock: `cycles` passes per
    // loop, shifted by the global phase and this cursor's stagger share.
    const u = frac( cycles * env.progress + phase + stagger * i / n );
    let x = cx;
    let y = cy;

    if ( movement.mode === "lissajous" ) {
      const cfg = {
        ...MOVEMENT_DEFAULTS.lissajous,
        ...( movement.lissajous ?? {} )
      };
      const freqX = Math.max(
        Math.round( cfg.freqX ),
        1
      );
      const freqY = Math.max(
        Math.round( cfg.freqY ),
        1
      );
      const theta = u * 2 * Math.PI;

      x = cx + cfg.amplitudeX * env.width / 2 * Math.sin( freqX * theta + cfg.phaseX );
      y = cy + cfg.amplitudeY * env.height / 2 * Math.cos( freqY * theta + cfg.phaseY );
    } else if ( movement.mode === "sweep" ) {
      const cfg = {
        ...MOVEMENT_DEFAULTS.sweep,
        ...( movement.sweep ?? {} )
      };
      const horizontal = cfg.direction !== "vertical";
      const travelSpan = horizontal ? env.width : env.height;
      const laneSpan = horizontal ? env.height : env.width;
      const inset = clamp(
        cfg.inset ?? MOVEMENT_DEFAULTS.sweep.inset,
        0,
        0.45
      ) * travelSpan;
      const travel = inset + easedPingPong(
        u,
        ease
      ) * ( travelSpan - 2 * inset );
      // Lanes spread evenly across the perpendicular axis, centred; one
      // cursor flies the centre line.
      const laneT = n === 1 ? 0 : i / ( n - 1 ) - 0.5;
      const lane = laneSpan * ( 0.5 + laneT * clamp(
        cfg.span ?? MOVEMENT_DEFAULTS.sweep.span,
        0,
        1
      ) );

      x = horizontal ? travel : lane;
      y = horizontal ? lane : travel;
    } else {
      // "circle" — the formation of the sketch's name. The breath is the
      // ping-pong's complement: outer rim at u = 0, centre at u = 0.5, back
      // out — so frame 0 shows the aligned circle the mode promises.
      const cfg = {
        ...MOVEMENT_DEFAULTS.circle,
        ...( movement.circle ?? {} )
      };
      const breath = 1 - easedPingPong(
        u,
        ease
      );
      const rMin = Math.max(
        cfg.radiusMin ?? MOVEMENT_DEFAULTS.circle.radiusMin,
        0
      );
      const rMax = Math.max(
        cfg.radiusMax ?? MOVEMENT_DEFAULTS.circle.radiusMax,
        rMin
      );
      const radius = ( rMin + ( rMax - rMin ) * breath ) * Math.min(
        env.width,
        env.height
      ) / 2;
      const spinTurns = Math.round( cfg.spinTurns ?? 0 );
      const theta = 2 * Math.PI * ( i / n + spinTurns * env.progress ) + ( cfg.rotation ?? 0 );

      x = cx + radius * Math.cos( theta );
      y = cy + radius * Math.sin( theta );
    }

    cursors.push( {
      key: `${ VIRTUAL_CURSOR_PREFIX }${ i }`,
      x,
      y
    } );
  }

  return cursors;
}

/**
 * Draw the formation. Each cursor shows the `normal` artwork in flight and
 * flips to the `over` artwork while it hovers at least one text point (the
 * sketch sets `cursor.over` from its own proximity pass — hovering is the
 * whole act in v10, so it deserves the costume change).
 *
 * @param {object} p - p5 instance.
 * @param {object} config - The `cursors` options block (images, scale).
 * @param {Array<{x, y, over}>} cursors - From computeCursors, `over` added.
 */
export function drawCursors(
  p, config, cursors
) {
  const cfg = config ?? {};

  if ( cfg.enabled === false || !cursors?.length ) {
    return;
  }

  const images = cfg.images ?? {};
  const scale = clamp(
    cfg.scale ?? CURSOR_DEFAULTS.scale,
    0.02,
    1
  );

  p.push();
  p.imageMode( p.CORNER );
  p.noStroke();

  cursors.forEach( ( cursor ) => {
    const iconKey = cursor.over ? OVER : NORMAL;
    const img = loadedImage( images[ iconKey ] ) ?? loadedImage( images[ NORMAL ] );

    if ( !img ) {
      return;
    }

    const width = img.width * scale;
    const height = img.height * scale;
    const [
      hx,
      hy
    ] = HOTSPOTS[ iconKey ] ?? HOTSPOTS[ NORMAL ];

    p.image(
      img,
      cursor.x - hx * width,
      cursor.y - hy * height,
      width,
      height
    );
  } );

  p.pop();
}

import {
  hash01,
  valueNoise3
} from "./_lattice.js";

// ─────────────────────────────────────────────────────────────────────────────
// The wave the sculpt category animates with, shared by every sketch in it.
//
// A wave is the loop clock offset per link by a RANK in [0, 1] — where the link
// sits along the wave's direction, computed from its rest position by the
// chosen mode. The same clock then runs through an ENVELOPE (pose, hold,
// withdraw) that says how much of the link is there and how thick it is. Two
// rules hold across every mode:
//
//   • A link is walked from its lower-ranked end to its higher-ranked end, so
//     the material always flows AWAY from the wave's source. The sketch orients
//     each link by comparing its two endpoints' ranks.
//   • Whole waves per loop. The phase is frac( loop × waves − rank × spread ),
//     which returns to itself when `loop` wraps, so a capture closes without a
//     seam whatever the mode.
//
// Positions are given normalised to the lattice's unit radius (see
// _lattice.js), y up, the camera looking from -z at yaw 0.
// ─────────────────────────────────────────────────────────────────────────────

export const WAVE_MODES = [
  "radial-out",
  "radial-in",
  "left-right",
  "right-left",
  "top-down",
  "bottom-up",
  "front-back",
  "back-front",
  "diagonal",
  "noise",
  "random",
  "cursor"
];

export const WAVE_EFFECTS = [
  "grow-swell",
  "grow",
  "swell",
  "reveal",
  "none"
];

function clamp01( value ) {
  return Math.min(
    1,
    Math.max(
      0,
      value
    )
  );
}

/**
 * Where a point sits along the wave, 0 (the source) → 1 (the far end).
 *
 * @param {{x:number,y:number,z:number}} pt normalised rest position
 * @param {string} mode one of WAVE_MODES
 * @param {object} [ctx]
 * @param {number} [ctx.id=0]       stable identity (for `random` and jitter)
 * @param {number} [ctx.seed=0]
 * @param {number} [ctx.jitter=0]   seeded noise added to the rank (0 → 1)
 * @param {number} [ctx.frequency=1.5] spatial frequency of the `noise` mode
 * @param {{x:number,y:number,z:number}|null} [ctx.cursor=null] source of the
 *   `cursor` mode, in the same normalised space; without one the wave starts
 *   at the centre, so an export with no pointer still has a source
 * @returns {number} rank in [0, 1]
 */
export function rankAt(
  pt, mode, {
    id = 0,
    seed = 0,
    jitter = 0,
    frequency = 1.5,
    cursor = null
  } = {}
) {
  let rank;

  switch ( mode ) {
    case "radial-in":
      rank = 1 - Math.min(
        1,
        Math.hypot(
          pt.x,
          pt.y,
          pt.z
        )
      );
      break;
    case "left-right":
      rank = ( pt.x + 1 ) / 2;
      break;
    case "right-left":
      rank = ( 1 - pt.x ) / 2;
      break;
    case "top-down":
      rank = ( 1 - pt.y ) / 2;
      break;
    case "bottom-up":
      rank = ( pt.y + 1 ) / 2;
      break;
    case "front-back":
      rank = ( pt.z + 1 ) / 2;
      break;
    case "back-front":
      rank = ( 1 - pt.z ) / 2;
      break;
    case "diagonal":
      rank = ( ( pt.x + 1 ) / 2 + ( pt.y + 1 ) / 2 ) / 2;
      break;
    case "noise":
      rank = valueNoise3(
        pt.x * frequency + 5.1,
        pt.y * frequency + 9.7,
        pt.z * frequency + 3.3,
        seed
      );
      break;
    case "random":
      rank = hash01(
        seed,
        id,
        23
      );
      break;
    case "cursor": {
      const c = cursor ?? {
        x: 0,
        y: 0,
        z: 0
      };

      rank = Math.min(
        1,
        Math.hypot(
          pt.x - c.x,
          pt.y - c.y,
          pt.z - c.z
        ) / 2
      );
      break;
    }
    default:
      rank = Math.min(
        1,
        Math.hypot(
          pt.x,
          pt.y,
          pt.z
        )
      );
  }

  if ( jitter > 0 ) {
    rank += ( hash01(
      seed,
      id,
      29
    ) - 0.5 ) * jitter * 1.6;
  }

  return clamp01( rank );
}

/**
 * The link's own phase in its cycle for a loop phase, a wave count and a rank.
 * Positive modulo, so it is continuous across the loop wrap.
 */
export function wavePhase(
  loop, waves, rank, spread
) {
  const beat = loop * Math.max(
    1,
    Math.round( waves )
  ) - rank * spread;

  return ( ( beat % 1 ) + 1 ) % 1;
}

/**
 * Pose / hold / withdraw timings, normalised so the three fit inside one cycle:
 * the withdraw lasts as long as the pose, and the hold is shortened first when
 * the sum would exceed the cycle. Anything past `active` is the dark part of
 * the cycle, where the link is absent.
 */
export function envelopeTimings( {
  rise,
  hold
} ) {
  const r = Math.min(
    0.5,
    Math.max(
      0.02,
      rise
    )
  );
  const h = Math.min(
    Math.max(
      0,
      hold
    ),
    Math.max(
      0,
      1 - 2 * r
    )
  );

  return {
    rise: r,
    hold: h,
    active: 2 * r + h
  };
}

/**
 * The envelope at a phase: `head` is how far the pose has travelled along the
 * link (0 → 1), `tail` how far the withdraw has followed it, `bump` a sine
 * crest over the active part of the cycle (0 outside it).
 */
export function envelopeAt(
  phase, timings, ease = ( x ) => x
) {
  const {
    rise,
    hold,
    active
  } = timings;
  const head = ease( clamp01( phase / rise ) );
  const tail = ease( clamp01( ( phase - rise - hold ) / rise ) );
  const bump = phase < active ? Math.sin( Math.PI * phase / active ) : 0;

  return {
    head,
    tail,
    bump
  };
}

/**
 * What the envelope does to a link under an effect. `present` false means the
 * link contributes nothing this frame; `head`/`tail` bound the drawn part
 * (fractions from the source end); `radius` scales the tube.
 */
export function linkStateAt(
  effect, envelope, swell
) {
  const {
    head,
    tail,
    bump
  } = envelope;

  switch ( effect ) {
    case "none":
      return {
        present: true,
        head: 1,
        tail: 0,
        radius: 1
      };
    case "grow":
      return {
        present: head - tail > 0.002,
        head,
        tail,
        radius: 1
      };
    case "swell":
      return {
        present: true,
        head: 1,
        tail: 0,
        radius: 1 + swell * bump
      };
    case "reveal": {
      const radius = Math.min(
        head,
        1 - tail
      );

      return {
        present: radius > 0.01,
        head: 1,
        tail: 0,
        radius
      };
    }
    default:
      return {
        present: head - tail > 0.002,
        head,
        tail,
        radius: 1 + swell * bump
      };
  }
}

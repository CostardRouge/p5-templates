// ── The sequence's clock: scenes laid end to end over one loop ─────────────
//
// A sequence item's scenes share the host loop in proportion to their
// `weight`, back to back, and each one ENTERS over the first `duration`
// seconds of its own slot while the outgoing scene keeps drawing under it. The
// whole arrangement is a pure function of the loop time, so a capture renders
// the same cut as the preview — nothing here reads a wall clock or keeps state
// between frames.
//
// No p5 in this module: it is unit-tested as plain maths.

import easing from "../easing.js";

/** Wrap any number into [0, 1). */
export function wrapUnit( value ) {
  if ( !Number.isFinite( value ) ) {
    return 0;
  }

  return value - Math.floor( value );
}

function clamp01( value ) {
  return Math.min(
    1,
    Math.max(
      0,
      value
    )
  );
}

function positive(
  value, fallback
) {
  return Number.isFinite( value ) && value > 0 ? value : fallback;
}

/**
 * Lay the scenes out over `loopSeconds`.
 *
 * Each scene gets `loopSeconds × weight / Σ weights`, in order. Its entrance
 * (`transition.duration`) is clamped so that at most two scenes are ever on
 * screen: never longer than its own slot, never longer than the slot it is
 * leaving. In `cyclic` mode the first scene enters from the last one across the
 * loop boundary (what makes the reel loop seamlessly); in `once` mode it
 * simply starts, and the last scene holds until the loop restarts.
 *
 * @param {Array<{ weight?: number, transition?: { duration?: number } }>} scenes
 * @param {number} loopSeconds the host loop's duration, in seconds
 * @param {"cyclic"|"once"} [loop]
 * @returns {{ total: number, loop: string, scenes: Array<{ index: number, start: number, end: number, length: number, transitionIn: number, from: number|null }> }}
 */
export function buildTimeline(
  scenes, loopSeconds, loop = "cyclic"
) {
  const list = Array.isArray( scenes ) ? scenes : [];
  const total = positive(
    loopSeconds,
    1
  );
  const weights = list.map( ( scene ) => positive(
    scene?.weight,
    1
  ) );
  const sum = weights.reduce(
    (
      acc, weight
    ) => acc + weight,
    0
  ) || 1;

  const laid = [];
  let cursor = 0;

  list.forEach( (
    scene, index
  ) => {
    const length = total * weights[ index ] / sum;

    laid.push( {
      index,
      start: cursor,
      end: cursor + length,
      length,
      transitionIn: 0,
      from: null
    } );
    cursor += length;
  } );

  // Pin the last end to the total so float drift never leaves a gap a frame
  // could fall into.
  if ( laid.length ) {
    laid[ laid.length - 1 ].end = total;
  }

  laid.forEach( (
    slot, index
  ) => {
    const previous = index > 0
      ? laid[ index - 1 ]
      : ( loop === "cyclic" && laid.length > 1 ? laid[ laid.length - 1 ] : null );

    if ( !previous ) {
      return;
    }

    const wanted = Math.max(
      0,
      Number( list[ index ]?.transition?.duration ) || 0
    );

    slot.from = previous.index;
    slot.transitionIn = Math.min(
      wanted,
      slot.length,
      previous.length
    );
  } );

  return {
    total,
    loop,
    scenes: laid
  };
}

/**
 * Where the reel is at loop time `seconds`.
 *
 * `index` is the scene on screen (the one being entered, during a transition),
 * `local` its time since its slot began, `progress` that time over its slot
 * (0..1). `from` names the outgoing scene while a transition runs — with a
 * `local` that keeps counting past its own slot, so it goes on moving under
 * the reveal — and `mix` is the EASED transition progress (0 = all outgoing,
 * 1 = all incoming). Outside a transition `from` is null and `mix` is 1.
 *
 * @param {ReturnType<typeof buildTimeline>} timeline
 * @param {number} seconds loop time in [0, total)
 * @param {Array<{ transition?: { easing?: string } }>} scenes the scenes the timeline was built from
 */
export function resolveSequence(
  timeline, seconds, scenes = []
) {
  const slots = timeline?.scenes ?? [];

  if ( !slots.length ) {
    return null;
  }

  const total = timeline.total;
  const t = wrapUnit( seconds / total ) * total;

  let slot = slots[ slots.length - 1 ];

  for ( const candidate of slots ) {
    if ( t >= candidate.start && t < candidate.end ) {
      slot = candidate;
      break;
    }
  }

  const local = t - slot.start;
  const progress = slot.length > 0 ? clamp01( local / slot.length ) : 1;

  let from = null;
  let raw = 1;

  if ( slot.from !== null && slot.transitionIn > 0 && local < slot.transitionIn ) {
    const previous = slots[ slot.from ];
    // The outgoing scene's own time keeps running: across the loop boundary
    // (last → first) its slot ended at `total`, so the overrun is simply `t`.
    const fromLocal = previous.start <= slot.start
      ? t - previous.start
      : previous.length + t;

    from = {
      index: previous.index,
      local: fromLocal,
      progress: previous.length > 0 ? fromLocal / previous.length : 1
    };
    raw = clamp01( local / slot.transitionIn );
  }

  const easingKey = scenes[ slot.index ]?.transition?.easing;
  const ease = easing[ easingKey ] ?? easing.linear;

  return {
    index: slot.index,
    local,
    progress,
    length: slot.length,
    from,
    raw,
    mix: from ? clamp01( ease( raw ) ) : 1
  };
}

/**
 * The loop phase a sketch scene is drawn at, in [0, 1): `loops` turns of its
 * own animation over its slot, starting at `progression`. Null when the scene
 * follows the host's clock (`loops` 0), so the caller installs no override.
 *
 * `local` may exceed the slot length (the outgoing scene during a transition);
 * the phase keeps turning, which is what lets the leaving scene move on.
 */
export function scenePhase(
  scene, local, length
) {
  const loops = Number( scene?.loops );

  if ( !( loops > 0 ) || !( length > 0 ) ) {
    return null;
  }

  const offset = clamp01( Number( scene?.progression ) || 0 );

  return wrapUnit( ( local / length ) * loops + offset );
}

const SHAKE_FREQUENCIES = [
  13.7,
  17.3,
  23.1
];

/**
 * A scene's camera over its slot, as the compositor's `vec4( scale, rotation,
 * offsetX, offsetY )` in texture space: scale > 1 zooms in, the offset moves
 * the frame (in fractions of it), rotation is radians.
 *
 * Every move overscans — zooms past 1 — by the amount it travels, so a pan
 * never shows the edge of the buffer. `progress` is the scene's own 0..1;
 * `seconds` is the loop time, for the deterministic handheld jitter.
 */
export function cameraTransform(
  camera, progress, seconds = 0
) {
  const move = camera?.move ?? "none";
  const amount = clamp01( Number( camera?.amount ) || 0 );
  const shake = clamp01( Number( camera?.shake ) || 0 );
  const rollDegrees = Number( camera?.roll ) || 0;
  const ease = easing[ camera?.easing ] ?? easing.linear;
  const e = clamp01( ease( clamp01( progress ) ) );

  let scale = 1;
  let x = 0;
  let y = 0;

  // A pan travels `amount × 0.3` of the frame; the overscan that hides the
  // edge is the same fraction on each side.
  const travel = amount * 0.3;

  switch ( move ) {
    case "push-in":
      scale = 1 + amount * 0.6 * e;
      break;
    case "pull-out":
      scale = 1 + amount * 0.6 * ( 1 - e );
      break;
    case "pan-left":
      scale = 1 + travel;
      x = travel * ( 0.5 - e );
      break;
    case "pan-right":
      scale = 1 + travel;
      x = travel * ( e - 0.5 );
      break;
    case "pan-up":
      scale = 1 + travel;
      y = travel * ( 0.5 - e );
      break;
    case "pan-down":
      scale = 1 + travel;
      y = travel * ( e - 0.5 );
      break;
    case "drift":
      scale = 1 + travel;
      x = travel * 0.5 * Math.sin( e * Math.PI * 2 * 0.5 );
      y = travel * 0.5 * Math.sin( e * Math.PI * 2 * 0.5 + 1.2 ) * 0.6;
      break;
    case "orbit":
      scale = 1 + travel;
      x = travel * 0.5 * Math.cos( e * Math.PI * 2 );
      y = travel * 0.5 * Math.sin( e * Math.PI * 2 );
      break;
    case "handheld":
      scale = 1 + travel + 0.04;
      x = travel * 0.5 * ( Math.sin( seconds * 0.9 ) * 0.6 + Math.sin( seconds * 2.3 ) * 0.4 );
      y = travel * 0.5 * ( Math.cos( seconds * 1.1 ) * 0.6 + Math.sin( seconds * 1.9 + 0.7 ) * 0.4 );
      break;
    default:
      break;
  }

  if ( shake > 0 ) {
    const strength = shake * 0.02;

    scale += shake * 0.04;
    x += strength * SHAKE_FREQUENCIES.reduce(
      (
        acc, f, i
      ) => acc + Math.sin( seconds * f + i ) / ( i + 1 ),
      0
    );
    y += strength * SHAKE_FREQUENCIES.reduce(
      (
        acc, f, i
      ) => acc + Math.cos( seconds * f * 1.07 + i * 2 ) / ( i + 1 ),
      0
    );
  }

  return [
    scale,
    ( rollDegrees * Math.PI / 180 ) * e,
    x,
    y
  ];
}

/** The identity camera: the buffer as it is. */
export const IDENTITY_CAMERA = [
  1,
  0,
  0,
  0
];

/**
 * The scene cut (SceneCutSchema, drawn by slides/common/drawSceneCut.js):
 * which side plays at loop time `seconds`, with its eased progress, or null
 * in between. Each side is capped at half the loop so the two never overlap.
 *
 * On the exit side, `rewind` says the entrance is being played backwards:
 * the picture is then the "to" of the transition, as on the way in.
 *
 * @returns {{ side: "in"|"out", rewind?: boolean, spec: object, raw: number, mix: number }|null}
 */
export function resolveSceneCut(
  cut, seconds, loopSeconds
) {
  if ( !cut?.enabled || !( loopSeconds > 0 ) || !Number.isFinite( seconds ) ) {
    return null;
  }

  const half = loopSeconds / 2;
  const inDuration = Math.min(
    half,
    Math.max(
      0,
      Number( cut.in?.duration ) || 0
    )
  );
  // The exit's settings: its own, or the entrance's (sceneCutExit).
  const exit = sceneCutExit( cut );
  const outDuration = Math.min(
    half,
    Math.max(
      0,
      Number( exit.duration ) || 0
    )
  );

  if ( inDuration > 0 && seconds < inDuration ) {
    const raw = seconds / inDuration;
    const ease = easing[ cut.in?.easing ] ?? easing.linear;

    return {
      side: "in",
      spec: cut.in ?? {},
      raw,
      mix: clamp01( ease( raw ) )
    };
  }

  const outStart = loopSeconds - outDuration;

  if ( outDuration > 0 && seconds >= outStart ) {
    const raw = ( seconds - outStart ) / outDuration;
    const ease = easing[ exit.spec.easing ] ?? easing.linear;

    if ( exit.rewind ) {
      // The entrance played backwards: plate → picture with the progress
      // running 1 → 0, its easing reversed in time with it.
      return {
        side: "out",
        rewind: true,
        spec: exit.spec,
        raw,
        mix: clamp01( ease( 1 - raw ) )
      };
    }

    return {
      side: "out",
      rewind: false,
      spec: exit.spec,
      raw,
      mix: clamp01( ease( raw ) )
    };
  }

  return null;
}

/**
 * Where a cut's exit takes its settings (SceneCutSchema.outFollows): its own
 * `out` block, or the entrance played again ("same") or backwards ("rewind").
 * A block without the key is read as "own" — the shape before the link.
 * `duration` is the exit's length: `out.duration` when the exit is its own or
 * keeps its own length (`outOwnDuration`), the entrance's otherwise.
 *
 * @returns {{ spec: object, rewind: boolean, duration: number }}
 */
export function sceneCutExit( cut ) {
  const follows = cut?.outFollows ?? "own";
  const own = follows !== "rewind" && follows !== "same";
  const spec = ( own ? cut?.out : cut?.in ) ?? {};
  const duration = own || cut?.outOwnDuration
    ? cut?.out?.duration
    : cut?.in?.duration;

  return {
    spec,
    rewind: follows === "rewind",
    duration: Number( duration ) || 0
  };
}

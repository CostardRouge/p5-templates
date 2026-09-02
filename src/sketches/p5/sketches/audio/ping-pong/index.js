import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import audio from "@/p5/utils/audio.js";
import {
  initInteraction,
  getPointers,
  disposeInteraction
} from "@/p5/utils/interaction/index.js";
import {
  drawInteractionOverlay
} from "@/p5/utils/interaction/overlay.js";

/**
 * Audio demo sketch: a ball bounces around the canvas and every wall hit
 * triggers a synthesised bip (see utils/audio.js). The trajectory is a pure
 * function of time, so the same beat plays in preview, realtime recording
 * and (later) deterministic offline audio rendering.
 *
 * Interactive layer: each live pointer from the shared interaction module —
 * fingers (camera), mouse, touch and gyroscope tilt — drives an extra ball
 * that simply tracks the pointer. The canvas boundary is the only thing that
 * makes a sound: whenever any ball (auto or interactive) reaches a wall it
 * plays a bip (pitch mapped to where it hit) and emits a flash. Optionally,
 * ball-to-ball contact can play a bip too (see the "Balls" options).
 *
 * The "Balls" mode select decides which balls exist — only the automatic ball
 * (default), the automatic ball plus interactive ones, or interactive only.
 * In "auto" mode the pointers are ignored, so the sketch renders exactly as
 * before until the user opts in.
 */

const state = sketch.state( () => ( {
  bouncesX: null,
  bouncesY: null,
  flashes: [], // { x, y, at } — wall-hit + collision ripples, `at` in sketch seconds
  // Per-pointer "was the interactive ball touching a wall last frame", indexed
  // to match getPointers() order, so a wall bips once on contact (edge trigger)
  // rather than every frame the pointer is held against the edge.
  // Each entry: { x: bool (left/right walls), y: bool (top/bottom walls) }.
  interactiveWalls: [],
  // Keys of the ball pairs currently overlapping, so a ball-to-ball collision
  // bips once on contact instead of every frame the balls stay overlapped.
  collidingPairs: new Set()
} ) );

/**
 * Fold a travelled distance into [0, range] with reflections.
 * `bounces` counts completed traversals — it increments exactly when the
 * ball touches a wall, which is what the sound triggers key off.
 */
function pingPong(
  distance, range
) {
  if ( range <= 0 ) {
    return {
      pos: 0,
      bounces: 0
    };
  }

  const cycle = distance / range;
  const bounces = Math.floor( cycle );
  const phase = cycle - bounces;

  return {
    pos: bounces % 2 === 0 ? phase * range : ( 1 - phase ) * range,
    bounces
  };
}

function triggerBounce(
  audioOptions, freqPosition
) {
  if ( audioOptions.enabled === false ) {
    return;
  }

  audio.setVolume( audioOptions.volume ?? 0.8 );
  audio.trigger(
    audioOptions.sound ?? "bounce",
    {
      freq: ( audioOptions.freqMin ?? 220 )
        + ( ( audioOptions.freqMax ?? 880 ) - ( audioOptions.freqMin ?? 220 ) )
        * freqPosition,
      duration: audioOptions.duration ?? 0.15
    }
  );
}

sketch.setup( async() => {
  state.bouncesX = null;
  state.bouncesY = null;
  state.flashes = [];
  state.interactiveWalls = [];
  state.collidingPairs = new Set();

  await initInteraction( options.sketch?.interaction ?? {} );
} );

sketch.draw( ( time ) => {
  const p = getP5();
  const o = options.sketch ?? {};
  const ballOptions = o.ball ?? {};
  const flashOptions = o.flash ?? {};
  const audioOptions = o.audio ?? {};
  const modeOptions = o.mode ?? {};
  const interaction = o.interaction ?? {};

  const composition = modeOptions.composition ?? "auto";
  const showAuto = composition !== "interactive";
  const showInteractive = composition !== "auto";
  const ballCollisions = modeOptions.ballCollisions === true;

  const radius = ballOptions.radius ?? 40;
  const rangeX = p.width - radius * 2;
  const rangeY = p.height - radius * 2;

  // The balls drawn this frame. Each carries a stable `key` so ball-to-ball
  // collisions can be edge-triggered: "auto" plus one "p<index>" per pointer.
  const balls = [];

  // ── Automatic ball (deterministic, time-based) ───────────────────────────
  const xState = pingPong(
    ( ballOptions.speedX ?? 420 ) * time,
    rangeX
  );
  const yState = pingPong(
    ( ballOptions.speedY ?? 333 ) * time,
    rangeY
  );

  const autoX = radius + xState.pos;
  const autoY = radius + yState.pos;

  if ( showAuto ) {
    balls.push( {
      key: "auto",
      x: autoX,
      y: autoY,
      r: radius
    } );

    // A wall hit happened when the traversal count increased since last frame.
    // Counts also *drop* when the preview loop wraps back to t=0 — resync
    // silently in that case instead of firing a phantom bip.
    if ( state.bouncesX !== null && xState.bounces > state.bouncesX ) {
      triggerBounce(
        audioOptions,
        yState.pos / rangeY
      );
      state.flashes.push( {
        x: autoX,
        y: autoY,
        at: time
      } );
    }

    if ( state.bouncesY !== null && yState.bounces > state.bouncesY ) {
      triggerBounce(
        audioOptions,
        xState.pos / rangeX
      );
      state.flashes.push( {
        x: autoX,
        y: autoY,
        at: time
      } );
    }
  }

  // Keep the deterministic counters advancing even while the auto ball is
  // hidden, so switching back to it doesn't fire a phantom bip.
  state.bouncesX = xState.bounces;
  state.bouncesY = yState.bounces;

  // ── Interactive balls (one per live pointer) ─────────────────────────────
  // Each pointer (finger / mouse / touch / gyro tilt) becomes an extra ball
  // that tracks it, clamped to stay fully on the canvas. The clamp is what
  // makes the boundary a collision: when the pointer reaches an edge the ball
  // touches the wall and bips (pitch from where along the wall it landed).
  const pointers = showInteractive ? getPointers( interaction ) : [];
  const walls = state.interactiveWalls;

  pointers.forEach( (
    pointer, index
  ) => {
    const cx = p.constrain(
      pointer.x,
      radius,
      p.width - radius
    );
    const cy = p.constrain(
      pointer.y,
      radius,
      p.height - radius
    );

    balls.push( {
      key: `p${ index }`,
      x: cx,
      y: cy,
      r: radius
    } );

    const onVertWall = pointer.x <= radius || pointer.x >= p.width - radius;
    const onHorizWall = pointer.y <= radius || pointer.y >= p.height - radius;
    const prev = walls[ index ] ?? {
      x: false,
      y: false
    };

    if ( onVertWall && !prev.x ) {
      triggerBounce(
        audioOptions,
        cy / p.height
      );
      state.flashes.push( {
        x: cx,
        y: cy,
        at: time
      } );
    }

    if ( onHorizWall && !prev.y ) {
      triggerBounce(
        audioOptions,
        cx / p.width
      );
      state.flashes.push( {
        x: cx,
        y: cy,
        at: time
      } );
    }

    walls[ index ] = {
      x: onVertWall,
      y: onHorizWall
    };
  } );

  // Drop stale wall memory once pointers disappear so a reused index starts
  // fresh (and can bip immediately if it spawns against an edge).
  walls.length = pointers.length;

  // ── Ball-to-ball collisions (optional sound) ─────────────────────────────
  // Balls pass through each other — the only effect is an optional bip when two
  // first overlap, edge-triggered via the set of currently-colliding pairs.
  if ( ballCollisions ) {
    const colliding = new Set();

    for ( let i = 0; i < balls.length; i++ ) {
      for ( let j = i + 1; j < balls.length; j++ ) {
        const a = balls[ i ];
        const b = balls[ j ];

        if ( p.dist(
          a.x,
          a.y,
          b.x,
          b.y
        ) > a.r + b.r ) {
          continue;
        }

        const pairKey = `${ a.key }|${ b.key }`;

        colliding.add( pairKey );

        if ( !state.collidingPairs.has( pairKey ) ) {
          const mx = ( a.x + b.x ) / 2;
          const my = ( a.y + b.y ) / 2;

          triggerBounce(
            audioOptions,
            my / p.height
          );
          state.flashes.push( {
            x: mx,
            y: my,
            at: time
          } );
        }
      }
    }

    state.collidingPairs = colliding;
  } else if ( state.collidingPairs.size > 0 ) {
    state.collidingPairs.clear();
  }

  // ── Render ───────────────────────────────────────────────────────────────
  p.clear();
  p.background( ...( o.background?.color ?? [
    0,
    0,
    0
  ] ) );

  // Collision ripples: expanding, fading rings (walls + ball-to-ball).
  if ( flashOptions.show !== false ) {
    const flashDuration = flashOptions.duration ?? 0.35;

    state.flashes = state.flashes.filter( ( flash ) => {
      const age = time - flash.at;

      return age >= 0 && age <= flashDuration;
    } );

    for ( const flash of state.flashes ) {
      const progress = ( time - flash.at ) / flashDuration;

      p.push();
      p.noFill();
      p.stroke(
        ...( ballOptions.color ?? [
          255,
          255,
          255
        ] ).slice(
          0,
          3
        ),
        255 * ( 1 - progress )
      );
      p.strokeWeight( 2 );
      p.circle(
        flash.x,
        flash.y,
        radius * 2 + radius * ( flashOptions.size ?? 4 ) * progress
      );
      p.pop();
    }
  }

  // Every ball (auto + interactive) drawn the same.
  p.push();
  p.noStroke();
  p.fill( ...( ballOptions.color ?? [
    255,
    255,
    255
  ] ) );

  for ( const ball of balls ) {
    p.circle(
      ball.x,
      ball.y,
      ball.r * 2
    );
  }

  p.pop();

  // Debug overlay (crosshairs / pointer markers / finger chains / webcam
  // preview / legend) — all gated by interaction.visualization, off by default.
  drawInteractionOverlay( interaction );
} );

sketch.cleanup?.( () => {
  disposeInteraction();
} );

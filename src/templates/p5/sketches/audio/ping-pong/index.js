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
 * On top of that deterministic beat sits an optional interactive layer: each
 * live pointer from the shared interaction module — fingers (camera), mouse,
 * touch and gyroscope tilt — becomes a circular bumper. The ball keeps its
 * time-based path, but the frame it enters a bumper it plays a bip (pitch
 * mapped to height) and emits a flash, so you can "play" the ball by hand.
 * Every interaction source defaults OFF, so until one is enabled the sketch
 * renders exactly as before.
 */

const state = {
  bouncesX: null,
  bouncesY: null,
  flashes: [], // { x, y, at } — wall-hit + bumper ripples, `at` in sketch seconds
  // Per-pointer "ball was inside this bumper last frame", indexed to match the
  // getPointers() order, so a bumper bips once on entry instead of every frame.
  bumperInside: []
};

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
  state.bumperInside = [];

  await initInteraction( options.sketch?.interaction ?? {} );
} );

sketch.draw( ( time ) => {
  const p = getP5();
  const o = options.sketch ?? {};
  const ballOptions = o.ball ?? {};
  const flashOptions = o.flash ?? {};
  const audioOptions = o.audio ?? {};

  const radius = ballOptions.radius ?? 40;
  const rangeX = p.width - radius * 2;
  const rangeY = p.height - radius * 2;

  const xState = pingPong(
    ( ballOptions.speedX ?? 420 ) * time,
    rangeX
  );
  const yState = pingPong(
    ( ballOptions.speedY ?? 333 ) * time,
    rangeY
  );

  const x = radius + xState.pos;
  const y = radius + yState.pos;

  // A bounce happened when the traversal count increased since last frame.
  // Counts also *drop* when the preview loop wraps back to t=0 — resync
  // silently in that case instead of firing a phantom bip.
  if ( state.bouncesX !== null && xState.bounces > state.bouncesX ) {
    triggerBounce(
      audioOptions,
      yState.pos / rangeY
    );
    state.flashes.push( {
      x,
      y,
      at: time
    } );
  }

  if ( state.bouncesY !== null && yState.bounces > state.bouncesY ) {
    triggerBounce(
      audioOptions,
      xState.pos / rangeX
    );
    state.flashes.push( {
      x,
      y,
      at: time
    } );
  }

  state.bouncesX = xState.bounces;
  state.bouncesY = yState.bounces;

  // ── Interactive bumpers ──────────────────────────────────────────────────
  // Each live pointer (finger / mouse / touch / gyro tilt) is a circular
  // bumper. The ball keeps its deterministic path; the frame it crosses into a
  // bumper we play a bip (pitch from the bumper's height) and emit a flash.
  // Edge-triggered per pointer index so holding the ball inside a bumper
  // doesn't machine-gun the sound.
  const interaction = o.interaction ?? {};
  const bumperOptions = o.bumpers ?? {};
  const bumperRadius = bumperOptions.radius ?? 80;
  const pointers = getPointers( interaction );

  pointers.forEach( (
    pointer, index
  ) => {
    const inside = p.dist(
      x,
      y,
      pointer.x,
      pointer.y
    ) <= radius + bumperRadius;

    if ( inside && !state.bumperInside[ index ] ) {
      triggerBounce(
        audioOptions,
        p.constrain(
          pointer.y / p.height,
          0,
          1
        )
      );
      state.flashes.push( {
        x: pointer.x,
        y: pointer.y,
        at: time
      } );
    }

    state.bumperInside[ index ] = inside;
  } );

  // Drop stale flags once pointers disappear so a new pointer reusing that
  // index starts fresh and can bip immediately on entry.
  state.bumperInside.length = pointers.length;

  p.clear();
  p.background( ...( o.background?.color ?? [
    0,
    0,
    0
  ] ) );

  // Wall-hit ripples: expanding, fading rings.
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

  // Bumper rings: where each pointer is, brighter while the ball is inside it.
  if ( bumperOptions.show !== false && pointers.length > 0 ) {
    const ballColor = ballOptions.color ?? [
      255,
      255,
      255
    ];

    pointers.forEach( (
      pointer, index
    ) => {
      const hit = state.bumperInside[ index ];

      p.push();
      p.noFill();
      p.stroke(
        ...ballColor.slice(
          0,
          3
        ),
        hit ? 230 : 90
      );
      p.strokeWeight( hit ? 4 : 2 );
      p.circle(
        pointer.x,
        pointer.y,
        bumperRadius * 2
      );
      p.pop();
    } );
  }

  p.push();
  p.noStroke();
  p.fill( ...( ballOptions.color ?? [
    255,
    255,
    255
  ] ) );
  p.circle(
    x,
    y,
    radius * 2
  );
  p.pop();

  // Debug overlay (crosshairs / pointer markers / finger chains / webcam
  // preview / legend) — all gated by interaction.visualization, off by default.
  drawInteractionOverlay( interaction );
} );

sketch.cleanup?.( () => {
  disposeInteraction();
} );

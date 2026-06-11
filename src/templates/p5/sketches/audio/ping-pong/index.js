import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import audio from "@/p5/utils/audio.js";

/**
 * Audio demo sketch: a ball bounces around the canvas and every wall hit
 * triggers a synthesised bip (see utils/audio.js). The trajectory is a pure
 * function of time, so the same beat plays in preview, realtime recording
 * and (later) deterministic offline audio rendering.
 */

const state = {
  bouncesX: null,
  bouncesY: null,
  flashes: [] // { x, y, at } — wall-hit ripples, `at` in sketch seconds
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

sketch.setup( () => {
  state.bouncesX = null;
  state.bouncesY = null;
  state.flashes = [];
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
} );

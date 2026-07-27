import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";

import string from "@/p5/utils/string.js";
import {
  getInteractionMetrics
} from "@/p5/utils/interaction/index.js";

import {
  HandCaptureScene
} from "../_shared.js";
import renderLegacyTitle from "@/p5/utils/title/renderLegacyTitle.js";

// ── puppet-type ────────────────────────────────────────────────────────────
// The word is a marionette and your hand is the puppeteer. Each letter is a
// spring-mass particle resting on its slot in the laid-out word; the live
// gesture snapshot (pinch / spread / fist) decides what your hand does to it:
//
//   PINCH  → grab: letters near the hand are pulled toward it, so a pinched
//            drag stretches the word like taffy.
//   SPREAD → explode: an open, spread hand shoves nearby letters away — the
//            word bursts into drifting glyphs.
//   FIST   → reassemble: closing the hand multiplies the home spring, and the
//            word snaps crisply back into place.
//
// No Matter body is needed — a hand-rolled spring integrator keeps every
// letter chasing its home slot, which makes the motion loop-safe: at rest the
// word is always pixel-identical, so any segment that starts and ends at rest
// is a seamless loop. With `gestures.mouseGrab` (default on) the mouse acts as
// a permanent pinch whenever no hand is on camera, so the sketch previews
// without a webcam.

const scene = new HandCaptureScene( {
  layers: {
    hands: {}
  }
} );

const state = {
  letters: [],
  layoutKey: null
};

sketch.setup( async() => {
  await scene.init( options.sketch?.interaction ?? {} );
} );

sketch.draw( () => {
  const p = getP5();

  const interaction = options.sketch?.interaction ?? {};
  const text = options.sketch?.text ?? {};
  const gestures = options.sketch?.gestures ?? {};
  const spring = options.sketch?.spring ?? {};
  const motion = options.sketch?.motion ?? {};
  const handDrawing = options.sketch?.hands ?? {};
  const background = options.sketch?.backgroundColor ?? [
    12,
    12,
    14
  ];

  scene.beginFrame( background );
  scene.readInteraction( interaction );

  const font = string.fonts?.[ text.font ] ?? string.fonts.martian;

  syncLetters(
    text,
    font
  );

  const command = readGestureCommand(
    interaction,
    gestures
  );

  stepLetters(
    command,
    gestures,
    spring
  );

  renderLetters(
    text,
    font,
    motion
  );

  if ( handDrawing.show ?? true ) {
    scene.drawInteraction( {
      innerCircleSize: handDrawing.size ?? 28,
      shadowsCount: handDrawing.glow ?? 2,
      vectorsStep: handDrawing.resolution ?? 0.1
    } );
  }

  scene.compose();

  renderLegacyTitle( {
    title: options.sketch?.title ?? "",
    subtitle: options.sketch?.subtitle ?? "",
    color: background
  } );
} );

/**
 * Reduce this frame's gesture snapshot to one command the physics understands:
 * how hard the hand grabs (0..1), how hard it shoves (0..1) and whether it is
 * a fist. Without a tracked hand, the mouse (or any other pointer source)
 * falls back to a full-strength grab so the sketch stays playable camera-less.
 */
function readGestureCommand(
  interaction, gestures
) {
  const metrics = getInteractionMetrics( interaction );
  const hand = metrics.hand;
  const handPresent = hand.present > 0.5;

  if ( handPresent ) {
    const pinch = hand.pinch;
    const spread = hand.spread;

    return {
      grab: pinch >= ( gestures.grabThreshold ?? 0.45 ) ? pinch : 0,
      explode: spread >= ( gestures.explodeThreshold ?? 0.7 ) ? spread : 0,
      fist: hand.openness <= ( gestures.fistThreshold ?? 0.25 )
    };
  }

  const mouseGrab = gestures.mouseGrab ?? true;

  return {
    grab: mouseGrab && scene.pointers.length > 0 ? 1 : 0,
    explode: 0,
    fist: false
  };
}

/**
 * (Re)build the letter particles whenever the word, its typography or the
 * canvas changes. Home slots come from real per-glyph advances so the resting
 * word reads exactly as typed; existing positions are kept when only the
 * canvas is resized… not worth it — a layout change simply resets the puppet.
 */
function syncLetters(
  text, font
) {
  const p = getP5();
  const content = text.content ?? "PULL ME";
  const size = ( text.size ?? 0.16 ) * p.width;
  const fontReady = Boolean( font?.font );
  const key = `${ content }:${ size }:${ text.font }:${ fontReady }:${ p.width }x${ p.height }`;

  if ( key === state.layoutKey ) {
    return;
  }

  state.layoutKey = key;
  state.letters = [];

  const lines = content.split( "\n" );
  const lineHeight = size * ( text.lineHeight ?? 1.15 );
  const blockHeight = lines.length * lineHeight;

  p.push();

  if ( fontReady ) {
    p.textFont( font );
  }

  p.textSize( size );

  lines.forEach( (
    line, lineIndex
  ) => {
    const lineWidth = p.textWidth( line );
    const y = p.height / 2 - blockHeight / 2 + ( lineIndex + 0.5 ) * lineHeight;
    let cursor = p.width / 2 - lineWidth / 2;

    for ( const char of line ) {
      const advance = p.textWidth( char );

      if ( char.trim() !== "" ) {
        state.letters.push( {
          char,
          home: {
            x: cursor + advance / 2,
            y
          },
          x: cursor + advance / 2,
          y,
          vx: 0,
          vy: 0
        } );
      }

      cursor += advance;
    }
  } );

  p.pop();
}

/**
 * One integrator step: a home spring (boosted while the hand is a fist), a
 * velocity damping, then per-pointer grab pulls and explode shoves with a
 * linear falloff over their radius. Time-scaled by deltaTime so the feel
 * doesn't change with the recording framerate.
 */
function stepLetters(
  command, gestures, spring
) {
  const p = getP5();
  const dt = Math.min(
    p.deltaTime,
    50
  ) / ( 1000 / 60 );

  const stiffness = ( spring.stiffness ?? 0.012 ) *
    ( command.fist ? spring.fistBoost ?? 8 : 1 );
  const damping = Math.pow(
    1 - ( spring.damping ?? 0.08 ),
    dt
  );
  const grabRadius = gestures.grabRadius ?? 420;
  const explodeRadius = gestures.explodeRadius ?? 520;
  const grabStrength = gestures.grabStrength ?? 0.045;
  const explodeStrength = gestures.explodeStrength ?? 3.2;

  for ( const letter of state.letters ) {
    let ax = ( letter.home.x - letter.x ) * stiffness;
    let ay = ( letter.home.y - letter.y ) * stiffness;

    for ( const pointer of scene.pointers ) {
      const dx = pointer.x - letter.x;
      const dy = pointer.y - letter.y;
      const distance = Math.hypot(
        dx,
        dy
      ) || 1;

      if ( command.grab > 0 && distance < grabRadius ) {
        const falloff = 1 - distance / grabRadius;

        ax += dx * grabStrength * command.grab * falloff;
        ay += dy * grabStrength * command.grab * falloff;
      }

      if ( command.explode > 0 && distance < explodeRadius ) {
        const falloff = 1 - distance / explodeRadius;
        const shove = explodeStrength * command.explode * falloff;

        ax -= ( dx / distance ) * shove;
        ay -= ( dy / distance ) * shove;
      }
    }

    letter.vx = ( letter.vx + ax * dt ) * damping;
    letter.vy = ( letter.vy + ay * dt ) * damping;
    letter.x += letter.vx * dt;
    letter.y += letter.vy * dt;
  }
}

/**
 * Draw every letter at its live position, tilted and slightly stretched by its
 * own velocity so fast letters lean into their motion like thrown cards.
 */
function renderLetters(
  text, font, motion
) {
  const p = getP5();
  const size = ( text.size ?? 0.16 ) * p.width;
  const tilt = motion.tilt ?? 0.014;
  const stretch = motion.stretch ?? 0.012;
  const fill = text.fill ?? [
    255,
    255,
    255
  ];
  const stroke = text.stroke ?? [
    255,
    255,
    255
  ];

  p.push();

  if ( font?.font ) {
    p.textFont( font );
  }

  p.textSize( size );
  p.textAlign(
    p.CENTER,
    p.CENTER
  );
  p.fill( ...fill );

  if ( ( text.strokeWeight ?? 0 ) > 0 ) {
    p.stroke( ...stroke );
    p.strokeWeight( text.strokeWeight );
  } else {
    p.noStroke();
  }

  for ( const letter of state.letters ) {
    const speed = Math.hypot(
      letter.vx,
      letter.vy
    );
    const lean = Math.max(
      -0.7,
      Math.min(
        0.7,
        letter.vx * tilt
      )
    );
    const grow = 1 + Math.min(
      speed * stretch,
      0.6
    );

    p.push();
    p.translate(
      letter.x,
      letter.y
    );
    p.rotate( lean );
    p.scale( grow );
    p.text(
      letter.char,
      0,
      0
    );
    p.pop();
  }

  p.pop();
}

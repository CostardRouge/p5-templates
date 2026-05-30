import string from "../../string.js";
import sketch, {
  getP5
} from "../../sketch.js";
import animation from "../../animation.js";
import buildSpecsLines from "./specsData.js";

/**
 * Technical / BIOS-style overlay that reveals the current sketch settings.
 *
 * Two styles (selectable via specsOption.style):
 *   - "boot-log": lines stream in top-down with a per-character typewriter on
 *     the line currently being typed, plus a blinking cursor (boot sequence).
 *   - "ticker": a single line shows one parameter at a time and cycles through
 *     all of them.
 *
 * Timing is driven by animation.progression (0..1 over the loop) split into
 * three phases via revealEnd / holdEnd / fadeEnd: reveal -> hold -> fade-out.
 * Past fadeEnd nothing is drawn (plays once, then disappears).
 */
export default function drawSlideSpecs( specsOption ) {
  const p = getP5();
  const progress = animation.progression;

  const revealEnd = specsOption.revealEnd ?? 0.45;
  const holdEnd = specsOption.holdEnd ?? 0.7;
  const fadeEnd = specsOption.fadeEnd ?? 0.8;

  // Past the fade window the overlay is gone.
  if ( progress >= fadeEnd ) {
    return;
  }

  const lines = buildSpecsLines( specsOption );

  if ( !lines.length ) {
    return;
  }

  // Global alpha for the fade-out phase.
  let alpha = 255;

  if ( progress >= holdEnd ) {
    alpha = p.map(
      progress,
      holdEnd,
      fadeEnd,
      255,
      0,
      true
    );
  }

  // Reveal fraction (0..1) across the reveal phase.
  const revealAmount = revealEnd > 0 ? p.constrain(
    progress / revealEnd,
    0,
    1
  ) : 1;

  const size = specsOption.size ?? 22;
  const lineStep = size * ( specsOption.lineHeight ?? 1.4 );
  const font = string.fonts?.[ specsOption.font ] ?? string.fonts.spaceMonoRegular;
  const fill = p.color( ...specsOption.fill );

  fill.setAlpha( alpha );

  const textStyle = {
    size,
    font,
    fill,
    stroke: false,
    strokeWeight: 0,
    blendMode: specsOption.blend,
    textWidth: -1,
    textAlign: [
      p.LEFT,
      p.TOP
    ]
  };

  // Blinking cursor character (toggles a few times per loop).
  const cursorVisible =
    specsOption.showCursor && animation.sinOscillation( 6 ) > 0;
  const cursor = cursorVisible ? "_" : "";

  p.push();
  if ( sketch.sketchOptions.type === "webgl" ) {
    p.translate(
      -p.width / 2,
      -p.height / 2
    );
  }

  const originX = p.width * ( specsOption.position?.x ?? 0.05 );
  const originY = p.height * ( specsOption.position?.y ?? 0.06 );

  if ( specsOption.style === "ticker" ) {
    // Single line cycling through all parameters.
    const index = Math.min(
      Math.floor( revealAmount * lines.length ),
      lines.length - 1
    );
    const line = lines[ index ];

    string.write(
      `${ line.label }: ${ line.value }${ cursor }`,
      originX,
      originY,
      textStyle
    );

    p.pop();
    return;
  }

  // Default "boot-log" style: stream lines in top-down with typewriter.
  const exactLines = revealAmount * lines.length;
  const fullyVisible = Math.floor( exactLines );
  const typingFraction = exactLines - fullyVisible;

  for ( let i = 0; i < lines.length; i++ ) {
    if ( i > fullyVisible ) {
      break;
    }

    const line = lines[ i ];
    const full = `${ line.label }: ${ line.value }`;
    const y = originY + i * lineStep;

    if ( i < fullyVisible ) {
      string.write(
        full,
        originX,
        y,
        textStyle
      );
      continue;
    }

    // Line currently being typed: reveal character by character.
    const visibleCount = Math.ceil( full.length * typingFraction );
    const typed = full.slice(
      0,
      visibleCount
    );

    string.write(
      `${ typed }${ cursor }`,
      originX,
      y,
      textStyle
    );
  }

  p.pop();
}

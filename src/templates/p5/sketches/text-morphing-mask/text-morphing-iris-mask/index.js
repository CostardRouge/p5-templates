import options from "@/p5/utils/options.js";
import sketch from "@/p5/utils/sketch.js";

import easing from "@/p5/utils/easing.js";
import string from "@/p5/utils/string.js";
import animation from "@/p5/utils/animation.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";
import {
  getP5
} from "@/p5/utils/sketch.js";

/**
 * Word → word typographic transition driven by a circular "iris" mask.
 *
 * The full word stays on screen. A circle sweeps letter by letter: on each
 * slot it shrinks down onto the current letter (closing it away to a point),
 * swaps to the next word's letter at the centre, then grows back open to
 * reveal it. Letters are clipped to the disc, so a large disc shows the whole
 * glyph and a vanishing disc eats it from the outside in.
 */

const getBackgroundColor = () =>
  options.sketch?.backgroundColor ?? [
    0,
    0,
    0
  ];

function clamp01( value ) {
  if ( value < 0 ) {
    return 0;
  }

  if ( value > 1 ) {
    return 1;
  }

  return value;
}

/**
 * Resolve the ordered list of words to cycle through from the text option.
 */
function resolveWords() {
  const text = options.sketch?.text;

  if ( !text ) {
    return [];
  }

  if ( text.mode === "multiple" ) {
    return ( text.value ?? [] )
      .map( ( word ) => String( word ?? "" ) )
      .filter( ( word ) => word.length > 0 );
  }

  return String( text.value ?? "" )
    .split( /\s+/ )
    .filter( ( word ) => word.length > 0 );
}

/**
 * Iris radius for a slot's local progress.
 *   local 0   → max radius (letter fully open / at rest)
 *   local 0.5 → 0          (letter fully closed, glyph swap happens here)
 *   local 1   → max radius (next letter fully open)
 */
function radiusAt(
  local, maxRadius, easeFn
) {
  if ( local <= 0.5 ) {
    return ( 1 - easeFn( local / 0.5 ) ) * maxRadius;
  }

  return easeFn( ( local - 0.5 ) / 0.5 ) * maxRadius;
}

function applyTextStyle(
  target, size, font, style
) {
  target.textFont( font );
  target.textSize( size );
  target.textAlign(
    target.CENTER,
    target.CENTER
  );

  if ( ( style.strokeWeight ?? 0 ) > 0 ) {
    target.stroke( ...( style.stroke ?? [
      0
    ] ) );
    target.strokeWeight( style.strokeWeight );
  } else {
    target.noStroke();
  }

  if ( style.fill ) {
    target.fill( ...style.fill );
  } else {
    target.noFill();
  }
}

function drawGlyph(
  target, slot, centerY, size, font, style
) {
  target.push();

  if ( slot.transitioning ) {
    const radius = slot.radius;

    target.clip(
      () => {
        target.circle(
          slot.cx,
          centerY,
          radius * 2
        );
      },
      {
        invert: false
      }
    );
  }

  applyTextStyle(
    target,
    size,
    font,
    style
  );

  target.text(
    slot.glyph,
    slot.cx,
    centerY
  );

  target.pop();
}

function drawCircle(
  target, cx, cy, radius, circle
) {
  target.push();

  const fillAlpha = circle.fillAlpha ?? 0;

  if ( circle.fill && fillAlpha > 0 ) {
    target.fill(
      ...circle.fill,
      fillAlpha
    );
  } else {
    target.noFill();
  }

  if ( ( circle.strokeWeight ?? 0 ) > 0 ) {
    target.stroke( ...( circle.stroke ?? [
      255
    ] ) );
    target.strokeWeight( circle.strokeWeight );
  } else {
    target.noStroke();
  }

  target.circle(
    cx,
    cy,
    radius * 2
  );

  target.pop();
}

sketch.setup( () => {
  const p = getP5();

  p.background( ...getBackgroundColor() );
} );

sketch.draw( () => {
  const p = getP5();

  p.clear();
  p.background( ...getBackgroundColor() );

  const words = resolveWords();

  if ( words.length === 0 ) {
    renderTitle();
    return;
  }

  const style = options.sketch.textStyle;
  const transition = options.sketch.transition;
  const circle = options.sketch.circle;

  const font = string.fonts?.[ style.font ] ?? string.fonts.waverseVariable;
  const size = style.size ?? 320;
  const letterSpacing = style.letterSpacing ?? 0.62;
  const advance = size * letterSpacing;

  const transitionEasing =
    easing?.[ transition.easing ] ?? easing.easeInOutCubic;
  const circleEasing = easing?.[ circle.easing ] ?? transitionEasing;

  // Loop the whole list: progression maps onto N word → word transitions,
  // wrapping from the last word back to the first.
  const count = words.length;
  const phase = animation.progression * count;
  const pairIndex = Math.floor( phase ) % count;
  const tPair = phase - Math.floor( phase );

  const wordA = words[ pairIndex ];
  const wordB = words[ ( pairIndex + 1 ) % count ];

  const slots = Math.max(
    wordA.length,
    wordB.length
  );

  if ( slots === 0 ) {
    renderTitle();
    return;
  }

  // Staggered sweep across the slots. `overlap` 0 → strictly sequential,
  // 1 → every letter transitions at once. `pauseRatio` holds the finished
  // word at the end of each transition.
  const pauseRatio = clamp01( transition.pauseRatio ?? 0 );
  const overlap = clamp01( transition.overlap ?? 0 );
  const span = Math.max(
    0.0001,
    1 - pauseRatio
  );
  const sweep = clamp01( tPair / span );

  const denom = slots - ( slots - 1 ) * overlap;
  const windowLen = denom > 0 ? 1 / denom : 1;
  const maxStart = 1 - windowLen;

  const minDimension = Math.min(
    p.width,
    p.height
  );
  const maxRadius = ( circle.maxRadius ?? 0.55 ) * minDimension;

  const centerY = p.height / 2;
  const blockWidth = ( slots - 1 ) * advance;
  const startX = p.width / 2 - blockWidth / 2;
  const drawBehind = circle.behindLetters ?? true;

  const slotsState = [];

  for ( let i = 0; i < slots; i++ ) {
    const startI = slots > 1 ? ( i / ( slots - 1 ) ) * maxStart : 0;
    const local = clamp01( ( sweep - startI ) / windowLen );

    const charA = wordA[ i ] ?? "";
    const charB = wordB[ i ] ?? "";
    const unchanged = charA === charB;
    const skip = unchanged && ( transition.onlyChanged ?? false );

    const transitioning = !skip && local > 0 && local < 1;

    slotsState.push( {
      cx: startX + i * advance,
      glyph: local < 0.5 ? charA : charB,
      transitioning,
      radius: transitioning
        ? radiusAt(
          local,
          maxRadius,
          circleEasing
        )
        : maxRadius
    } );
  }

  // Pass 1 — circles kept behind the letters when requested.
  if ( circle.show && drawBehind ) {
    for ( const slot of slotsState ) {
      if ( slot.transitioning ) {
        drawCircle(
          p,
          slot.cx,
          centerY,
          slot.radius,
          circle
        );
      }
    }
  }

  // Pass 2 — glyphs, clipped to the iris disc while transitioning.
  for ( const slot of slotsState ) {
    if ( !slot.glyph ) {
      continue;
    }

    drawGlyph(
      p,
      slot,
      centerY,
      size,
      font,
      style
    );
  }

  // Pass 3 — circles on top of the letters when requested.
  if ( circle.show && !drawBehind ) {
    for ( const slot of slotsState ) {
      if ( slot.transitioning ) {
        drawCircle(
          p,
          slot.cx,
          centerY,
          slot.radius,
          circle
        );
      }
    }
  }

  renderTitle();
} );

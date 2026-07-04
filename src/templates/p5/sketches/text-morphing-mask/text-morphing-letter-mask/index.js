import options from "@/p5/utils/options.js";
import sketch from "@/p5/utils/sketch.js";

import easing from "@/p5/utils/easing.js";
import string from "@/p5/utils/string.js";
import animation from "@/p5/utils/animation.js";
import {
  getP5
} from "@/p5/utils/sketch.js";

/**
 * Word → word typographic transition where the mask is the *next letter's
 * silhouette* (instead of a circle).
 *
 * The full word stays on screen. For each letter slot, the next word's glyph
 * acts as a clipping shape that scales large → 0 → large:
 *   - large → 0 : the current letter is clipped to the shrinking next-letter
 *                 shape, so it is eaten away in that silhouette;
 *   - at 0      : the glyph swaps to the next letter;
 *   - 0 → large : the next letter grows back out of its own shape.
 *
 * The masking letter can also be drawn (outline / fill) so you literally see
 * the next letter's shape growing and reducing as it masks the current one.
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
 * Mask scale for a slot's local progress.
 *   local 0   → max scale (letter fully open / at rest)
 *   local 0.5 → 0         (fully masked, glyph swap happens here)
 *   local 1   → max scale (next letter fully open)
 */
function scaleAt(
  local, maxScale, easeFn
) {
  if ( local <= 0.5 ) {
    return ( 1 - easeFn( local / 0.5 ) ) * maxScale;
  }

  return easeFn( ( local - 0.5 ) / 0.5 ) * maxScale;
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
    const maskChar = slot.maskChar || slot.glyph;
    const maskSize = size * slot.scale;

    if ( maskSize < 1 || !maskChar ) {
      target.pop();
      return;
    }

    target.textFont( font );
    target.textSize( maskSize );
    target.textAlign(
      target.CENTER,
      target.CENTER
    );

    target.clip(
      () => {
        target.text(
          maskChar,
          slot.cx,
          centerY
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

function drawMaskShape(
  target, slot, centerY, size, font, mask
) {
  const maskChar = slot.maskChar || slot.glyph;
  const maskSize = size * slot.scale;

  if ( maskSize < 1 || !maskChar ) {
    return;
  }

  target.push();

  target.textFont( font );
  target.textSize( maskSize );
  target.textAlign(
    target.CENTER,
    target.CENTER
  );

  const fillAlpha = mask.fillAlpha ?? 0;

  if ( mask.fill && fillAlpha > 0 ) {
    target.fill(
      ...mask.fill,
      fillAlpha
    );
  } else {
    target.noFill();
  }

  if ( ( mask.strokeWeight ?? 0 ) > 0 ) {
    target.stroke( ...( mask.stroke ?? [
      255
    ] ) );
    target.strokeWeight( mask.strokeWeight );
  } else {
    target.noStroke();
  }

  target.text(
    maskChar,
    slot.cx,
    centerY
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
    return;
  }

  const style = options.sketch.textStyle;
  const transition = options.sketch.transition;
  const mask = options.sketch.mask;

  const font = string.fonts?.[ style.font ] ?? string.fonts.waverseVariable;
  const size = style.size ?? 320;
  const letterSpacing = style.letterSpacing ?? 0.62;
  const advance = size * letterSpacing;

  const transitionEasing =
    easing?.[ transition.easing ] ?? easing.easeInOutCubic;
  const maskEasing = easing?.[ mask.easing ] ?? transitionEasing;

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

  const maxScale = mask.maxScale ?? 6;

  const centerY = p.height / 2;
  const blockWidth = ( slots - 1 ) * advance;
  const startX = p.width / 2 - blockWidth / 2;
  const drawBehind = mask.behindLetters ?? true;

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
      maskChar: charB,
      transitioning,
      scale: transitioning
        ? scaleAt(
          local,
          maxScale,
          maskEasing
        )
        : maxScale
    } );
  }

  // Pass 1 — mask letters kept behind the word when requested.
  if ( mask.show && drawBehind ) {
    for ( const slot of slotsState ) {
      if ( slot.transitioning ) {
        drawMaskShape(
          p,
          slot,
          centerY,
          size,
          font,
          mask
        );
      }
    }
  }

  // Pass 2 — glyphs, clipped to the next letter's silhouette while transitioning.
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

  // Pass 3 — mask letters on top of the word when requested.
  if ( mask.show && !drawBehind ) {
    for ( const slot of slotsState ) {
      if ( slot.transitioning ) {
        drawMaskShape(
          p,
          slot,
          centerY,
          size,
          font,
          mask
        );
      }
    }
  }
} );

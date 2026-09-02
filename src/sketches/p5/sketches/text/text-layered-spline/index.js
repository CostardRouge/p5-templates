import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import string from "@/p5/utils/string.js";
import {
  renderSplines
} from "../../splines/_shared.js";

// ── What this sketch is ──────────────────────────────────────────────────────
// A word, centred on the canvas, is decomposed into its individual letters so
// each glyph becomes its own layer. A single glowing spline — the exact
// "control-point-free" curve shared by the `splines` v0 / v1 sketches — coils
// horizontally across the word like a helix seen from the side, making several
// small loops as it travels from left to right.
//
// The trick that makes the spline weave *through* the word is purely about
// draw order. Because every letter occupies its own horizontal slice, we split
// the glyphs into two layers:
//
//   1. background
//   2. the "back" letters          → the coil is drawn ON TOP of these
//   3. the coil (renderSplines)
//   4. the "front" letters         → these are drawn ON TOP of the coil
//
// Where the coil overlaps a back letter it passes in front; where it overlaps a
// front letter the letter hides it. With the layers alternating letter by letter
// (en quinconce) the coil appears to dive behind one glyph and surface in front
// of the next as it spirals along the word.

const TAU = Math.PI * 2;

// Per-letter geometry, rebuilt only when the text / font / size / position or
// the canvas dimensions actually change — measuring glyph advances every frame
// is wasteful and the layout is otherwise static.
const state = sketch.state( () => ( {
  key: "",
  letters: [],
  centerY: 0,
  startX: 0,
  endX: 0
} ) );

/**
 * Decompose `text` into a list of placed glyphs. Each entry carries the glyph's
 * centre (x, y) and advance width so it can be both drawn (textAlign CENTER) and
 * used to bound the coil. Spaces advance the cursor but emit no drawable glyph,
 * and only visible glyphs receive a weave parity so the front/back alternation
 * isn't broken by gaps.
 */
function layoutLetters( {
  text,
  font,
  size,
  letterSpacing,
  position
} ) {
  const p = getP5();

  p.push();
  p.textFont( font );
  p.textSize( size );

  const chars = Array.from( text );
  const advances = chars.map( ( char ) =>
    char === " " ? size * 0.4 : p.textWidth( char ) );

  p.pop();

  const totalWidth =
    advances.reduce(
      (
        sum, w
      ) => sum + w,
      0
    ) + letterSpacing * Math.max(
      0,
      chars.length - 1
    );

  const centerX = p.width * position.x;
  const centerY = p.height * position.y;

  let cursor = centerX - totalWidth / 2;
  let visibleIndex = 0;
  const letters = [];

  chars.forEach( (
    char, index
  ) => {
    const advance = advances[ index ];

    if ( char !== " " ) {
      letters.push( {
        char,
        x: cursor + advance / 2,
        y: centerY,
        width: advance,
        visibleIndex: visibleIndex++
      } );
    }

    cursor += advance + letterSpacing;
  } );

  return {
    letters,
    centerX,
    centerY,
    startX: centerX - totalWidth / 2,
    endX: centerX + totalWidth / 2
  };
}

function ensureLayout(
  textOptions, position
) {
  const p = getP5();
  const fontKey = textOptions.font ?? "martian";
  const font = string.fonts[ fontKey ] ?? string.fonts.martian;

  if ( !font?.font ) {
    return null;
  }

  const content = ( textOptions.content ?? "" ).toString();
  const size = textOptions.size ?? 220;
  const letterSpacing = textOptions.letterSpacing ?? 8;

  const key = [
    content,
    fontKey,
    size,
    letterSpacing,
    position.x,
    position.y,
    p.width,
    p.height
  ].join( "|" );

  if ( key !== state.key ) {
    const layout = layoutLetters( {
      text: content,
      font,
      size,
      letterSpacing,
      position
    } );

    state.key = key;
    state.letters = layout.letters;
    state.centerY = layout.centerY;
    state.startX = layout.startX;
    state.endX = layout.endX;
  }

  return font;
}

/**
 * Build the travelling coil. As `t` sweeps 0→1 the curve advances horizontally
 * across (and slightly beyond) the word while `angle` winds it round `turns`
 * times: sin drives the vertical oscillation, cos pushes the horizontal "loop
 * width" so the coil folds back on itself into proper little loops instead of a
 * flat wave. `phase` is animated so the whole helix drifts over time.
 */
function buildCoil( {
  size,
  spiral,
  centerY,
  startX,
  endX,
  phase
} ) {
  const p = getP5();
  const extend = ( spiral.extend ?? 0.6 ) * size;
  const left = startX - extend;
  const right = endX + extend;
  const span = right - left;

  const radiusY = size * ( spiral.heightRatio ?? 0.62 );
  const loopWidth = size * ( spiral.loopWidthRatio ?? 0.28 );
  const turns = spiral.turns ?? 6;
  const direction = spiral.direction ?? 1;
  const count = Math.max(
    8,
    Math.round( spiral.pointCount ?? 220 )
  );

  const points = [];

  for ( let i = 0; i < count; i++ ) {
    const t = i / ( count - 1 );
    const angle = phase + t * turns * TAU * direction;

    points.push( p.createVector(
      left + t * span + Math.cos( angle ) * loopWidth,
      centerY + Math.sin( angle ) * radiusY
    ) );
  }

  return points;
}

/**
 * Draw a subset of the decomposed glyphs. Kept in its own helper so the back
 * layer and the front layer share identical styling and only differ by which
 * letters they receive.
 */
function drawLetters(
  letters, textOptions
) {
  if ( letters.length === 0 ) {
    return;
  }

  const p = getP5();
  const fontKey = textOptions.font ?? "martian";
  const font = string.fonts[ fontKey ] ?? string.fonts.martian;
  const size = textOptions.size ?? 220;
  const fill = textOptions.fill ?? [
    235,
    235,
    240,
    255
  ];
  const strokeColor = textOptions.stroke ?? [
    0,
    0,
    0,
    255
  ];
  const strokeWeight = textOptions.strokeWeight ?? 0;

  p.push();
  p.textFont( font );
  p.textSize( size );
  p.textAlign(
    p.CENTER,
    p.CENTER
  );
  p.fill( ...fill );

  if ( strokeWeight > 0 ) {
    p.stroke( ...strokeColor );
    p.strokeWeight( strokeWeight );
  } else {
    p.noStroke();
  }

  letters.forEach( ( letter ) => p.text(
    letter.char,
    letter.x,
    letter.y
  ) );

  p.pop();
}

/**
 * Split the glyphs into the layer drawn behind the coil and the layer drawn in
 * front of it. `alternate` is the weave: every other (visible) glyph swaps side,
 * `offset` flips which side leads. `front` / `back` push the whole word to one
 * side of the coil for the non-woven looks.
 */
function partitionLetters(
  letters, layering
) {
  const mode = layering.mode ?? "alternate";
  const offset = layering.offset ?? 0;

  if ( mode === "front" ) {
    return {
      back: [],
      front: letters
    };
  }

  if ( mode === "back" ) {
    return {
      back: letters,
      front: []
    };
  }

  const back = [];
  const front = [];

  letters.forEach( ( letter ) => {
    if ( ( letter.visibleIndex + offset ) % 2 === 0 ) {
      back.push( letter );
    } else {
      front.push( letter );
    }
  } );

  return {
    back,
    front
  };
}

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};
  const textOptions = o.text ?? {};
  const position = o.position ?? {
    x: 0.5,
    y: 0.5
  };

  p.clear();
  p.background( ...( o.backgroundColor ?? [
    8,
    8,
    12,
    255
  ] ) );
  p.strokeCap( p.ROUND );
  p.strokeJoin( p.ROUND );

  const font = ensureLayout(
    textOptions,
    position
  );

  if ( !font || state.letters.length === 0 ) {
    return;
  }

  const {
    back,
    front
  } = partitionLetters(
    state.letters,
    o.layering ?? {}
  );

  // 1. Letters that the coil passes in front of.
  drawLetters(
    back,
    textOptions
  );

  // 2. The coil itself, rendered with the shared splines look (v0 / v1).
  const spiral = o.spiral ?? {};
  const coil = buildCoil( {
    size: textOptions.size ?? 220,
    spiral,
    centerY: state.centerY,
    startX: state.startX,
    endX: state.endX,
    phase: animation.angle * ( spiral.speed ?? 1 )
  } );

  renderSplines(
    [
      coil
    ],
    {
      curve: {
        method: "chaikin",
        closed: false,
        iterations: o.curve?.iterations ?? 4
      },
      stroke: o.stroke ?? {},
      // The point markers / raw polygon are a demonstration overlay in the
      // splines sketches; here the coil is the subject, so keep them off.
      overlay: {
        polygon: {
          show: false
        },
        points: {
          show: false
        }
      }
    }
  );

  // 3. Letters that hide the coil, completing the weave.
  drawLetters(
    front,
    textOptions
  );
} );

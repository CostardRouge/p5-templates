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
// A word, centred on the canvas, is decomposed into its individual glyphs. A
// single glowing spline winds across the word like a coil / bobbin: it is built
// as a 3D helix (it advances horizontally, oscillates vertically, and carries a
// DEPTH given by the cosine of its winding angle) and then projected to 2D.
//
// The realism comes from the depth. Wherever the helix is on the *far* side of
// the text plane (depth < 0) the coil must read as passing BEHIND the letters;
// wherever it is on the *near* side (depth >= 0) it passes IN FRONT. We get that
// — properly clipped to the glyph outlines, with several strands crossing one
// letter — purely through draw order:
//
//   1. background
//   2. the BEHIND arcs of the coil
//   3. the letters, drawn opaque        → they hide the behind arcs they cover
//   4. the IN-FRONT arcs of the coil    → these are painted over the letters
//
// Because the letters are opaque, step 3 clips every behind arc to the glyph
// silhouette for free, and step 4 lays the near strands back on top. The coil
// dives in and out of each letter in quinconce, exactly like a thread wound
// around the word. The coil reuses the shared `splines` renderer (v0 / v1), so
// it keeps the same neon glow and Chaikin smoothing.

const TAU = Math.PI * 2;

// Per-letter geometry, rebuilt only when the text / font / size / position or
// the canvas dimensions actually change — measuring glyph advances every frame
// is wasteful and the layout is otherwise static.
const state = {
  key: "",
  letters: [],
  centerY: 0,
  startX: 0,
  endX: 0
};

/**
 * Decompose `text` into a list of placed glyphs. Each entry carries the glyph's
 * centre (x, y) and advance width so it can be both drawn (textAlign CENTER) and
 * used to bound the coil. Spaces advance the cursor but emit no drawable glyph.
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
        width: advance
      } );
    }

    cursor += advance + letterSpacing;
  } );

  return {
    letters,
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
 * Sample the travelling helix. As `t` sweeps 0→1 the curve advances horizontally
 * across (and slightly beyond) the word while `angle` winds it round `turns`
 * times: sin drives the vertical oscillation, cos folds it horizontally into
 * rounded loops. A separate `depth = cos(angle + depthPhase)` tags each point as
 * near (>= 0, in front of the text) or far (< 0, behind it). `phase` is animated
 * so the whole coil drifts over time.
 *
 * Returns the flat point list plus the matching depth list, ready to be split
 * into front / behind arcs.
 */
function sampleCoil( {
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
  const loopWidth = size * ( spiral.loopWidthRatio ?? 0.3 );
  const turns = spiral.turns ?? 7;
  const direction = spiral.direction ?? 1;
  const depthPhase = spiral.depthPhase ?? 0;
  const count = Math.max(
    8,
    Math.round( spiral.pointCount ?? 240 )
  );

  const points = [];
  const depths = [];

  for ( let i = 0; i < count; i++ ) {
    const t = i / ( count - 1 );
    const angle = phase + t * turns * TAU * direction;

    points.push( p.createVector(
      left + t * span + Math.cos( angle ) * loopWidth,
      centerY + Math.sin( angle ) * radiusY
    ) );
    depths.push( Math.cos( angle + depthPhase ) );
  }

  return {
    points,
    depths
  };
}

/**
 * Split the sampled helix into contiguous runs of the same side (front vs
 * behind the text plane). Each time the depth sign flips we start a new run,
 * seeding it with the previous point so neighbouring arcs overlap by one vertex
 * and join seamlessly once smoothed. Runs shorter than two points are useless to
 * the spline renderer and dropped.
 */
function splitCoilByDepth(
  points, depths
) {
  const front = [];
  const back = [];
  let current = null;
  let currentIsFront = null;

  for ( let i = 0; i < points.length; i++ ) {
    const isFront = depths[ i ] >= 0;

    if ( current === null || isFront !== currentIsFront ) {
      const seed = current && current.length
        ? [
          current[ current.length - 1 ]
        ]
        : [];

      current = seed;
      currentIsFront = isFront;
      ( isFront ? front : back ).push( current );
    }

    current.push( points[ i ] );
  }

  const usable = ( runs ) => runs.filter( ( run ) => run.length >= 2 );

  return {
    front: usable( front ),
    back: usable( back )
  };
}

/**
 * Draw the decomposed glyphs in a single opaque pass. Opaqueness is what clips
 * the behind arcs to the glyph silhouette, so the fill alpha is forced to 255.
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
  const [
    fr,
    fg,
    fb
  ] = textOptions.fill ?? [
    235,
    235,
    240
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
  p.fill(
    fr,
    fg,
    fb,
    255
  );

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

  const spiral = o.spiral ?? {};
  const {
    points,
    depths
  } = sampleCoil( {
    size: textOptions.size ?? 220,
    spiral,
    centerY: state.centerY,
    startX: state.startX,
    endX: state.endX,
    phase: animation.angle * ( spiral.speed ?? 1 )
  } );

  const renderConfig = {
    curve: {
      method: "chaikin",
      closed: false,
      iterations: o.curve?.iterations ?? 4
    },
    stroke: o.stroke ?? {},
    // The point markers / raw polygon are a demonstration overlay in the splines
    // sketches; here the coil is the subject, so keep them off.
    overlay: {
      polygon: {
        show: false
      },
      points: {
        show: false
      }
    }
  };

  // When the weave is off the coil is a flat ribbon entirely in front of the
  // word — useful to preview the raw curve. Otherwise the depth split is what
  // makes it dive behind and surface in front of the letters in quinconce.
  if ( spiral.weave === false ) {
    drawLetters(
      state.letters,
      textOptions
    );
    renderSplines(
      [
        points
      ],
      renderConfig
    );

    return;
  }

  const {
    front,
    back
  } = splitCoilByDepth(
    points,
    depths
  );

  // 1. arcs that pass behind the word.
  renderSplines(
    back,
    renderConfig
  );

  // 2. the opaque word clips those behind arcs to the glyph outlines.
  drawLetters(
    state.letters,
    textOptions
  );

  // 3. arcs that pass in front, painted on top to complete the weave.
  renderSplines(
    front,
    renderConfig
  );
} );

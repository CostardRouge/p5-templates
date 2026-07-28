import {
  getP5
} from "@/p5/utils/sketch.js";
import string from "@/p5/utils/string.js";
import easing from "@/p5/utils/easing.js";
import mappers from "@/p5/utils/mappers.js";
import animation from "@/p5/utils/animation.js";
import {
  renderSplines
} from "../splines/_shared.js";
import {
  resampleOrdered,
  staggeredProgress,
  ensureDetailMap,
  applyTravelDetail
} from "./_shared.js";

/**
 * Shared engine for the "reading" variants of the `spline-text` category.
 *
 * Here the whole text is laid out as a wrapped paragraph and drawn behind the
 * curve (the "texte arrière"). A single cluster of spline control points does
 * NOT start scattered at random — it starts already shaped as the first word and
 * then travels word by word: it rests on a word, morphs onto the next, and so on
 * through the paragraph, looping back to the first word at the end.
 *
 * Two flows:
 *   - progressive → the cluster morphs from word to word; the points can be
 *     staggered so the curve "unrolls" from its start or its end (a direction
 *     parameter for variation).
 *   - instant     → the cluster snaps onto each word, jumping word to word.
 *
 * Rendering reuses the `splines` neon look (`renderSplines`) and the layout +
 * point-staggering helpers are shared with the rest of the category.
 */

function clamp(
  value, min, max
) {
  return Math.min(
    max,
    Math.max(
      min,
      value
    )
  );
}

function resolveFont( name ) {
  return string.fonts[ name ] ?? string.fonts.sans;
}

/**
 * Lay `text` out as a centred, word-wrapped paragraph. Each entry carries the
 * word's centre (x, y) and advance width. Wrapping is measured with the same
 * font/size the spline samples and the background draws, so the curve sits on the
 * displayed words.
 */
function layoutWords( {
  text,
  font,
  size,
  lineHeight,
  maxWidth,
  area
} ) {
  const p = getP5();

  p.push();
  p.textFont( font );
  p.textSize( size );

  const spaceWidth = p.textWidth( " " );
  const tokens = text.split( /\s+/ ).filter( Boolean );
  const measured = tokens.map( ( token ) => ( {
    text: token,
    width: p.textWidth( token )
  } ) );

  p.pop();

  // Greedy wrap into lines no wider than maxWidth (a single over-long word still
  // gets its own line rather than being dropped).
  const lines = [];
  let line = [];
  let lineWidth = 0;

  for ( const word of measured ) {
    const extra = ( line.length ? spaceWidth : 0 ) + word.width;

    if ( line.length && lineWidth + extra > maxWidth ) {
      lines.push( {
        words: line,
        width: lineWidth
      } );
      line = [];
      lineWidth = 0;
    }

    lineWidth += ( line.length ? spaceWidth : 0 ) + word.width;
    line.push( word );
  }

  if ( line.length ) {
    lines.push( {
      words: line,
      width: lineWidth
    } );
  }

  // Centre the block vertically around the area centre, each line centred
  // horizontally.
  const totalHeight = lines.length * lineHeight;
  const top = area.cy - totalHeight / 2 + lineHeight / 2;
  const words = [];

  lines.forEach( (
    ln, lineIndex
  ) => {
    const y = top + lineIndex * lineHeight;
    let cursor = area.cx - ln.width / 2;

    ln.words.forEach( ( word ) => {
      words.push( {
        text: word.text,
        x: cursor + word.width / 2,
        y,
        width: word.width
      } );

      cursor += word.width + spaceWidth;
    } );
  } );

  return words;
}

// Layout + per-word target clouds, rebuilt only when the relevant options or the
// canvas size change.
const state = {
  key: "",
  words: [],
  targets: []
};

function ensureLayout( {
  textCfg,
  position,
  count,
  sampleFactor,
  simplifyThreshold,
  font
} ) {
  const p = getP5();
  const content = ( textCfg.value ?? "" ).toString();
  const size = textCfg.size ?? 120;
  const lineHeight = size * ( textCfg.lineHeight ?? 1.25 );
  const maxWidth = ( textCfg.maxWidth ?? 0.8 ) * p.width;
  const fontFamily = font?.name || font?.face?.family || "unknown";
  const key = [
    content,
    fontFamily,
    size,
    lineHeight,
    maxWidth,
    count,
    sampleFactor,
    simplifyThreshold,
    position.x,
    position.y,
    p.width,
    p.height
  ].join( "|" );

  if ( key === state.key ) {
    return;
  }

  if ( !font?.data ) {
    // Font not loaded yet — try again next frame instead of caching an empty
    // layout.
    return;
  }

  const area = {
    cx: p.width * position.x,
    cy: p.height * position.y
  };
  const words = layoutWords( {
    text: content,
    font,
    size,
    lineHeight,
    maxWidth,
    area
  } );

  const targets = words.map( ( word ) => {
    const raw = string.getTextPoints( {
      text: word.text,
      size,
      font,
      position: p.createVector(
        word.x,
        word.y
      ),
      sampleFactor,
      simplifyThreshold
    } );

    // A word with no sampled outline (e.g. punctuation only) collapses to a
    // cluster at its centre so the morph still has `count` points to lerp.
    if ( !raw.length ) {
      return Array.from(
        {
          length: count
        },
        () => p.createVector(
          word.x,
          word.y
        )
      );
    }

    return resampleOrdered(
      raw,
      count
    );
  } );

  state.key = key;
  state.words = words;
  state.targets = targets;
}

/**
 * The faint full paragraph behind the curve, with the word the cluster currently
 * sits on optionally brightened (`activeAlpha[i]` per word). Aligned to the same
 * bounding-box centre `getTextPoints` uses so it matches the traced spline.
 */
function drawBackgroundText( {
  words,
  textCfg,
  font,
  size,
  activeAlpha
} ) {
  if ( !font?.data || ( textCfg.visible ?? true ) === false ) {
    return;
  }

  const p = getP5();
  const base = textCfg.color ?? [
    255,
    255,
    255,
    40
  ];
  const active = textCfg.activeColor ?? [
    255,
    255,
    255,
    230
  ];

  p.push();
  p.noStroke();
  p.textFont( font );
  p.textSize( size );
  p.textAlign(
    p.LEFT,
    p.BASELINE
  );

  words.forEach( (
    word, index
  ) => {
    // p5 v2: size comes from the renderer state set above; a 4th
    // positional number would be treated as a wrap width.
    const bounds = font.textBounds(
      word.text,
      0,
      0,
      {
        graphics: p
      }
    );
    const cx = bounds.x + bounds.w / 2;
    const cy = bounds.y + bounds.h / 2;
    const x = word.x - cx;
    const y = word.y - cy;

    p.fill(
      base[ 0 ],
      base[ 1 ],
      base[ 2 ],
      base[ 3 ] ?? 40
    );
    p.text(
      word.text,
      x,
      y
    );

    const highlight = activeAlpha[ index ] ?? 0;

    if ( highlight > 0 ) {
      p.fill(
        active[ 0 ],
        active[ 1 ],
        active[ 2 ],
        ( active[ 3 ] ?? 230 ) * highlight
      );
      p.text(
        word.text,
        x,
        y
      );
    }
  } );

  p.pop();
}

/**
 * Draw one frame of a "reading" spline-text sketch from a resolved `sketch`
 * options object. Both reading variants call this and only differ by defaults
 * (flow.mode = progressive vs instant).
 */
export function renderReadingSplineText( o = {} ) {
  const p = getP5();
  const textCfg = o.text ?? {};
  const pointsCfg = o.points ?? {};
  const flowCfg = o.flow ?? {};
  const position = o.position ?? {
    x: 0.5,
    y: 0.5
  };

  const count = Math.max(
    3,
    Math.round( pointsCfg.count ?? 55 )
  );
  const size = textCfg.size ?? 120;
  const font = resolveFont( textCfg.font );

  ensureLayout( {
    textCfg,
    position,
    count,
    sampleFactor: textCfg.sampleFactor ?? 0.2,
    simplifyThreshold: textCfg.simplifyThreshold ?? 0,
    font
  } );

  const words = state.words;
  const targets = state.targets;

  if ( words.length === 0 || targets.length === 0 ) {
    return;
  }

  // Which word the cluster is on, and how far through this word-segment we are.
  const wordCount = words.length;
  const phase = animation.progression * wordCount;
  const index = Math.floor( phase ) % wordCount;
  const next = ( index + 1 ) % wordCount;
  const frac = phase - Math.floor( phase );

  const mode = flowCfg.mode === "instant" ? "instant" : "progressive";
  const dwell = clamp(
    flowCfg.dwell ?? 0.45,
    0,
    0.95
  );
  const move = 1 - dwell;
  // 0 while resting on the current word, ramps 0→1 across the move window.
  const localRaw = frac < dwell ? 0 : ( frac - dwell ) / move;
  const local = clamp(
    localRaw,
    0,
    1
  );

  const easeFn = easing[ flowCfg.easing ] ?? easing.easeInOutCubic;
  const spread = mode === "instant"
    ? 0
    : clamp(
      flowCfg.spread ?? 0.6,
      0,
      0.95
    );
  const reversed = flowCfg.direction === "end";

  const from = targets[ index ];
  const to = targets[ next ];

  // Highlight: the resting word is lit, fading to the next as the cluster moves.
  const activeAlpha = new Array( wordCount ).fill( 0 );

  if ( mode === "instant" ) {
    activeAlpha[ index ] = 1;
  } else {
    activeAlpha[ index ] = Math.max(
      activeAlpha[ index ],
      1 - local
    );
    activeAlpha[ next ] = Math.max(
      activeAlpha[ next ],
      local
    );
  }

  drawBackgroundText( {
    words,
    textCfg,
    font,
    size,
    activeAlpha
  } );

  // The cluster geometry: in instant mode it simply IS the current word (it jumps
  // at each segment boundary); in progressive mode each point morphs from the
  // current word to the next, optionally staggered from one end of the curve.
  let current;

  if ( mode === "instant" ) {
    current = from.map( ( point ) => point.copy() );
  } else {
    const denom = Math.max(
      1,
      count - 1
    );

    current = from.map( (
      fromPoint, i
    ) => {
      const toPoint = to[ i ];

      if ( !toPoint ) {
        return fromPoint.copy();
      }

      const key = reversed ? 1 - i / denom : i / denom;
      const progress = easeFn( staggeredProgress(
        local,
        key,
        spread
      ) );

      return mappers.lerpVector(
        fromPoint,
        toPoint,
        progress
      );
    } );

    // Declutter the crossing: `travelDetail` is the fraction of points kept while
    // the cluster is off the word (1 = the full, busy crossing; small = a clean,
    // sparse strand). `offWord` is 0 while resting on either word and peaks halfway
    // between them, so the simplification fades fully in mid-travel and fully out
    // as the cluster lands — the glyph is always traced at full detail at rest.
    const detail = clamp(
      pointsCfg.travelDetail ?? 0.2,
      0,
      1
    );

    if ( detail < 1 && count > 2 ) {
      current = applyTravelDetail(
        current,
        ensureDetailMap(
          count,
          detail
        ),
        Math.sin( Math.PI * local )
      );
    }
  }

  if ( current.length >= 2 ) {
    renderSplines(
      [
        current
      ],
      {
        curve: o.curve ?? {},
        stroke: o.stroke ?? {},
        overlay: o.overlay ?? {}
      }
    );
  }
}

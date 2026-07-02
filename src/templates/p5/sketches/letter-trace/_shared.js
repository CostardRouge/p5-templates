import {
  getP5
} from "@/p5/utils/sketch.js";
import string from "@/p5/utils/string.js";
import colors from "@/p5/utils/colors.js";
import easing from "@/p5/utils/easing.js";
import animation from "@/p5/utils/animation.js";
import {
  splitContours,
  resampleContour,
  rotateContour,
  hashedRandom,
  tangentHeadings,
  sampleHeading,
  lerpAngle
} from "@/p5/utils/letterPaths.js";

/**
 * Shared engine for the `letter-trace` category.
 *
 * The idea: a word is drawn on the canvas, but instead of just showing it we
 * travel along the outlines of its letters like the tip of a pen. Each glyph is
 * sampled into its closed contours (`letterPaths`), every contour re-spaced to
 * even arc-length steps, and then a normalised clock walks one or more "pens"
 * along those steps. Two reading heads sit on top of the same geometry:
 *
 *   - renderScribe — a single pen follows the word letter by letter while the
 *     camera tracks the pen tip (the cinematic "writing" POV), with optional
 *     zoom-in at the start of each letter, a fill that drops in as a letter is
 *     completed, and a final pull-back that reveals the whole word.
 *
 *   - renderReveal — the camera stays on the whole word and several pens per
 *     contour reveal the outlines at once, optionally from chaotic start points,
 *     so the word materialises out of nothing (the "completion" effect).
 *
 *   - renderCurrent — like the scribe, ONE pen follows the outline, but instead
 *     of the camera only sliding to keep the tip centred, it also ROTATES the
 *     whole world so the pen's direction of travel always points along a fixed
 *     screen vector. The pen sits still on an "on-rails" anchor and the glyph
 *     streams and swivels past it (the cinematic "driving through the letter"
 *     POV), then at the end it un-rotates and pulls back to the upright word.
 *
 * All three share: glyph geometry, an assemble→hold→dissolve loop envelope (so
 * the sketch is a perfect loop), the stroke styling, and the optional letter
 * fill. The `index.js` entries are thin — they only pick defaults and call one
 * of these functions.
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

function easeFn(
  name, fallback = "easeInOutCubic"
) {
  return easing[ name ] ?? easing[ fallback ] ?? easing.linear;
}

function palette( name ) {
  return colors[ name ] ?? colors.rainbow;
}

// ---------------------------------------------------------------------------
// Geometry: build the word once and memoise it. The samples are never mutated
// downstream (draw calls only read x/y), so sharing them across frames is safe.
// ---------------------------------------------------------------------------

const WORD_MEMO_MAX = 24;
const wordMemo = new Map();

function buildWord( {
  text,
  font,
  size,
  sampleFactor,
  simplifyThreshold,
  contourBreak,
  spacing
} ) {
  const p = getP5();

  if ( !font?.font || !text.length ) {
    return null;
  }

  p.push();
  p.textFont( font );
  p.textSize( size );

  const breakDistance = contourBreak * size;
  const sampleStep = Math.max(
    1,
    spacing * size
  );
  const letters = [];
  let cursor = 0;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for ( const char of text ) {
    const advance = p.textWidth( char );

    if ( char.trim() === "" ) {
      cursor += advance;
      continue;
    }

    const raw = font.textToPoints(
      char,
      cursor,
      0,
      size,
      {
        sampleFactor,
        simplifyThreshold
      }
    );

    cursor += advance;

    if ( !raw.length ) {
      continue;
    }

    const contours = splitContours(
      raw,
      breakDistance
    )
      .map( ( pts ) => resampleContour(
        pts,
        sampleStep,
        true
      ) )
      .filter( ( pts ) => pts.length >= 2 );

    if ( !contours.length ) {
      continue;
    }

    let count = 0;

    for ( const contour of contours ) {
      count += contour.length;

      for ( const point of contour ) {
        minX = Math.min(
          minX,
          point.x
        );
        maxX = Math.max(
          maxX,
          point.x
        );
        minY = Math.min(
          minY,
          point.y
        );
        maxY = Math.max(
          maxY,
          point.y
        );
      }
    }

    letters.push( {
      char,
      contours,
      count
    } );
  }

  p.pop();

  if ( !letters.length ) {
    return null;
  }

  // Centre the whole word on the origin so the camera maths is in word space
  // (pen at (0,0) = word centre). Mutate the shared samples once, here.
  const cx = ( minX + maxX ) / 2;
  const cy = ( minY + maxY ) / 2;

  for ( const letter of letters ) {
    let lx = 0;
    let ly = 0;
    let n = 0;

    for ( const contour of letter.contours ) {
      for ( const point of contour ) {
        point.x -= cx;
        point.y -= cy;
        lx += point.x;
        ly += point.y;
        n++;
      }
    }

    // Per-letter centre (used as the camera target in simultaneous modes).
    letter.center = {
      x: lx / n,
      y: ly / n
    };
  }

  return {
    letters,
    width: maxX - minX,
    height: maxY - minY
  };
}

function getWord( cfg ) {
  const font = resolveFont( cfg.font );
  const p = getP5();
  const size = ( cfg.size ?? 0.2 ) * Math.min(
    p.width,
    p.height
  );
  const text = ( cfg.value ?? "" ).toString();
  const sampleFactor = cfg.sampleFactor ?? 0.15;
  const simplifyThreshold = cfg.simplifyThreshold ?? 0;
  const contourBreak = cfg.contourBreak ?? 0.18;
  const spacing = cfg.spacing ?? 0.012;
  const fontFamily = font?.font?.names?.fontFamily?.en || "unknown";
  const key = [
    text,
    fontFamily,
    Math.round( size ),
    sampleFactor,
    simplifyThreshold,
    contourBreak,
    spacing
  ].join( "|" );

  const cached = wordMemo.get( key );

  if ( cached ) {
    return cached;
  }

  const word = buildWord( {
    text,
    font,
    size,
    sampleFactor,
    simplifyThreshold,
    contourBreak,
    spacing
  } );

  // Don't cache a null (font still loading) — retry next frame.
  if ( !word ) {
    return null;
  }

  word.font = font;
  word.size = size;
  wordMemo.set(
    key,
    word
  );

  if ( wordMemo.size > WORD_MEMO_MAX ) {
    wordMemo.delete( wordMemo.keys().next().value );
  }

  return word;
}

// ---------------------------------------------------------------------------
// Loop envelope: assemble (0→1) → hold (1) → dissolve (1→0). Returns both the
// signed phase and a 0..1 "amount" so every variant loops seamlessly: it starts
// and ends empty.
// ---------------------------------------------------------------------------

function loopEnvelope(
  progression, assemble, hold
) {
  const a = clamp(
    assemble,
    0.01,
    1
  );
  const h = clamp(
    hold,
    0,
    Math.max(
      0,
      1 - a
    )
  );

  if ( progression < a ) {
    return {
      phase: "assemble",
      amount: progression / a
    };
  }

  if ( progression < a + h ) {
    return {
      phase: "hold",
      amount: 1
    };
  }

  const dissolve = Math.max(
    1e-4,
    1 - a - h
  );

  return {
    phase: "dissolve",
    amount: clamp(
      1 - ( progression - a - h ) / dissolve,
      0,
      1
    )
  };
}

// ---------------------------------------------------------------------------
// Drawing primitives.
// ---------------------------------------------------------------------------

function strokeColor( {
  cfg,
  hueIndex,
  alpha
} ) {
  const p = getP5();

  if ( cfg.rainbow ) {
    // animation.angle sweeps exactly TAU per loop, and the palettes read it as
    // a raw radian offset, so the scroll only lands back on its start hue when
    // it completes a WHOLE number of turns per loop — snapped here.
    const hueTurns = Math.round( cfg.hueSpeed ?? 0 );

    return palette( cfg.palette ?? "rainbow" )( {
      hueIndex,
      hueOffset: ( cfg.hueOffset ?? 0 ) + animation.angle * hueTurns,
      alpha
    } );
  }

  const base = cfg.color ?? [
    255,
    255,
    255
  ];

  return p.color(
    base[ 0 ],
    base[ 1 ],
    base[ 2 ],
    alpha
  );
}

function drawPolyline(
  points, closed
) {
  const p = getP5();

  p.beginShape();

  for ( const point of points ) {
    p.vertex(
      point.x,
      point.y
    );
  }

  p.endShape( closed ? p.CLOSE : undefined );
}

/**
 * The optional filled glyph, aligned to the same word-space the samples live in.
 * Drawn with the letter fill colour and a per-letter alpha (so a letter can fill
 * in as it is completed). textToPoints centres on the glyph bbox, so we offset
 * by the same bbox centre `buildWord` removed.
 */
function drawLetterFill( {
  word,
  letter,
  charIndex,
  alpha,
  color
} ) {
  if ( alpha <= 0 ) {
    return;
  }

  const p = getP5();
  const font = word.font;
  const size = word.size;

  // Recover this letter's x advance by measuring the substring before it.
  p.push();
  p.textFont( font );
  p.textSize( size );
  p.noStroke();
  p.fill(
    color[ 0 ],
    color[ 1 ],
    color[ 2 ],
    alpha
  );
  p.textAlign(
    p.CENTER,
    p.CENTER
  );
  // The samples were centred on the origin per word; the letter centre is its
  // own translate. textAlign CENTER/CENTER plus the letter centre keeps the fill
  // glued under the traced outline closely enough for a backing fill.
  p.text(
    letter.char,
    letter.center.x,
    letter.center.y
  );
  p.pop();
  void charIndex;
  void size;
}

// ---------------------------------------------------------------------------
// Camera.
// ---------------------------------------------------------------------------

function applyCamera( {
  target,
  zoom
} ) {
  const p = getP5();

  p.translate(
    p.width / 2,
    p.height / 2
  );
  p.scale( zoom );
  p.translate(
    -target.x,
    -target.y
  );
}

function fitZoom( word ) {
  const p = getP5();
  const margin = 0.8;

  return Math.min(
    ( p.width * margin ) / Math.max(
      word.width,
      1
    ),
    ( p.height * margin ) / Math.max(
      word.height,
      1
    )
  );
}

// ---------------------------------------------------------------------------
// Scribe: one pen, letter by letter, camera follows the tip.
// ---------------------------------------------------------------------------

/**
 * The pen tip on a letter at normalised `progress`: walk its concatenated
 * contours by sample count and return the sample sitting at that point. Always
 * computed the same way (progressive or predrawn) so the camera tracks the true
 * tip even when the whole outline is already on screen.
 */
function penAt(
  letter, progress
) {
  const target = clamp(
    progress,
    0,
    1
  ) * letter.count;
  let walked = 0;

  for ( const contour of letter.contours ) {
    const n = contour.length;

    if ( target <= walked + n ) {
      return contour[ clamp(
        Math.floor( target - walked ),
        0,
        n - 1
      ) ];
    }

    walked += n;
  }

  const last = letter.contours[ letter.contours.length - 1 ];

  return last[ last.length - 1 ];
}

/**
 * The drawn portion of a letter at normalised `progress`: completed contours in
 * full plus the in-progress one drawn up to the pen. When `predrawn` every
 * contour is returned in full regardless of progress (the camera-only travel
 * mode). Pairs with `penAt` for the tip position.
 */
function traceLetter(
  letter, progress, predrawn
) {
  const target = clamp(
    progress,
    0,
    1
  ) * letter.count;
  const drawn = [];
  let walked = 0;

  for ( const contour of letter.contours ) {
    const n = contour.length;

    if ( predrawn || walked + n <= target ) {
      drawn.push( {
        points: contour,
        closed: true
      } );
    } else if ( walked < target ) {
      const k = Math.max(
        1,
        Math.floor( target - walked )
      );

      drawn.push( {
        points: contour.slice(
          0,
          k + 1
        ),
        closed: false
      } );
    }

    walked += n;
  }

  return {
    drawn,
    pen: penAt(
      letter,
      progress
    )
  };
}

export function renderScribe( o = {} ) {
  const p = getP5();
  const textCfg = o.text ?? {};
  const cameraCfg = o.camera ?? {};
  const drawCfg = o.draw ?? {};
  const strokeCfg = o.stroke ?? {};
  const fillCfg = o.fill ?? {};
  const loopCfg = o.loop ?? {};

  const word = getWord( textCfg );

  if ( !word ) {
    return;
  }

  const letters = word.letters;
  const envelope = loopEnvelope(
    animation.progression,
    loopCfg.assemble ?? 0.7,
    loopCfg.hold ?? 0.18
  );
  const single = drawCfg.focus === "single";
  const focusIndex = single
    ? clamp(
      Math.floor( drawCfg.focusIndex ?? 0 ),
      0,
      letters.length - 1
    )
    : 0;
  const predrawn = drawCfg.reveal === "predrawn";
  const startEase = easeFn( drawCfg.easing ?? "easeInOutSine" );

  // How far through the writing we are (assemble ramps it 0→1; hold keeps it at
  // 1; dissolve keeps the geometry but fades the whole thing out).
  const writeAmount = envelope.phase === "assemble" ? envelope.amount : 1;

  // Resolve, per letter, how much of it is drawn and where the pen tip is.
  const followZoom = cameraCfg.followZoom ?? 2.6;
  const overviewZoom = fitZoom( word );
  let camTarget = {
    x: 0,
    y: 0
  };
  let zoom = overviewZoom;

  const drawList = [];
  let activePen = null;
  let activeLetterIndex = single ? focusIndex : 0;
  let activeLocal = 0;

  if ( single ) {
    const letter = letters[ focusIndex ];
    const local = startEase( writeAmount );
    const traced = traceLetter(
      letter,
      local,
      predrawn
    );

    activePen = traced.pen;
    activeLocal = local;
    drawList.push( {
      letterIndex: focusIndex,
      letter,
      drawn: traced.drawn,
      complete: local >= 1
    } );
  } else {
    const span = letters.length;
    const head = startEase( writeAmount ) * span;
    const current = clamp(
      Math.floor( head ),
      0,
      span - 1
    );

    activeLetterIndex = current;
    activeLocal = clamp(
      head - current,
      0,
      1
    );

    letters.forEach( (
      letter, index
    ) => {
      let local;

      if ( index < current ) {
        local = 1;
      } else if ( index === current ) {
        local = activeLocal;
      } else {
        local = predrawn ? 0 : -1;
      }

      if ( local < 0 ) {
        return;
      }

      const traced = traceLetter(
        letter,
        local,
        predrawn
      );

      if ( index === current ) {
        activePen = traced.pen;
      }

      drawList.push( {
        letterIndex: index,
        letter,
        drawn: traced.drawn,
        complete: local >= 1
      } );
    } );
  }

  // Camera: follow the active pen while writing, then ease continuously back to
  // the whole-word overview for the "reveal" (no hard cut at the phase boundary).
  // revealT: 0 while writing, eases 0→1 across the first part of the hold (or
  // straight away on dissolve), and stays 1 so the word sits revealed.
  const a = clamp(
    loopCfg.assemble ?? 0.7,
    0.01,
    1
  );
  const h = clamp(
    loopCfg.hold ?? 0.18,
    0,
    Math.max(
      0,
      1 - a
    )
  );
  const progression = animation.progression;
  let revealRaw;

  if ( envelope.phase === "dissolve" ) {
    revealRaw = 1;
  } else if ( envelope.phase === "hold" && ( cameraCfg.reveal ?? true ) ) {
    revealRaw = h > 0 ? clamp(
      ( progression - a ) / ( h * 0.5 ),
      0,
      1
    ) : 1;
  } else {
    revealRaw = 0;
  }

  const revealT = easing.easeInOutCubic( revealRaw );
  const letter = letters[ activeLetterIndex ];
  const penTarget = activePen ?? letter.center;
  // A gentle zoom-in pulse at the start of each letter (the "approach").
  const punch = cameraCfg.zoomPunch ?? 0;
  const pulse = punch > 0 && envelope.phase === "assemble"
    ? 1 - punch * ( 1 - easing.easeOutCubic( clamp(
      activeLocal / 0.35,
      0,
      1
    ) ) )
    : 1;

  camTarget = {
    x: penTarget.x * ( 1 - revealT ),
    y: penTarget.y * ( 1 - revealT )
  };
  zoom = ( followZoom * pulse ) * ( 1 - revealT ) + overviewZoom * revealT;

  // Global alpha: full while writing/holding, fades out on dissolve so the loop
  // returns to an empty canvas seamlessly.
  const globalAlpha = envelope.phase === "dissolve"
    ? easing.easeInOutCubic( envelope.amount )
    : 1;

  p.push();
  applyCamera( {
    target: camTarget,
    zoom
  } );
  p.noFill();
  p.strokeCap( p.ROUND );
  p.strokeJoin( p.ROUND );

  const baseWeight = ( strokeCfg.weight ?? 3 ) / zoom;
  const fillColor = fillCfg.color ?? [
    255,
    255,
    255
  ];
  const fillMode = fillCfg.mode ?? "none";

  drawList.forEach( ( entry ) => {
    // Optional fill, dropped in as a letter completes.
    if ( fillMode !== "none" ) {
      const fillAlpha = ( fillCfg.alpha ?? 255 ) * globalAlpha * (
        fillMode === "always"
          ? 1
          : entry.complete ? 1 : 0
      );

      drawLetterFill( {
        word,
        letter: entry.letter,
        charIndex: entry.letterIndex,
        alpha: fillAlpha,
        color: fillColor
      } );
    }

    p.noFill();
    p.strokeWeight( baseWeight );

    entry.drawn.forEach( (
      segment, segmentIndex
    ) => {
      p.stroke( strokeColor( {
        cfg: strokeCfg,
        hueIndex: ( entry.letterIndex + segmentIndex ) * ( strokeCfg.hueSpread ?? 0.6 ),
        alpha: 255 * globalAlpha
      } ) );
      drawPolyline(
        segment.points,
        segment.closed
      );
    } );
  } );

  // The pen tip dot.
  if ( ( strokeCfg.penDot ?? true ) && activePen && envelope.phase === "assemble" ) {
    p.noStroke();
    p.fill(
      255,
      255,
      255,
      255 * globalAlpha
    );
    p.circle(
      activePen.x,
      activePen.y,
      ( strokeCfg.penDotSize ?? 6 ) / zoom
    );
  }

  p.pop();
}

// ---------------------------------------------------------------------------
// Reveal: whole-word view, several pens per contour, materialise from nothing.
// ---------------------------------------------------------------------------

/**
 * Reveal one contour with `drawers` pens. Each pen owns an equal arc of the ring,
 * starting at an offset (optionally chaotic), and fills its arc as `amount` goes
 * 0→1, so at amount 1 the drawers together cover the whole outline.
 */
function revealContour( {
  contour,
  drawers,
  amount,
  chaotic,
  seed
} ) {
  const n = contour.length;
  const rotated = chaotic
    ? rotateContour(
      contour,
      hashedRandom( seed )
    )
    : contour;
  const arc = n / drawers;
  const length = Math.floor( arc * clamp(
    amount,
    0,
    1
  ) );
  const segments = [];

  // Below one sample the drawer hasn't put pen to paper yet — nothing to draw,
  // so the loop stays truly empty at the seams (amount → 0).
  if ( length < 1 ) {
    return segments;
  }

  for ( let d = 0; d < drawers; d++ ) {
    const start = Math.floor( d * arc );
    const points = [];

    for ( let i = 0; i <= length; i++ ) {
      points.push( rotated[ ( start + i ) % n ] );
    }

    segments.push( points );
  }

  return segments;
}

export function renderReveal( o = {} ) {
  const p = getP5();
  const textCfg = o.text ?? {};
  const drawCfg = o.draw ?? {};
  const strokeCfg = o.stroke ?? {};
  const fillCfg = o.fill ?? {};
  const loopCfg = o.loop ?? {};
  const cameraCfg = o.camera ?? {};

  const word = getWord( textCfg );

  if ( !word ) {
    return;
  }

  const letters = word.letters;
  const envelope = loopEnvelope(
    animation.progression,
    loopCfg.assemble ?? 0.45,
    loopCfg.hold ?? 0.25
  );
  const drawers = Math.max(
    1,
    Math.floor( drawCfg.drawers ?? 3 )
  );
  const chaotic = drawCfg.start === "chaotic";
  const simultaneous = drawCfg.simultaneous ?? false;
  const spread = clamp(
    drawCfg.letterStagger ?? 0.5,
    0,
    0.95
  );
  const ease = easeFn( drawCfg.easing ?? "easeInOutCubic" );

  const overviewZoom = fitZoom( word );
  // A subtle, optional push-in over the loop so the reveal breathes.
  const zoomDrift = cameraCfg.zoomDrift ?? 0;
  const zoom = overviewZoom * ( 1 + zoomDrift * Math.sin( animation.angle ) );

  const globalAlpha = 1;

  p.push();
  applyCamera( {
    target: {
      x: 0,
      y: 0
    },
    zoom
  } );
  p.noFill();
  p.strokeCap( p.ROUND );
  p.strokeJoin( p.ROUND );
  p.strokeWeight( ( strokeCfg.weight ?? 3 ) / zoom );

  const fillMode = fillCfg.mode ?? "none";
  const fillColor = fillCfg.color ?? [
    255,
    255,
    255
  ];

  letters.forEach( (
    letter, letterIndex
  ) => {
    // Per-letter progress: all together (simultaneous) or staggered left→right.
    const key = letters.length > 1 ? letterIndex / ( letters.length - 1 ) : 0;
    const start = simultaneous ? 0 : key * spread;
    const span = simultaneous ? 1 : 1 - spread;
    const local = ease( clamp(
      ( envelope.amount - start ) / Math.max(
        span,
        1e-4
      ),
      0,
      1
    ) );

    if ( fillMode !== "none" ) {
      const fillAlpha = ( fillCfg.alpha ?? 255 ) * globalAlpha * (
        fillMode === "always" ? 1 : local >= 1 ? 1 : 0
      );

      drawLetterFill( {
        word,
        letter,
        charIndex: letterIndex,
        alpha: fillAlpha,
        color: fillColor
      } );
    }

    p.noFill();

    letter.contours.forEach( (
      contour, contourIndex
    ) => {
      const segments = revealContour( {
        contour,
        drawers,
        amount: local,
        chaotic,
        seed: ( letterIndex + 1 ) * 131 + contourIndex * 17
      } );

      segments.forEach( (
        points, drawerIndex
      ) => {
        p.stroke( strokeColor( {
          cfg: strokeCfg,
          hueIndex: ( letterIndex + contourIndex + drawerIndex )
            * ( strokeCfg.hueSpread ?? 0.6 ),
          alpha: 255 * globalAlpha
        } ) );
        drawPolyline(
          points,
          false
        );
      } );
    } );
  } );

  p.pop();
}

// ---------------------------------------------------------------------------
// Current: one pen on a fixed on-rails anchor, the world rotates so the trace
// always flows toward one screen direction, then un-rotates to reveal the word.
// ---------------------------------------------------------------------------

/**
 * Flatten the word's letters into one ordered list of contours and attach a
 * continuous heading array to each. The pen walks this list end to end, so the
 * structure also carries every contour's place on a single "travel timeline"
 * (its arc length plus a short pen-lift gap to the next). Computed once and
 * memoised on the word so per-frame work is pure sampling.
 */
function ensureFlow(
  word, liftSamples
) {
  const lift = Math.max(
    0,
    Math.round( liftSamples )
  );

  if ( word._flow && word._flow.lift === lift ) {
    return word._flow;
  }

  const contours = [];
  let cursor = 0;

  word.letters.forEach( (
    letter, letterIndex
  ) => {
    letter.contours.forEach( (
      points, contourIndex
    ) => {
      const count = points.length;
      const start = cursor;

      contours.push( {
        letterIndex,
        contourIndex,
        points,
        count,
        headings: tangentHeadings( points ),
        start
      } );
      cursor += count;

      // A pen-lift gap follows every contour but the last: the pen "lifts",
      // re-orients toward the next contour and sets back down.
      cursor += lift;
    } );
  } );

  // The last contour needs no trailing lift — reclaim it so the timeline ends
  // exactly when the pen finishes the final outline.
  const total = Math.max(
    1,
    cursor - lift
  );

  // Per letter, the timeline position at which its last contour finishes, so a
  // fill can drop in the moment a letter is fully traced.
  const letterEnd = word.letters.map( () => 0 );

  contours.forEach( ( c ) => {
    letterEnd[ c.letterIndex ] = Math.max(
      letterEnd[ c.letterIndex ],
      c.start + c.count
    );
  } );

  word._flow = {
    lift,
    contours,
    total,
    letterEnd
  };

  return word._flow;
}

export function renderCurrent( o = {} ) {
  const p = getP5();
  const textCfg = o.text ?? {};
  const drawCfg = o.draw ?? {};
  const cameraCfg = o.camera ?? {};
  const strokeCfg = o.stroke ?? {};
  const fillCfg = o.fill ?? {};
  const loopCfg = o.loop ?? {};
  const dirCfg = o.direction ?? {};

  const word = getWord( textCfg );

  if ( !word ) {
    return;
  }

  const liftSamples = Math.max(
    0,
    drawCfg.lift ?? 8
  );
  const flow = ensureFlow(
    word,
    liftSamples
  );
  const contours = flow.contours;

  if ( !contours.length ) {
    return;
  }

  const envelope = loopEnvelope(
    animation.progression,
    loopCfg.assemble ?? 0.7,
    loopCfg.hold ?? 0.2
  );
  const predrawn = ( drawCfg.reveal ?? "predrawn" ) === "predrawn";
  const startEase = easeFn( drawCfg.easing ?? "easeInOutSine" );
  const rotationAmount = clamp(
    drawCfg.rotationAmount ?? 1,
    0,
    1
  );
  const banking = drawCfg.banking ?? 0.15;
  const ghostAlpha = clamp(
    drawCfg.ghostAlpha ?? 40,
    0,
    255
  );
  const anticipation = Math.max(
    0,
    drawCfg.anticipation ?? 6
  );

  // The fixed screen direction the trace is rotated to flow along. (0,-1) — the
  // default — sends it up the screen ("the road ahead"); magnitude is ignored.
  const desiredAngle = Math.atan2(
    dirCfg.y ?? -1,
    dirCfg.x ?? 0
  );

  // How far along the travel timeline the pen has reached.
  const writeAmount = envelope.phase === "assemble" ? envelope.amount : 1;
  const head = startEase( writeAmount ) * flow.total;

  // Locate the pen: inside a contour (drawing) or in the gap between two
  // (lifting). Walk the same timeline ensureFlow laid out.
  let penPos = contours[ 0 ].points[ 0 ];
  let penHeading = desiredAngle;
  let penAlpha = 1;
  let bank = 0;

  for ( let i = 0; i < contours.length; i++ ) {
    const c = contours[ i ];
    const localCount = c.count;

    if ( head <= c.start + localCount || i === contours.length - 1 ) {
      // Drawing this contour.
      const localT = clamp(
        ( head - c.start ) / Math.max(
          1,
          localCount
        ),
        0,
        1
      );
      const idx = clamp(
        Math.round( localT * ( c.count - 1 ) ),
        0,
        c.count - 1
      );

      penPos = c.points[ idx ];
      penHeading = sampleHeading(
        c.headings,
        localT,
        anticipation
      );

      if ( banking !== 0 ) {
        const ahead = sampleHeading(
          c.headings,
          clamp(
            localT + 0.05,
            0,
            1
          ),
          anticipation
        );
        const behind = sampleHeading(
          c.headings,
          clamp(
            localT - 0.05,
            0,
            1
          ),
          anticipation
        );

        bank = banking * clamp(
          ahead - behind,
          -1,
          1
        );
      }

      break;
    }

    if ( head < c.start + localCount + flow.lift ) {
      // Lifting from this contour to the next: bridge position and heading so
      // the camera never teleports, and dip the pen so it reads as a lift.
      const next = contours[ i + 1 ];
      const tl = clamp(
        ( head - ( c.start + localCount ) ) / Math.max(
          1,
          flow.lift
        ),
        0,
        1
      );
      const s = easing.easeInOutCubic( tl );
      const from = c.points[ c.count - 1 ];
      const to = next.points[ 0 ];

      penPos = {
        x: from.x + ( to.x - from.x ) * s,
        y: from.y + ( to.y - from.y ) * s
      };
      penHeading = lerpAngle(
        sampleHeading(
          c.headings,
          1,
          anticipation
        ),
        sampleHeading(
          next.headings,
          0,
          anticipation
        ),
        s
      );
      penAlpha = 1 - Math.sin( tl * Math.PI ) * 0.85;

      break;
    }
  }

  // Camera. Same reveal envelope as the scribe (ease back to the upright word
  // over the first half of the hold), with the rotation unwound to 0 alongside.
  const followZoom = cameraCfg.followZoom ?? 3;
  const overviewZoom = fitZoom( word );
  const anchorY = clamp(
    cameraCfg.anchorY ?? 0.62,
    0.1,
    0.9
  );
  const a = clamp(
    loopCfg.assemble ?? 0.7,
    0.01,
    1
  );
  const h = clamp(
    loopCfg.hold ?? 0.2,
    0,
    Math.max(
      0,
      1 - a
    )
  );
  const progression = animation.progression;
  let revealRaw;

  if ( envelope.phase === "dissolve" ) {
    revealRaw = 1;
  } else if ( envelope.phase === "hold" && ( cameraCfg.reveal ?? true ) ) {
    revealRaw = h > 0 ? clamp(
      ( progression - a ) / ( h * 0.5 ),
      0,
      1
    ) : 1;
  } else {
    revealRaw = 0;
  }

  const revealT = easing.easeInOutCubic( revealRaw );

  // On-rails rotation: align the pen heading to the desired screen direction
  // (scaled by rotationAmount so 0 falls back to the scribe's upright follow),
  // plus a little banking into curves. Unwound to 0 as the word is revealed.
  const railAngle = ( rotationAmount * ( desiredAngle - penHeading ) + bank )
    * ( 1 - revealT );
  const camTarget = {
    x: penPos.x * ( 1 - revealT ),
    y: penPos.y * ( 1 - revealT )
  };
  const zoom = followZoom * ( 1 - revealT ) + overviewZoom * revealT;
  const anchor = {
    x: p.width / 2,
    y: p.height * anchorY + ( p.height / 2 - p.height * anchorY ) * revealT
  };
  const globalAlpha = envelope.phase === "dissolve"
    ? easing.easeInOutCubic( envelope.amount )
    : 1;

  p.push();
  p.translate(
    anchor.x,
    anchor.y
  );
  p.scale( zoom );
  p.rotate( railAngle );
  p.translate(
    -camTarget.x,
    -camTarget.y
  );
  p.noFill();
  p.strokeCap( p.ROUND );
  p.strokeJoin( p.ROUND );

  const baseWeight = ( strokeCfg.weight ?? 3 ) / zoom;
  const fillMode = fillCfg.mode ?? "none";
  const fillColor = fillCfg.color ?? [
    255,
    255,
    255
  ];

  // Optional letter fill, dropped in as each letter is fully traced.
  if ( fillMode !== "none" ) {
    word.letters.forEach( (
      letter, letterIndex
    ) => {
      const complete = head >= flow.letterEnd[ letterIndex ];
      const fillAlpha = ( fillCfg.alpha ?? 255 ) * globalAlpha * (
        fillMode === "always" ? 1 : complete ? 1 : 0
      );

      drawLetterFill( {
        word,
        letter,
        charIndex: letterIndex,
        alpha: fillAlpha,
        color: fillColor
      } );
    } );
  }

  p.noFill();
  p.strokeWeight( baseWeight );

  // Draw each contour: the traveled arc bright, and — in predrawn mode — the
  // road still ahead as a faint ghost so the larger structure stays legible.
  contours.forEach( ( c ) => {
    const traveled = clamp(
      Math.round( head - c.start ),
      0,
      c.count
    );
    const hueIndex = ( c.letterIndex + c.contourIndex )
      * ( strokeCfg.hueSpread ?? 0.6 );

    if ( predrawn && ghostAlpha > 0 && traveled < c.count ) {
      p.strokeWeight( baseWeight * 0.8 );
      p.stroke( strokeColor( {
        cfg: strokeCfg,
        hueIndex,
        alpha: ghostAlpha * globalAlpha
      } ) );
      drawPolyline(
        c.points,
        true
      );
      p.strokeWeight( baseWeight );
    }

    if ( traveled < 1 ) {
      return;
    }

    p.stroke( strokeColor( {
      cfg: strokeCfg,
      hueIndex,
      alpha: 255 * globalAlpha
    } ) );
    drawPolyline(
      c.points.slice(
        0,
        traveled + 1
      ),
      traveled >= c.count
    );
  } );

  // The pen tip, riding the on-rails anchor while writing.
  if ( ( strokeCfg.penDot ?? true ) && envelope.phase === "assemble" ) {
    p.noStroke();
    p.fill(
      255,
      255,
      255,
      255 * globalAlpha * penAlpha
    );
    p.circle(
      penPos.x,
      penPos.y,
      ( strokeCfg.penDotSize ?? 6 ) / zoom
    );
  }

  p.pop();
}

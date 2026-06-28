import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import easing from "@/p5/utils/easing.js";
import animation from "@/p5/utils/animation.js";
import string from "@/p5/utils/string.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";
import {
  LETTERS,
  clamp,
  cellChar,
  lerpColor,
  ensurePath,
  resolveReadingPosition
} from "../_grid.js";

// ─────────────────────────────────────────────────────────────────────────────
// letter-grid v1 — "spell"
//
// A VIRTUAL, "infinite" grid of random letters/digits. Each cell's glyph is a
// pure hash of (col, row, seed), so any cell can be queried without ever storing
// the whole grid — only the handful of cells inside the viewport are ever drawn.
//
// The camera lives in *cell space* (a fractional col/row) and travels letter by
// letter to spell a word: for each character it locks onto a random matching cell
// — preferably OUTSIDE the current viewport — and eases across the void to it. The
// glyph under the centre of the screen is the one we're "reading", so it lights up
// via a centre-focus falloff; the cells we actually land on (the word) get an
// accent tint on top. A parametric vignette darkens the edges to keep the eye on
// the middle.
//
// The grid + word-path + camera engine lives in `../_grid.js` (shared with the
// other letter-grid variants); this file only renders the flat 2D view.
// ─────────────────────────────────────────────────────────────────────────────

// Cached path/alphabet, rebuilt only when an input that shapes it changes.
const store = {
  key: "",
  path: [],
  alphabet: LETTERS,
  seed: 1
};

// Radial vignette via the 2D context's native gradient — cheap and crisp.
function drawVignette( {
  amount,
  radius,
  softness,
  color
} ) {
  if ( amount <= 0 ) {
    return;
  }

  const p = getP5();
  const ctx = p.drawingContext;
  const cx = p.width / 2;
  const cy = p.height / 2;
  const maxR = 0.5 * Math.sqrt( p.width * p.width + p.height * p.height );
  const inner = clamp(
    radius,
    0,
    1
  ) * maxR;
  const outer = Math.max(
    inner + 1,
    ( radius + Math.max(
      0.01,
      softness
    ) ) * maxR
  );

  const [
    r,
    g,
    b
  ] = color;
  const gradient = ctx.createRadialGradient(
    cx,
    cy,
    inner,
    cx,
    cy,
    outer
  );

  gradient.addColorStop(
    0,
    `rgba(${ r }, ${ g }, ${ b }, 0)`
  );
  gradient.addColorStop(
    1,
    `rgba(${ r }, ${ g }, ${ b }, ${ clamp(
      amount,
      0,
      1
    ) })`
  );

  ctx.save();
  ctx.fillStyle = gradient;
  ctx.fillRect(
    0,
    0,
    p.width,
    p.height
  );
  ctx.restore();
}

sketch.setup( () => {} );

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};

  const wordCfg = o.word ?? {};
  const gridCfg = o.grid ?? {};
  const motionCfg = o.motion ?? {};
  const colorsCfg = o.colors ?? {};
  const vignetteCfg = o.vignette ?? {};

  const background = o.backgroundColor ?? [
    8,
    8,
    12,
    255
  ];

  p.clear();
  p.background( ...background );

  // ── Zoom / cell geometry ──────────────────────────────────────────────────
  // A fractional `cellsAcross` is what leaves the centre glyph big while letting
  // its neighbours peek in at the edges (the "imprecise zoom" margin).
  const cellsAcross = Math.max(
    1,
    gridCfg.cellsAcross ?? 3.4
  );
  const minDim = Math.min(
    p.width,
    p.height
  );
  const pulse = ( gridCfg.zoomPulse ?? 0 ) * Math.sin( animation.angle );
  const cellSize = ( minDim / cellsAcross ) * ( 1 + pulse );

  const viewCols = p.width / cellSize;
  const viewRows = p.height / cellSize;
  const viewRadius = 0.5 * Math.sqrt( viewCols * viewCols + viewRows * viewRows );

  const spread = clamp(
    motionCfg.searchSpread ?? 0.6,
    0,
    1
  );

  ensurePath(
    store,
    {
      wordCfg,
      spread,
      viewRadius
    }
  );

  const path = store.path;
  const alphabet = store.alphabet;
  const seed = store.seed;

  // ── Camera position in cell space ─────────────────────────────────────────
  const {
    camCol,
    camRow,
    from,
    to,
    fromLit,
    toLit
  } = resolveReadingPosition( {
    path,
    progression: animation.progression,
    dwell: motionCfg.dwell ?? 0.45,
    easeFn: easing[ motionCfg.easing ] ?? easing.easeInOutCubic
  } );

  // ── Draw the visible slice of the grid ────────────────────────────────────
  const font = string.fonts[ gridCfg.font ] ?? string.fonts.spaceMonoRegular;

  if ( font?.font && alphabet.length > 0 ) {
    const letterScale = clamp(
      gridCfg.letterScale ?? 0.62,
      0.1,
      1.4
    );

    p.push();
    p.noStroke();
    p.textFont( font );
    p.textSize( cellSize * letterScale );
    p.textAlign(
      p.CENTER,
      p.CENTER
    );

    const gridColor = colorsCfg.gridColor ?? [
      120,
      120,
      135,
      150
    ];
    const focusColor = colorsCfg.focusColor ?? [
      255,
      255,
      255,
      255
    ];
    const accentColor = colorsCfg.accentColor ?? [
      120,
      200,
      255,
      255
    ];
    const focusRadius = Math.max(
      0.3,
      colorsCfg.focusRadius ?? 1.3
    );
    const focusEase = easing[ colorsCfg.focusEasing ] ?? easing.easeOutQuad;

    const colMin = Math.floor( camCol - viewCols / 2 ) - 1;
    const colMax = Math.ceil( camCol + viewCols / 2 ) + 1;
    const rowMin = Math.floor( camRow - viewRows / 2 ) - 1;
    const rowMax = Math.ceil( camRow + viewRows / 2 ) + 1;

    for ( let col = colMin; col <= colMax; col++ ) {
      for ( let row = rowMin; row <= rowMax; row++ ) {
        const sx = p.width / 2 + ( col - camCol ) * cellSize;
        const sy = p.height / 2 + ( row - camRow ) * cellSize;

        const dx = col - camCol;
        const dy = row - camRow;
        const dist = Math.sqrt( dx * dx + dy * dy );
        const focus = focusEase( clamp(
          1 - dist / focusRadius,
          0,
          1
        ) );

        let colorArray = lerpColor(
          gridColor,
          focusColor,
          focus
        );

        // The word cells we actually land on glow in the accent colour, scaled by
        // how "locked-on" we currently are and how central they sit.
        let accentWeight = 0;

        if ( from && col === from.col && row === from.row ) {
          accentWeight = fromLit;
        } else if ( to && col === to.col && row === to.row ) {
          accentWeight = toLit;
        }

        if ( accentWeight > 0 ) {
          colorArray = lerpColor(
            colorArray,
            accentColor,
            accentWeight * ( 0.35 + 0.65 * focus )
          );
        }

        const glyph = ( from && from.forced && col === from.col && row === from.row )
          ? from.forced
          : ( to && to.forced && col === to.col && row === to.row )
            ? to.forced
            : cellChar(
              col,
              row,
              seed,
              alphabet
            );

        p.fill( ...colorArray );
        p.text(
          glyph,
          sx,
          sy
        );
      }
    }

    p.pop();
  }

  drawVignette( {
    amount: vignetteCfg.amount ?? 0.85,
    radius: vignetteCfg.radius ?? 0.42,
    softness: vignetteCfg.softness ?? 0.5,
    color: vignetteCfg.color ?? background
  } );

  renderTitle();
} );

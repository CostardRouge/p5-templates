import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";

import animation from "@/p5/utils/animation.js";
import string from "@/p5/utils/string.js";

// ─────────────────────────────────────────────────────────────────────────────
// SYNASTAR TERMINAL — fictional UI animation.
//
// A diegetic diagnostic terminal in the language of retro sci-fi consoles: the
// warning-graphic austerity of a NERV / Evangelion readout, the phosphor grid of
// a lab oscilloscope, the segmented LCD of a Casio watch, and the wireframe
// point-cloud of an early CAD holo-display — all wrapped in a dashed containment
// frame and glazed with CRT scanlines.
//
// Everything is a pure function of `animation.progression` (0 → 1), so the whole
// terminal is a seamless loop that renders identically live and during headless
// frame capture. Motion uses only sines whose phase is an INTEGER multiple of the
// loop angle (they return to themselves at the seam) and p5 noise sampled at
// fixed coordinates (static texture) — no accumulated state, no Math.random().
// ─────────────────────────────────────────────────────────────────────────────

// ── Palettes ────────────────────────────────────────────────────────────────
// Each theme paints the panels in one coherent language. `neonGenesis` is the
// default: a phosphor-green terminal shot through with EVA orange, warning red,
// and the red/cyan/magenta of an interference scope — every reference at once.
const THEMES = {
  neonGenesis: {
    bg: [
      6,
      9,
      12
    ],
    grid: [
      34,
      92,
      70
    ],
    frame: [
      90,
      150,
      120
    ],
    primary: [
      74,
      255,
      150
    ],
    signal: [
      57,
      255,
      120
    ],
    warn: [
      255,
      78,
      46
    ],
    accent: [
      255,
      140,
      40
    ],
    cool: [
      70,
      200,
      255
    ],
    hot: [
      255,
      60,
      190
    ],
    text: [
      150,
      240,
      190
    ]
  },
  phosphor: {
    bg: [
      3,
      10,
      6
    ],
    grid: [
      22,
      84,
      48
    ],
    frame: [
      60,
      170,
      100
    ],
    primary: [
      120,
      255,
      150
    ],
    signal: [
      90,
      255,
      130
    ],
    warn: [
      210,
      255,
      120
    ],
    accent: [
      60,
      230,
      140
    ],
    cool: [
      120,
      255,
      200
    ],
    hot: [
      190,
      255,
      140
    ],
    text: [
      150,
      255,
      180
    ]
  },
  amber: {
    bg: [
      12,
      7,
      2
    ],
    grid: [
      96,
      58,
      14
    ],
    frame: [
      190,
      120,
      40
    ],
    primary: [
      255,
      176,
      60
    ],
    signal: [
      255,
      150,
      40
    ],
    warn: [
      255,
      70,
      30
    ],
    accent: [
      255,
      210,
      90
    ],
    cool: [
      255,
      160,
      70
    ],
    hot: [
      255,
      120,
      40
    ],
    text: [
      255,
      190,
      110
    ]
  },
  vaporwave: {
    bg: [
      10,
      6,
      20
    ],
    grid: [
      70,
      40,
      110
    ],
    frame: [
      150,
      90,
      210
    ],
    primary: [
      90,
      230,
      255
    ],
    signal: [
      255,
      90,
      210
    ],
    warn: [
      255,
      70,
      130
    ],
    accent: [
      180,
      120,
      255
    ],
    cool: [
      90,
      220,
      255
    ],
    hot: [
      255,
      80,
      200
    ],
    text: [
      220,
      170,
      255
    ]
  },
  crimson: {
    bg: [
      12,
      4,
      6
    ],
    grid: [
      110,
      26,
      32
    ],
    frame: [
      210,
      70,
      70
    ],
    primary: [
      255,
      90,
      80
    ],
    signal: [
      255,
      60,
      60
    ],
    warn: [
      255,
      180,
      60
    ],
    accent: [
      255,
      120,
      100
    ],
    cool: [
      255,
      120,
      120
    ],
    hot: [
      255,
      60,
      90
    ],
    text: [
      255,
      150,
      140
    ]
  }
};

const TAU = Math.PI * 2;

// ── Colour helpers ────────────────────────────────────────────────────────────
function stroke(
  p, rgb, a, w
) {
  p.stroke(
    rgb[ 0 ],
    rgb[ 1 ],
    rgb[ 2 ],
    a ?? 255
  );

  if ( w !== undefined ) {
    p.strokeWeight( w );
  }
}

function fill(
  p, rgb, a
) {
  p.fill(
    rgb[ 0 ],
    rgb[ 1 ],
    rgb[ 2 ],
    a ?? 255
  );
}

// Additive bloom via the raw 2D context shadow — one cheap call sets a glow that
// every subsequent stroke/fill inherits until cleared.
function glowOn(
  p, rgb, blur
) {
  const c = p.drawingContext;

  c.shadowBlur = blur;
  c.shadowColor = `rgba( ${ rgb[ 0 ] }, ${ rgb[ 1 ] }, ${ rgb[ 2 ] }, 0.9 )`;
}

function glowOff( p ) {
  p.drawingContext.shadowBlur = 0;
}

function lerp3(
  a, b, t
) {
  return [
    a[ 0 ] + ( b[ 0 ] - a[ 0 ] ) * t,
    a[ 1 ] + ( b[ 1 ] - a[ 1 ] ) * t,
    a[ 2 ] + ( b[ 2 ] - a[ 2 ] ) * t
  ];
}

// Monospace telemetry writer — thin wrapper over the shared text util locked to
// Space Mono, the console typeface of the whole series.
function mono(
  p, str, x, y, size, rgb, align, alpha
) {
  string.write(
    str,
    x,
    y,
    {
      size,
      font: string.fonts.spaceMonoRegular,
      fill: p.color(
        rgb[ 0 ],
        rgb[ 1 ],
        rgb[ 2 ],
        alpha ?? 255
      ),
      stroke: false,
      strokeWeight: 0,
      textAlign: align ?? [
        p.LEFT,
        p.BASELINE
      ]
    }
  );
}

// Zero-padded integer, the native tongue of a segmented display.
function pad(
  value, width
) {
  return String( Math.max(
    0,
    Math.floor( value )
  ) ).padStart(
    width,
    "0"
  );
}

// ── Frame primitives ──────────────────────────────────────────────────────────
// L-shaped corner bracket anchored at (x, y), arms of length len running (sx, sy).
function bracket(
  p, x, y, len, sx, sy
) {
  p.line(
    x,
    y,
    x + len * sx,
    y
  );
  p.line(
    x,
    y,
    x,
    y + len * sy
  );
}

// A hazard chevron arrow (the "danger, keep clear" glyph from the reference UI).
function chevron(
  p, x, y, size, dir
) {
  const s = size;

  p.push();
  p.translate(
    x,
    y
  );
  p.rotate( dir );
  p.noFill();
  p.beginShape();
  p.vertex(
    -s,
    -s * 0.6
  );
  p.vertex(
    0,
    0
  );
  p.vertex(
    -s,
    s * 0.6
  );
  p.endShape();
  p.pop();
}

function hexagon(
  p, cx, cy, r, rot
) {
  p.beginShape();

  for ( let i = 0; i < 6; i++ ) {
    const a = rot + i * TAU / 6;

    p.vertex(
      cx + Math.cos( a ) * r,
      cy + Math.sin( a ) * r
    );
  }

  p.endShape( p.CLOSE );
}

// A titled panel: faint field, hairline border, bright corner ticks, and a label
// tab riveted to the top-left edge.
function panel(
  p, x, y, w, h, pal, label, tag
) {
  p.push();
  p.noStroke();
  fill(
    p,
    pal.bg,
    150
  );
  p.rect(
    x,
    y,
    w,
    h
  );

  p.noFill();
  stroke(
    p,
    pal.grid,
    120,
    1
  );
  p.rect(
    x,
    y,
    w,
    h
  );

  const t = Math.min(
    w,
    h
  ) * 0.06;

  stroke(
    p,
    pal.frame,
    230,
    2
  );
  bracket(
    p,
    x,
    y,
    t,
    1,
    1
  );
  bracket(
    p,
    x + w,
    y,
    t,
    -1,
    1
  );
  bracket(
    p,
    x,
    y + h,
    t,
    1,
    -1
  );
  bracket(
    p,
    x + w,
    y + h,
    t,
    -1,
    -1
  );

  // edge ticks — the little ruled marks that make a panel read as an instrument
  stroke(
    p,
    pal.grid,
    90,
    1
  );

  const ticks = 24;

  for ( let i = 1; i < ticks; i++ ) {
    const tx = x + w * i / ticks;
    const len = i % 4 === 0 ? h * 0.02 : h * 0.01;

    p.line(
      tx,
      y,
      tx,
      y + len
    );
    p.line(
      tx,
      y + h,
      tx,
      y + h - len
    );
  }

  if ( label ) {
    const s = h * 0.055;

    p.noStroke();
    fill(
      p,
      pal.frame,
      40
    );
    p.rect(
      x,
      y - s * 1.7,
      s * ( label.length * 0.62 + 1.4 ),
      s * 1.5
    );
    mono(
      p,
      label,
      x + s * 0.5,
      y - s * 0.55,
      s,
      pal.text,
      [
        p.LEFT,
        p.BASELINE
      ],
      235
    );

    if ( tag ) {
      mono(
        p,
        tag,
        x + w,
        y - s * 0.55,
        s * 0.82,
        pal.frame,
        [
          p.RIGHT,
          p.BASELINE
        ],
        200
      );
    }
  }

  p.pop();
}

// ── Seven-segment LCD ──────────────────────────────────────────────────────────
// Segment membership per glyph. Layout:  aaa / f b / ggg / e c / ddd
const SEG = {
  0: "abcdef",
  1: "bc",
  2: "abged",
  3: "abgcd",
  4: "fgbc",
  5: "afgcd",
  6: "afgedc",
  7: "abc",
  8: "abcdefg",
  9: "abcdfg",
  "-": "g",
  " ": ""
};

// Horizontal tapered bar (a pointed hexagon) centred at (cx, cy).
function hbar(
  cx, cy, len, t
) {
  const h = len / 2;
  const q = t / 2;

  return [
    [
      cx - h,
      cy
    ],
    [
      cx - h + q,
      cy - q
    ],
    [
      cx + h - q,
      cy - q
    ],
    [
      cx + h,
      cy
    ],
    [
      cx + h - q,
      cy + q
    ],
    [
      cx - h + q,
      cy + q
    ]
  ];
}

// Vertical tapered bar centred at (cx, cy).
function vbar(
  cx, cy, len, t
) {
  const h = len / 2;
  const q = t / 2;

  return [
    [
      cx,
      cy - h
    ],
    [
      cx + q,
      cy - h + q
    ],
    [
      cx + q,
      cy + h - q
    ],
    [
      cx,
      cy + h
    ],
    [
      cx - q,
      cy + h - q
    ],
    [
      cx - q,
      cy - h + q
    ]
  ];
}

function segPoly(
  p, pts
) {
  p.beginShape();

  for ( const pt of pts ) {
    p.vertex(
      pt[ 0 ],
      pt[ 1 ]
    );
  }

  p.endShape( p.CLOSE );
}

// Render one seven-segment glyph. Off segments ghost faintly (the resting LCD),
// on segments glow — the tactile hallmark of the Casio reference.
function segmentGlyph(
  p, ch, x, y, w, h, on, off
) {
  const t = w * 0.16;
  const midY = y + h / 2;
  const vlen = h / 2 - t * 1.1;
  const hlen = w - t * 1.1;
  const geo = {
    a: hbar(
      x + w / 2,
      y + t / 2,
      hlen,
      t
    ),
    g: hbar(
      x + w / 2,
      midY,
      hlen,
      t
    ),
    d: hbar(
      x + w / 2,
      y + h - t / 2,
      hlen,
      t
    ),
    f: vbar(
      x + t / 2,
      y + h * 0.25 + t * 0.05,
      vlen,
      t
    ),
    b: vbar(
      x + w - t / 2,
      y + h * 0.25 + t * 0.05,
      vlen,
      t
    ),
    e: vbar(
      x + t / 2,
      y + h * 0.75 - t * 0.05,
      vlen,
      t
    ),
    c: vbar(
      x + w - t / 2,
      y + h * 0.75 - t * 0.05,
      vlen,
      t
    )
  };
  const lit = SEG[ ch ] ?? "";

  p.noStroke();

  for ( const key of Object.keys( geo ) ) {
    if ( lit.includes( key ) ) {
      continue;
    }

    fill(
      p,
      off,
      26
    );
    segPoly(
      p,
      geo[ key ]
    );
  }

  glowOn(
    p,
    on,
    w * 0.5
  );
  fill(
    p,
    on,
    240
  );

  for ( const key of Object.keys( geo ) ) {
    if ( lit.includes( key ) ) {
      segPoly(
        p,
        geo[ key ]
      );
    }
  }

  glowOff( p );
}

// Draw a whole string of glyphs (digits, blanks, dashes, and ":" as a colon).
function segmentString(
  p, str, x, y, w, h, on, off
) {
  const gap = w * 0.34;
  let cx = x;

  for ( const ch of str ) {
    if ( ch === ":" ) {
      const r = w * 0.09;

      glowOn(
        p,
        on,
        w * 0.4
      );
      p.noStroke();
      fill(
        p,
        on,
        230
      );
      p.circle(
        cx + gap * 0.4,
        y + h * 0.34,
        r
      );
      p.circle(
        cx + gap * 0.4,
        y + h * 0.66,
        r
      );
      glowOff( p );
      cx += gap;
      continue;
    }

    segmentGlyph(
      p,
      ch,
      cx,
      y,
      w,
      h,
      on,
      off
    );
    cx += w + gap;
  }

  return cx;
}

// ── Height field (shared by the terrain wireframe and its point cloud) ─────────
// A rolling landscape built from loop-safe sines plus a static noise ridge for
// craggy detail. `xn` ∈ [-1, 1], `depth` ∈ [0, 1], `ph` = loop angle.
function terrainHeight(
  p, xn, depth, ph, detail
) {
  const wx = xn * TAU;
  const wz = depth * TAU;
  const rolling =
    Math.sin( wx * 1.4 + ph ) * 0.42 +
    Math.sin( wz * 1.1 - ph ) * 0.34 +
    Math.sin( ( wx + wz ) * 0.7 + ph * 2 ) * 0.24;
  const ridge = ( p.noise(
    xn * 2.1 + 12,
    depth * 2.6 + 5
  ) - 0.5 ) * 2 * detail;

  return rolling * ( 1 - detail * 0.4 ) + ridge;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: header
// ═══════════════════════════════════════════════════════════════════════════════
function drawHeader(
  p, cfg, pal, pr, W
) {
  const m = W * 0.06;
  const yTop = W * 0.075;
  const blink = Math.sin( pr * TAU * 8 ) > -0.2;

  glowOn(
    p,
    pal.accent,
    W * 0.02
  );
  mono(
    p,
    cfg.company,
    m,
    yTop,
    W * 0.028,
    pal.text,
    [
      p.LEFT,
      p.BASELINE
    ],
    240
  );
  glowOff( p );

  glowOn(
    p,
    pal.signal,
    W * 0.03
  );
  mono(
    p,
    cfg.title,
    m,
    yTop + W * 0.062,
    W * 0.052,
    pal.signal,
    [
      p.LEFT,
      p.BASELINE
    ],
    255
  );
  glowOff( p );

  mono(
    p,
    `// ${ cfg.version }`,
    m,
    yTop + W * 0.096,
    W * 0.024,
    pal.frame,
    [
      p.LEFT,
      p.BASELINE
    ],
    200
  );

  // rotating hex emblem, top-right
  const hx = p.width - m - W * 0.05;
  const hy = yTop + W * 0.02;

  p.push();
  p.noFill();
  glowOn(
    p,
    pal.accent,
    W * 0.02
  );
  stroke(
    p,
    pal.accent,
    220,
    2
  );
  hexagon(
    p,
    hx,
    hy,
    W * 0.05,
    pr * TAU
  );
  stroke(
    p,
    pal.frame,
    150,
    1
  );
  hexagon(
    p,
    hx,
    hy,
    W * 0.032,
    -pr * TAU * 2
  );
  glowOff( p );
  p.pop();

  // status light
  const dotX = p.width - m - W * 0.05;
  const dotY = yTop + W * 0.09;

  p.noStroke();

  if ( blink ) {
    glowOn(
      p,
      pal.warn,
      W * 0.03
    );
    fill(
      p,
      pal.warn,
      255
    );
    p.circle(
      dotX - W * 0.16,
      dotY,
      W * 0.016
    );
    glowOff( p );
  }

  mono(
    p,
    blink ? "● REC  LOCK" : "○ REC  LOCK",
    p.width - m,
    dotY + W * 0.006,
    W * 0.022,
    pal.warn,
    [
      p.RIGHT,
      p.BASELINE
    ],
    230
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: oscilloscope — moiré interference family + modulated green carrier
// ═══════════════════════════════════════════════════════════════════════════════
function drawOscilloscope(
  p, x, y, w, h, cfg, pal, pr
) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const ph = pr * TAU;

  p.push();

  // fine grid
  stroke(
    p,
    pal.grid,
    70,
    1
  );

  const gx = 16;
  const gy = 8;

  for ( let i = 1; i < gx; i++ ) {
    p.line(
      x + w * i / gx,
      y,
      x + w * i / gx,
      y + h
    );
  }

  for ( let j = 1; j < gy; j++ ) {
    p.line(
      x,
      y + h * j / gy,
      x + w,
      y + h * j / gy
    );
  }

  // crosshair reticle field ("+" marks) — the graticule of a lab scope
  stroke(
    p,
    pal.frame,
    130,
    1.4
  );

  const r = w * 0.011;

  for ( let i = 1; i < gx; i += 3 ) {
    for ( let j = 1; j < gy; j += 2 ) {
      const mx = x + w * i / gx;
      const my = y + h * j / gy;

      p.line(
        mx - r,
        my,
        mx + r,
        my
      );
      p.line(
        mx,
        my - r,
        mx,
        my + r
      );
    }
  }

  // baseline
  stroke(
    p,
    pal.grid,
    150,
    1
  );
  p.line(
    x,
    cy,
    x + w,
    cy
  );

  // ── moiré interference family ──
  // A fan of sine traces whose frequency drifts per line; overlaid additively
  // they braid into the red→magenta→cyan interference of the reference scope.
  p.blendMode( p.ADD );

  const traces = cfg.traces;
  const amp = h * 0.34 * cfg.amplitude;
  const step = Math.max(
    2,
    Math.floor( w / 300 )
  );

  glowOn(
    p,
    pal.hot,
    w * 0.006
  );

  for ( let k = 0; k < traces; k++ ) {
    const kt = traces > 1 ? k / ( traces - 1 ) : 0;
    const col = kt < 0.5
      ? lerp3(
        pal.warn,
        pal.hot,
        kt * 2
      )
      : lerp3(
        pal.hot,
        pal.cool,
        ( kt - 0.5 ) * 2
      );
    const freq = cfg.frequency * ( 1 + kt * 0.9 );
    const phase = ph * cfg.speed + kt * TAU;

    stroke(
      p,
      col,
      90,
      1.2
    );
    p.noFill();
    p.beginShape();

    for ( let sx = 0; sx <= w; sx += step ) {
      const u = sx / w;
      const env = Math.sin( u * Math.PI );
      const yy = cy + Math.sin( u * TAU * freq + phase ) * amp * env;

      p.vertex(
        x + sx,
        yy
      );
    }

    p.endShape();
  }

  // ── modulated carrier ──
  // A high-frequency wave enveloped by a slow travelling sine — the bright green
  // "signal riding a signal" of the phosphor reference.
  if ( cfg.carrier ) {
    stroke(
      p,
      pal.signal,
      220,
      1.6
    );
    glowOn(
      p,
      pal.signal,
      w * 0.012
    );
    p.noFill();
    p.beginShape();

    for ( let sx = 0; sx <= w; sx += step ) {
      const u = sx / w;
      const envelope = Math.sin( u * TAU - ph ) * 0.7;
      const carrier = Math.sin( u * TAU * cfg.frequency * 9 + ph * 4 );
      const yy = cy + ( envelope + carrier * 0.22 ) * amp;

      p.vertex(
        x + sx,
        yy
      );
    }

    p.endShape();
  }

  glowOff( p );
  p.blendMode( p.BLEND );

  // ── sweeping scan line + flyback ──
  const sweep = ( pr * cfg.speed ) % 1;
  const scanX = x + sweep * w;

  glowOn(
    p,
    pal.primary,
    w * 0.02
  );
  stroke(
    p,
    pal.primary,
    220,
    2
  );
  p.line(
    scanX,
    y,
    scanX,
    y + h
  );
  glowOff( p );
  p.noStroke();
  fill(
    p,
    pal.primary,
    255
  );
  p.circle(
    scanX,
    cy,
    w * 0.01
  );

  // ── time ruler along the bottom edge ──
  stroke(
    p,
    pal.frame,
    180,
    1.5
  );
  p.line(
    x,
    y + h,
    x + w,
    y + h
  );

  const majors = 10;

  for ( let i = 0; i <= majors; i++ ) {
    const rx = x + w * i / majors;

    p.line(
      rx,
      y + h,
      rx,
      y + h - h * 0.05
    );

    for ( let s = 1; s < 5 && i < majors; s++ ) {
      const sxr = x + w * ( i + s / 5 ) / majors;

      p.line(
        sxr,
        y + h,
        sxr,
        y + h - h * 0.022
      );
    }

    const val = i - majors / 2;

    mono(
      p,
      ( val > 0 ? "+" : "" ) + val,
      rx,
      y + h - h * 0.075,
      w * 0.017,
      pal.text,
      [
        p.CENTER,
        p.BASELINE
      ],
      190
    );
  }

  p.pop();
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: terrain — perspective wireframe height field + floating point cloud
// ═══════════════════════════════════════════════════════════════════════════════
function drawTerrain(
  p, x, y, w, h, cfg, pal, pr
) {
  const ph = pr * TAU;
  const cols = cfg.cols;
  const rows = cfg.rows;
  const heightPx = h * 0.42 * cfg.height;
  const horizonY = y + h * 0.20;
  const nearY = y + h * 0.99;
  const verts = [];

  for ( let j = 0; j <= rows; j++ ) {
    const depth = j / rows;
    const de = Math.pow(
      depth,
      1.35
    );
    const rowY = nearY + ( horizonY - nearY ) * de;
    const halfW = ( w * 0.5 ) * ( 1 - de * 0.66 );
    const persp = 1 - de * 0.6;
    const row = [];

    for ( let i = 0; i <= cols; i++ ) {
      const xn = i / cols * 2 - 1;
      const hgt = terrainHeight(
        p,
        xn,
        depth,
        ph,
        cfg.detail
      );
      const sx = x + w / 2 + xn * halfW;
      const sy = rowY - hgt * heightPx * persp;

      row.push( {
        sx,
        sy,
        h: hgt,
        de
      } );
    }

    verts.push( row );
  }

  p.push();
  p.noFill();

  // depth rows (constant j) — one continuous shape each, faded by distance
  for ( let j = 0; j <= rows; j++ ) {
    const de = j / rows;
    const a = 40 + ( 1 - de ) * 150;

    stroke(
      p,
      lerp3(
        pal.grid,
        pal.primary,
        1 - de
      ),
      a,
      1
    );
    p.beginShape();

    for ( let i = 0; i <= cols; i++ ) {
      p.vertex(
        verts[ j ][ i ].sx,
        verts[ j ][ i ].sy
      );
    }

    p.endShape();
  }

  // fall lines (constant i) — sparse, for the woven CAD look
  for ( let i = 0; i <= cols; i += 2 ) {
    stroke(
      p,
      pal.grid,
      70,
      1
    );
    p.beginShape();

    for ( let j = 0; j <= rows; j++ ) {
      p.vertex(
        verts[ j ][ i ].sx,
        verts[ j ][ i ].sy
      );
    }

    p.endShape();
  }

  // ── floating point cloud ── peaks above the threshold spawn glowing samples
  if ( cfg.cloud ) {
    p.blendMode( p.ADD );

    for ( let j = 0; j <= rows; j++ ) {
      for ( let i = 0; i <= cols; i++ ) {
        const v = verts[ j ][ i ];

        if ( ( i + j ) % cfg.cloudDensity !== 0 ) {
          continue;
        }

        const hn = ( v.h + 1 ) / 2;

        if ( hn < 0.52 ) {
          continue;
        }

        const col = lerp3(
          pal.cool,
          pal.accent,
          hn
        );
        const sz = ( 1 - v.de ) * w * 0.01 * ( 0.5 + hn );

        glowOn(
          p,
          col,
          w * 0.015
        );
        p.noStroke();
        fill(
          p,
          col,
          90 + hn * 120
        );
        p.circle(
          v.sx,
          v.sy - w * 0.01,
          sz
        );
      }
    }

    glowOff( p );
    p.blendMode( p.BLEND );
  }

  // ── scan-lock reticle at the panel core (the Evangelion "target" glyph) ──
  const rcx = x + w / 2;
  const rcy = y + h * 0.5;
  const rr = w * 0.11;

  p.push();
  p.translate(
    rcx,
    rcy
  );
  p.noFill();
  glowOn(
    p,
    pal.warn,
    w * 0.01
  );
  stroke(
    p,
    pal.warn,
    200,
    1.5
  );
  p.rotate( ph );
  hexagon(
    p,
    0,
    0,
    rr,
    0
  );
  stroke(
    p,
    pal.accent,
    160,
    1
  );
  p.rotate( -ph * 3 );
  hexagon(
    p,
    0,
    0,
    rr * 0.62,
    0
  );

  stroke(
    p,
    pal.warn,
    150,
    1
  );

  for ( let i = 0; i < 6; i++ ) {
    const a = i * TAU / 6;

    p.line(
      Math.cos( a ) * rr * 0.2,
      Math.sin( a ) * rr * 0.2,
      Math.cos( a ) * rr,
      Math.sin( a ) * rr
    );
  }

  glowOff( p );
  p.pop();

  // corner crosshair extents
  stroke(
    p,
    pal.frame,
    120,
    1
  );
  p.line(
    rcx - rr * 1.4,
    rcy,
    rcx - rr * 1.1,
    rcy
  );
  p.line(
    rcx + rr * 1.1,
    rcy,
    rcx + rr * 1.4,
    rcy
  );
  p.line(
    rcx,
    rcy - rr * 1.4,
    rcx,
    rcy - rr * 1.1
  );
  p.line(
    rcx,
    rcy + rr * 1.1,
    rcx,
    rcy + rr * 1.4
  );

  p.pop();
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: segmented readouts — Casio LCD row + segmented bar meter + sparkline
// ═══════════════════════════════════════════════════════════════════════════════
function drawSegments(
  p, x, y, w, h, cfg, pal, pr
) {
  const ph = pr * TAU;

  p.push();

  // big sample counter, top-left of the panel
  const dh = h * 0.42;
  const dw = dh * 0.52;
  const sample = pad(
    pr * cfg.sampleMax,
    5
  );

  mono(
    p,
    "SAMPLE",
    x + w * 0.02,
    y + h * 0.16,
    h * 0.09,
    pal.frame,
    [
      p.LEFT,
      p.BASELINE
    ],
    200
  );
  segmentString(
    p,
    sample,
    x + w * 0.02,
    y + h * 0.24,
    dw,
    dh,
    pal.signal,
    pal.frame
  );

  // clock-style readout, top-right
  const mm = pad(
    ( pr * 3 ) % 1 * 60,
    2
  );
  const ss = pad(
    ( pr * 12 ) % 1 * 60,
    2
  );
  const clockW = w * 0.06;
  const clockH = clockW * 1.9;

  mono(
    p,
    "T-MINUS",
    x + w,
    y + h * 0.16,
    h * 0.09,
    pal.frame,
    [
      p.RIGHT,
      p.BASELINE
    ],
    200
  );
  segmentString(
    p,
    `${ mm }:${ ss }`,
    x + w * 0.62,
    y + h * 0.24,
    clockW,
    clockH,
    pal.warn,
    pal.frame
  );

  // segmented bar meter (bottom band) — a VU-style ladder of lit cells
  const barY = y + h * 0.78;
  const barH = h * 0.16;
  const cells = 40;
  const cellW = w / cells;
  const level = ( Math.sin( ph ) * 0.5 + 0.5 ) * 0.7 + Math.sin( ph * 5 ) * 0.12 + 0.15;

  p.noStroke();

  for ( let i = 0; i < cells; i++ ) {
    const frac = i / cells;
    const lit = frac <= level;
    const col = frac > 0.82 ? pal.warn : frac > 0.6 ? pal.accent : pal.signal;

    if ( lit ) {
      glowOn(
        p,
        col,
        w * 0.008
      );
      fill(
        p,
        col,
        230
      );
    } else {
      glowOff( p );
      fill(
        p,
        pal.grid,
        40
      );
    }

    p.rect(
      x + i * cellW + cellW * 0.12,
      barY,
      cellW * 0.76,
      barH
    );
  }

  glowOff( p );
  mono(
    p,
    `FLUX ${ pad(
      level * 100,
      2
    ) }%`,
    x + w,
    barY - h * 0.03,
    h * 0.085,
    pal.text,
    [
      p.RIGHT,
      p.BASELINE
    ],
    200
  );

  p.pop();
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: footer telemetry
// ═══════════════════════════════════════════════════════════════════════════════
function drawFooter(
  p, pal, pr, W, H
) {
  const m = W * 0.06;
  const size = W * 0.019;
  const baseY = H * 0.948;
  const bars = ( n ) => {
    const lvl = Math.floor( n * 6 );

    return "[" + "#".repeat( lvl ) + "-".repeat( 6 - lvl ) + "]";
  };
  const flux = Math.sin( pr * TAU * 3 ) * 0.5 + 0.5;
  const drift = Math.sin( pr * TAU * 2 + 1 ) * 0.5 + 0.5;
  const leftRows = [
    `SIG ${ bars( flux ) } ${ pad(
      flux * 100,
      2
    ) }%`,
    `LAT ${ ( Math.sin( pr * TAU ) * 47.3 ).toFixed( 3 ) }  LON ${ ( Math.cos( pr * TAU ) * 12.1 ).toFixed( 3 ) }  ALT ${ pad(
      drift * 4200,
      4
    ) }m`
  ];
  const rightRows = [
    `SYNASTAR//DX · FRM ${ pad(
      pr * 300,
      3
    ) }/300`,
    `AT-FIELD NOMINAL · ${ p.width }×${ p.height }`
  ];

  leftRows.forEach( (
    row, i
  ) => {
    mono(
      p,
      row,
      m,
      baseY + i * size * 1.5,
      size,
      pal.text,
      [
        p.LEFT,
        p.BASELINE
      ],
      200
    );
  } );

  rightRows.forEach( (
    row, i
  ) => {
    mono(
      p,
      row,
      p.width - m,
      baseY + i * size * 1.5,
      size,
      pal.frame,
      [
        p.RIGHT,
        p.BASELINE
      ],
      190
    );
  } );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: containment border — marching-ants dashed frame + hazard chevrons
// ═══════════════════════════════════════════════════════════════════════════════
function drawBorder(
  p, cfg, pal, pr, W, H
) {
  const m = W * 0.03;
  const dash = W * 0.02;
  const offset = ( pr * cfg.dashSpeed * dash * 2 ) % ( dash * 2 );

  p.push();
  p.drawingContext.setLineDash( [
    dash,
    dash
  ] );
  p.drawingContext.lineDashOffset = -offset;
  p.noFill();
  glowOn(
    p,
    pal.warn,
    W * 0.006
  );
  stroke(
    p,
    pal.warn,
    170,
    2
  );
  p.rect(
    m,
    m,
    W - m * 2,
    H - m * 2
  );
  glowOff( p );
  p.drawingContext.setLineDash( [] );

  // solid inner keyline
  stroke(
    p,
    pal.frame,
    90,
    1
  );
  p.rect(
    m * 1.6,
    m * 1.6,
    W - m * 3.2,
    H - m * 3.2
  );

  // hazard chevrons pointing inward from three corners — the top-right corner is
  // left to the rotating header emblem so the two never collide
  stroke(
    p,
    pal.accent,
    200,
    2
  );

  const cs = W * 0.022;
  const cm = m * 2.6;

  chevron(
    p,
    cm,
    cm,
    cs,
    Math.PI * 0.25
  );
  chevron(
    p,
    cm,
    H - cm,
    cs,
    -Math.PI * 0.25
  );
  chevron(
    p,
    W - cm,
    H - cm,
    cs,
    -Math.PI * 0.75
  );

  p.pop();
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: CRT overlay — scanlines, rolling refresh band, vignette, sensor specks
// ═══════════════════════════════════════════════════════════════════════════════
function drawOverlay(
  p, cfg, pal, pr, W, H
) {
  p.push();

  // scanlines
  if ( cfg.scanlines ) {
    stroke(
      p,
      [
        0,
        0,
        0
      ],
      70,
      1
    );

    for ( let y = 0; y < H; y += 3 ) {
      p.line(
        0,
        y,
        W,
        y
      );
    }
  }

  // rolling refresh band, travelling down once per loop — a soft-edged glow so
  // it reads as a CRT sweep, not a hard rectangle
  const bandY = ( pr % 1 ) * H;
  const bandH = H * 0.08;
  const bctx = p.drawingContext;
  const bandGrad = bctx.createLinearGradient(
    0,
    bandY - bandH,
    0,
    bandY + bandH
  );

  bandGrad.addColorStop(
    0,
    `rgba( ${ pal.primary[ 0 ] }, ${ pal.primary[ 1 ] }, ${ pal.primary[ 2 ] }, 0 )`
  );
  bandGrad.addColorStop(
    0.5,
    `rgba( ${ pal.primary[ 0 ] }, ${ pal.primary[ 1 ] }, ${ pal.primary[ 2 ] }, 0.05 )`
  );
  bandGrad.addColorStop(
    1,
    `rgba( ${ pal.primary[ 0 ] }, ${ pal.primary[ 1 ] }, ${ pal.primary[ 2 ] }, 0 )`
  );
  bctx.fillStyle = bandGrad;
  bctx.fillRect(
    0,
    bandY - bandH,
    W,
    bandH * 2
  );

  // sensor specks — deterministic flickering noise motes
  if ( cfg.grain > 0 ) {
    const count = Math.floor( 220 * cfg.grain );
    const th = pr * TAU;

    p.noStroke();
    fill(
      p,
      pal.text,
      120
    );

    for ( let i = 0; i < count; i++ ) {
      const nx = p.noise(
        i * 0.37,
        Math.cos( th ) * 0.5 + 10
      );
      const ny = p.noise(
        i * 0.37 + 40,
        Math.sin( th ) * 0.5 + 10
      );

      p.rect(
        nx * W,
        ny * H,
        1.4,
        1.4
      );
    }
  }

  // vignette via a radial gradient — cheap and it seats the console in its bezel
  if ( cfg.vignette ) {
    const ctx = p.drawingContext;
    const g = ctx.createRadialGradient(
      W / 2,
      H / 2,
      H * 0.25,
      W / 2,
      H / 2,
      H * 0.72
    );

    g.addColorStop(
      0,
      "rgba( 0, 0, 0, 0 )"
    );
    g.addColorStop(
      1,
      "rgba( 0, 0, 0, 0.72 )"
    );
    ctx.fillStyle = g;
    ctx.fillRect(
      0,
      0,
      W,
      H
    );
  }

  // global flicker — a barely-there brightness wobble
  if ( cfg.flicker > 0 ) {
    const f = ( Math.sin( pr * TAU * 24 ) * 0.5 + 0.5 ) * cfg.flicker;

    p.noStroke();
    fill(
      p,
      [
        255,
        255,
        255
      ],
      f * 18
    );
    p.rect(
      0,
      0,
      W,
      H
    );
  }

  p.pop();
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════
sketch.setup( () => {
  const p = getP5();

  p.noiseSeed( 7 );
  p.noiseDetail(
    3,
    0.55
  );
} );

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};
  const pr = animation.progression;
  const W = p.width;
  const H = p.height;
  const pal = THEMES[ o.theme ] ?? THEMES.neonGenesis;

  // The backdrop is theme-driven (same source as the panel fills) so switching
  // `theme` recolours the whole terminal coherently.
  const bg = pal.bg;

  p.clear();
  p.background(
    bg[ 0 ],
    bg[ 1 ],
    bg[ 2 ]
  );

  const header = o.header ?? {};
  const osc = o.oscilloscope ?? {};
  const terr = o.terrain ?? {};
  const seg = o.segments ?? {};
  const border = o.border ?? {};
  const overlay = o.overlay ?? {};

  // layout — a vertical stack of instruments inside the containment margin
  const mx = W * 0.06;
  const innerW = W - mx * 2;

  if ( ( border.show ?? true ) ) {
    drawBorder(
      p,
      {
        dashSpeed: border.dashSpeed ?? 6
      },
      pal,
      pr,
      W,
      H
    );
  }

  if ( ( header.show ?? true ) ) {
    drawHeader(
      p,
      {
        company: header.company ?? "SYNASTAR CO.",
        title: header.title ?? "DATA EXTRACTION",
        version: header.version ?? "V.732F7"
      },
      pal,
      pr,
      W
    );
  }

  if ( ( osc.show ?? true ) ) {
    const oy = H * 0.168;
    const oh = H * 0.222;

    panel(
      p,
      mx,
      oy,
      innerW,
      oh,
      pal,
      "OSCILLOSCOPE",
      "CH.A-B"
    );
    drawOscilloscope(
      p,
      mx,
      oy,
      innerW,
      oh,
      {
        traces: Math.round( osc.traces ?? 14 ),
        frequency: osc.frequency ?? 3,
        amplitude: osc.amplitude ?? 1,
        speed: Math.round( osc.speed ?? 2 ),
        carrier: osc.carrier ?? true
      },
      pal,
      pr
    );
  }

  if ( ( terr.show ?? true ) ) {
    const ty = H * 0.435;
    const th = H * 0.288;

    panel(
      p,
      mx,
      ty,
      innerW,
      th,
      pal,
      "TERRAIN SCAN",
      "GRID 47N"
    );
    drawTerrain(
      p,
      mx,
      ty,
      innerW,
      th,
      {
        cols: Math.round( terr.cols ?? 40 ),
        rows: Math.round( terr.rows ?? 24 ),
        height: terr.height ?? 1,
        detail: terr.detail ?? 0.35,
        cloud: terr.cloud ?? true,
        cloudDensity: Math.max(
          1,
          Math.round( terr.cloudDensity ?? 2 )
        )
      },
      pal,
      pr
    );
  }

  if ( ( seg.show ?? true ) ) {
    const sy = H * 0.752;
    const sh = H * 0.128;

    panel(
      p,
      mx,
      sy,
      innerW,
      sh,
      pal,
      "CONTAINMENT GRID",
      "SYS.OK"
    );
    drawSegments(
      p,
      mx,
      sy,
      innerW,
      sh,
      {
        sampleMax: seg.sampleMax ?? 99999
      },
      pal,
      pr
    );
  }

  drawFooter(
    p,
    pal,
    pr,
    W,
    H
  );

  drawOverlay(
    p,
    {
      scanlines: overlay.scanlines ?? true,
      vignette: overlay.vignette ?? true,
      grain: overlay.grain ?? 0.6,
      flicker: overlay.flicker ?? 0.3
    },
    pal,
    pr,
    W,
    H
  );
} );

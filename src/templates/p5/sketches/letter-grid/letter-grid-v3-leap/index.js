import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import easing from "@/p5/utils/easing.js";
import animation from "@/p5/utils/animation.js";
import string from "@/p5/utils/string.js";
import graphics from "@/p5/utils/graphics.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";
import {
  LETTERS,
  clamp,
  cellChar,
  lerpColor,
  wordGlyphs,
  ensurePath,
  resolveReadingPosition
} from "../_grid.js";
import {
  getGlyphGeometry,
  geometryFromContours,
  getMorphSource,
  morphContours,
  drawExtrudedGlyph,
  fillOutline
} from "../_extrude3d.js";

// ─────────────────────────────────────────────────────────────────────────────
// letter-grid v3 — "leap"
//
// A single extruded letter LEAPS in 3D arcs across the grid, hopping from one of
// the word's cells to the next: it springs up along a parabola, tumbles a whole
// turn in the air, and lands flat again in the same orientation on the next cell —
// "des bonds de lettre en lettre". The flat sea of letters from v2 still lies on
// the ground (so it lands ON letters), but only the hero hops.
//
// For this first version the flying glyph is IDENTICAL throughout (the word's
// first letter); morphing it into each letter it lands on is the next step. Reuses
// the shared grid/word-path engine (../_grid.js) and the shared extruded-glyph
// geometry (../_extrude3d.js); everything is a pure function of
// animation.progression → seamless loop, recording-safe (no orbitControl).
// ─────────────────────────────────────────────────────────────────────────────

const CELL = 100;
const FLAT_Y = -0.4;
const SHADOW_Y = -0.8;

const state = {
  scene: null,
  store: {
    key: "",
    path: [],
    alphabet: LETTERS,
    seed: 1
  }
};

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
    `rgba(${ color[ 0 ] }, ${ color[ 1 ] }, ${ color[ 2 ] }, 0)`
  );
  gradient.addColorStop(
    1,
    `rgba(${ color[ 0 ] }, ${ color[ 1 ] }, ${ color[ 2 ] }, ${ clamp(
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

sketch.setup( ( {
  canvas
} ) => {
  state.scene = graphics.createAutoResizableGraphics(
    canvas.width,
    canvas.height,
    "webgl"
  );
  state.scene.pixelDensity( 1 );
} );

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};

  const wordCfg = o.word ?? {};
  const gridCfg = o.grid ?? {};
  const motionCfg = o.motion ?? {};
  const leapCfg = o.leap ?? {};
  const lightCfg = o.light ?? {};
  const shadowCfg = o.shadow ?? {};
  const cameraCfg = o.camera ?? {};
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

  const g = state.scene;

  if ( !g ) {
    return;
  }

  const font = string.fonts[ gridCfg.font ] ?? string.fonts.spaceMonoRegular;

  if ( !font?.font ) {
    return;
  }

  // ── Reading head (shared engine) ──────────────────────────────────────────
  // A small search radius keeps consecutive word cells close, so each leap clears
  // only a few cells and reads as a hop rather than a long flight.
  const radius = Math.max(
    2,
    Math.round( gridCfg.gridRadius ?? 6 )
  );
  const viewRadius = Math.max(
    1.5,
    gridCfg.leapReach ?? 2.6
  );

  ensurePath(
    state.store,
    {
      wordCfg,
      spread: 0,
      viewRadius
    }
  );

  const {
    path,
    alphabet,
    seed
  } = state.store;

  const {
    camCol,
    camRow,
    from,
    to,
    local
  } = resolveReadingPosition( {
    path,
    progression: animation.progression,
    dwell: motionCfg.dwell ?? 0.4,
    easeFn: easing[ motionCfg.easing ] ?? easing.easeInOutCubic
  } );

  const letterScale = clamp(
    gridCfg.letterScale ?? 0.7,
    0.1,
    1.4
  );
  const sampleFactor = gridCfg.sampleFactor ?? 0.18;
  const k = letterScale;

  // ── Colours / light ───────────────────────────────────────────────────────
  const gridColor = colorsCfg.grid ?? [
    90,
    90,
    110,
    255
  ];
  const focusColor = colorsCfg.focus ?? [
    150,
    150,
    175,
    255
  ];
  const focusRadius = Math.max(
    0.3,
    colorsCfg.focusRadius ?? 2
  );
  const focusEase = easing[ colorsCfg.focusEasing ] ?? easing.easeOutQuad;
  const letterColor = colorsCfg.letter ?? [
    235,
    235,
    245,
    255
  ];
  const groundColor = colorsCfg.ground ?? [
    20,
    20,
    28,
    255
  ];

  const el = p.radians( clamp(
    lightCfg.elevation ?? 50,
    5,
    89
  ) );
  const az = p.radians( lightCfg.azimuth ?? 235 );
  const cosEl = Math.cos( el );
  const light = {
    x: cosEl * Math.cos( az ),
    y: Math.max(
      0.06,
      Math.sin( el )
    ),
    z: cosEl * Math.sin( az )
  };
  const lightIntensity = clamp(
    lightCfg.intensity ?? 0.85,
    0,
    1
  );
  const lightColor = lightCfg.color ?? [
    255,
    250,
    240
  ];
  const ambient = clamp(
    lightCfg.ambient ?? 0.45,
    0,
    1
  );

  // ── The leap: height (parabola) + tumble (whole turns) ────────────────────
  const arcHeight = CELL * Math.max(
    0,
    leapCfg.arcHeight ?? 2.6
  );
  const height = arcHeight * Math.sin( Math.PI * local );
  const spins = leapCfg.spins ?? 1;
  const tumbleEase = easing[ leapCfg.tumbleEasing ] ?? easing.easeInOutCubic;
  // Rotation and morph complete by `settle` of the step — still slightly airborne —
  // so the last bit of the descent is flat and the letter lands cleanly in the
  // target's orientation rather than touching down mid-spin.
  const settle = clamp(
    leapCfg.settle ?? 0.85,
    0.3,
    1
  );
  const air = clamp(
    local / settle,
    0,
    1
  );
  const tumble = Math.PI * 2 * spins * tumbleEase( air );
  const morphEase = easing[ leapCfg.morphEasing ] ?? easing.easeInOutCubic;
  const morphT = morphEase( air );
  const extrudeHeight = CELL * Math.max(
    0.02,
    leapCfg.extrudeHeight ?? 0.35
  );
  // The hero is drawn bigger than the terrain letters and given an emissive glow so
  // it stays the clear protagonist (lit faces still shade to show the volume/spin).
  const heroK = k * Math.max(
    0.1,
    leapCfg.heroScale ?? 1.5
  );
  const glow = clamp(
    leapCfg.glow ?? 0.5,
    0,
    1
  );

  // Flip around the horizontal axis perpendicular to the travel direction, so the
  // letter tumbles "forward" over its leap.
  const dCol = ( to?.col ?? 0 ) - ( from?.col ?? 0 );
  const dRow = ( to?.row ?? 0 ) - ( from?.row ?? 0 );
  let axisX = -dRow;
  let axisZ = dCol;
  const axisLen = Math.hypot(
    axisX,
    axisZ
  ) || 1;

  axisX /= axisLen;
  axisZ /= axisLen;

  if ( dCol === 0 && dRow === 0 ) {
    axisX = 1;
    axisZ = 0;
  }

  // The flying glyph STARTS as the letter it leaps from (the cell at the centre)
  // and MORPHS into the letter it lands on, so it spells the word and settles
  // exactly onto each target. (from/to carry the word's letters along the path.)
  const fallbackChar = wordGlyphs( wordCfg.value )[ 0 ] ?? "A";
  const fromChar = from?.char ?? fallbackChar;
  const toChar = to?.char ?? fromChar;
  const flyGeometry = fromChar === toChar
    ? getGlyphGeometry(
      fromChar,
      font,
      sampleFactor
    )
    : geometryFromContours( morphContours(
      getMorphSource(
        fromChar,
        font,
        sampleFactor
      ),
      getMorphSource(
        toChar,
        font,
        sampleFactor
      ),
      morphT
    ) );

  // ── Camera (shared with v2: 3-axis, full 0–360) ───────────────────────────
  const distance = cameraCfg.distance ?? 1300;
  const rotX = p.radians( cameraCfg.rotateX ?? 50 );
  const rotY = p.radians( cameraCfg.rotateY ?? 0 );
  const rotZ = p.radians( cameraCfg.rotateZ ?? 0 );
  const sinX = Math.sin( rotX );
  const cosX = Math.cos( rotX );

  const colC = Math.round( camCol );
  const rowC = Math.round( camRow );

  g.clear();
  g.push();
  g.noStroke();
  g.perspective(
    p.radians( clamp(
      cameraCfg.fov ?? 36,
      10,
      90
    ) ),
    g.width / g.height,
    1,
    200000
  );
  g.camera(
    0,
    -distance * sinX,
    distance * cosX,
    0,
    cameraCfg.lift ?? 0,
    0,
    0,
    -cosX,
    -sinX
  );
  g.scale(
    -1,
    1,
    1
  );
  g.rotateY( rotY );
  g.rotateZ( rotZ );

  // A p5.Graphics doesn't auto-reset its lighting between frames, so last frame's
  // lights would otherwise leak onto the (normal-less, unlit) terrain caps and
  // blow them out. Kill them until the hero needs them.
  g.noLights();

  // ── Ground plane (unlit) ──────────────────────────────────────────────────
  const half = ( radius + 1 ) * CELL;

  g.fill( ...groundColor );
  g.beginShape();
  g.vertex(
    -half,
    0,
    -half
  );
  g.vertex(
    half,
    0,
    -half
  );
  g.vertex(
    half,
    0,
    half
  );
  g.vertex(
    -half,
    0,
    half
  );
  g.endShape( p.CLOSE );

  // ── Flat terrain letters (unlit; immediate fills so each cell keeps its own
  // colour — a cached buildGeometry mesh bakes one colour and ignores fill()) ──
  for ( let col = colC - radius; col <= colC + radius; col++ ) {
    for ( let row = rowC - radius; row <= rowC + radius; row++ ) {
      const dx = col - camCol;
      const dy = row - camRow;
      const dist = Math.sqrt( dx * dx + dy * dy );
      const focus = focusEase( clamp(
        1 - dist / focusRadius,
        0,
        1
      ) );
      const color = lerpColor(
        gridColor,
        focusColor,
        focus
      );

      g.fill( ...color );
      fillOutline(
        g,
        p,
        getGlyphGeometry(
          cellChar(
            col,
            row,
            seed,
            alphabet
          ),
          font,
          sampleFactor
        ),
        k,
        FLAT_Y,
        ( col - camCol ) * CELL,
        ( row - camRow ) * CELL,
        1
      );
    }
  }

  // ── The hero's cast shadow (unlit; footprint shrinks & fades with height) ──
  const shadowOpacity = clamp(
    shadowCfg.opacity ?? 0.5,
    0,
    1
  );

  if ( shadowOpacity > 0 ) {
    const lift = height / arcHeight; // 0 grounded → 1 at apex
    const shadowFill = lerpColor(
      groundColor,
      shadowCfg.color ?? [
        0,
        0,
        0
      ],
      shadowOpacity * ( 1 - 0.55 * lift )
    );
    const shadowScale = 1 - 0.35 * lift;
    const t = height / Math.max(
      0.06,
      light.y
    );

    g.fill( ...shadowFill );
    g.push();
    g.translate(
      0,
      0,
      0
    );
    fillOutline(
      g,
      p,
      flyGeometry,
      heroK,
      SHADOW_Y,
      light.x * t,
      light.z * t,
      shadowScale
    );
    g.pop();
  }

  // ── Lights on for the leaping letter ──────────────────────────────────────
  g.ambientLight( ambient * 255 );
  g.directionalLight(
    lightColor[ 0 ] * lightIntensity,
    lightColor[ 1 ] * lightIntensity,
    lightColor[ 2 ] * lightIntensity,
    light.x,
    light.y,
    light.z
  );

  // ── The leaping letter ────────────────────────────────────────────────────
  g.emissiveMaterial(
    letterColor[ 0 ] * glow,
    letterColor[ 1 ] * glow,
    letterColor[ 2 ] * glow
  );
  g.push();
  g.translate(
    0,
    -height,
    0
  );
  g.rotate(
    tumble,
    [
      axisX,
      0,
      axisZ
    ]
  );
  // Pivot the tumble around the glyph's mid-thickness rather than its base.
  g.translate(
    0,
    extrudeHeight / 2,
    0
  );
  drawExtrudedGlyph(
    g,
    p,
    flyGeometry,
    heroK,
    extrudeHeight,
    letterColor
  );
  g.pop();
  // Clear the emissive so it can't leak onto the next frame's unlit terrain.
  g.emissiveMaterial(
    0,
    0,
    0
  );

  g.pop();

  p.image(
    g,
    0,
    0
  );
  g.reset();

  drawVignette( {
    amount: vignetteCfg.amount ?? 0.55,
    radius: vignetteCfg.radius ?? 0.5,
    softness: vignetteCfg.softness ?? 0.6,
    color: vignetteCfg.color ?? background
  } );

  renderTitle();
} );

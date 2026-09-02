import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import easing from "@/p5/utils/easing.js";
import animation from "@/p5/utils/animation.js";
import string from "@/p5/utils/string.js";
import graphics from "@/p5/utils/graphics.js";
import {
  LETTERS,
  clamp,
  cellChar,
  lerpColor,
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
// letter-grid v4 — "trail"  (the one we actually wanted — a bit like Tron)
//
// The leaping letter of v3 now leaves a CONTINUOUS VOLUMETRIC TRAIL behind it: as
// it springs from one cell to the next, tumbling and morphing into the letter it
// lands on, the swept path of its outline is lofted into a solid 3D ribbon — the
// letter's silhouette dragged through the air, twisting with the tumble and
// morphing along its length from the older letter (tail) to the current one
// (head). The trail glows, fades out over a configurable LIFETIME (so it can
// persist across several letters), and casts a soft shadow on the terrain below.
//
// It is rebuilt every frame as a pure function of animation.progression by
// sampling the head's trajectory BACKWARD in time and reconstructing each past
// state exactly — so it loops seamlessly and is recording-safe (no orbitControl,
// no Date.now/random). Reuses the shared grid/word engine (../_grid.js) and the
// shared extruded-glyph + morph geometry (../_extrude3d.js).
// ─────────────────────────────────────────────────────────────────────────────

const CELL = 100;
const FLAT_Y = -0.4;
const SHADOW_Y = -0.8;
const MAX_SAMPLES = 360;

const state = sketch.state( () => ( {
  scene: null,
  store: {
    key: "",
    path: [],
    alphabet: LETTERS,
    seed: 1
  }
} ) );

// Rotate point (px, py, pz) around the horizontal unit axis (ax, 0, az) by
// `angle` (Rodrigues, specialised to an axis with no Y component). Matches the
// hero's g.rotate(tumble, [axisX, 0, axisZ]) so the trail's cross-sections line
// up exactly with the leaping letter at the head.
function rotAxisXZ(
  px, py, pz, ax, az, angle
) {
  const c = Math.cos( angle );
  const s = Math.sin( angle );
  const dot = ax * px + az * pz;
  const omc = 1 - c;

  return {
    x: px * c + ( -az * py ) * s + ax * dot * omc,
    y: py * c + ( az * px - ax * pz ) * s,
    z: pz * c + ( ax * py ) * s + az * dot * omc
  };
}

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
  const trailCfg = o.trail ?? {};
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
  // A small search radius keeps consecutive word cells close so the trail stays
  // mostly on-screen as it streams between them.
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
  const count = Math.max(
    1,
    path.length
  );

  const dwell = motionCfg.dwell ?? 0.4;
  const easeFn = easing[ motionCfg.easing ] ?? easing.easeInOutCubic;

  const {
    camCol,
    camRow,
    from,
    to,
    local
  } = resolveReadingPosition( {
    path,
    progression: animation.progression,
    dwell,
    easeFn
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

  // ── Leap parameters (shared with v3; reused to reconstruct any past state) ──
  const arcHeight = CELL * Math.max(
    0,
    leapCfg.arcHeight ?? 2.6
  );
  const spins = leapCfg.spins ?? 1;
  const tumbleEase = easing[ leapCfg.tumbleEasing ] ?? easing.easeInOutCubic;
  const settle = clamp(
    leapCfg.settle ?? 0.85,
    0.3,
    1
  );
  const morphEase = easing[ leapCfg.morphEasing ] ?? easing.easeInOutCubic;
  const extrudeHeight = CELL * Math.max(
    0.02,
    leapCfg.extrudeHeight ?? 0.35
  );
  const heroK = k * Math.max(
    0.1,
    leapCfg.heroScale ?? 1.5
  );
  const glow = clamp(
    leapCfg.glow ?? 0.5,
    0,
    1
  );

  // The full leap state of the head at any loop progression — position (eased
  // reading head), arc height, tumble + its axis, and the morphed outer outline.
  // Pure, so sampling it at progression − age reconstructs exactly where the head
  // WAS that far back in time.
  function sampleHead( prog ) {
    const rp = resolveReadingPosition( {
      path,
      progression: prog,
      dwell,
      easeFn
    } );

    if ( !rp.from || !rp.to ) {
      return null;
    }

    const localS = rp.local;
    const heightS = arcHeight * Math.sin( Math.PI * localS );
    const airS = clamp(
      localS / settle,
      0,
      1
    );
    const tumbleS = Math.PI * 2 * spins * tumbleEase( airS );
    const morphTS = morphEase( airS );

    let axisX = -( rp.to.row - rp.from.row );
    let axisZ = rp.to.col - rp.from.col;
    const axisLen = Math.hypot(
      axisX,
      axisZ
    ) || 1;

    axisX /= axisLen;
    axisZ /= axisLen;

    if ( rp.to.row === rp.from.row && rp.to.col === rp.from.col ) {
      axisX = 1;
      axisZ = 0;
    }

    const outer = morphContours(
      getMorphSource(
        rp.from.char,
        font,
        sampleFactor
      ),
      getMorphSource(
        rp.to.char,
        font,
        sampleFactor
      ),
      morphTS
    )[ 0 ];

    return {
      index: rp.index,
      gridCol: rp.camCol,
      gridRow: rp.camRow,
      height: heightS,
      tumble: tumbleS,
      axisX,
      axisZ,
      outer
    };
  }

  // ── The trail: sample the trajectory backward over `lifetime` steps ─────────
  const lifetimeSteps = Math.max(
    0,
    trailCfg.lifetime ?? 1.8
  );
  const lifetimeProg = lifetimeSteps / count;
  const samplesPerStep = Math.max(
    4,
    Math.round( trailCfg.samples ?? 22 )
  );
  const totalSamples = clamp(
    Math.round( lifetimeSteps * samplesPerStep ),
    2,
    MAX_SAMPLES
  );
  const fadeEase = easing[ trailCfg.fadeEasing ] ?? easing.easeInQuad;
  const trailOpacity = clamp(
    trailCfg.opacity ?? 0.85,
    0,
    1
  );
  const trailGlow = clamp(
    trailCfg.glow ?? 0.5,
    0,
    1
  );
  const taper = clamp(
    trailCfg.taper ?? 0.3,
    0,
    1
  );
  const trailColor = trailCfg.color ?? letterColor;
  // Glow shifts the ribbon toward white so it stays vivid as it thins/fades.
  const trailLit = lerpColor(
    trailColor,
    [
      255,
      255,
      255,
      255
    ],
    trailGlow * 0.3
  );

  const now = animation.progression;
  const builtSamples = [];

  for ( let i = 0; i < totalSamples; i++ ) {
    const age = totalSamples > 1
      ? ( lifetimeProg * i ) / ( totalSamples - 1 )
      : 0;
    let prog = now - age;

    prog = ( ( prog % 1 ) + 1 ) % 1;

    const s = sampleHead( prog );

    if ( !s ) {
      continue;
    }

    const ageFrac = lifetimeProg > 0 ? clamp(
      age / lifetimeProg,
      0,
      1
    ) : 0;
    const fade = fadeEase( ageFrac );
    const ptScale = heroK * Math.max(
      0.0001,
      1 - taper * fade
    );
    const offX = ( s.gridCol - camCol ) * CELL;
    const offZ = ( s.gridRow - camRow ) * CELL;
    const n = s.outer.length;
    const ring3D = new Array( n );
    let cx = 0;
    let cy = 0;
    let cz = 0;

    for ( let j = 0; j < n; j++ ) {
      const r = rotAxisXZ(
        s.outer[ j ].x * ptScale,
        0,
        s.outer[ j ].y * ptScale,
        s.axisX,
        s.axisZ,
        s.tumble
      );
      const wx = r.x + offX;
      const wy = r.y - s.height;
      const wz = r.z + offZ;

      ring3D[ j ] = {
        x: wx,
        y: wy,
        z: wz
      };
      cx += wx;
      cy += wy;
      cz += wz;
    }

    builtSamples.push( {
      index: s.index,
      ring3D,
      centroid: {
        x: cx / n,
        y: cy / n,
        z: cz / n
      },
      height: s.height,
      fade
    } );
  }

  // The flying glyph at the head, for the solid leaping letter (full outline with
  // holes — crisper than the fixed-count morph rings used for the loft).
  const fromChar = from?.char ?? "A";
  const toChar = to?.char ?? fromChar;
  const airHead = clamp(
    local / settle,
    0,
    1
  );
  const heroGeometry = fromChar === toChar
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
      morphEase( airHead )
    ) );
  const heroHeight = arcHeight * Math.sin( Math.PI * local );
  const heroTumble = Math.PI * 2 * spins * tumbleEase( airHead );

  let heroAxisX = -( ( to?.row ?? 0 ) - ( from?.row ?? 0 ) );
  let heroAxisZ = ( to?.col ?? 0 ) - ( from?.col ?? 0 );
  const heroAxisLen = Math.hypot(
    heroAxisX,
    heroAxisZ
  ) || 1;

  heroAxisX /= heroAxisLen;
  heroAxisZ /= heroAxisLen;

  if ( heroAxisLen <= 1e-6 ) {
    heroAxisX = 1;
    heroAxisZ = 0;
  }

  // ── Camera (shared with v2/v3: 3-axis, full 0–360) ────────────────────────
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

  // A p5.Graphics doesn't auto-reset lighting between frames, so kill it until the
  // lit geometry (trail + hero) needs it — otherwise it leaks onto the unlit
  // terrain caps and blows them out.
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

  // ── Trail shadow on the terrain (unlit; each cross-section projected toward
  // the light onto the ground, faded by age and lift — overlapping fills build a
  // clean dark swath under the denser parts of the trail) ───────────────────
  const shadowOpacity = clamp(
    shadowCfg.opacity ?? 0.45,
    0,
    1
  );
  const shadowColor = shadowCfg.color ?? [
    0,
    0,
    0
  ];

  if ( shadowOpacity > 0 ) {
    g.drawingContext.depthMask( false );

    for ( const smp of builtSamples ) {
      const liftFrac = clamp(
        smp.height / Math.max(
          1,
          arcHeight
        ),
        0,
        1
      );
      const a = shadowOpacity * ( 1 - smp.fade ) * ( 1 - 0.5 * liftFrac );

      if ( a <= 0.003 ) {
        continue;
      }

      g.fill(
        shadowColor[ 0 ],
        shadowColor[ 1 ],
        shadowColor[ 2 ],
        a * 255
      );
      g.beginShape( p.TESS );

      for ( const pt of smp.ring3D ) {
        const t = Math.max(
          0,
          -pt.y
        ) / Math.max(
          0.06,
          light.y
        );

        g.vertex(
          pt.x + light.x * t,
          SHADOW_Y,
          pt.z + light.z * t
        );
      }

      g.endShape( p.CLOSE );
    }

    g.drawingContext.depthMask( true );
  }

  // ── Lights on for the trail + the leaping letter ──────────────────────────
  g.ambientLight( ambient * 255 );
  g.directionalLight(
    lightColor[ 0 ] * lightIntensity,
    lightColor[ 1 ] * lightIntensity,
    lightColor[ 2 ] * lightIntensity,
    light.x,
    light.y,
    light.z
  );

  // ── The swept trail tube (lit, translucent). Loft each pair of consecutive
  // cross-sections into a wall; per-vertex radial normals shade it; depth-writes
  // off so overlapping translucent ribs don't fight. Skip the bridge across a
  // segment boundary (where the tumble/axis would jump). ────────────────────
  if ( trailOpacity > 0 && builtSamples.length > 1 ) {
    g.ambientMaterial(
      trailLit[ 0 ],
      trailLit[ 1 ],
      trailLit[ 2 ]
    );
    g.drawingContext.depthMask( false );

    for ( let s = 0; s < builtSamples.length - 1; s++ ) {
      const A = builtSamples[ s ];
      const B = builtSamples[ s + 1 ];

      if ( A.index !== B.index ) {
        continue;
      }

      const a = trailOpacity * ( 1 - A.fade );

      if ( a <= 0.003 ) {
        continue;
      }

      const ra = A.ring3D;
      const rb = B.ring3D;
      const ca = A.centroid;
      const cb = B.centroid;
      const n = ra.length;

      g.fill(
        trailLit[ 0 ],
        trailLit[ 1 ],
        trailLit[ 2 ],
        a * 255
      );
      g.beginShape( p.TRIANGLES );

      for ( let j = 0; j < n; j++ ) {
        const j2 = ( j + 1 ) % n;
        const p0 = ra[ j ];
        const p1 = ra[ j2 ];
        const p2 = rb[ j2 ];
        const p3 = rb[ j ];

        emitTrailVertex(
          g,
          p0,
          ca
        );
        emitTrailVertex(
          g,
          p1,
          ca
        );
        emitTrailVertex(
          g,
          p2,
          cb
        );

        emitTrailVertex(
          g,
          p0,
          ca
        );
        emitTrailVertex(
          g,
          p2,
          cb
        );
        emitTrailVertex(
          g,
          p3,
          cb
        );
      }

      g.endShape();
    }

    g.drawingContext.depthMask( true );
  }

  // ── The leaping letter at the head (solid, lit, glowing) ──────────────────
  g.emissiveMaterial(
    letterColor[ 0 ] * glow,
    letterColor[ 1 ] * glow,
    letterColor[ 2 ] * glow
  );
  g.push();
  g.translate(
    0,
    -heroHeight,
    0
  );
  g.rotate(
    heroTumble,
    [
      heroAxisX,
      0,
      heroAxisZ
    ]
  );
  g.translate(
    0,
    extrudeHeight / 2,
    0
  );
  drawExtrudedGlyph(
    g,
    p,
    heroGeometry,
    heroK,
    extrudeHeight,
    letterColor
  );
  g.pop();
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
} );

// Emit one trail vertex with an outward (radial-from-centroid) normal so the
// directional light shades the swept tube.
function emitTrailVertex(
  g, pt, centroid
) {
  const nx = pt.x - centroid.x;
  const ny = pt.y - centroid.y;
  const nz = pt.z - centroid.z;
  const len = Math.hypot(
    nx,
    ny,
    nz
  ) || 1;

  g.normal(
    nx / len,
    ny / len,
    nz / len
  );
  g.vertex(
    pt.x,
    pt.y,
    pt.z
  );
}

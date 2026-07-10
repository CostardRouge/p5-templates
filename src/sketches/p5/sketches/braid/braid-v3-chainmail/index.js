import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import createNoiseFieldRenderer from "@/p5/utils/noiseFieldGpu.js";
import {
  BRAID_UNIFORMS_GLSL,
  IRIDESCENT_GLSL,
  BRAID_CAMERA_MAIN_GLSL,
  braidShadingGlsl,
  lightDirFrom,
  focalFromFov
} from "@/p5/utils/braidShader.js";

// ─────────────────────────────────────────────────────────────────────────────
// braid v3 — chainmail.
//
// The braid family's armoury: a European-4-in-1 maille sheet being assembled
// forever. Rings sit on a half-offset row lattice, every row tilted the
// opposite way to its neighbours, so each ring interlocks with four others —
// the classic mail weave. The sheet scrolls upward while new rows materialise
// at the assembly front below.
//
// ── No overlap, by construction (the family cheat, episode 3) ────────────────
// Rigid closed rings can never intersect here because every clearance is
// enforced before the shader runs:
//
//   • same-row rings are coplanar, so their spacing is floored at
//     2·ringR + 2.3·wireR — as curves they can't touch;
//   • rows two apart share a tilt, so their ring planes are parallel and
//     separated — clearance grows with tilt;
//   • the linked diagonals (the actual 4-in-1 interlocks) are checked
//     NUMERICALLY on the CPU: the neighbouring ring centre-circles are
//     sampled, the minimum wire-to-wire distance measured, and the row tilt
//     auto-raised until every pair clears 2.3·wireR. Cached per option set.
//
// ── Emergence: rings that condense, not rings that fly in ────────────────────
// A closed ring physically CANNOT join a woven sheet — it would have to pass
// through its neighbours (that's why real maillers thread rings open). Any
// fly-in animation would therefore clip. Instead, a new row's rings grow their
// WIRE GAUGE from zero in their final, already-interlocked position: the
// centre curve never moves, so the growing ring is collision-free by
// construction at every instant — it condenses into the weave.
//
// Because rings are rigid (nothing deforms with height), the union of exact
// torus SDFs is itself exact: no Lipschitz divisor, a fast clean march.
//
// ── Loop safety ──────────────────────────────────────────────────────────────
// The lattice repeats every 2 rows (tilt parity + the half-column offset), so
// the sheet scrolls a whole EVEN number of rows per loop; ring hues depend
// only on column index and row parity. Frame at uT = TAU == frame at uT = 0.
//
// Orientation reuses the family's vector2d → screen-roll (uRoll).
// ─────────────────────────────────────────────────────────────────────────────

const MAX_STEPS = 96; // exact SDF — converges fast

const FRAGMENT = `
  ${ BRAID_UNIFORMS_GLSL }

  // ── Maille lattice ──
  uniform float uRingR;     // ring (torus major) radius
  uniform float uWireR;     // wire gauge (torus minor radius)
  uniform float uTilt;      // row tilt (CPU auto-raised for clearance)
  uniform float uDx;        // column pitch (CPU-floored: coplanar clearance)
  uniform float uDy;        // row pitch
  uniform float uScrollVel; // sheet scroll per uT radian (even rows/loop)
  uniform float uFrontY;    // assembly-front height (world y)
  uniform float uGrowSpan;  // rows over which a new ring reaches full gauge

  ${ IRIDESCENT_GLSL }

  // Distance to one ring: a torus tilted ±uTilt around the x axis.
  float ringDist(vec3 q, float tiltSign, float rr) {
    float c = cos(uTilt);
    float s = sin(uTilt) * tiltSign;
    vec3 lp = vec3(q.x, c * q.y + s * q.z, -s * q.y + c * q.z);

    return length(vec2(length(lp.xy) - uRingR, lp.z)) - rr;
  }

  // Wire gauge of a row: 0 below the front, condensing to full over uGrowSpan
  // rows above it. The centre curve is fixed, so growth is collision-free.
  float rowGauge(float rowY) {
    return uWireR * smoothstep(0.0, 1.0, (rowY - uFrontY) / (uDy * uGrowSpan));
  }

  float mapScene(vec3 p) {
    float scrollY = uT * uScrollVel;
    float jBase = floor((p.y - scrollY) / uDy + 0.5);
    float best = 1e9;

    for (int dj = -2; dj <= 2; dj++) {
      float j = jBase + float(dj);
      float rowY = j * uDy + scrollY;
      float rr = rowGauge(rowY);

      if (rr < 0.004) { continue; }

      float parity = mod(j, 2.0);
      float tiltSign = 1.0 - 2.0 * parity;
      float xoff = parity * 0.5 * uDx;
      float iBase = floor((p.x - xoff) / uDx + 0.5);

      for (int di = -1; di <= 1; di++) {
        vec3 c = vec3((iBase + float(di)) * uDx + xoff, rowY, 0.0);

        best = min(best, ringDist(p - c, tiltSign, rr));
      }
    }

    return best;
  }

  // Ring identity for the palette: hue cycles along columns, offset by row
  // parity — both loop-stable under the even-row scroll.
  float nearestPipe(vec3 p) {
    float scrollY = uT * uScrollVel;
    float jBase = floor((p.y - scrollY) / uDy + 0.5);
    float best = 1e9;
    float bestK = 0.0;

    for (int dj = -2; dj <= 2; dj++) {
      float j = jBase + float(dj);
      float rowY = j * uDy + scrollY;
      float rr = rowGauge(rowY);

      if (rr < 0.004) { continue; }

      float parity = mod(j, 2.0);
      float tiltSign = 1.0 - 2.0 * parity;
      float xoff = parity * 0.5 * uDx;
      float iBase = floor((p.x - xoff) / uDx + 0.5);

      for (int di = -1; di <= 1; di++) {
        float i = iBase + float(di);
        vec3 c = vec3(i * uDx + xoff, rowY, 0.0);
        float d = ringDist(p - c, tiltSign, rr);

        if (d < best) { best = d; bestK = mod(i, 4.0) + parity * 4.0; }
      }
    }

    return bestK;
  }

  ${ braidShadingGlsl( {
    maxSteps: MAX_STEPS
  } ) }

  ${ BRAID_CAMERA_MAIN_GLSL }
`;

const mailleRenderer = createNoiseFieldRenderer( FRAGMENT );

// ── Numeric clearance check (CPU) ────────────────────────────────────────────
// Sample the centre circles of a ring and its three distinct neighbour types
// (linked diagonal, far diagonal, parallel two-rows-up), measure the minimum
// centre-to-centre distance, and raise the tilt until every wire pair clears
// 2.3× the gauge. Runs only when the relevant options change.

function circlePoints(
  cx, cy, tiltSign, ringR, tilt, count
) {
  const points = [];

  for ( let n = 0; n < count; n++ ) {
    const t = ( n / count ) * Math.PI * 2;

    points.push( [
      cx + ringR * Math.cos( t ),
      cy + ringR * Math.sin( t ) * Math.cos( tilt ),
      tiltSign * ringR * Math.sin( t ) * Math.sin( tilt )
    ] );
  }

  return points;
}

function minPairDistance(
  a, b
) {
  let min = Infinity;

  for ( const p of a ) {
    for ( const q of b ) {
      const dx = p[ 0 ] - q[ 0 ];
      const dy = p[ 1 ] - q[ 1 ];
      const dz = p[ 2 ] - q[ 2 ];
      const d = dx * dx + dy * dy + dz * dz;

      if ( d < min ) {
        min = d;
      }
    }
  }

  return Math.sqrt( min );
}

const clearanceCache = new Map();

function clearedTilt(
  ringR, wireR, dx, dy, baseTilt
) {
  const key = [
    ringR,
    wireR,
    dx,
    dy,
    baseTilt
  ].join( "|" );

  if ( clearanceCache.has( key ) ) {
    return clearanceCache.get( key );
  }

  const samples = 40;
  const needed = 2.3 * wireR;

  let tilt = baseTilt;

  for ( let step = 0; step < 60; step++ ) {
    const self = circlePoints(
      0,
      0,
      1,
      ringR,
      tilt,
      samples
    );
    const neighbours = [
      circlePoints(
        dx / 2,
        dy,
        -1,
        ringR,
        tilt,
        samples
      ),
      circlePoints(
        3 * dx / 2,
        dy,
        -1,
        ringR,
        tilt,
        samples
      ),
      circlePoints(
        0,
        2 * dy,
        1,
        ringR,
        tilt,
        samples
      )
    ];
    const clearance = Math.min( ...neighbours.map( ( n ) => minPairDistance(
      self,
      n
    ) ) );

    if ( clearance >= needed || tilt >= 1.25 ) {
      break;
    }

    tilt += 0.02;
  }

  clearanceCache.set(
    key,
    tilt
  );

  return tilt;
}

sketch.setup(
  () => {},
  {}
);

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};
  const maille = o.chainmail ?? {};
  const front = o.front ?? {};
  const camera = o.camera ?? {};
  const colors = o.colors ?? {};
  const light = o.light ?? {};
  const aberration = o.aberration ?? {};
  const rendering = o.rendering ?? {};

  p.clear();
  p.background( ...( o.backgroundColor ?? [
    0,
    0,
    0
  ] ) );

  const timeScale = o.timeScale ?? 1;
  const t = animation.angle;

  // The lattice repeats every 2 rows, so the scroll snaps to whole EVEN rows.
  const scrollRows = 2 * Math.round( ( ( maille.scrollRows ?? 2 ) * timeScale ) / 2 );

  const hueSpread = colors.hueSpread ?? 2;
  const hueCycles = Math.round( ( colors.hueSpeed ?? 0 ) * timeScale * p.TAU * hueSpread );

  const ringR = maille.ringRadius ?? 0.5;
  const wireR = Math.min(
    maille.wireRadius ?? 0.07,
    ringR * 0.3
  );

  // Coplanar same-row rings: floor the column pitch so the curves can't touch.
  const dx = 2 * ringR + 2.3 * wireR + ( maille.columnGap ?? 0.02 );
  const dy = ringR * Math.max(
    maille.rowSpacing ?? 0.55,
    0.5
  );

  // Auto-raise the tilt until the interlocked neighbours clear the gauge.
  const tilt = clearedTilt(
    ringR,
    wireR,
    dx,
    dy,
    maille.tilt ?? 0.55
  );

  const frontY = front.height ?? -1.6;
  const growSpan = Math.max(
    front.growSpan ?? 1.5,
    0.25
  );

  const fov = camera.fov ?? 55;
  const focal = focalFromFov( fov );
  const camDist = camera.distance ?? 7;

  const orientation = o.orientation ?? {};
  const ox = orientation.x ?? 0;
  const oy = orientation.y ?? 1;
  const roll = Math.hypot(
    ox,
    oy
  ) > 1e-3
    ? Math.atan2(
      oy,
      ox
    ) - Math.PI / 2
    : 0;

  const lightDir = lightDirFrom(
    light.azimuth ?? -1.1,
    light.elevation ?? 0.5
  );

  mailleRenderer.render( {
    columns: 1,
    rows: 1,
    resolutionScale: rendering.resolutionScale ?? 0.75,
    uniforms: {
      uT: t,
      uRingR: ringR,
      uWireR: wireR,
      uTilt: tilt,
      uDx: dx,
      uDy: dy,
      uScrollVel: ( scrollRows * dy ) / p.TAU,
      uFrontY: frontY,
      uGrowSpan: growSpan,
      uCamDist: camDist,
      uFocal: focal,
      uPitch: camera.pitch ?? 0.5,
      uYaw: camera.yaw ?? 0.3,
      uRoll: roll,
      uHueSpeed: hueSpread ? hueCycles / ( p.TAU * hueSpread ) : 0,
      uHueSpread: hueSpread,
      uHuePhase: colors.huePhase ?? 2.6,
      uLengthHueShift: colors.lengthHueShift ?? -0.15,
      uPipeHueShift: colors.pipeHueShift ?? 0.35,
      uShimmer: colors.shimmer ?? 1.6,
      uSaturation: colors.saturation ?? 0.6,
      uBrightness: colors.brightness ?? 1.25,
      uLightDir: lightDir,
      uAmbient: light.ambient ?? 0.28,
      uDiffuse: light.diffuse ?? 0.85,
      uSpecular: light.specular ?? 1.3,
      uSpecPower: light.specPower ?? 56,
      uFresnelPower: light.fresnelPower ?? 3,
      uRimStrength: light.rimStrength ?? 0.7,
      uShadowSoft: light.shadowSoftness ?? 24,
      uFogDensity: camera.fogDensity ?? 0.14,
      uFogStart: camDist,
      uMaxDist: camDist + 10,
      uAberration: aberration.amount ?? 2,
      uAberrationMode: {
        int: ( aberration.mode ?? "radial" ) === "horizontal" ? 1 : 0
      }
    }
  } );
} );

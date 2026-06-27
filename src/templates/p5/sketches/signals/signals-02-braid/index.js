import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import createNoiseFieldRenderer from "@/p5/utils/noiseFieldGpu.js";
import drawInstrument from "../_instrument.js";

// ─────────────────────────────────────────────────────────────────────────────
// SIGNALS — 02 / BRAID
//
// The serpent's sibling: a bundle of solid pipes that wind helically around a
// shared vertical axis and rotate around one another — a twisted rope / DNA
// braid — rendered as a real 3D SDF raymarch (lifted verbatim from
// flowers-shaders v2 — pipes, which is proven in the app). Here it is dressed in
// the SIGNALS identity: pure black, the same structural instrument frame, and a
// *low-saturation* oil-slick palette so the thin-film colour reads sophisticated
// on a city screen rather than as a full rainbow.
//
// Loop safety (Demo Festival = a seamless 10 s / 250-frame / 25 fps loop): with a
// fixed camera, the whole frame is a function of the rotation phase uT·spin and
// the pulse phase uT·pulseSpeed. Driving uT from animation.angle (0 → TAU) with
// integer spin / pulseSpeed and a *spatial-only* hue (hueSpeed = 0, colour
// attached to geometry) makes the image at uT = 0 identical to uT = TAU.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_PIPES = 12; // matches the "pipes" slider max
const MAX_STEPS = 96; // sphere-trace iterations per ray
const SURF_EPS = 0.001; // hit threshold (world units)

const FRAGMENT = `
  const float SURF_EPS = ${ SURF_EPS.toFixed( 4 ) }; // hit threshold (world units)

  uniform float uT;

  // ── Braid geometry ──
  uniform float uPipeCount;
  uniform float uPipeRadius;
  uniform float uBraidRadius;
  uniform float uTwist;
  uniform float uSpin;
  uniform float uRadiusPulse;
  uniform float uPulseFreq;
  uniform float uPulseSpeed;
  uniform float uTwistLipschitz;

  // ── Camera ──
  uniform float uCamDist;
  uniform float uFocal;
  uniform float uPitch;
  uniform float uYaw;

  // ── Iridescent palette ──
  uniform float uHueSpeed;
  uniform float uHueSpread;
  uniform float uHuePhase;
  uniform float uLengthHueShift;
  uniform float uPipeHueShift;
  uniform float uShimmer;
  uniform float uSaturation;
  uniform float uBrightness;

  // ── Lighting ──
  uniform vec3  uLightDir;
  uniform float uAmbient;
  uniform float uDiffuse;
  uniform float uSpecular;
  uniform float uSpecPower;
  uniform float uFresnelPower;
  uniform float uRimStrength;
  uniform float uFogDensity;
  uniform float uFogStart;
  uniform float uMaxDist;

  // ── Chromatic aberration ──
  uniform float uAberration;
  uniform int   uAberrationMode;

  vec3 iridescent(float t) {
    vec3 spectrum = 0.5 + 0.5 * cos(
      TAU * (uHueSpread * t + vec3(0.0, 0.33, 0.67)) + uHuePhase
    );

    float luma = dot(spectrum, vec3(0.299, 0.587, 0.114));

    return clamp(mix(vec3(luma), spectrum, uSaturation) * uBrightness, 0.0, 1.0);
  }

  float braidRadiusAt(float y) {
    return uBraidRadius * (1.0 + uRadiusPulse * sin(y * uPulseFreq + uT * uPulseSpeed));
  }

  float mapScene(vec3 p) {
    float phi = p.y * uTwist + uT * uSpin;
    float c = cos(phi);
    float s = sin(phi);
    vec2  q = vec2(c * p.x - s * p.z, s * p.x + c * p.z);

    float br = braidRadiusAt(p.y);
    float best = 1e9;

    for (int k = 0; k < ${ MAX_PIPES }; k++) {
      if (float(k) >= uPipeCount) { break; }

      float a = TAU * float(k) / uPipeCount;
      vec2  centre = br * vec2(cos(a), sin(a));
      float d = length(q - centre) - uPipeRadius;

      best = min(best, d);
    }

    return best / uTwistLipschitz;
  }

  float nearestPipe(vec3 p) {
    float phi = p.y * uTwist + uT * uSpin;
    float c = cos(phi);
    float s = sin(phi);
    vec2  q = vec2(c * p.x - s * p.z, s * p.x + c * p.z);

    float br = braidRadiusAt(p.y);
    float best = 1e9;
    float bestK = 0.0;

    for (int k = 0; k < ${ MAX_PIPES }; k++) {
      if (float(k) >= uPipeCount) { break; }

      float a = TAU * float(k) / uPipeCount;
      vec2  centre = br * vec2(cos(a), sin(a));
      float d = length(q - centre);

      if (d < best) { best = d; bestK = float(k); }
    }

    return bestK;
  }

  vec3 calcNormal(vec3 p) {
    vec2 k = vec2(1.0, -1.0);
    float e = SURF_EPS;

    return normalize(
      k.xyy * mapScene(p + k.xyy * e) +
      k.yyx * mapScene(p + k.yyx * e) +
      k.yxy * mapScene(p + k.yxy * e) +
      k.xxx * mapScene(p + k.xxx * e)
    );
  }

  float calcAO(vec3 p, vec3 n) {
    float occ = 0.0;
    float sca = 1.0;

    for (int i = 0; i < 4; i++) {
      float h = 0.02 + 0.10 * float(i);
      float d = mapScene(p + n * h);

      occ += (h - d) * sca;
      sca *= 0.6;
    }

    return clamp(1.0 - 2.5 * occ, 0.0, 1.0);
  }

  vec3 shade(vec3 pos, vec3 n, vec3 rd) {
    float k = nearestPipe(pos);

    float fres = pow(1.0 - clamp(dot(n, -rd), 0.0, 1.0), uFresnelPower);

    float phase = pos.y * uLengthHueShift
      + uT * uHueSpeed
      + k * uPipeHueShift;

    vec3 base = iridescent(phase + uShimmer * fres);

    float diff = max(dot(n, uLightDir), 0.0);
    vec3  hlf = normalize(uLightDir - rd);
    float spec = pow(max(dot(n, hlf), 0.0), uSpecPower) * uSpecular;
    float ao = calcAO(pos, n);

    vec3 col = base * (uAmbient + uDiffuse * diff * ao);
    col += base * fres * uRimStrength;
    col += vec3(spec) * ao;

    return col;
  }

  vec4 traceRay(vec3 ro, vec3 rd) {
    float t = 0.0;
    bool  hit = false;

    for (int i = 0; i < ${ MAX_STEPS }; i++) {
      vec3  pos = ro + rd * t;
      float d = mapScene(pos);

      if (d < SURF_EPS) { hit = true; break; }

      t += d;

      if (t > uMaxDist) { break; }
    }

    if (!hit) { return vec4(0.0); }

    vec3 pos = ro + rd * t;
    vec3 n = calcNormal(pos);
    vec3 col = shade(pos, n, rd);

    float fog = exp(-uFogDensity * max(0.0, t - uFogStart));

    return vec4(col, fog);
  }

  void main() {
    vec2 frag = vec2(vUv.x * uResolution.x, vUv.y * uResolution.y);
    vec2 uv = (frag - 0.5 * uResolution) / uResolution.y;

    float cp = cos(uPitch);
    float sp = sin(uPitch);
    float cy = cos(uYaw);
    float sy = sin(uYaw);

    vec3 ro = uCamDist * vec3(cp * sy, sp, -cp * cy);
    vec3 fwd = normalize(-ro);
    vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), fwd));
    vec3 up = cross(fwd, right);

    if (uAberration < 0.5) {
      vec3 rd = normalize(fwd * uFocal + right * uv.x + up * uv.y);
      gl_FragColor = traceRay(ro, rd);
      return;
    }

    vec2 dir = uAberrationMode == 1
      ? vec2(1.0, 0.0)
      : normalize(uv + vec2(1e-4));
    vec2 off = dir * (uAberration / uResolution.y);

    vec3 rdR = normalize(fwd * uFocal + right * (uv.x + off.x) + up * (uv.y + off.y));
    vec3 rdG = normalize(fwd * uFocal + right * uv.x + up * uv.y);
    vec3 rdB = normalize(fwd * uFocal + right * (uv.x - off.x) + up * (uv.y - off.y));

    vec4 cr = traceRay(ro, rdR);
    vec4 cg = traceRay(ro, rdG);
    vec4 cb = traceRay(ro, rdB);

    gl_FragColor = vec4(cr.r, cg.g, cb.b, max(cr.a, max(cg.a, cb.a)));
  }
`;

const braidRenderer = createNoiseFieldRenderer( FRAGMENT );

sketch.setup(
  () => {},
  {}
);

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};
  const braid = o.braid ?? {};
  const camera = o.camera ?? {};
  const colors = o.colors ?? {};
  const light = o.light ?? {};
  const aberration = o.aberration ?? {};

  p.clear();
  p.background( ...( o.backgroundColor ?? [
    0,
    0,
    0,
    255
  ] ) );

  // Seamless loop: drive uT over exactly one TAU per loop. timeScale must stay an
  // integer so the rotation/pulse phases close at the recording boundary.
  const timeScale = o.timeScale ?? 1;
  const t = animation.angle * timeScale;

  const pipeCount = Math.min(
    braid.pipeCount ?? 3,
    MAX_PIPES
  );
  const pipeRadius = braid.pipeRadius ?? 0.13;
  const braidRadius = braid.braidRadius ?? 0.58;
  const twist = braid.twist ?? 4.0;
  const radiusPulse = braid.radiusPulse ?? 0.16;
  const pulseFreq = braid.pulseFreq ?? 0.8;

  const maxR = braidRadius * ( 1 + radiusPulse ) + pipeRadius;
  const pulseSlope = braidRadius * radiusPulse * pulseFreq;
  const twistLipschitz = Math.sqrt( 1 + ( maxR * twist + pulseSlope ) ** 2 ) * 1.1;

  const fov = camera.fov ?? 40;
  const focal = 1 / Math.tan( ( fov * Math.PI ) / 180 / 2 );
  const camDist = camera.distance ?? 13;
  const pitch = camera.pitch ?? 0.06;

  const az = light.azimuth ?? -0.6;
  const el = light.elevation ?? 0.8;
  const lightDir = [
    Math.cos( el ) * Math.sin( az ),
    Math.sin( el ),
    -Math.cos( el ) * Math.cos( az )
  ];

  braidRenderer.render( {
    columns: 1,
    rows: 1,
    uniforms: {
      uT: t,
      uPipeCount: pipeCount,
      uPipeRadius: pipeRadius,
      uBraidRadius: braidRadius,
      uTwist: twist,
      uSpin: braid.spin ?? 1,
      uRadiusPulse: radiusPulse,
      uPulseFreq: pulseFreq,
      uPulseSpeed: braid.pulseSpeed ?? 1,
      uTwistLipschitz: twistLipschitz,
      uCamDist: camDist,
      uFocal: focal,
      uPitch: pitch,
      uYaw: ( camera.yaw ?? 0.5 ) + t * ( camera.orbitSpeed ?? 0 ),
      uHueSpeed: colors.hueSpeed ?? 0,
      uHueSpread: colors.hueSpread ?? 1.4,
      uHuePhase: colors.huePhase ?? 0,
      uLengthHueShift: colors.lengthHueShift ?? 0.25,
      uPipeHueShift: colors.pipeHueShift ?? 0.33,
      uShimmer: colors.shimmer ?? 0.4,
      uSaturation: colors.saturation ?? 0.3,
      uBrightness: colors.brightness ?? 1.1,
      uLightDir: lightDir,
      uAmbient: light.ambient ?? 0.18,
      uDiffuse: light.diffuse ?? 0.9,
      uSpecular: light.specular ?? 0.5,
      uSpecPower: light.specPower ?? 40,
      uFresnelPower: light.fresnelPower ?? 2.5,
      uRimStrength: light.rimStrength ?? 0.5,
      uFogDensity: camera.fogDensity ?? 0.1,
      uFogStart: camDist,
      uMaxDist: camDist + 10,
      uAberration: aberration.amount ?? 0,
      uAberrationMode: {
        int: ( aberration.mode ?? "radial" ) === "horizontal" ? 1 : 0
      }
    }
  } );

  // ── structural instrument frame ─────────────────────────────────────────────
  if ( o.hud?.show ?? true ) {
    // The braid fills a central vertical column. Project its on-screen half-width
    // from the orbit radius (+ pipe) through the pinhole camera, swelling with the
    // radius pulse, and lock the reticle on a point that winds with the spin near
    // the top of the column — so the instrument reads as bolted to the geometry.
    const cx = p.width / 2;
    // On-screen half-width of the braid envelope: an object at perpendicular
    // radius R and depth ≈ camDist projects to uv = focal·R/camDist (uv is
    // normalised by canvas height), so px = uv·height. cos(pitch) trims the tilt.
    const projScale = ( focal / camDist ) * Math.cos( pitch );
    const pulse = 1 + radiusPulse * Math.sin( t * ( braid.pulseSpeed ?? 1 ) );
    const halfW = ( braidRadius * pulse + pipeRadius ) * projScale * p.height;
    const halfH = p.height * ( 0.5 - ( o.hud?.verticalMargin ?? 0.1 ) );

    const topY = p.height * ( o.hud?.verticalMargin ?? 0.1 );
    const headPhi = t * ( braid.spin ?? 1 );
    const headX = cx + Math.sin( headPhi ) * halfW * 0.85;
    const headY = topY + ( p.height - 2 * topY ) * 0.12;

    drawInstrument(
      p,
      {
        box: {
          minX: cx - halfW,
          minY: p.height / 2 - halfH,
          maxX: cx + halfW,
          maxY: p.height / 2 + halfH
        },
        head: {
          x: headX,
          y: headY
        },
        hudColor: o.hud?.color ?? [
          180,
          230,
          210
        ],
        label: o.hud?.label ?? "SIGNALS",
        spec: "SPEC.02 / BRAID",
        rows: [
          `PIPES ${ pipeCount.toFixed( 0 ) }`,
          `TWIST ${ twist.toFixed( 2 ) }`,
          `SPIN  ${ ( braid.spin ?? 1 ).toFixed( 2 ) }`,
          `PHASE ${ String( Math.round( ( animation.progression * 360 ) % 360 ) ).padStart(
            3,
            "0"
          ) }°`
        ]
      }
    );
  }
} );

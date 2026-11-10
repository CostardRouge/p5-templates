import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import createSpikeMeshRenderer from "@/p5/utils/spikeMeshGpu.js";
import {
  easingId
} from "@/p5/utils/easingGlsl.js";

import {
  resolveLook,
  materialRender,
  renderingSettings,
  drawBackground,
  wobbleRotation
} from "../_iridescence.js";

import {
  formValues as defaults
} from "./options";

// ─────────────────────────────────────────────────────────────────────────────
// iridescent-v7-peaks-shell
//
// The peaks family on a seashell. A shell is one curve and one number: a
// spiral whose every measure — its distance from the axis, its drop along it,
// the width of the tube that follows it — is multiplied by the same factor at
// every turn (the growth), so each whorl is the previous one, larger. The
// needles obey the same law: hairs at the apex, long spines at the mouth.
//
// They stand on the OUTER side of the tube only (the inner side lies against
// the previous whorl), and their length is gathered into ridges a whole
// number of times per turn, which lines the long spines up from whorl to
// whorl the way a murex grows its combs.
//
// The shell is an open curve, so nothing travels along it: what moves is a
// wave of length and a wave of sway running from the apex to the mouth, a
// whole number of cycles per loop, and the shell's own turn.
// ─────────────────────────────────────────────────────────────────────────────

const SPIKE_BODY = `
  uniform float uColumns;
  uniform float uRows;

  uniform float uShellTurns;
  uniform float uShellGrowth;     // ln of the size ratio, mouth / apex
  uniform float uShellRadius;     // the spiral's radius at the mouth
  uniform float uShellHeight;     // apex to mouth, along the axis
  uniform float uShellTube;       // the tube's radius at the mouth
  uniform float uBodyScale;

  uniform float uCoverage;        // share of the tube's circumference with spikes
  uniform float uAim;             // where that arc is centred, in turns from outwards
  uniform float uSelfSimilar;     // 0 = every spike the same size, 1 = scaled like the shell

  uniform float uSpikeLenMin;
  uniform float uSpikeLenMax;
  uniform float uRidges;          // per turn
  uniform float uRidgeAmount;
  uniform float uRidgeSharpness;

  uniform float uLean;            // radians, towards the mouth
  uniform float uSway;
  uniform float uSwayWaves;
  uniform float uSwayPhase;
  uniform float uWave;
  uniform float uWaveCount;
  uniform float uWavePhase;

  uniform float uSurfNoiseScale;
  uniform vec3  uSurfOffset;
  uniform float uSurfContrast;
  uniform int   uSurfContrastEaseId;
  uniform float uSize;

  // The shell's scale at s (0 = apex, 1 = mouth): 1 at the mouth.
  float shellScale(float s) {
    return exp(uShellGrowth * (s - 1.0));
  }

  // The axis is y, apex up (p5's y points down).
  vec3 shellCurve(float s) {
    float w = shellScale(s);
    float a = TAU * uShellTurns * s;

    return vec3(uShellRadius * w * cos(a), uShellHeight * (w - 0.5), uShellRadius * w * sin(a));
  }

  void shellFrame(float s, out vec3 centre, out vec3 tangent, out vec3 n1, out vec3 n2) {
    float a = TAU * uShellTurns * s;

    centre  = shellCurve(s);
    tangent = normalize(shellCurve(s + 0.0005) - shellCurve(s - 0.0005));

    // Outwards from the axis, squared up against the curve.
    vec3 outward = vec3(cos(a), 0.0, sin(a));

    n1 = normalize(outward - tangent * dot(outward, tangent));
    n2 = cross(tangent, n1);
  }

  float terrain(vec3 point) {
    float n = perlinNoise(point / max(uSize, 1.0) * uSurfNoiseScale + uSurfOffset);
    float shaped = mapEase(n, 0.0, 1.0, 0.0, uSurfContrast, uSurfContrastEaseId);

    return uSurfContrast > 0.0 ? shaped / uSurfContrast : 1.0;
  }

  void computeSpike(
    float col, float row,
    out vec3 base, out vec3 dir, out float len, out float radiusMul, out float extra, out float visible
  ) {
    float s = (col + 0.5) / uColumns;
    float rowNorm = uRows > 1.5 ? row / (uRows - 1.0) : 0.5;
    float phi = TAU * ((rowNorm - 0.5) * uCoverage + uAim);
    float w = shellScale(s);
    float size = mix(1.0, w, uSelfSimilar);

    vec3 centre;
    vec3 tangent;
    vec3 n1;
    vec3 n2;

    shellFrame(s, centre, tangent, n1, n2);

    vec3 across = n1 * cos(phi) + n2 * sin(phi);
    float tilt = uLean + uSway * sin(TAU * (uSwayWaves * s - uSwayPhase));

    // Ridges: the spines gather a whole number of times per turn, so they
    // line up from one whorl to the next.
    float ridge = pow(0.5 + 0.5 * cos(TAU * uRidges * uShellTurns * s), uRidgeSharpness);

    base      = centre + across * uShellTube * w;
    dir       = normalize(across * cos(tilt) + tangent * sin(tilt));
    extra     = terrain(base);
    len       = mix(uSpikeLenMin, uSpikeLenMax, extra) * size
      * mix(1.0 - uRidgeAmount, 1.0, ridge)
      * (1.0 + uWave * sin(TAU * (uWaveCount * s - uWavePhase)));
    radiusMul = size;
    visible   = 1.0;
  }

  // The tube: t runs from the apex to the mouth, a around it.
  vec4 bodyPoint(float t, float a) {
    vec3 centre;
    vec3 tangent;
    vec3 n1;
    vec3 n2;

    shellFrame(t, centre, tangent, n1, n2);

    float phi = a * TAU;
    vec3 point = centre + (n1 * cos(phi) + n2 * sin(phi)) * uShellTube * shellScale(t) * uBodyScale;

    return vec4(point, terrain(point));
  }
`;

const renderer = createSpikeMeshRenderer( {
  spikeBody: SPIKE_BODY
} );

const radians = ( degrees ) => degrees * Math.PI / 180;

sketch.setup(
  () => {},
  {}
);

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};

  p.clear();

  const look = resolveLook(
    o.material,
    o.background
  );

  drawBackground(
    p,
    look.background
  );

  const shell = {
    ...defaults.shell,
    ...o.shell
  };
  const peaks = {
    ...defaults.peaks,
    ...o.peaks,
    point: {
      ...defaults.peaks.point,
      ...o.peaks?.point
    }
  };
  const surface = {
    ...defaults.surface,
    ...o.surface
  };
  const motion = {
    ...defaults.motion,
    ...o.motion
  };
  const body = {
    ...defaults.body,
    ...o.body
  };
  const noise = {
    ...defaults.noise,
    ...o.noise
  };

  const phase = animation.progression;
  const angle = animation.angle;

  const columns = Math.max(
    1,
    Math.round( shell.columns )
  );
  const rows = Math.max(
    1,
    Math.round( shell.rows )
  );

  // Twice the reach, so the material's position axes read 0..1 from the
  // apex to the mouth without wrapping.
  const size = 2 * ( Math.max(
    shell.radius,
    shell.height * 0.5
  ) + shell.tubeRadius + peaks.spikeLengthMax );

  const rendering = renderingSettings(
    o.rendering,
    {
      spikeRings: 32,
      spikeSegments: 16,
      bodyRings: 220,
      bodySegments: 28
    }
  );

  const material = materialRender(
    look.material,
    look.background,
    {
      scale: size,
      axis: "y",
      pixelScale: rendering.supersample
    }
  );

  const drift = surface.animated ? surface.drift : 0;

  renderer.render( {
    rotation: wobbleRotation(
      p,
      o.rotation,
      defaults.rotation
    ),
    // The mouth's tube hangs below the curve's last point: lift the shell by
    // half of it so it sits centred.
    translate: [
      0,
      -shell.tubeRadius * 0.5,
      0
    ],
    grid: {
      cols: columns,
      rows
    },
    ...rendering,
    body: body.enabled,
    seed: noise.seed,
    octaves: noise.detail,
    falloff: noise.falloff,
    profile: {
      lengthEasing: easingId( peaks.depthEasing ),
      radiusMin: peaks.point.strokeWeightMin,
      radiusMax: peaks.point.strokeWeightMax,
      radiusEasing: easingId( peaks.point.strokeWeightEasing )
    },
    ramp: material.ramp,
    shade: material.shade,
    uniforms: {
      ...material.uniforms,
      uColumns: columns,
      uRows: rows,
      uShellTurns: shell.turns,
      uShellGrowth: shell.growth,
      uShellRadius: shell.radius,
      uShellHeight: shell.height,
      uShellTube: shell.tubeRadius,
      uBodyScale: body.scale,
      uCoverage: shell.coverage,
      uAim: shell.aim,
      uSelfSimilar: shell.selfSimilar,
      uSpikeLenMin: peaks.spikeLengthMin,
      uSpikeLenMax: peaks.spikeLengthMax,
      uRidges: Math.round( shell.ridges ),
      uRidgeAmount: shell.ridgeAmount,
      uRidgeSharpness: Math.max(
        shell.ridgeSharpness,
        0.01
      ),
      uLean: radians( motion.lean ),
      uSway: radians( motion.sway ),
      uSwayWaves: motion.swayWaves,
      uSwayPhase: Math.round( motion.swaySpeed ) * phase,
      uWave: motion.wave,
      uWaveCount: motion.waveCount,
      uWavePhase: Math.round( motion.waveSpeed ) * phase,
      uSurfNoiseScale: surface.noiseScale,
      // p5's Perlin mirrors negative inputs: keep the samples positive.
      uSurfOffset: [
        surface.noiseOffset + 20 + drift * Math.cos( angle ),
        20 + drift * Math.sin( angle ),
        20
      ],
      uSurfContrast: surface.contrast,
      uSurfContrastEaseId: easingId( surface.contrastEasing ),
      uSize: size * 0.5
    }
  } );
} );

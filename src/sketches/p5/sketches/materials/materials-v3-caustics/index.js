import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import createNoiseFieldRenderer from "@/p5/utils/noiseFieldGpu.js";

import {
  formValues as defaults
} from "./options";

// ─────────────────────────────────────────────────────────────────────────────
// materials-v3-caustics
//
// A shallow pool seen from straight above: a tiled floor bent by the ripples
// that cross the surface, and on it the net of light those same ripples cast.
//
// The net is not painted, it is computed. A ripple is a lens: where the
// surface curves, it gathers the sunlight that crosses it or spreads it out.
// Follow a small square of light from the surface to the floor and its area
// is multiplied by det( I + depth × H ), H being the surface's second
// derivatives; the light on the floor is the inverse of that — and where the
// determinant falls to zero the square has collapsed to a line, which is a
// caustic. The surface is a sum of sines, so H comes in closed form with the
// height and the slope, in one pass over the ripples.
//
// Three things make it read as water rather than as a pattern: the floor is
// seen THROUGH the same surface (its tiles are displaced by the slope above
// them), red, green and blue focus at slightly different depths (the fringes
// of colour along the bright lines), and the sun glints off the ripples
// that happen to face it.
//
// Each ripple turns a whole number of times per loop, so the pool at phase 1
// is the pool at phase 0.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_RIPPLES = 40;

const FRAGMENT = `
  uniform float uPhase;

  // ── Ripples ──
  uniform float uRippleCount;
  uniform float uRippleScale;     // waves across the canvas height, the longest
  uniform float uRippleGrowth;    // each next ripple this much finer
  uniform float uRippleGain;      // … and this much lower
  uniform float uRippleSpeed;     // turns per loop of the longest
  uniform float uRippleSeed;

  // ── Light ──
  uniform float uFocus;           // depth × refraction: how hard the surface lenses
  uniform float uSoftness;
  uniform float uDispersion;
  uniform float uSunlight;
  uniform float uAmbient;
  uniform float uContrast;
  uniform vec3  uGlintDir;        // the half vector the glints answer to
  uniform float uGlintPower;
  uniform float uGlintSharpness;
  uniform float uSlope;           // how steep the surface is, for the glints

  // ── Pool ──
  uniform float uRefraction;      // how far the slope displaces the floor
  uniform vec3  uTint;
  uniform float uTintAmount;
  uniform float uTileSize;
  uniform float uGrout;
  uniform vec3  uTileColor;
  uniform vec3  uAccentColor;
  uniform float uAccentShare;
  uniform vec3  uGroutColor;
  uniform float uVariation;

  // ── Frame ──
  uniform float uZoom;
  uniform vec2  uTurn;            // (cos, sin) of the camera's rotation
  uniform float uVignette;
  uniform float uExposure;

  float hash21(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);

    p3 += dot(p3, p3.yzx + 33.33);

    return fract((p3.x + p3.y) * p3.z);
  }

  // The surface at a point, in one pass over the ripples: its slope, its
  // second derivatives (xx, yy, xy), and how far a ray is carried sideways
  // per unit of focus (the slope, on the curvature's scale).
  void surface(vec2 x, out vec2 slope, out vec3 curve, out vec2 carry) {
    float freq = TAU * uRippleScale;
    float amp = 1.0;
    float slopePower = 0.0;
    float curvePower = 0.0;

    slope = vec2(0.0);
    curve = vec3(0.0);

    for (int i = 0; i < ${ MAX_RIPPLES }; i++) {
      if (float(i) >= uRippleCount) { break; }

      float fi = float(i);
      // The golden angle spreads the directions evenly, however many there are.
      float angle = fi * 2.399963 + uRippleSeed;
      vec2 k = freq * vec2(cos(angle), sin(angle));
      // Short ripples run faster, as on real water; always a whole number of
      // turns per loop.
      float turns = max(1.0, floor(uRippleSpeed * sqrt(freq / (TAU * uRippleScale)) + 0.5));
      float theta = dot(k, x) + TAU * turns * uPhase + fi * 1.7 + uRippleSeed * 3.1;
      float s = sin(theta);
      float c = cos(theta);

      slope += amp * c * k;
      curve -= amp * s * vec3(k.x * k.x, k.y * k.y, k.x * k.y);
      slopePower += amp * amp * freq * freq;
      curvePower += amp * amp * freq * freq * freq * freq;

      freq *= uRippleGrowth;
      amp *= uRippleGain;
    }

    // Each is brought to its own typical size (the root of the summed
    // powers: phases are as good as random), so the focus, the refraction
    // and the steepness mean the same whatever the count, growth and gain.
    float curveNorm = inversesqrt(max(curvePower, 1e-12));

    carry = slope * curveNorm;
    slope *= inversesqrt(max(slopePower, 1e-12));
    curve *= curveNorm;
  }

  // Light on the floor under a patch of surface: the inverse of how much the
  // patch's image has grown or shrunk.
  float gathered(vec3 curve, float focus) {
    float det = (1.0 + focus * curve.x) * (1.0 + focus * curve.y) - focus * focus * curve.z * curve.z;

    return 1.0 / (abs(det) + uSoftness);
  }

  vec3 floorColor(vec2 q, float pixel) {
    vec2 g = q / uTileSize;
    vec2 id = floor(g);
    vec2 f = fract(g);
    float edge = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)) * uTileSize;
    float grout = 1.0 - smoothstep(uGrout * 0.5 - pixel, uGrout * 0.5 + pixel, edge);

    float shade = 1.0 + uVariation * (hash21(id) - 0.5) * 2.0;
    float accent = step(1.0 - uAccentShare, hash21(id + 17.31));
    vec3 tile = mix(uTileColor, uAccentColor, accent) * shade;

    return mix(tile, uGroutColor, grout);
  }

  vec3 develop(vec3 light) {
    vec3 x = light * uExposure;
    vec3 mapped = clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);

    return pow(mapped, vec3(1.0 / 2.2));
  }

  void main() {
    vec2 uv = (vUv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);
    vec2 p = vec2(uTurn.x * uv.x - uTurn.y * uv.y, uTurn.y * uv.x + uTurn.x * uv.y) * uZoom;
    float pixel = 1.5 * uZoom / uResolution.y;

    // What the eye sees: the floor, displaced by the slope it is seen through.
    vec2 slopeHere;
    vec3 curveHere;
    vec2 carryHere;

    surface(p, slopeHere, curveHere, carryHere);

    vec2 q = p + uRefraction * slopeHere;

    // What lights that point of the floor: the patch of surface the sun's
    // ray came through, found by stepping back along the slope once.
    vec2 slopeFloor;
    vec3 curveFloor;
    vec2 carryFloor;

    surface(q, slopeFloor, curveFloor, carryFloor);

    vec2 slopeSource;
    vec3 curveSource;
    vec2 carrySource;

    surface(q - uFocus * carryFloor, slopeSource, curveSource, carrySource);

    // Red, green and blue bend by slightly different amounts.
    vec3 caustic = vec3(
      gathered(curveSource, uFocus * (1.0 - uDispersion)),
      gathered(curveSource, uFocus),
      gathered(curveSource, uFocus * (1.0 + uDispersion))
    );

    caustic = pow(caustic, vec3(uContrast));

    vec3 albedo = floorColor(q, pixel);
    vec3 light = albedo * (uAmbient + uSunlight * caustic);

    // The water's own colour, taken from everything seen through it.
    light *= mix(vec3(1.0), uTint, uTintAmount);

    // The sun off the ripples that face it.
    vec3 normal = normalize(vec3(-slopeHere * uSlope, 1.0));
    float glint = pow(max(dot(normal, uGlintDir), 0.0), uGlintSharpness);

    // Only the core of each highlight: a sparkle, not a sheen.
    glint = smoothstep(0.45, 0.9, glint);

    light += vec3(uGlintPower * glint);

    float fall = dot(uv, uv);

    light *= 1.0 - uVignette * fall;

    gl_FragColor = vec4(develop(light), 1.0);
  }
`;

const renderer = createNoiseFieldRenderer( FRAGMENT );

const radians = ( degrees ) => degrees * Math.PI / 180;

// A screen colour as light.
const linear = ( color ) => [
  0,
  1,
  2
].map( ( channel ) => Math.pow(
  ( color?.[ channel ] ?? 0 ) / 255,
  2.2
) );

sketch.setup(
  () => {},
  {}
);

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};

  p.clear();

  const ripples = {
    ...defaults.ripples,
    ...o.ripples
  };
  const light = {
    ...defaults.light,
    ...o.light
  };
  const pool = {
    ...defaults.pool,
    ...o.pool
  };
  const frame = {
    ...defaults.frame,
    ...o.frame
  };
  const quality = {
    ...defaults.quality,
    ...o.quality
  };

  const phase = animation.progression;
  const angle = animation.angle;

  // The camera breathes and turns a little: whole cycles, like the ripples.
  const cycles = Math.round( frame.driftCycles );
  const turn = radians( frame.rotation ) + radians( frame.sway ) * Math.sin( angle * cycles );
  const zoom = frame.zoom * ( 1 + frame.breath * Math.sin( angle * cycles + 1.3 ) );

  // The glints answer to the half vector between the sun and the eye, which
  // looks straight down.
  const sunTilt = radians( light.sunTilt );
  const sunTurn = radians( light.sunDirection );
  const sun = [
    Math.sin( sunTilt ) * Math.cos( sunTurn ),
    Math.sin( sunTilt ) * Math.sin( sunTurn ),
    Math.cos( sunTilt )
  ];
  const half = [
    sun[ 0 ],
    sun[ 1 ],
    sun[ 2 ] + 1
  ];
  const halfLength = Math.hypot( ...half );

  renderer.render( {
    columns: 1,
    rows: 1,
    resolutionScale: quality.renderScale,
    uniforms: {
      uPhase: phase,
      uRippleCount: Math.max(
        1,
        Math.min(
          MAX_RIPPLES,
          Math.round( ripples.detail )
        )
      ),
      uRippleScale: ripples.scale,
      uRippleGrowth: ripples.growth,
      uRippleGain: ripples.gain,
      uRippleSpeed: Math.max(
        1,
        Math.round( ripples.speed )
      ),
      uRippleSeed: ripples.seed,
      uFocus: light.focus,
      uSoftness: Math.max(
        light.softness,
        1e-3
      ),
      uDispersion: light.dispersion,
      uSunlight: light.sunlight,
      uAmbient: light.ambient,
      uContrast: light.contrast,
      uGlintDir: half.map( ( v ) => v / halfLength ),
      uGlintPower: light.glints,
      uGlintSharpness: light.glintSharpness,
      uSlope: light.steepness,
      uRefraction: pool.refraction,
      uTint: linear( pool.tint ),
      uTintAmount: pool.tintAmount,
      uTileSize: Math.max(
        pool.tileSize,
        1e-3
      ),
      uGrout: pool.grout,
      uTileColor: linear( pool.tileColor ),
      uAccentColor: linear( pool.accentColor ),
      uAccentShare: pool.accentShare,
      uGroutColor: linear( pool.groutColor ),
      uVariation: pool.variation,
      uZoom: zoom,
      uTurn: [
        Math.cos( turn ),
        Math.sin( turn )
      ],
      uVignette: frame.vignette,
      uExposure: frame.exposure
    }
  } );
} );

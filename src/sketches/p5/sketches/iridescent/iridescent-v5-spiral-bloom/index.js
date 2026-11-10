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
// iridescent-v5-spiral-bloom
//
// A flower built the way a sunflower or a dahlia packs itself: petal i sits at
// i × the golden angle around the axis, and further from the centre the larger
// i is, so the petals fall into the crossing spiral arms of a phyllotaxis.
// From the centre outwards they grow longer and wider and lean from upright to
// laid back, each one a flattened, cupped, curled blade rather than a round
// spike — `spikeShape` is the hook spikeMeshGpu.js offers for exactly that.
//
// Everything that moves is a whole number of cycles of the loop phase: the
// bloom closes and reopens as a wave running from the heart to the rim, the
// divergence angle breathes (a fraction of a degree winds the arms visibly),
// a ripple of length travels along the spiral, and the flower turns on its
// own axis. The colour is the category's ramp, staggered along the petal
// index by default so the hue itself draws the spiral.
// ─────────────────────────────────────────────────────────────────────────────

const SPIKE_BODY = `
  uniform float uCount;
  uniform float uDivergence;    // radians between two successive petals
  uniform float uTwist;         // the flower's own turn, radians
  uniform float uSwirl;         // extra angle from heart to rim, radians

  uniform float uDomeRadius;
  uniform float uSpread;        // polar angle the outermost petal sits at
  uniform float uPacking;       // exponent on the index fraction
  uniform float uElongation;    // stretches the receptacle along the axis
  uniform float uBodyScale;

  uniform vec2  uOpen;          // lean from the axis (inner, outer), radians
  uniform int   uOpenEaseId;
  uniform float uBloomAmount;   // how far the petals fold back to the axis
  uniform float uBloomPhase;    // bloom cycles elapsed
  uniform float uBloomLag;      // cycles of delay between heart and rim
  uniform float uBloomCurl;     // extra cupping while folded, radians

  uniform vec2  uLength;        // (inner, outer), px
  uniform int   uGrowEaseId;
  uniform vec2  uWidth;         // radius multiplier (inner, outer)
  uniform vec2  uCurl;          // bend over the petal's length (inner, outer), radians
  uniform float uThickness;     // blade thickness / width
  uniform float uPinch;
  uniform float uCup;

  uniform float uRipple;        // length ripple amplitude
  uniform float uRippleWaves;
  uniform float uRipplePhase;

  uniform float uVariation;     // Perlin length variation
  uniform float uNoiseScale;
  uniform vec2  uNoiseLoop;     // a point on a circle: the noise closes with the loop

  float petalFraction(float col) {
    return (col + 0.5) / max(uCount, 1.0);
  }

  float petalAngle(float col, float f) {
    return col * uDivergence + uTwist + uSwirl * f;
  }

  // 0 = folded onto the axis, 1 = fully open; a wave from the heart outwards.
  float bloomState(float f) {
    return 0.5 - 0.5 * cos(TAU * (uBloomPhase - uBloomLag * f));
  }

  vec3 receptacle(float theta, float phi) {
    return uDomeRadius * vec3(sin(phi) * cos(theta), sin(phi) * sin(theta), cos(phi) * uElongation);
  }

  void computeSpike(
    float col, float row,
    out vec3 base, out vec3 dir, out float len, out float radiusMul, out float extra, out float visible
  ) {
    float f     = petalFraction(col);
    float theta = petalAngle(col, f);
    float phi   = uSpread * pow(f, uPacking);

    float open  = 1.0 - uBloomAmount * (1.0 - bloomState(f));
    float lean  = mapEase(f, 0.0, 1.0, uOpen.x, uOpen.y, uOpenEaseId) * open;

    float grown = mapEase(f, 0.0, 1.0, 0.0, 1.0, uGrowEaseId);
    float noise = perlinNoise(vec3(col * uNoiseScale + uNoiseLoop.x, uNoiseLoop.y, 0.0));
    float wave  = sin(TAU * (uRippleWaves * f - uRipplePhase));
    float vary  = (1.0 - uVariation * noise) * (1.0 + uRipple * wave);

    visible   = 1.0;
    base      = receptacle(theta, phi);
    dir       = vec3(sin(lean) * cos(theta), sin(lean) * sin(theta), cos(lean));
    len       = mix(uLength.x, uLength.y, grown) * vary;
    radiusMul = mix(uWidth.x, uWidth.y, grown);
    extra     = clamp(vary / (1.0 + uRipple), 0.0, 1.0);
  }

  // The blade: its wide axis runs around the flower, so the flat face looks at
  // the axis; a positive curl bends the petal towards the axis (a cup), a
  // negative one lays it back.
  void spikeShape(float col, float row, vec3 dir, out vec3 side, out vec4 form) {
    float f     = petalFraction(col);
    float theta = petalAngle(col, f);
    float grown = mapEase(f, 0.0, 1.0, 0.0, 1.0, uGrowEaseId);
    float shut  = uBloomAmount * (1.0 - bloomState(f));

    side = vec3(-sin(theta), cos(theta), 0.0);
    form = vec4(uThickness, mix(uCurl.x, uCurl.y, grown) + uBloomCurl * shut, uPinch, uCup);
  }

  vec4 bodyPoint(float t, float a) {
    return vec4(receptacle(a * TAU, t * PI) * uBodyScale, 0.0);
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

  const spiral = {
    ...defaults.spiral,
    ...o.spiral
  };
  const receptacle = {
    ...defaults.receptacle,
    ...o.receptacle
  };
  const petals = {
    ...defaults.petals,
    ...o.petals
  };
  const bloom = {
    ...defaults.bloom,
    ...o.bloom
  };
  const ripple = {
    ...defaults.ripple,
    ...o.ripple
  };
  const noise = {
    ...defaults.noise,
    ...o.noise
  };
  const rotationOptions = {
    ...defaults.rotation,
    ...o.rotation
  };

  // Every clock below is a whole number of cycles of the loop phase.
  const phase = animation.progression;
  const angle = animation.angle;
  const breath = radians( spiral.breath ) * Math.sin( angle * Math.round( spiral.breathCycles ) );

  const rendering = renderingSettings(
    o.rendering,
    {
      spikeRings: 40,
      spikeSegments: 20
    }
  );

  const lengthOuter = petals.lengthOuter;
  const material = materialRender(
    look.material,
    look.background,
    {
      scale: receptacle.radius + Math.max(
        petals.lengthInner,
        lengthOuter
      ),
      axis: "z",
      pixelScale: rendering.supersample
    }
  );

  const rotation = wobbleRotation(
    p,
    rotationOptions,
    defaults.rotation
  );

  rotation.x += radians( rotationOptions.tilt );

  renderer.render( {
    rotation,
    grid: {
      cols: spiral.count,
      rows: 1
    },
    ...rendering,
    body: receptacle.body,
    seed: noise.seed,
    octaves: noise.detail,
    falloff: noise.falloff,
    profile: {
      lengthEasing: easingId( petals.taperEasing ),
      radiusMin: petals.tip,
      radiusMax: petals.width,
      radiusEasing: easingId( petals.widthEasing )
    },
    ramp: material.ramp,
    shade: material.shade,
    uniforms: {
      ...material.uniforms,
      uCount: Math.round( spiral.count ),
      uDivergence: radians( spiral.divergence ) + breath,
      uTwist: Math.round( spiral.turns ) * angle,
      uSwirl: radians( spiral.swirl ),
      uDomeRadius: receptacle.radius,
      uSpread: radians( receptacle.spread ),
      uPacking: receptacle.packing,
      uElongation: receptacle.elongation,
      uBodyScale: receptacle.bodyScale,
      uOpen: [
        radians( petals.leanInner ),
        radians( petals.leanOuter )
      ],
      uOpenEaseId: easingId( petals.leanEasing ),
      uBloomAmount: bloom.amount,
      uBloomPhase: Math.round( bloom.cycles ) * phase,
      uBloomLag: bloom.lag,
      uBloomCurl: bloom.curl,
      uLength: [
        petals.lengthInner,
        lengthOuter
      ],
      uGrowEaseId: easingId( petals.growEasing ),
      uWidth: [
        petals.widthInner,
        1
      ],
      uCurl: [
        petals.curlInner,
        petals.curlOuter
      ],
      uThickness: petals.thickness,
      uPinch: petals.pinch,
      uCup: petals.cup,
      uRipple: ripple.amount,
      uRippleWaves: ripple.waves,
      uRipplePhase: Math.round( ripple.speed ) * phase,
      uVariation: noise.variation,
      uNoiseScale: noise.scale,
      uNoiseLoop: noise.animated
        ? [
          noise.drift * Math.cos( angle ),
          noise.drift * Math.sin( angle )
        ]
        : [
          0,
          0
        ]
    }
  } );
} );

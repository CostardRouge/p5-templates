import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import createNoiseFieldRenderer from "@/p5/utils/noiseFieldGpu.js";

// ─────────────────────────────────────────────────────────────────────────────
// GPU port of the "noise grid with rotation" sketch.
//
// The original drew a grid of coloured dots one by one on the CPU, sampling
// p5's Perlin noise per cell every frame and building string cache keys that
// never repeated (the scene angle changes each frame), so the cache grew
// without bound. Here the whole field is drawn in a single full-screen
// fragment shader (see utils/noiseFieldGpu.js): each pixel finds the dot it
// belongs to, samples the exact same Perlin noise on the GPU, and shades it.
// Pixels outside any dot bail out before touching the noise.
// ─────────────────────────────────────────────────────────────────────────────

const FRAGMENT = `
  uniform float uRadius;       // dot radius in pixels (strokeWeight / 2)
  uniform float uSceneAngle;
  uniform float uAngleCycles;
  uniform float uHueRange;
  uniform float uHueOffset;
  uniform float uOpacityFactor;

  vec3 dotColor(vec2 cellCenter) {
    vec2 rotated = rotateAroundCenter(cellCenter, uSceneAngle);
    float noiseValue = perlinNoise(vec2(rotated.x / uColumns, rotated.y / uRows));
    float angle = noiseValue * TAU * uAngleCycles;
    float hueIndex = -uHueRange + (angle / TAU) * 2.0 * uHueRange;

    return paletteRainbow(uHueOffset, hueIndex, uOpacityFactor);
  }

  void main() {
    vec2 frag = vec2(vUv.x * uResolution.x, (1.0 - vUv.y) * uResolution.y);

    float col = floor(frag.x / uCellWidth);
    float row = floor(frag.y / uCellHeight);

    vec2 cellCenter = vec2(
      col * uCellWidth + uCellWidth * 0.5,
      row * uCellHeight + uCellHeight * 0.5
    );

    float dist = distance(frag, cellCenter);
    float mask = 1.0 - smoothstep(uRadius - 1.0, uRadius + 1.0, dist);

    if (mask <= 0.0) {
      gl_FragColor = vec4(0.0); // transparent: let the p2d background show through
      return;
    }

    gl_FragColor = vec4(dotColor(cellCenter), mask);
  }
`;

const field = createNoiseFieldRenderer( FRAGMENT );

sketch.setup(
  () => {},
  {}
);

sketch.draw( (
  _time, center
) => {
  const p = getP5();

  p.clear();
  p.background( ...( options.sketch.backgroundColor ?? [
    0
  ] ) );

  const rows = options.sketch.grid?.rows ?? 40;
  const columns = options.sketch.grid?.columns ?? 40;

  const rotationAngleMax = options.sketch.rotation?.angleMax ?? p.PI / 2;
  const rotationSpeed = options.sketch.rotation?.speed ?? 1;
  const sceneAngle = p.map(
    p.sin( animation.angle * rotationSpeed ),
    -1,
    1,
    -rotationAngleMax,
    rotationAngleMax
  );

  field.render( {
    seed: options.sketch.noise?.seed ?? 42,
    octaves: options.sketch.noise?.detail ?? 4,
    falloff: options.sketch.noise?.falloff ?? 0.3,
    columns,
    rows,
    center: [
      center.x,
      center.y
    ],
    uniforms: {
      uRadius: ( options.sketch.stroke?.weight ?? 10 ) / 2,
      uSceneAngle: sceneAngle,
      uAngleCycles: options.sketch.angle?.cycles ?? 4,
      uHueRange: options.sketch.colors?.hueRange ?? p.PI / 2,
      uHueOffset: options.sketch.colors?.hueOffset ?? 0,
      uOpacityFactor: options.sketch.colors?.opacityFactor ?? 1.5
    }
  } );
} );

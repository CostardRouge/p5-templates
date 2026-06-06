import cache from "./cache.js";
import graphics from "./graphics.js";
import {
  getP5
} from "./sketch.js";

// ─────────────────────────────────────────────────────────────────────────────
// Shared GPU engine for the noise-grid family.
//
// Every noise-grid sketch follows the same skeleton: sample p5's Perlin noise
// over a grid, turn it into an angle, and shade a primitive per cell. Doing
// that per cell on the CPU each frame is what made the originals slow. This
// module renders the whole field in a single full-screen fragment shader
// (into an off-screen WebGL buffer, then composited onto the p2d canvas) and
// owns the parts that are identical across sketches:
//
//   - p5's Perlin noise, reproduced bit-for-bit on the GPU via its 4096-entry
//     permutation table (same LCG as noiseSeed) uploaded as a packed texture;
//   - a small GLSL standard library (noise 2D/3D, rotation, colour palettes);
//   - the full-screen quad plumbing and the draw/composite cycle.
//
// A sketch supplies only its own fragment source (extra uniforms + main), and
// drives it each frame through render(). See noise-grid-v11-with-rotation for
// a minimal consumer.
// ─────────────────────────────────────────────────────────────────────────────

// Up to this many octaves are evaluated on the GPU. p5's noiseDetail allows
// more, but past a dozen the contribution is negligible and the integer noise
// indices would lose float precision, so we clamp here.
export const MAX_OCTAVES = 12;

const VERT_SRC = `
  precision highp float;

  attribute vec2 aPos; // full-screen quad in clip space (-1..1)
  varying vec2 vUv;    // 0..1 across the quad

  void main() {
    vUv = aPos * 0.5 + 0.5;
    gl_Position = vec4(aPos, 0.0, 1.0);
  }
`;

// Common uniforms + GLSL helpers injected before every sketch fragment.
// Pixel coordinates use the same top-left origin p5 uses in 2D.
const COMMON_GLSL = `
  precision highp float;

  #define MAX_OCT ${ MAX_OCTAVES }

  varying vec2 vUv;

  uniform vec2  uResolution;
  uniform vec2  uCenter;
  uniform float uColumns;     // cell count (noise input divisor, as in the originals)
  uniform float uRows;
  uniform float uCellWidth;   // pixels
  uniform float uCellHeight;  // pixels
  uniform int   uOctaves;
  uniform float uFalloff;
  uniform sampler2D uPerlin;  // 64x64 RGBA8, packed permutation table (4096 entries)

  const float PI  = 3.141592653589793;
  const float TAU = 6.283185307179586;

  // p5 Perlin constants.
  const float PERLIN_YWRAP = 16.0;   // 1 << 4
  const float PERLIN_ZWRAP = 256.0;  // 1 << 8
  const float PERLIN_SIZE  = 4096.0;

  // Read entry "index" of the permutation table from the packed texture.
  float perlinLookup(float index) {
    float wrapped = mod(index, PERLIN_SIZE);
    float u = mod(wrapped, 64.0);
    float v = floor(wrapped / 64.0);
    vec2 uv = (vec2(u, v) + 0.5) / 64.0;
    vec4 texel = texture2D(uPerlin, uv);

    return dot(texel, vec4(1.0, 1.0 / 255.0, 1.0 / 65025.0, 1.0 / 16581375.0));
  }

  float scaledCosine(float i) {
    return 0.5 * (1.0 - cos(i * PI));
  }

  // Faithful port of p5.prototype.noise — 2D (z = 0) case.
  float perlinNoise(vec2 p) {
    float x = abs(p.x);
    float y = abs(p.y);

    float xi = floor(x);
    float yi = floor(y);
    float xf = x - xi;
    float yf = y - yi;

    float r = 0.0;
    float ampl = 0.5;

    for (int o = 0; o < MAX_OCT; o++) {
      if (o >= uOctaves) {
        break;
      }

      float of = xi + yi * PERLIN_YWRAP;
      float rxf = scaledCosine(xf);
      float ryf = scaledCosine(yf);

      float n1 = perlinLookup(of);
      n1 += rxf * (perlinLookup(of + 1.0) - n1);

      float n2 = perlinLookup(of + PERLIN_YWRAP);
      n2 += rxf * (perlinLookup(of + PERLIN_YWRAP + 1.0) - n2);

      n1 += ryf * (n2 - n1);
      // z layer is skipped: scaledCosine(0) == 0, so it never contributes.

      r += n1 * ampl;
      ampl *= uFalloff;

      xi *= 2.0;
      xf *= 2.0;
      yi *= 2.0;
      yf *= 2.0;

      if (xf >= 1.0) { xi += 1.0; xf -= 1.0; }
      if (yf >= 1.0) { yi += 1.0; yf -= 1.0; }
    }

    return r;
  }

  // Faithful port of p5.prototype.noise — full 3D case.
  float perlinNoise(vec3 p) {
    float x = abs(p.x);
    float y = abs(p.y);
    float z = abs(p.z);

    float xi = floor(x);
    float yi = floor(y);
    float zi = floor(z);
    float xf = x - xi;
    float yf = y - yi;
    float zf = z - zi;

    float r = 0.0;
    float ampl = 0.5;

    for (int o = 0; o < MAX_OCT; o++) {
      if (o >= uOctaves) {
        break;
      }

      float of = xi + yi * PERLIN_YWRAP + zi * PERLIN_ZWRAP;
      float rxf = scaledCosine(xf);
      float ryf = scaledCosine(yf);

      float n1 = perlinLookup(of);
      n1 += rxf * (perlinLookup(of + 1.0) - n1);

      float n2 = perlinLookup(of + PERLIN_YWRAP);
      n2 += rxf * (perlinLookup(of + PERLIN_YWRAP + 1.0) - n2);

      n1 += ryf * (n2 - n1);

      of += PERLIN_ZWRAP;
      n2 = perlinLookup(of);
      n2 += rxf * (perlinLookup(of + 1.0) - n2);

      float n3 = perlinLookup(of + PERLIN_YWRAP);
      n3 += rxf * (perlinLookup(of + PERLIN_YWRAP + 1.0) - n3);

      n2 += ryf * (n3 - n2);
      n1 += scaledCosine(zf) * (n2 - n1);

      r += n1 * ampl;
      ampl *= uFalloff;

      xi *= 2.0;
      xf *= 2.0;
      yi *= 2.0;
      yf *= 2.0;
      zi *= 2.0;
      zf *= 2.0;

      if (xf >= 1.0) { xi += 1.0; xf -= 1.0; }
      if (yf >= 1.0) { yi += 1.0; yf -= 1.0; }
      if (zf >= 1.0) { zi += 1.0; zf -= 1.0; }
    }

    return r;
  }

  // Matches the rotatePoint() helper the sketches use (rotate v around center).
  vec2 rotateAroundCenter(vec2 v, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    vec2 d = v - uCenter;

    return vec2(c * d.x + s * d.y, c * d.y - s * d.x) + uCenter;
  }
`;

// GLSL ports of utils/mappers.js + utils/easing.js.
//   remap        == p5.map (unclamped)
//   remapClamp   == p5.map(..., true)
//   ease helpers mirror easing.js; mappers.fn(v,min,max,a,b,ease) is
//   remap(ease(remap(v, min, max, 0.0, 1.0)), 0.0, 1.0, a, b).
const MAPPERS_GLSL = `
  float remap(float v, float a, float b, float c, float d) {
    return c + (v - a) / (b - a) * (d - c);
  }

  float remapClamp(float v, float a, float b, float c, float d) {
    float t = clamp((v - a) / (b - a), 0.0, 1.0);
    return c + t * (d - c);
  }

  float easeInSine(float x) { return 1.0 - cos((x * PI) / 2.0); }
  float easeOutSine(float x) { return sin((x * PI) / 2.0); }
  float easeInOutSine(float x) { return -(cos(PI * x) - 1.0) / 2.0; }

  // Polynomial easings use multiplication rather than pow(): mappers.fn feeds
  // unclamped inputs, so the base can be negative — pow(negative, n) is
  // undefined in GLSL, whereas Math.pow (real, integer exponent) is what the JS
  // originals use. Multiplying reproduces that exactly for any input.
  float easeInQuad(float x) { return x * x; }
  float easeOutQuad(float x) { float u = 1.0 - x; return 1.0 - u * u; }
  float easeInOutQuad(float x) {
    if (x < 0.5) { return 2.0 * x * x; }
    float u = -2.0 * x + 2.0;
    return 1.0 - (u * u) / 2.0;
  }

  float easeInCubic(float x) { return x * x * x; }
  float easeOutCubic(float x) { float u = 1.0 - x; return 1.0 - u * u * u; }
  float easeInOutCubic(float x) {
    if (x < 0.5) { return 4.0 * x * x * x; }
    float u = -2.0 * x + 2.0;
    return 1.0 - (u * u * u) / 2.0;
  }

  float easeInBack(float x) {
    float c1 = 1.70158;
    float c3 = c1 + 1.0;
    return c3 * x * x * x - c1 * x * x;
  }
  float easeOutBack(float x) {
    float c1 = 1.70158;
    float c3 = c1 + 1.0;
    float u = x - 1.0;
    return 1.0 + c3 * u * u * u + c1 * u * u;
  }
`;

// GLSL ports of utils/colors.js. p5 builds each channel in 0..360 then divides
// by opacityFactor in 0..255 RGB space (values are clamped to 255 by p5).
const PALETTES_GLSL = `
  vec3 paletteRainbow(float hueOffset, float hueIndex, float opacityFactor) {
    float a = hueOffset + hueIndex;
    float b = hueOffset - hueIndex;

    float red   = (sin(a) * 0.5 + 0.5) * 360.0 / opacityFactor;
    float green = (1.0 - cos(b)) * 0.5 * 360.0 / opacityFactor;
    float blue  = (1.0 - sin(a)) * 0.5 * 360.0 / opacityFactor;

    return clamp(vec3(red, green, blue) / 255.0, 0.0, 1.0);
  }
`;

// SDF helpers for the primitives the sketches draw.
const SHAPES_GLSL = `
  // Distance from point p to the segment a→b (round caps, i.e. a capsule axis),
  // matching p5's default ROUND strokeCap for line().
  float segmentDistance(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a;
    vec2 ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);

    return length(pa - ba * h);
  }
`;

// ─── Perlin permutation table ─────────────────────────────────────────────────
// p5's noiseSeed() fills a 4096-entry table with a fixed LCG. We reproduce it
// exactly so the GPU noise matches p5's noise() to the bit.
function buildPerlinBytes( seed ) {
  const SIZE = 4096;
  const m = 4294967296; // 2^32
  const a = 1664525;
  const c = 1013904223;

  let z = seed >>> 0;

  const bytes = new Uint8Array( SIZE * 4 );

  for ( let i = 0; i < SIZE; i++ ) {
    z = ( a * z + c ) % m;

    const value = z / m; // [0, 1)

    // Pack the float across RGBA8 (standard GLSL pack/unpack pair).
    let e0 = value % 1;
    let e1 = ( value * 255 ) % 1;
    let e2 = ( value * 65025 ) % 1;
    let e3 = ( value * 16581375 ) % 1;

    e0 -= e1 / 255;
    e1 -= e2 / 255;
    e2 -= e3 / 255;

    const base = i * 4;

    bytes[ base ] = Math.max(
      0,
      Math.min(
        255,
        Math.round( e0 * 255 )
      )
    );
    bytes[ base + 1 ] = Math.max(
      0,
      Math.min(
        255,
        Math.round( e1 * 255 )
      )
    );
    bytes[ base + 2 ] = Math.max(
      0,
      Math.min(
        255,
        Math.round( e2 * 255 )
      )
    );
    bytes[ base + 3 ] = Math.max(
      0,
      Math.min(
        255,
        Math.round( e3 * 255 )
      )
    );
  }

  return bytes;
}

// ─── WebGL helpers ────────────────────────────────────────────────────────────
function compileShader(
  gl, type, src
) {
  const shader = gl.createShader( type );

  gl.shaderSource(
    shader,
    src
  );
  gl.compileShader( shader );

  if ( !gl.getShaderParameter(
    shader,
    gl.COMPILE_STATUS
  ) ) {
    console.error(
      "Shader compile error:",
      gl.getShaderInfoLog( shader )
    );
    gl.deleteShader( shader );
    return null;
  }

  return shader;
}

function buildProgram(
  gl, vertSrc, fragSrc
) {
  const vert = compileShader(
    gl,
    gl.VERTEX_SHADER,
    vertSrc
  );
  const frag = compileShader(
    gl,
    gl.FRAGMENT_SHADER,
    fragSrc
  );

  if ( !vert || !frag ) {
    return null;
  }

  const program = gl.createProgram();

  gl.attachShader(
    program,
    vert
  );
  gl.attachShader(
    program,
    frag
  );
  gl.linkProgram( program );

  if ( !gl.getProgramParameter(
    program,
    gl.LINK_STATUS
  ) ) {
    console.error(
      "Program link error:",
      gl.getProgramInfoLog( program )
    );
    return null;
  }

  gl.deleteShader( vert );
  gl.deleteShader( frag );
  return program;
}

/**
 * Create a GPU noise-field renderer for one sketch.
 *
 * @param {string} fragmentSource GLSL fragment body: extra `uniform` lines plus
 *   any helper functions and `main()`. The common uniforms (uResolution,
 *   uCenter, uColumns, uRows, uCellWidth, uCellHeight, uOctaves, uFalloff,
 *   uPerlin) and the GLSL stdlib (perlinNoise, rotateAroundCenter, palettes)
 *   are injected automatically before it.
 * @returns {{ render: Function }}
 */
export default function createNoiseFieldRenderer( fragmentSource ) {
  const state = {
    graphics: null,
    program: null,
    quadVBO: null,
    aPosLoc: -1,
    perlinTexture: null,
    perlinSeed: null,
    locs: {},
    ctxRef: null
  };

  function ensureGraphics() {
    if ( !state.graphics ) {
      const p = getP5();

      state.graphics = graphics.createAutoResizableGraphics(
        p.width,
        p.height,
        "webgl"
      );
    }

    return state.graphics;
  }

  function ensureProgram( gl ) {
    if ( state.ctxRef === gl && state.program ) {
      return true;
    }

    if ( state.program ) {
      gl.deleteProgram( state.program );
    }

    state.program = buildProgram(
      gl,
      VERT_SRC,
      COMMON_GLSL + MAPPERS_GLSL + PALETTES_GLSL + SHAPES_GLSL + fragmentSource
    );

    state.locs = {};
    state.perlinTexture = null;
    state.perlinSeed = null;
    state.ctxRef = gl;

    if ( !state.program ) {
      return false;
    }

    state.aPosLoc = gl.getAttribLocation(
      state.program,
      "aPos"
    );

    if ( !state.quadVBO ) {
      state.quadVBO = gl.createBuffer();

      // Two triangles covering clip space.
      const quad = new Float32Array( [
        -1,
        -1,
        1,
        -1,
        -1,
        1,
        -1,
        1,
        1,
        -1,
        1,
        1
      ] );

      gl.bindBuffer(
        gl.ARRAY_BUFFER,
        state.quadVBO
      );
      gl.bufferData(
        gl.ARRAY_BUFFER,
        quad,
        gl.STATIC_DRAW
      );
    }

    return true;
  }

  function uploadPerlinTexture(
    gl, seed
  ) {
    if ( !state.perlinTexture ) {
      state.perlinTexture = gl.createTexture();
    }

    gl.bindTexture(
      gl.TEXTURE_2D,
      state.perlinTexture
    );
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      64,
      64,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      buildPerlinBytes( seed )
    );

    // NEAREST + CLAMP so each permutation entry is read exactly, never blended.
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_MIN_FILTER,
      gl.NEAREST
    );
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_MAG_FILTER,
      gl.NEAREST
    );
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_WRAP_S,
      gl.CLAMP_TO_EDGE
    );
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_WRAP_T,
      gl.CLAMP_TO_EDGE
    );

    state.perlinSeed = seed;
  }

  function location(
    gl, name
  ) {
    if ( !( name in state.locs ) ) {
      state.locs[ name ] = gl.getUniformLocation(
        state.program,
        name
      );
    }

    return state.locs[ name ];
  }

  // Set a uniform, inferring its kind from the JS value:
  //   number          -> float
  //   { int: n }       -> int / sampler
  //   [a, b] / [a,b,c] -> vec2 / vec3 / vec4
  function setUniform(
    gl, name, value
  ) {
    const loc = location(
      gl,
      name
    );

    if ( loc === null ) {
      return;
    }

    if ( Array.isArray( value ) ) {
      if ( value.length === 2 ) {
        gl.uniform2f(
          loc,
          value[ 0 ],
          value[ 1 ]
        );
      } else if ( value.length === 3 ) {
        gl.uniform3f(
          loc,
          value[ 0 ],
          value[ 1 ],
          value[ 2 ]
        );
      } else if ( value.length === 4 ) {
        gl.uniform4f(
          loc,
          value[ 0 ],
          value[ 1 ],
          value[ 2 ],
          value[ 3 ]
        );
      }

      return;
    }

    if ( value !== null && typeof value === "object" && "int" in value ) {
      gl.uniform1i(
        loc,
        value.int
      );

      return;
    }

    gl.uniform1f(
      loc,
      value
    );
  }

  /**
   * Render one frame of the field and composite it onto the main canvas.
   *
   * @param {object} params
   * @param {number} [params.seed=42]      noise seed
   * @param {number} [params.octaves=4]    noiseDetail octaves (clamped to MAX_OCTAVES)
   * @param {number} [params.falloff=0.5]  noiseDetail falloff
   * @param {number} params.columns        grid columns
   * @param {number} params.rows           grid rows
   * @param {number[]} [params.center]     [x, y] rotation/distance centre (defaults to canvas centre)
   * @param {object} [params.uniforms]     sketch-specific uniforms (see setUniform)
   */
  function render( params ) {
    const {
      seed = 42,
      octaves = 4,
      falloff = 0.5,
      columns,
      rows,
      center,
      uniforms = {}
    } = params;

    const p = getP5();
    const g = ensureGraphics();
    const gl = g.drawingContext;

    if ( !ensureProgram( gl ) ) {
      return;
    }

    if ( state.perlinSeed !== seed ) {
      uploadPerlinTexture(
        gl,
        seed
      );
    }

    const width = g.width;
    const height = g.height;

    gl.viewport(
      0,
      0,
      gl.drawingBufferWidth,
      gl.drawingBufferHeight
    );
    gl.disable( gl.DEPTH_TEST );
    gl.disable( gl.BLEND );
    gl.clearColor(
      0,
      0,
      0,
      0
    );
    gl.clear( gl.COLOR_BUFFER_BIT );

    gl.useProgram( state.program );

    setUniform(
      gl,
      "uResolution",
      [
        width,
        height
      ]
    );
    setUniform(
      gl,
      "uCenter",
      center ?? [
        width / 2,
        height / 2
      ]
    );
    setUniform(
      gl,
      "uColumns",
      columns
    );
    setUniform(
      gl,
      "uRows",
      rows
    );
    setUniform(
      gl,
      "uCellWidth",
      width / columns
    );
    setUniform(
      gl,
      "uCellHeight",
      height / rows
    );
    setUniform(
      gl,
      "uOctaves",
      {
        int: Math.min(
          octaves,
          MAX_OCTAVES
        )
      }
    );
    setUniform(
      gl,
      "uFalloff",
      falloff
    );

    gl.activeTexture( gl.TEXTURE0 );
    gl.bindTexture(
      gl.TEXTURE_2D,
      state.perlinTexture
    );
    setUniform(
      gl,
      "uPerlin",
      {
        int: 0
      }
    );

    for ( const [
      name,
      value
    ] of Object.entries( uniforms ) ) {
      setUniform(
        gl,
        name,
        value
      );
    }

    gl.bindBuffer(
      gl.ARRAY_BUFFER,
      state.quadVBO
    );
    gl.enableVertexAttribArray( state.aPosLoc );
    gl.vertexAttribPointer(
      state.aPosLoc,
      2,
      gl.FLOAT,
      false,
      0,
      0
    );

    gl.drawArrays(
      gl.TRIANGLES,
      0,
      6
    );

    // Restore GL state so p5 can keep using the buffer cleanly.
    gl.disableVertexAttribArray( state.aPosLoc );
    gl.bindBuffer(
      gl.ARRAY_BUFFER,
      null
    );
    g.resetShader();

    p.image(
      g,
      0,
      0
    );
  }

  return {
    render
  };
}

/**
 * Pre-compute the converged min/max of a per-cell scalar over the animation
 * loop, on the CPU, cached by `key`.
 *
 * Several sketches normalise colour/weight against a min/max of the noise angle
 * that the originals accumulate across frames (the look "warms up" over the
 * first seconds). A pixel-parallel shader can't reduce that cheaply, so instead
 * we sample the field once across the whole loop to get the steady-state range
 * and feed it in as uniforms. Recomputes only when `key` changes (so live form
 * edits to seed/detail/grid stay correct), and subsamples large grids to keep
 * the cost to a few milliseconds.
 *
 * @param {object} args
 * @param {string} args.key            cache key built from every field param
 * @param {number} args.columns
 * @param {number} args.rows
 * @param {number} [args.frames=30]    time samples across the loop
 * @param {number} [args.maxCols=64]   cap on sampled columns
 * @param {number} [args.maxRows=64]   cap on sampled rows
 * @param {Function} [args.prepareFrame] (u) => void — set noiseSeed/noiseDetail for loop position u in [0,1)
 * @param {Function} args.sampleAt     (col, row, u) => number
 * @returns {{ min: number, max: number }}
 */
export function computeFieldRange( {
  key,
  columns,
  rows,
  frames = 30,
  maxCols = 64,
  maxRows = 64,
  prepareFrame,
  sampleAt
} ) {
  return cache.store(
    `noise-field-range-${ key }`,
    () => {
      const colStep = Math.max(
        1,
        Math.ceil( columns / maxCols )
      );
      const rowStep = Math.max(
        1,
        Math.ceil( rows / maxRows )
      );

      let min = Infinity;
      let max = -Infinity;

      for ( let f = 0; f < frames; f++ ) {
        const u = f / frames;

        prepareFrame?.( u );

        for ( let row = 0; row < rows; row += rowStep ) {
          for ( let col = 0; col < columns; col += colStep ) {
            const value = sampleAt(
              col,
              row,
              u
            );

            if ( value < min ) {
              min = value;
            }

            if ( value > max ) {
              max = value;
            }
          }
        }
      }

      return {
        min,
        max
      };
    }
  );
}

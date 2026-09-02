import graphics from "./graphics.js";
import {
  getP5
} from "./sketch.js";
import {
  createKeyedStore
} from "./instanceState.js";
import {
  EASINGS_GLSL, easingId
} from "./easingGlsl.js";

// Re-exported so a sketch can grab the renderer and the easing-uniform helper
// from one place.
export {
  easingId
};

// ─────────────────────────────────────────────────────────────────────────────
// Shared GPU engine for the "peaks" family (a 3D point cloud on a surface).
//
// Every peaks sketch follows the same skeleton: walk a (column, row) grid mapped
// onto a 3D surface (sphere / plane / tunnel / …), grow a stack of `layers`
// points outward from each cell along a spike, and colour every point with a
// Perlin-driven rainbow. The CPU originals draw that with one g.point() per
// (col, row, layer) — tens of thousands of draw calls per frame — and rebuild
// the whole field (noise + p5.Color per point) on the CPU every frame.
//
// This module keeps the generative MATH identical to the originals but moves it
// entirely onto the GPU:
//
//   - the grid of (col, row, layer) indices is uploaded ONCE as a static
//     instance buffer (rebuilt only when the grid dimensions change);
//   - the vertex shader rebuilds each point from those indices — surface noise,
//     spike length, LOD, the outward displacement, the per-layer stroke weight
//     and the rainbow colour — so the CPU does O(1) work per frame (a handful of
//     uniforms + two small matrices);
//   - each point is drawn as a round, antialiased billboard disc (a screen-space
//     quad, NOT gl.POINTS), so the stroke weight is honoured at any size with no
//     hardware point-size cap, matching p5's round-capped point();
//   - depth testing is on, so nearer points occlude farther ones exactly as the
//     original WEBGL sketches do.
//
// Faithful p5 reproduction:
//   - Perlin noise is the same 4096-entry permutation table p5's noiseSeed()
//     builds, uploaded as a packed texture and read bit-for-bit on the GPU.
//   - mappers.fn / easing.js / colors.rainbow are ported to GLSL (the easing
//     dispatch is shared with the noise-grid family via easingGlsl.js).
//   - the camera is p5's: its WEBGL default-camera model-view and projection are
//     reproduced in JS (eyeZ 800, fov 2·atan(h/2/eyeZ), the −f y-flip), so the
//     projection matches the CPU original frame for frame without depending on
//     p5's internal, version-specific matrix objects.
//
// A sketch supplies only the GLSL that maps one (col, row, layer) index to a
// point — see peaks-shaders-sphere for a minimal consumer.
// ─────────────────────────────────────────────────────────────────────────────

// Up to this many noise octaves on the GPU (the detail slider maxes at 8).
const MAX_OCTAVES = 8;

// Antialiasing half-band, in pixels, applied around every disc edge.
const EDGE_PAD = 1.0;

// ─── GLSL standard library ──────────────────────────────────────────────────
// Faithful ports of utils Perlin noise, mappers.fn and colors.rainbow. These
// mirror the ports proven in noiseFieldGpu.js; they are restated here so the
// peaks engine stays self-contained and the 14 noise-grid consumers are never
// disturbed by a change made for the peaks family.

const CONSTANTS_GLSL = `
  precision highp float;
  precision highp int;

  #define MAX_OCT ${ MAX_OCTAVES }

  const float PI  = 3.141592653589793;
  const float TAU = 6.283185307179586;

  // p5 Perlin constants.
  const float PERLIN_YWRAP = 16.0;   // 1 << 4
  const float PERLIN_ZWRAP = 256.0;  // 1 << 8
  const float PERLIN_SIZE  = 4096.0;

  uniform int       uOctaves;
  uniform float     uFalloff;
  uniform sampler2D uPerlin;  // 64x64 RGBA8, packed permutation table (4096 entries)
`;

const PERLIN_GLSL = `
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
`;

// remap == p5.map (unclamped). The base easings EASINGS_GLSL (easingGlsl.js)
// dispatches to — sine / quad / cubic / back — live in noiseFieldGpu's
// MAPPERS_GLSL, which we don't import; restate exactly that subset here so the
// shared applyEasing() resolves, then add the mappers.fn equivalent.
const MAPPERS_GLSL = `
  float remap(float v, float a, float b, float c, float d) {
    return c + (v - a) / (b - a) * (d - c);
  }

  float easeInSine(float x) { return 1.0 - cos((x * PI) / 2.0); }
  float easeOutSine(float x) { return sin((x * PI) / 2.0); }
  float easeInOutSine(float x) { return -(cos(PI * x) - 1.0) / 2.0; }

  // Polynomial easings use multiplication, not pow(): mappers.fn feeds unclamped
  // inputs so the base can be negative, and pow(negative, n) is undefined in
  // GLSL whereas the JS originals use Math.pow with integer exponents.
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

  // applyEasing() (easingGlsl.js) also dispatches to these two, so they must be
  // defined even though no default preset selects them.
  float easeInOutQuart(float x) {
    if (x < 0.5) { return 8.0 * x * x * x * x; }
    float u = -2.0 * x + 2.0;
    return 1.0 - (u * u * u * u) / 2.0;
  }

  float easeInOutExpo(float x) {
    if (x < 0.5) { return exp2(20.0 * x - 10.0) * 0.5; }
    return (2.0 - exp2(-20.0 * x + 10.0)) * 0.5;
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

// GLSL equivalent of mappers.fn(value, min, max, start, end, easing):
//   p.map(easing(p.map(value, min, max, 0, 1)), 0, 1, start, end)   (unclamped)
// Injected AFTER EASINGS_GLSL because it calls applyEasing(), which GLSL ES 1.00
// requires to be defined before use.
const MAPEASE_GLSL = `
  float mapEase(float v, float a, float b, float c, float d, int easeId) {
    float t = remap(v, a, b, 0.0, 1.0);

    return remap(applyEasing(easeId, t), 0.0, 1.0, c, d);
  }
`;

// GLSL port of utils/colors.js rainbow() (default Math.sin/cos easing). p5 builds
// each channel in 0..360 then divides by opacityFactor (clamped to 0..255 by p5).
const PALETTE_GLSL = `
  vec3 paletteRainbow(float hueOffset, float hueIndex, float opacityFactor) {
    float a = hueOffset + hueIndex;
    float b = hueOffset - hueIndex;

    float red   = (sin(a) * 0.5 + 0.5) * 360.0 / opacityFactor;
    float green = (1.0 - cos(b)) * 0.5 * 360.0 / opacityFactor;
    float blue  = (1.0 - sin(a)) * 0.5 * 360.0 / opacityFactor;

    return clamp(vec3(red, green, blue) / 255.0, 0.0, 1.0);
  }
`;

// ─── Vertex / fragment wrappers ───────────────────────────────────────────────
// The sketch supplies `pointBody`: its own `uniform` lines plus
//   void computePoint(
//     float col, float row, float layer,
//     out vec3 worldPos,    // model-space point, BEFORE the camera rotations
//     out float diameter,   // stroke weight in px (disc diameter)
//     out vec3 color,       // rgb 0..1
//     out float visible     // >0.5 to draw, else cull this instance
//   )
// The GLSL stdlib above (perlinNoise, mapEase, applyEasing, paletteRainbow) is
// injected before it.

const VERT_HEADER = `
  attribute vec2 aCorner;     // unit quad corner in [-1, 1]
  attribute vec3 aCell;       // (col, row, layer) per instance

  uniform mat4  uMV;          // p5 model-view (camera + the sketch's rotations)
  uniform mat4  uP;           // p5 projection
  uniform vec2  uResolution;  // buffer size in px
  uniform float uEdgePad;     // antialiasing pad in px

  varying vec2  vLocal;       // fragment offset from disc centre, px
  varying vec3  vColor;
  varying float vRadius;
`;

const VERT_MAIN = `
  void main() {
    vec3  worldPos;
    float diameter;
    vec3  color;
    float visible;

    computePoint(aCell.x, aCell.y, aCell.z, worldPos, diameter, color, visible);

    if (visible < 0.5) {
      // Push every corner well outside the clip volume so the instance is culled.
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);

      return;
    }

    vec4  clip   = uP * uMV * vec4(worldPos, 1.0);
    float radius = max(diameter, 0.0) * 0.5;
    float ext    = radius + uEdgePad;

    // Billboard: offset the projected centre by a screen-space quad. Scaling by
    // clip.w keeps the disc a fixed pixel size at any depth (like gl_PointSize /
    // p5's point()), and we keep clip.z so depth testing still occludes.
    vec2 offset = aCorner * ext / (uResolution * 0.5) * clip.w;

    gl_Position = clip + vec4(offset, 0.0, 0.0);
    vLocal      = aCorner * ext;
    vColor      = color;
    vRadius     = radius;
  }
`;

const FRAG_SRC = `
  precision highp float;

  uniform float uEdgePad;

  varying vec2  vLocal;
  varying vec3  vColor;
  varying float vRadius;

  void main() {
    float d   = length(vLocal) - vRadius;
    float cov = 1.0 - smoothstep(-uEdgePad, uEdgePad, d);

    if (cov <= 0.0) {
      discard;
    }

    // The rainbow palette is opaque, so coverage IS the alpha. Emit premultiplied
    // colour: the buffer is premultipliedAlpha, so p.image() composites it over
    // the p2d canvas with no edge fringing.
    gl_FragColor = vec4(vColor * cov, cov);
  }
`;

// ─── Perlin permutation table ─────────────────────────────────────────────────
// p5's noiseSeed() fills a 4096-entry table with a fixed LCG. Reproduced exactly
// so the GPU noise matches p5's noise() to the bit (same packing as
// noiseFieldGpu.js).
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
      "Peaks field shader compile error:",
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
      "Peaks field program link error:",
      gl.getProgramInfoLog( program )
    );
    return null;
  }

  gl.deleteShader( vert );
  gl.deleteShader( frag );
  return program;
}

function writePerlinTexture(
  gl, texture, seed
) {
  gl.bindTexture(
    gl.TEXTURE_2D,
    texture
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
}

function isWebGL2( gl ) {
  return typeof WebGL2RenderingContext !== "undefined"
    && gl instanceof WebGL2RenderingContext;
}

function getInstancingExt( gl ) {
  return isWebGL2( gl )
    ? null
    : gl.getExtension( "ANGLE_instanced_arrays" );
}

function setDivisor(
  gl, ext, loc, divisor
) {
  if ( loc < 0 ) {
    return;
  }

  if ( ext ) {
    ext.vertexAttribDivisorANGLE(
      loc,
      divisor
    );
  } else {
    gl.vertexAttribDivisor(
      loc,
      divisor
    );
  }
}

function drawArraysInstanced(
  gl, ext, mode, first, count, primCount
) {
  if ( ext ) {
    ext.drawArraysInstancedANGLE(
      mode,
      first,
      count,
      primCount
    );
  } else {
    gl.drawArraysInstanced(
      mode,
      first,
      count,
      primCount
    );
  }
}

// ─── Matrices ─────────────────────────────────────────────────────────────────
// p5's WEBGL default camera, reproduced exactly (p5 1.x), so the projection
// matches the CPU peaks sketches frame for frame without reading p5's internal,
// version-specific matrix objects:
//   eyeZ = 800, fov = 2·atan(height / 2 / eyeZ), near = eyeZ·0.1, far = eyeZ·10,
//   eye (0,0,800) looking at the origin, up (0,1,0).
// The projection's Y term is negated (−f), which is how p5 makes +y point down
// in WEBGL (Camera.perspective() with yScale = 1). All matrices are column-major
// (WebGL order), so uniformMatrix4fv is called with transpose = false.
const EYE_Z = 800;

// C = A · B, both column-major 4×4.
function multiplyMat4(
  a, b
) {
  const out = new Array( 16 );

  for ( let col = 0; col < 4; col++ ) {
    for ( let row = 0; row < 4; row++ ) {
      out[ col * 4 + row ] =
        a[ row ] * b[ col * 4 ]
        + a[ 4 + row ] * b[ col * 4 + 1 ]
        + a[ 8 + row ] * b[ col * 4 + 2 ]
        + a[ 12 + row ] * b[ col * 4 + 3 ];
    }
  }

  return out;
}

// p5 Camera.perspective() for the default camera, column-major.
function perspectiveMat4(
  width, height
) {
  const aspect = width / height;
  const fov = 2 * Math.atan( height / 2 / EYE_Z );
  const near = EYE_Z * 0.1;
  const far = EYE_Z * 10;
  const f = 1 / Math.tan( fov / 2 );
  const nf = 1 / ( near - far );

  return [
    f / aspect,
    0,
    0,
    0,
    0,
    -f, // −f · yScale, yScale = 1 → p5's "+y points down"
    0,
    0,
    0,
    0,
    ( far + near ) * nf,
    -1,
    0,
    0,
    2 * far * near * nf,
    0
  ];
}

// View = look-at from (0,0,EYE_Z) to the origin = translate(0,0,−EYE_Z).
function viewMat4() {
  return [
    1,
    0,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    -EYE_Z,
    1
  ];
}

function rotationXMat4( a ) {
  const c = Math.cos( a );
  const s = Math.sin( a );

  return [
    1,
    0,
    0,
    0,
    0,
    c,
    s,
    0,
    0,
    -s,
    c,
    0,
    0,
    0,
    0,
    1
  ];
}

function rotationYMat4( a ) {
  const c = Math.cos( a );
  const s = Math.sin( a );

  return [
    c,
    0,
    -s,
    0,
    0,
    1,
    0,
    0,
    s,
    0,
    c,
    0,
    0,
    0,
    0,
    1
  ];
}

function rotationZMat4( a ) {
  const c = Math.cos( a );
  const s = Math.sin( a );

  return [
    c,
    s,
    0,
    0,
    -s,
    c,
    0,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    0,
    1
  ];
}

// Model-view for the default camera with the sketch's rotateX/Y/Z applied in
// p5's order (uModelMatrix = Rx·Ry·Rz, then the camera view in front).
function modelViewMat4( rotation ) {
  const model = multiplyMat4(
    multiplyMat4(
      rotationXMat4( rotation.x ),
      rotationYMat4( rotation.y )
    ),
    rotationZMat4( rotation.z )
  );

  return multiplyMat4(
    viewMat4(),
    model
  );
}

// Set a uniform, inferring its kind from the JS value:
//   number          -> float
//   { int: n }       -> int / sampler
//   [a, b] / [a,b,c] -> vec2 / vec3 / vec4
function setUniformValue(
  gl, loc, value
) {
  if ( loc === null || loc < 0 ) {
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
 * Create a GPU peaks-field renderer for one sketch.
 *
 * @param {object} sources
 * @param {string} sources.pointBody GLSL defining computePoint() (+ its own
 *   uniforms). The stdlib (perlinNoise, mapEase, applyEasing, paletteRainbow,
 *   constants) and the common uniforms (uMV, uP, uResolution, uEdgePad,
 *   uOctaves, uFalloff, uPerlin) are injected automatically.
 * @returns {{ render: Function }}
 */
export default function createPeaksFieldRenderer( {
  pointBody
} ) {
  // GL resources belong to one context, and one of this renderer serves every
  // surface its module ever draws on — the page across re-navigations, and
  // every layer embedding the sketch — so they are kept per surface. See
  // instanceState.js; glowBatchGpu.js has the full story.
  const store = createKeyedStore(
    getP5,
    () => ( {
      graphics: null,
      program: null,
      quadVBO: null,
      cellVBO: null,
      cellCount: 0,
      gridKey: null,
      perlinTexture: null,
      perlinSeed: null,
      locs: {},
      ctxRef: null,
      ext: null,
      aCornerLoc: -1,
      aCellLoc: -1
    } )
  );

  // Rebound on entry to render(), the one public call.
  let state = null;

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

  function getLocation( name ) {
    if ( !( name in state.locs ) ) {
      state.locs[ name ] = state.gl.getUniformLocation(
        state.program,
        name
      );
    }

    return state.locs[ name ];
  }

  function ensureProgram( gl ) {
    if ( state.ctxRef === gl && state.program ) {
      return true;
    }

    if ( state.program ) {
      gl.deleteProgram( state.program );
    }

    const stdlib = CONSTANTS_GLSL + PERLIN_GLSL + MAPPERS_GLSL + EASINGS_GLSL + MAPEASE_GLSL + PALETTE_GLSL;

    state.program = buildProgram(
      gl,
      stdlib + VERT_HEADER + pointBody + VERT_MAIN,
      FRAG_SRC
    );

    state.locs = {};
    state.gl = gl;
    state.perlinTexture = null;
    state.perlinSeed = null;
    state.cellVBO = null;
    state.gridKey = null;
    state.quadVBO = null;
    state.ctxRef = gl;
    state.ext = getInstancingExt( gl );

    if ( !state.program ) {
      return false;
    }

    if ( !isWebGL2( gl ) && !state.ext ) {
      console.error( "Peaks field needs WebGL2 or ANGLE_instanced_arrays." );
      return false;
    }

    state.aCornerLoc = gl.getAttribLocation(
      state.program,
      "aCorner"
    );
    state.aCellLoc = gl.getAttribLocation(
      state.program,
      "aCell"
    );

    state.quadVBO = gl.createBuffer();

    // Unit quad in [-1, 1], two triangles.
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

    return true;
  }

  // Upload one (col, row, layer) triple per instance. Rebuilt only when the grid
  // dimensions change — the per-frame cost is then just uniforms + matrices.
  function ensureCells(
    gl, meridians, rows, layers
  ) {
    const key = `${ meridians }x${ rows }x${ layers }`;

    if ( state.gridKey === key && state.cellVBO ) {
      return;
    }

    const count = meridians * rows * layers;
    const data = new Float32Array( count * 3 );
    let i = 0;

    for ( let col = 0; col < meridians; col++ ) {
      for ( let row = 0; row < rows; row++ ) {
        for ( let layer = 0; layer < layers; layer++ ) {
          data[ i++ ] = col;
          data[ i++ ] = row;
          data[ i++ ] = layer;
        }
      }
    }

    if ( !state.cellVBO ) {
      state.cellVBO = gl.createBuffer();
    }

    gl.bindBuffer(
      gl.ARRAY_BUFFER,
      state.cellVBO
    );
    gl.bufferData(
      gl.ARRAY_BUFFER,
      data,
      gl.STATIC_DRAW
    );

    state.cellCount = count;
    state.gridKey = key;
  }

  function uploadPerlinTexture(
    gl, seed
  ) {
    if ( !state.perlinTexture ) {
      state.perlinTexture = gl.createTexture();
    }

    writePerlinTexture(
      gl,
      state.perlinTexture,
      seed
    );

    state.perlinSeed = seed;
  }

  /**
   * Render one frame of the peaks field and composite it onto the main canvas.
   *
   * @param {object} params
   * @param {{x:number,y:number,z:number}} [params.rotation]  rotateX/Y/Z (radians),
   *   baked into the model-view in p5's order so the wobble matches the original.
   * @param {object} params.grid           { meridians, parallels, layers }
   * @param {number} [params.seed=42]      noise seed
   * @param {number} [params.octaves=4]    noiseDetail octaves (clamped to 8)
   * @param {number} [params.falloff=0.5]  noiseDetail falloff
   * @param {object} [params.uniforms]     sketch-specific uniforms (see setUniformValue)
   */
  function render( {
    rotation = {
      x: 0,
      y: 0,
      z: 0
    },
    grid,
    seed = 42,
    octaves = 4,
    falloff = 0.5,
    uniforms = {}
  } ) {
    state = store.current();

    const p = getP5();
    const g = ensureGraphics();
    const gl = g.drawingContext;

    if ( !ensureProgram( gl ) ) {
      return;
    }

    const meridians = Math.max(
      1,
      Math.round( grid.meridians )
    );
    const parallels = Math.max(
      1,
      Math.round( grid.parallels )
    );
    const layers = Math.max(
      1,
      Math.round( grid.layers )
    );

    ensureCells(
      gl,
      meridians,
      parallels,
      layers
    );

    if ( state.perlinSeed !== seed ) {
      uploadPerlinTexture(
        gl,
        seed
      );
    }

    const width = g.width;
    const height = g.height;

    // Reproduce p5's default-camera model-view + projection in JS, so the result
    // is independent of p5's internal matrix layout.
    const mvMat = modelViewMat4( rotation );
    const pMat = perspectiveMat4(
      width,
      height
    );

    gl.viewport(
      0,
      0,
      gl.drawingBufferWidth,
      gl.drawingBufferHeight
    );
    gl.enable( gl.DEPTH_TEST );
    gl.depthFunc( gl.LEQUAL );
    gl.depthMask( true );
    gl.enable( gl.BLEND );
    gl.blendFunc(
      gl.ONE,
      gl.ONE_MINUS_SRC_ALPHA
    );
    gl.clearColor(
      0,
      0,
      0,
      0
    );
    gl.clearDepth( 1.0 );
    gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );

    gl.useProgram( state.program );

    gl.uniformMatrix4fv(
      getLocation( "uMV" ),
      false,
      mvMat
    );
    gl.uniformMatrix4fv(
      getLocation( "uP" ),
      false,
      pMat
    );

    setUniformValue(
      gl,
      getLocation( "uResolution" ),
      [
        width,
        height
      ]
    );
    setUniformValue(
      gl,
      getLocation( "uEdgePad" ),
      EDGE_PAD
    );
    setUniformValue(
      gl,
      getLocation( "uOctaves" ),
      {
        int: Math.min(
          octaves,
          MAX_OCTAVES
        )
      }
    );
    setUniformValue(
      gl,
      getLocation( "uFalloff" ),
      falloff
    );

    gl.activeTexture( gl.TEXTURE0 );
    gl.bindTexture(
      gl.TEXTURE_2D,
      state.perlinTexture
    );
    setUniformValue(
      gl,
      getLocation( "uPerlin" ),
      {
        int: 0
      }
    );

    for ( const [
      name,
      value
    ] of Object.entries( uniforms ) ) {
      setUniformValue(
        gl,
        getLocation( name ),
        value
      );
    }

    gl.bindBuffer(
      gl.ARRAY_BUFFER,
      state.quadVBO
    );
    gl.enableVertexAttribArray( state.aCornerLoc );
    gl.vertexAttribPointer(
      state.aCornerLoc,
      2,
      gl.FLOAT,
      false,
      0,
      0
    );
    setDivisor(
      gl,
      state.ext,
      state.aCornerLoc,
      0
    );

    gl.bindBuffer(
      gl.ARRAY_BUFFER,
      state.cellVBO
    );
    gl.enableVertexAttribArray( state.aCellLoc );
    gl.vertexAttribPointer(
      state.aCellLoc,
      3,
      gl.FLOAT,
      false,
      0,
      0
    );
    setDivisor(
      gl,
      state.ext,
      state.aCellLoc,
      1
    );

    drawArraysInstanced(
      gl,
      state.ext,
      gl.TRIANGLES,
      0,
      6,
      state.cellCount
    );

    // Restore GL state so p5 keeps working with the buffer.
    gl.disableVertexAttribArray( state.aCornerLoc );
    gl.disableVertexAttribArray( state.aCellLoc );
    setDivisor(
      gl,
      state.ext,
      state.aCellLoc,
      0
    );
    gl.bindBuffer(
      gl.ARRAY_BUFFER,
      null
    );
    gl.disable( gl.DEPTH_TEST );
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

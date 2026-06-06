import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import graphics from "@/p5/utils/graphics.js";
import animation from "@/p5/utils/animation.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";

// ─────────────────────────────────────────────────────────────────────────────
// GPU port of the "noise grid with rotation" sketch.
//
// The original drew a grid of coloured dots one by one on the CPU, sampling
// p5's Perlin noise per cell every frame and building string cache keys that
// never repeated (the scene angle changes each frame), so the cache grew
// without bound. Here the whole field is drawn in a single full-screen
// fragment shader: each pixel finds the dot it belongs to, samples the exact
// same Perlin noise on the GPU, and shades it. Pixels outside any dot bail out
// before touching the noise, so only the painted area pays for it.
//
// p5's Perlin noise is reproduced bit-for-bit by uploading its 4096-entry
// permutation table (seeded with the same LCG as p5's noiseSeed) into a
// texture the shader reads from.
// ─────────────────────────────────────────────────────────────────────────────

// Up to this many octaves are evaluated on the GPU. The original form caps
// detail higher, but past a dozen octaves the contribution is negligible and
// the noise indices would lose float precision, so we clamp here.
const MAX_OCTAVES = 12;

const VERT_SRC = `
  precision highp float;

  attribute vec2 aPos; // full-screen quad in clip space (-1..1)
  varying vec2 vUv;    // 0..1 across the quad

  void main() {
    vUv = aPos * 0.5 + 0.5;
    gl_Position = vec4(aPos, 0.0, 1.0);
  }
`;

const FRAG_SRC = `
  precision highp float;

  #define MAX_OCT ${ MAX_OCTAVES }

  varying vec2 vUv;

  uniform vec2  uResolution;
  uniform vec2  uCenter;
  uniform float uColumns;     // cell count (noise input divisor, as in the original)
  uniform float uRows;
  uniform float uCellWidth;   // pixels
  uniform float uCellHeight;  // pixels
  uniform float uRadius;      // dot radius in pixels (strokeWeight / 2)
  uniform float uSceneAngle;
  uniform float uAngleCycles;
  uniform float uHueRange;
  uniform float uHueOffset;
  uniform float uOpacityFactor;
  uniform int   uOctaves;
  uniform float uFalloff;
  uniform sampler2D uPerlin;  // 64x64 RGBA8, packed permutation table (4096 entries)

  const float PI  = 3.141592653589793;
  const float TAU = 6.283185307179586;

  // p5 Perlin constants (2D path, z always 0 in this sketch).
  const float PERLIN_YWRAP = 16.0;  // 1 << PERLIN_YWRAPB (PERLIN_YWRAPB = 4)
  const float PERLIN_SIZE  = 4096.0;

  // Read entry "index" of the permutation table from the packed texture.
  float perlinLookup(float index) {
    float wrapped = mod(index, PERLIN_SIZE);
    float u = mod(wrapped, 64.0);
    float v = floor(wrapped / 64.0);
    vec2 uv = (vec2(u, v) + 0.5) / 64.0;
    vec4 packed = texture2D(uPerlin, uv);

    return dot(packed, vec4(1.0, 1.0 / 255.0, 1.0 / 65025.0, 1.0 / 16581375.0));
  }

  float scaledCosine(float i) {
    return 0.5 * (1.0 - cos(i * PI));
  }

  // Faithful port of p5.prototype.noise for the 2D (z = 0) case.
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

  // Same rotation as the original rotatePoint() helper.
  vec2 rotateAroundCenter(vec2 v) {
    float c = cos(uSceneAngle);
    float s = sin(uSceneAngle);
    vec2 d = v - uCenter;

    return vec2(c * d.x + s * d.y, c * d.y - s * d.x) + uCenter;
  }

  // Reproduces colors.rainbow({ hueOffset, hueIndex, opacityFactor }).
  // p5 builds the colour in 0..360 then divides by opacityFactor in 0..255
  // RGB space (values are clamped to 255 by p5).
  vec3 rainbow(float hueIndex) {
    float a = uHueOffset + hueIndex;
    float b = uHueOffset - hueIndex;

    float red   = (sin(a) * 0.5 + 0.5) * 360.0 / uOpacityFactor;
    float green = (1.0 - cos(b)) * 0.5 * 360.0 / uOpacityFactor;
    float blue  = (1.0 - sin(a)) * 0.5 * 360.0 / uOpacityFactor;

    return clamp(vec3(red, green, blue) / 255.0, 0.0, 1.0);
  }

  vec3 dotColor(vec2 cellCenter) {
    vec2 rotated = rotateAroundCenter(cellCenter);
    float noiseValue = perlinNoise(vec2(rotated.x / uColumns, rotated.y / uRows));
    float angle = noiseValue * TAU * uAngleCycles;
    float hueIndex = -uHueRange + (angle / TAU) * 2.0 * uHueRange;

    return rainbow(hueIndex);
  }

  void main() {
    // Pixel coordinates with the same top-left origin p5 uses in 2D.
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

// ─── WebGL helpers (same approach as peaks-cone) ──────────────────────────────
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

// ─── Sketch state ─────────────────────────────────────────────────────────────
const sketchState = {
  graphics: null,
  gpu: {
    program: null,
    quadVBO: null,
    perlinTexture: null,
    perlinSeed: null,
    locs: null,
    ctxRef: null
  }
};

function uploadPerlinTexture(
  gl, seed
) {
  const gpu = sketchState.gpu;

  if ( !gpu.perlinTexture ) {
    gpu.perlinTexture = gl.createTexture();
  }

  gl.bindTexture(
    gl.TEXTURE_2D,
    gpu.perlinTexture
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

  gpu.perlinSeed = seed;
}

function initGPU( gl ) {
  const gpu = sketchState.gpu;

  if ( gpu.program ) {
    gl.deleteProgram( gpu.program );
  }

  gpu.program = buildProgram(
    gl,
    VERT_SRC,
    FRAG_SRC
  );

  if ( !gpu.program ) {
    return false;
  }

  const pr = gpu.program;

  gpu.locs = {
    aPos: gl.getAttribLocation(
      pr,
      "aPos"
    ),
    uResolution: gl.getUniformLocation(
      pr,
      "uResolution"
    ),
    uCenter: gl.getUniformLocation(
      pr,
      "uCenter"
    ),
    uColumns: gl.getUniformLocation(
      pr,
      "uColumns"
    ),
    uRows: gl.getUniformLocation(
      pr,
      "uRows"
    ),
    uCellWidth: gl.getUniformLocation(
      pr,
      "uCellWidth"
    ),
    uCellHeight: gl.getUniformLocation(
      pr,
      "uCellHeight"
    ),
    uRadius: gl.getUniformLocation(
      pr,
      "uRadius"
    ),
    uSceneAngle: gl.getUniformLocation(
      pr,
      "uSceneAngle"
    ),
    uAngleCycles: gl.getUniformLocation(
      pr,
      "uAngleCycles"
    ),
    uHueRange: gl.getUniformLocation(
      pr,
      "uHueRange"
    ),
    uHueOffset: gl.getUniformLocation(
      pr,
      "uHueOffset"
    ),
    uOpacityFactor: gl.getUniformLocation(
      pr,
      "uOpacityFactor"
    ),
    uOctaves: gl.getUniformLocation(
      pr,
      "uOctaves"
    ),
    uFalloff: gl.getUniformLocation(
      pr,
      "uFalloff"
    ),
    uPerlin: gl.getUniformLocation(
      pr,
      "uPerlin"
    )
  };

  if ( !gpu.quadVBO ) {
    gpu.quadVBO = gl.createBuffer();

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
      gpu.quadVBO
    );
    gl.bufferData(
      gl.ARRAY_BUFFER,
      quad,
      gl.STATIC_DRAW
    );
  }

  gpu.perlinTexture = null;
  gpu.perlinSeed = null;
  gpu.ctxRef = gl;
  return true;
}

// ─── Setup ────────────────────────────────────────────────────────────────────
sketch.setup(
  async() => {
    const p = getP5();

    sketchState.graphics = graphics.createAutoResizableGraphics(
      p.width,
      p.height,
      "webgl"
    );
  },
  {}
);

// ─── Draw ─────────────────────────────────────────────────────────────────────
sketch.draw( (
  _time, center
) => {
  const p = getP5();

  p.clear();
  p.background( ...( options.sketch.backgroundColor ?? [
    0
  ] ) );

  const g = sketchState.graphics;
  const gpu = sketchState.gpu;
  const gl = g.drawingContext;

  // (Re)build the GPU program if the context was recreated (e.g. on resize).
  if ( gpu.ctxRef !== gl ) {
    if ( !initGPU( gl ) ) {
      renderTitle();
      return;
    }
  }

  const rows = options.sketch.grid?.rows ?? 40;
  const columns = options.sketch.grid?.columns ?? 40;

  const seed = options.sketch.noise?.seed ?? 42;
  const octaves = Math.min(
    options.sketch.noise?.detail ?? 4,
    MAX_OCTAVES
  );
  const falloff = options.sketch.noise?.falloff ?? 0.3;

  if ( gpu.perlinSeed !== seed ) {
    uploadPerlinTexture(
      gl,
      seed
    );
  }

  const angleCycles = options.sketch.angle?.cycles ?? 4;
  const rotationAngleMax = options.sketch.rotation?.angleMax ?? p.PI / 2;
  const rotationSpeed = options.sketch.rotation?.speed ?? 1;
  const sceneAngle = p.map(
    p.sin( animation.angle * rotationSpeed ),
    -1,
    1,
    -rotationAngleMax,
    rotationAngleMax
  );

  const hueRange = options.sketch.colors?.hueRange ?? p.PI / 2;
  const hueOffset = options.sketch.colors?.hueOffset ?? 0;
  const opacityFactor = options.sketch.colors?.opacityFactor ?? 1.5;
  const strokeWeight = options.sketch.stroke?.weight ?? 10;

  const width = g.width;
  const height = g.height;
  const cellWidth = width / columns;
  const cellHeight = height / rows;

  // ── Render the field into the off-screen WebGL buffer ──────────────────────
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

  gl.useProgram( gpu.program );

  gl.uniform2f(
    gpu.locs.uResolution,
    width,
    height
  );
  gl.uniform2f(
    gpu.locs.uCenter,
    center.x,
    center.y
  );
  gl.uniform1f(
    gpu.locs.uColumns,
    columns
  );
  gl.uniform1f(
    gpu.locs.uRows,
    rows
  );
  gl.uniform1f(
    gpu.locs.uCellWidth,
    cellWidth
  );
  gl.uniform1f(
    gpu.locs.uCellHeight,
    cellHeight
  );
  gl.uniform1f(
    gpu.locs.uRadius,
    strokeWeight / 2
  );
  gl.uniform1f(
    gpu.locs.uSceneAngle,
    sceneAngle
  );
  gl.uniform1f(
    gpu.locs.uAngleCycles,
    angleCycles
  );
  gl.uniform1f(
    gpu.locs.uHueRange,
    hueRange
  );
  gl.uniform1f(
    gpu.locs.uHueOffset,
    hueOffset
  );
  gl.uniform1f(
    gpu.locs.uOpacityFactor,
    opacityFactor
  );
  gl.uniform1i(
    gpu.locs.uOctaves,
    octaves
  );
  gl.uniform1f(
    gpu.locs.uFalloff,
    falloff
  );

  gl.activeTexture( gl.TEXTURE0 );
  gl.bindTexture(
    gl.TEXTURE_2D,
    gpu.perlinTexture
  );
  gl.uniform1i(
    gpu.locs.uPerlin,
    0
  );

  gl.bindBuffer(
    gl.ARRAY_BUFFER,
    gpu.quadVBO
  );
  gl.enableVertexAttribArray( gpu.locs.aPos );
  gl.vertexAttribPointer(
    gpu.locs.aPos,
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

  // ── Restore GL state so p5 can keep using the buffer cleanly ───────────────
  gl.disableVertexAttribArray( gpu.locs.aPos );
  gl.bindBuffer(
    gl.ARRAY_BUFFER,
    null
  );
  g.resetShader();

  // ── Composite onto the main canvas ─────────────────────────────────────────
  p.image(
    g,
    0,
    0
  );

  renderTitle();
} );

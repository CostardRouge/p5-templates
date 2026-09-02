import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";

import colors from "@/p5/utils/colors.js";
import easing from "@/p5/utils/easing.js";

import mappers from "@/p5/utils/mappers.js";
import graphics from "@/p5/utils/graphics.js";
import animation from "@/p5/utils/animation.js";

// ─────────────────────────────────────────────────────────────────────────────
// GLSL vertex shader (GLSL ES 1.00, works in both WebGL1 and WebGL2)
// ─────────────────────────────────────────────────────────────────────────────
// Each "unit cone" vertex carries (theta, layer_t).
// Per-instance (per spike) data carries position, normal, length, color.
// The vertex shader constructs the final 3D cone point on the GPU.
//
// Profile modes (uProfile uniform):
//   0 = cone     radius = (1-t)        — classic spike
//   1 = droplet  radius = sin(t·π)     — blob shape
//   2 = tube     radius = constant     — cylinder spike
//   3 = bulge    radius = 4t(1-t)      — wide middle, narrow ends
//
// Morphing: change uProfile between 0-3 (fractional values lerp profiles).
// Twist:    set uTwist > 0 for a DNA/corkscrew effect.
// ─────────────────────────────────────────────────────────────────────────────
const VERT_SRC = `
  precision highp float;

  attribute vec2 aUnit;
  attribute vec4 aPos;
  attribute vec4 aNrm;
  attribute vec4 aCol;

  uniform mat4 uMV;
  uniform mat4 uP;
  uniform float uProfile;
  uniform float uTaper;
  uniform float uTwist;
  uniform float uPtBase;
  uniform float uPtTip;

  varying vec4 vCol;

  float profileRadius(float t) {
    float pA = 1.0 - t;
    float pB = sin(t * 3.14159265);
    float pC = 0.4;
    float pD = 4.0 * t * (1.0 - t);

    float blendAB = mix(pA, pB, clamp(uProfile - 0.0, 0.0, 1.0));
    float blendBC = mix(pB, pC, clamp(uProfile - 1.0, 0.0, 1.0));
    float blendCD = mix(pC, pD, clamp(uProfile - 2.0, 0.0, 1.0));

    if (uProfile < 1.0) return blendAB;
    if (uProfile < 2.0) return blendBC;
    return blendCD;
  }

  void main() {
    float theta  = aUnit.x;
    float layerT = aUnit.y;
    vec3  pos    = aPos.xyz;
    float slen   = aPos.w;
    vec3  normal = normalize(aNrm.xyz);

    float h   = (1.0 - layerT) * slen;
    float rad = profileRadius(layerT) * slen * uTaper;
    float tw  = theta + uTwist * h;

    vec3 up    = abs(normal.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
    vec3 tan   = normalize(cross(normal, up));
    vec3 bitan = cross(normal, tan);

    vec3 wp = pos
      + normal * h
      + tan    * cos(tw) * rad
      + bitan  * sin(tw) * rad;

    gl_Position  = uP * uMV * vec4(wp, 1.0);
    gl_PointSize = mix(uPtTip, uPtBase, layerT);
    vCol         = aCol;
  }
`;

const FRAG_SRC = `
  precision mediump float;
  varying vec4 vCol;
  void main() {
    gl_FragColor = vCol;
  }
`;

// ─── WebGL helpers ────────────────────────────────────────────────────────────
function compileShader(
  gl, type, src
) {
  const sh = gl.createShader( type );

  gl.shaderSource(
    sh,
    src
  );
  gl.compileShader( sh );

  if ( !gl.getShaderParameter(
    sh,
    gl.COMPILE_STATUS
  ) ) {
    console.error(
      "Shader compile error:",
      gl.getShaderInfoLog( sh )
    );
    gl.deleteShader( sh );
    return null;
  }

  return sh;
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
  const prog = gl.createProgram();

  gl.attachShader(
    prog,
    vert
  );
  gl.attachShader(
    prog,
    frag
  );
  gl.linkProgram( prog );

  if ( !gl.getProgramParameter(
    prog,
    gl.LINK_STATUS
  ) ) {
    console.error(
      "Program link error:",
      gl.getProgramInfoLog( prog )
    );
    return null;
  }

  gl.deleteShader( vert );
  gl.deleteShader( frag );
  return prog;
}

// Returns true if the context is WebGL2 (supports native instancing + divisors).
function isWGL2( gl ) {
  return typeof WebGL2RenderingContext !== "undefined"
    && gl instanceof WebGL2RenderingContext;
}

function setDivisor(
  gl, ext, loc, divisor
) {
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

function drawInstanced(
  gl, ext, count, instances
) {
  if ( ext ) {
    ext.drawArraysInstancedANGLE(
      gl.POINTS,
      0,
      count,
      instances
    );
  } else {
    gl.drawArraysInstanced(
      gl.POINTS,
      0,
      count,
      instances
    );
  }
}

// Bind a float attribute from the currently-bound ARRAY_BUFFER.
function bindAttrib(
  gl, loc, size, stride, offset
) {
  gl.enableVertexAttribArray( loc );
  gl.vertexAttribPointer(
    loc,
    size,
    gl.FLOAT,
    false,
    stride,
    offset
  );
}

// Extract [r,g,b,a] as 0–1 floats from a p5.Color created by colors.rainbow.
function colorLevels( c ) {
  const lvl = c?.levels ?? [
    255,
    255,
    255,
    255
  ];

  return [
    lvl[ 0 ] / 255,
    lvl[ 1 ] / 255,
    lvl[ 2 ] / 255,
    lvl[ 3 ] / 255
  ];
}

// ─── Build static unit-cone VBO ───────────────────────────────────────────────
// Vertex layout: [theta, layer_t] — 2 floats per vertex.
// N_THETA segments × N_LAYERS layers; outer=layer, inner=segment.
function buildStaticVBO(
  gl, nTheta, nLayers
) {
  const data = new Float32Array( nTheta * nLayers * 2 );
  let i = 0;

  for ( let l = 0; l < nLayers; l++ ) {
    const layerT = nLayers > 1
      ? l / ( nLayers - 1 )
      : 1.0;

    for ( let t = 0; t < nTheta; t++ ) {
      data[ i++ ] = ( t / nTheta ) * Math.PI * 2;
      data[ i++ ] = layerT;
    }
  }

  const vbo = gl.createBuffer();

  gl.bindBuffer(
    gl.ARRAY_BUFFER,
    vbo
  );
  gl.bufferData(
    gl.ARRAY_BUFFER,
    data,
    gl.STATIC_DRAW
  );
  return vbo;
}

// ─── Sketch state ─────────────────────────────────────────────────────────────
const sketchState = sketch.state( () => ( {
  threeDimensionGraphics: null,
  gpu: {
    prog: null,
    staticVBO: null,
    instVBO: null,
    nUnit: 0,
    instBuf: null,
    locs: null,
    ext: null, // ANGLE_instanced_arrays (WebGL1) or null (WebGL2)
    ctxRef: null // detect graphics recreation
  }
} ) );

// ─── GPU initialisation ───────────────────────────────────────────────────────
function initGPU(
  g, nTheta, nLayers
) {
  const gl = g.drawingContext;
  const gpu = sketchState.gpu;

  gpu.ext = isWGL2( gl )
    ? null
    : gl.getExtension( "ANGLE_instanced_arrays" );

  if ( !isWGL2( gl ) && !gpu.ext ) {
    console.error( "Neither WebGL2 nor ANGLE_instanced_arrays is available." );
    return false;
  }

  if ( gpu.prog ) {
    gl.deleteProgram( gpu.prog );
  }

  gpu.prog = buildProgram(
    gl,
    VERT_SRC,
    FRAG_SRC
  );

  if ( !gpu.prog ) {
    return false;
  }

  const pr = gpu.prog;

  gpu.locs = {
    aUnit: gl.getAttribLocation(
      pr,
      "aUnit"
    ),
    aPos: gl.getAttribLocation(
      pr,
      "aPos"
    ),
    aNrm: gl.getAttribLocation(
      pr,
      "aNrm"
    ),
    aCol: gl.getAttribLocation(
      pr,
      "aCol"
    ),
    uMV: gl.getUniformLocation(
      pr,
      "uMV"
    ),
    uP: gl.getUniformLocation(
      pr,
      "uP"
    ),
    uProfile: gl.getUniformLocation(
      pr,
      "uProfile"
    ),
    uTaper: gl.getUniformLocation(
      pr,
      "uTaper"
    ),
    uTwist: gl.getUniformLocation(
      pr,
      "uTwist"
    ),
    uPtBase: gl.getUniformLocation(
      pr,
      "uPtBase"
    ),
    uPtTip: gl.getUniformLocation(
      pr,
      "uPtTip"
    )
  };

  if ( gpu.staticVBO ) {
    gl.deleteBuffer( gpu.staticVBO );
  }

  gpu.staticVBO = buildStaticVBO(
    gl,
    nTheta,
    nLayers
  );
  gpu.nUnit = nTheta * nLayers;

  if ( gpu.instVBO ) {
    gl.deleteBuffer( gpu.instVBO );
  }

  gpu.instVBO = gl.createBuffer();
  gpu.ctxRef = gl;
  return true;
}

// ─── Setup ───────────────────────────────────────────────────────────
sketch.setup(
  async() => {
    const p = getP5();

    sketchState.threeDimensionGraphics = graphics.createAutoResizableGraphics(
      p.width,
      p.height,
      "webgl"
    );
  },
  {}
);

// ─── Draw ─────────────────────────────────────────────────────────────────────
sketch.draw( (
  time, center
) => {
  const p = getP5();

  p.clear();
  p.background( ...( options.sketch.backgroundColor ?? [
    0
  ] ) );

  const g = sketchState.threeDimensionGraphics;
  const gpu = sketchState.gpu;

  // ── Sphere surface ────────────────────────────────────────────────────────
  const radiusX = options.sketch.sphere?.radiusX ?? 200;
  const radiusY = options.sketch.sphere?.radiusY ?? 200;
  const radiusZ = options.sketch.sphere?.radiusZ ?? 200;
  const meridians = options.sketch.sphere?.meridians ?? 28;
  const parallels = options.sketch.sphere?.parallels ?? 16;

  // ── Cone shape ────────────────────────────────────────────────────────────
  // nTheta: cross-section segments per cone (≥1; 1 = flat line spike)
  // layers: points along the spike height
  // profileType: 0=cone 1=droplet 2=tube 3=bulge (can be fractional → GPU lerps)
  // taper: ratio of max cone radius to spike length
  // twist: radians of rotation added per unit height (GPU-side, free to animate)
  const nTheta = options.sketch.cone?.nTheta ?? 6;
  const layers = options.sketch.cone?.layers ?? 80;
  const profileType = options.sketch.cone?.profileType ?? 0;
  const coneTaper = options.sketch.cone?.taper ?? 0.12;
  const twist = options.sketch.cone?.twist ?? 0;

  // ── Peaks ─────────────────────────────────────────────────────────────────
  const spikeLengthMax = options.sketch.peaks?.spikeLengthMax ?? 200;
  const spikeLengthMin = options.sketch.peaks?.spikeLengthMin ?? 0;
  const strokeWeightMin = options.sketch.peaks?.point?.strokeWeightMin ?? 1;
  const strokeWeightMax = options.sketch.peaks?.point?.strokeWeightMax ?? 12;

  // ── Surface noise ─────────────────────────────────────────────────────────
  const surfaceNoiseScale = options.sketch.surface?.noiseScale ?? 1.5;
  const surfaceNoiseSpeed = options.sketch.surface?.noiseSpeed ?? 0.15;
  const surfaceAnimated = options.sketch.surface?.animated ?? true;
  const surfaceContrast = options.sketch.surface?.contrast ?? 1;
  const surfaceContrastEasingFn = easing?.[ options.sketch.surface?.contrastEasing ] ?? easing.easeInQuad;
  const surfaceOffset = options.sketch.surface?.noiseOffset ?? 0;
  const surfaceTime = surfaceAnimated ? animation.angle * surfaceNoiseSpeed : 0;

  // ── Rotation ──────────────────────────────────────────────────────────────
  const rotationEnabled = options.sketch.rotation?.enabled ?? true;
  const angleMax = options.sketch.rotation?.angleMax ?? ( p.PI / 16 );
  const xMultiplier = options.sketch.rotation?.xMultiplier ?? 1;
  const yMultiplier = options.sketch.rotation?.yMultiplier ?? 2;
  const zMultiplier = options.sketch.rotation?.zMultiplier ?? 0;

  const rX = rotationEnabled
    ? mappers.fn(
      p.sin( animation.angle * xMultiplier ),
      -1,
      1,
      -angleMax,
      angleMax
    )
    : 0;
  const rY = rotationEnabled
    ? mappers.fn(
      p.cos( animation.angle * yMultiplier ),
      -1,
      1,
      -angleMax,
      angleMax
    )
    : 0;
  const rZ = rotationEnabled
    ? mappers.fn(
      p.sin( animation.angle * zMultiplier ),
      -1,
      1,
      -angleMax,
      angleMax
    )
    : 0;

  // ── Noise ─────────────────────────────────────────────────────────────────
  p.noiseSeed( options.sketch.noise?.seed ?? 42 );
  p.noiseDetail(
    options.sketch.noise?.detail ?? 4,
    options.sketch.noise?.falloff ?? 0.5
  );

  const noiseXMult = options.sketch.noise?.xMultiplier ?? 1;
  const noiseYMult = options.sketch.noise?.yMultiplier ?? 1;
  const noiseLayerMult = options.sketch.noise?.layerProgressionMultiplier ?? 0.4;
  const noiseAnimMult = options.sketch.noise?.animMultiplier ?? 0.3;

  // ── Colors ────────────────────────────────────────────────────────────────
  const colorFunction = colors.rainbow;
  const opacityMax = options.sketch.colors?.opacityMax ?? 4;
  const opacityMin = options.sketch.colors?.opacityMin ?? 1;
  const progressionMultiplier = options.sketch.colors?.progressionMultiplier ?? 1;
  const layerProgressionMult = options.sketch.colors?.layerProgressionMultiplier ?? 1;
  const hueIndexMultiplier = options.sketch.colors?.hueIndexMultiplier ?? 5;
  const hueSurfaceMixing = options.sketch.colors?.hueSurfaceMixing ?? 0.3;
  const hueOffset = options.sketch.colors?.hueOffset ?? 0;
  const hueIndexEasingFn = easing?.[ options.sketch.colors?.hueIndexEasing ] ?? easing.easeOutSine;
  const opacityEasingFn = easing?.[ options.sketch.colors?.opacityEasing ] ?? easing.easeInCirc;

  // ── GPU init / reinit (on first frame or when cone shape changes) ─────────
  const gl = g.drawingContext;
  const needsInit = gpu.ctxRef !== gl || gpu.nUnit !== nTheta * layers;

  if ( needsInit ) {
    const ok = initGPU(
      g,
      nTheta,
      layers
    );

    if ( !ok ) {
      return;
    }
  }

  // ── Apply rotations through p5 to get its internal matrices ───────────────
  // We push/pop so p5 draws nothing itself; we only need the matrix state.
  g.push();
  g.rotateX( rX );
  g.rotateY( rY );
  g.rotateZ( rZ );

  const mvMat = g._renderer.uMVMatrix.mat4.slice();
  const pMat = g._renderer.uPMatrix.mat4.slice();

  g.pop();

  // ── CPU loop: fill per-spike instance buffer ───────────────────────────────
  // Instance layout (12 floats = 48 bytes per spike):
  //   [0]  posX  [1]  posY  [2]  posZ  [3]  effectiveSpikeLen
  //   [4]  nrmX  [5]  nrmY  [6]  nrmZ  [7]  pad
  //   [8]  r     [9]  g     [10] b     [11] a   (normalized 0-1)
  const STRIDE = 12;
  const totalSpikes = meridians * parallels;

  if ( !gpu.instBuf || gpu.instBuf.length !== totalSpikes * STRIDE ) {
    gpu.instBuf = new Float32Array( totalSpikes * STRIDE );
  }

  const instBuf = gpu.instBuf;
  let instIdx = 0;

  for ( let col = 0; col < meridians; col++ ) {
    const colNorm = col / meridians;
    const theta = colNorm * p.TWO_PI;

    for ( let row = 0; row < parallels; row++ ) {
      const rowNorm = row / ( parallels - 1 );
      const phi = rowNorm * p.PI;
      const sinPhi = p.sin( phi );
      const cosPhi = p.cos( phi );
      const sinTheta = p.sin( theta );
      const cosTheta = p.cos( theta );

      const posX = radiusX * sinPhi * cosTheta;
      const posY = radiusY * cosPhi;
      const posZ = radiusZ * sinPhi * sinTheta;

      // Outward ellipsoid normal: gradient of f(x,y,z) = x²/rx² + y²/ry² + z²/rz² at the surface
      const nxRaw = posX / ( radiusX * radiusX );
      const nyRaw = posY / ( radiusY * radiusY );
      const nzRaw = posZ / ( radiusZ * radiusZ );
      const nLen = Math.sqrt( nxRaw * nxRaw + nyRaw * nyRaw + nzRaw * nzRaw ) || 1;
      const nX = nxRaw / nLen;
      const nY = nyRaw / nLen;
      const nZ = nzRaw / nLen;

      // Surface noise → spike length
      const surfNoise = p.noise(
        colNorm * surfaceNoiseScale + surfaceOffset,
        rowNorm * surfaceNoiseScale,
        surfaceTime
      );
      const surfFactor = mappers.fn(
        surfNoise,
        0,
        1,
        0,
        surfaceContrast,
        surfaceContrastEasingFn
      );
      const spikeLength = mappers.fn(
        surfFactor,
        0,
        surfaceContrast,
        spikeLengthMin,
        spikeLengthMax
      );
      const normSurf = surfaceContrast > 0
        ? surfFactor / surfaceContrast
        : 1;

      // At poles, all meridians share the same point — zero out all but col 0.
      const isPole = row === 0 || row === parallels - 1;
      const effectiveSpikeLen = isPole && col > 0 ? 0 : spikeLength;

      // Color: sample at a representative mid-layer (layerProgression = 0.5)
      const progression = ( col * parallels + row ) / ( totalSpikes - 1 );
      const colorNoise = p.noise(
        colNorm * noiseXMult + rX,
        rowNorm * noiseYMult + rY,
        0.5 * noiseLayerMult + surfaceTime * noiseAnimMult + progression + rZ
      );
      const hueNoise = p.lerp(
        colorNoise,
        normSurf,
        hueSurfaceMixing
      );
      const opacityFactor = mappers.fn(
        p.sin( colorNoise * p.TAU + progression * progressionMultiplier + 0.5 * layerProgressionMult ),
        -1,
        1,
        opacityMax,
        opacityMin,
        opacityEasingFn
      );
      const col4 = colorFunction( {
        hueOffset,
        hueIndex: mappers.fn(
          hueNoise,
          0,
          1,
          -p.PI,
          p.PI,
          hueIndexEasingFn
        ) * hueIndexMultiplier,
        opacityFactor
      } );
      const [
        cr,
        cg,
        cb,
        ca
      ] = colorLevels( col4 );

      const base = instIdx * STRIDE;

      instBuf[ base ] = posX;
      instBuf[ base + 1 ] = posY;
      instBuf[ base + 2 ] = posZ;
      instBuf[ base + 3 ] = effectiveSpikeLen;
      instBuf[ base + 4 ] = nX;
      instBuf[ base + 5 ] = nY;
      instBuf[ base + 6 ] = nZ;
      instBuf[ base + 7 ] = 0;
      instBuf[ base + 8 ] = cr;
      instBuf[ base + 9 ] = cg;
      instBuf[ base + 10 ] = cb;
      instBuf[ base + 11 ] = ca;

      instIdx++;
    }
  }

  // ── Upload per-spike instance data to GPU ─────────────────────────────────
  const BYTES = 4; // bytes per float
  const instStride = STRIDE * BYTES; // 48

  gl.bindBuffer(
    gl.ARRAY_BUFFER,
    gpu.instVBO
  );
  gl.bufferData(
    gl.ARRAY_BUFFER,
    instBuf,
    gl.DYNAMIC_DRAW
  );

  // ── Activate shader and set uniforms ──────────────────────────────────────
  gl.useProgram( gpu.prog );

  gl.uniformMatrix4fv(
    gpu.locs.uMV,
    false,
    mvMat
  );
  gl.uniformMatrix4fv(
    gpu.locs.uP,
    false,
    pMat
  );
  gl.uniform1f(
    gpu.locs.uProfile,
    profileType
  );
  gl.uniform1f(
    gpu.locs.uTaper,
    coneTaper
  );
  gl.uniform1f(
    gpu.locs.uTwist,
    twist
  );
  gl.uniform1f(
    gpu.locs.uPtBase,
    strokeWeightMax
  );
  gl.uniform1f(
    gpu.locs.uPtTip,
    strokeWeightMin
  );

  // ── Bind static VBO (unit cone: theta × layer_t) ──────────────────────────
  gl.bindBuffer(
    gl.ARRAY_BUFFER,
    gpu.staticVBO
  );
  bindAttrib(
    gl,
    gpu.locs.aUnit,
    2,
    8,
    0
  );
  setDivisor(
    gl,
    gpu.ext,
    gpu.locs.aUnit,
    0
  );

  // ── Bind instance VBO (per spike: pos, normal, color) ─────────────────────
  gl.bindBuffer(
    gl.ARRAY_BUFFER,
    gpu.instVBO
  );
  bindAttrib(
    gl,
    gpu.locs.aPos,
    4,
    instStride,
    0
  );
  setDivisor(
    gl,
    gpu.ext,
    gpu.locs.aPos,
    1
  );
  bindAttrib(
    gl,
    gpu.locs.aNrm,
    4,
    instStride,
    16
  );
  setDivisor(
    gl,
    gpu.ext,
    gpu.locs.aNrm,
    1
  );
  bindAttrib(
    gl,
    gpu.locs.aCol,
    4,
    instStride,
    32
  );
  setDivisor(
    gl,
    gpu.ext,
    gpu.locs.aCol,
    1
  );

  // ── Single draw call for all spikes ───────────────────────────────────────
  drawInstanced(
    gl,
    gpu.ext,
    gpu.nUnit,
    totalSpikes
  );

  // ── Restore GL state so p5's next call works correctly ────────────────────
  gl.disableVertexAttribArray( gpu.locs.aUnit );
  gl.disableVertexAttribArray( gpu.locs.aPos );
  gl.disableVertexAttribArray( gpu.locs.aNrm );
  gl.disableVertexAttribArray( gpu.locs.aCol );

  // Reset divisors — p5 doesn't manage these and expects 0
  setDivisor(
    gl,
    gpu.ext,
    gpu.locs.aPos,
    0
  );
  setDivisor(
    gl,
    gpu.ext,
    gpu.locs.aNrm,
    0
  );
  setDivisor(
    gl,
    gpu.ext,
    gpu.locs.aCol,
    0
  );

  gl.bindBuffer(
    gl.ARRAY_BUFFER,
    null
  );

  // Tell p5 to re-bind its own shader on the next draw call
  g.resetShader();

  // ── Composite to main canvas ──────────────────────────────────────────────
  p.image(
    g,
    0,
    0
  );
  g.clear();
  g.reset();
} );
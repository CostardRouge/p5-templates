import graphics from "./graphics.js";
import {
  getP5
} from "./sketch.js";
import {
  createKeyedStore
} from "./instanceState.js";
import {
  PEAKS_STDLIB_GLSL,
  PEAKS_EASING_GLSL,
  buildProgram,
  writePerlinTexture,
  isWebGL2,
  getInstancingExt,
  setDivisor,
  setUniformValue,
  modelViewMat4,
  perspectiveMat4
} from "./peaksFieldGpu.js";

// ─────────────────────────────────────────────────────────────────────────────
// Solid-surface renderer for the "peaks" family — the spikes as MESHES.
//
// The peaks sketches stack p5.point() discs along each spike: the envelope of
// that stack is a surface of revolution whose radius along the spike is the
// stroke-weight curve and whose axial position is the depth-easing curve.
// peaksFieldGpu.js keeps the discs and moves them to the GPU; this renderer
// draws the ENVELOPE instead — one surface of revolution per spike, with real
// normals — so the spikes can be lit, and a material can read the angle between
// the surface and the camera (the iridescent family needs exactly that).
//
// How it is drawn:
//
//   - ONE canonical (t, angle) grid is uploaded as an indexed mesh and drawn
//     instanced, one instance per (col, row) cell of the sketch's grid — like
//     peaksFieldGpu's instanced discs, but a whole spike per instance;
//   - the vertex shader places the spike with the sketch's own GLSL
//     (`computeSpike`: base point, direction, length, radius multiplier — the
//     same surface noise, the same lengths as the CPU original), then puts the
//     vertex on the surface of revolution: hemispherical base cap, the
//     stroke-weight / depth-easing profile, hemispherical tip cap;
//   - normals come from finite differences of that same surface function, so a
//     sketch supplies a POSITION and gets lighting for free — the body does
//     the same with `bodyPoint(t, angle)`, a parametric surface drawn once;
//   - the fragment shader is the sketch's material (`shadeBody`), given the
//     view-space normal and position, and a per-vertex `extra` channel the
//     placement hands it (terrain height, ring depth…).
//
// Pixel units, the wobble and the projection are p5's default camera, exactly
// as peaksFieldGpu.js reproduces it, so a mesh version frames the subject the
// way its disc original does. The buffer may be supersampled (drawn at k× the
// layout size and composited down) because p5's offscreen WEBGL buffers have
// no MSAA by default and a mesh silhouette shows the aliasing a disc does not.
// ─────────────────────────────────────────────────────────────────────────────

const RAMP_UNIT = 1;

// The base and tip caps each take this fraction of the vertex parameter t.
const CAP_FRACTION = 0.12;

const VERT_HEADER = `
  attribute vec2 aParam;   // (t along the profile, angle around) in [0, 1]²
  attribute vec2 aCell;    // (col, row) per instance

  uniform mat4  uMV;       // p5 model-view (camera + the sketch's rotations)
  uniform mat4  uP;        // p5 projection
  uniform float uMode;     // 0 = spike instances, 1 = the body surface
  uniform float uCapFrac;
  uniform float uBaseCapDepth;   // base dome depth, × its radius (1 = hemisphere)
  uniform float uDeltaT;   // finite-difference steps for the normal
  uniform float uDeltaA;
  uniform float uRadiusMin;   // stroke weight at the tip (px, a diameter)
  uniform float uRadiusMax;   // stroke weight at the base
  uniform int   uRadiusEaseId;
  uniform int   uLengthEaseId;
  uniform vec2  uCellCount;   // (cols, rows) of the spike grid

  varying vec3  vNormal;   // view space, unnormalised
  varying vec3  vViewPos;
  varying vec3  vPos;      // model space, the sketch's own units
  varying vec3  vCell;     // (column, row, index) as 0..1 fractions
  varying float vExtra;
`;

const VERT_MAIN = `
  // (axial offset from the base, radius) for one vertex parameter t: 0 is the
  // far end of the base cap (inside the body), 1 the far end of the tip cap.
  // Between the caps, lp runs 1 (base) → 0 (tip) exactly as the originals'
  // layerProgression does, so the same easings give the same silhouette.
  vec2 spikeProfile(float t, float len, float radiusMul) {
    float rBase = max(uRadiusMax * 0.5 * radiusMul, 0.0);
    float rTip  = max(uRadiusMin * 0.5 * radiusMul, 0.0);
    float cb = uCapFrac;

    if (t < cb) {
      float u = 1.0 - t / cb;
      return vec2(-rBase * uBaseCapDepth * u, rBase * sqrt(max(0.0, 1.0 - u * u)));
    }

    if (t > 1.0 - cb) {
      float u = (t - (1.0 - cb)) / cb;
      return vec2(len + rTip * u, rTip * sqrt(max(0.0, 1.0 - u * u)));
    }

    float lp = 1.0 - (t - cb) / (1.0 - 2.0 * cb);
    float axial = mapEase(lp, 0.0, 1.0, len, 0.0, uLengthEaseId);
    float r = mapEase(lp, 0.0, 1.0, uRadiusMin, uRadiusMax, uRadiusEaseId) * 0.5 * radiusMul;

    return vec2(axial, max(r, 0.0));
  }

  vec3 spikePoint(vec3 base, vec3 dir, vec3 u, vec3 v, float len, float radiusMul, float t, float a) {
    vec2 pr = spikeProfile(clamp(t, 0.0, 1.0), len, radiusMul);
    float ang = a * TAU;

    return base + dir * pr.x + (u * cos(ang) + v * sin(ang)) * pr.y;
  }

  void main() {
    float t = aParam.x;
    float a = aParam.y;

    // The normal is sampled a little inside the parameter range, so the pole
    // rows (where the ring collapses to a point and the cross product is 0)
    // borrow their neighbour ring's normal.
    float tn = clamp(t, 1.5 * uDeltaT, 1.0 - 1.5 * uDeltaT);

    vec3 pos;
    vec3 dPdt;
    vec3 dPda;
    float extra;
    vec3 cell;

    if (uMode > 0.5) {
      vec4 here = bodyPoint(t, a);

      pos   = here.xyz;
      extra = here.w;
      cell  = vec3(a, t, t);
      dPdt  = bodyPoint(tn + uDeltaT, a).xyz - bodyPoint(tn - uDeltaT, a).xyz;
      dPda  = bodyPoint(tn, a + uDeltaA).xyz - bodyPoint(tn, a - uDeltaA).xyz;
    } else {
      vec3 base;
      vec3 dir;
      float len;
      float radiusMul;
      float visible;

      computeSpike(aCell.x, aCell.y, base, dir, len, radiusMul, extra, visible);

      if (visible < 0.5) {
        gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        vNormal  = vec3(0.0, 0.0, 1.0);
        vViewPos = vec3(0.0);
        vPos     = vec3(0.0);
        vCell    = vec3(0.0);
        vExtra   = 0.0;

        return;
      }

      float total = max(uCellCount.x * uCellCount.y - 1.0, 1.0);

      cell = vec3(
        aCell.x / max(uCellCount.x, 1.0),
        aCell.y / max(uCellCount.y - 1.0, 1.0),
        (aCell.x * uCellCount.y + aCell.y) / total
      );
      dir = normalize(dir);

      vec3 helper = abs(dir.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
      vec3 u = normalize(cross(dir, helper));
      vec3 v = cross(dir, u);

      pos  = spikePoint(base, dir, u, v, len, radiusMul, t, a);
      dPdt = spikePoint(base, dir, u, v, len, radiusMul, tn + uDeltaT, a)
           - spikePoint(base, dir, u, v, len, radiusMul, tn - uDeltaT, a);
      dPda = spikePoint(base, dir, u, v, len, radiusMul, tn, a + uDeltaA)
           - spikePoint(base, dir, u, v, len, radiusMul, tn, a - uDeltaA);
    }

    vec3 n = cross(dPdt, dPda);

    if (dot(n, n) < 1e-12) {
      n = vec3(0.0, 0.0, 1.0);
    }

    vec4 viewPos = uMV * vec4(pos, 1.0);

    vViewPos    = viewPos.xyz;
    vNormal     = mat3(uMV) * normalize(n);
    vPos        = pos;
    vCell       = cell;
    vExtra      = extra;
    gl_Position = uP * viewPos;
  }
`;

// No body unless the sketch supplies one: a degenerate surface that is never
// drawn (render() skips the body pass when no bodyBody was given).
const DEFAULT_BODY_GLSL = `
  vec4 bodyPoint(float t, float a) {
    return vec4(0.0);
  }
`;

// The fragment gets the easing dispatch (applyEasing) so a material can take
// a selectable curve, as the vertex side does for the profile.
const FRAG_HEADER = `
  precision highp float;

  const float PI  = 3.141592653589793;
  const float TAU = 6.283185307179586;

  varying vec3  vNormal;
  varying vec3  vViewPos;
  varying vec3  vPos;
  varying vec3  vCell;
  varying float vExtra;
` + PEAKS_EASING_GLSL;

// The material is given a normal that always faces the camera: closed opaque
// shapes only ever show their front, and the tunnel's wall is seen from inside,
// so two-sided shading is both free and the only convention that never needs
// a sketch to know which way its parametrisation winds.
const FRAG_MAIN = `
  void main() {
    vec3 n = normalize(vNormal);
    vec3 v = normalize(-vViewPos);

    if (dot(n, v) < 0.0) {
      n = -n;
    }

    gl_FragColor = vec4(shade(n, v, vViewPos, vCell, vPos, vExtra), 1.0);
  }
`;

function buildGridMesh(
  rings, segments
) {
  const cols = segments + 1;
  const rows = rings + 1;
  const params = new Float32Array( rows * cols * 2 );
  let i = 0;

  for ( let r = 0; r < rows; r++ ) {
    const t = r / rings;

    for ( let c = 0; c < cols; c++ ) {
      params[ i++ ] = t;
      params[ i++ ] = c / segments;
    }
  }

  const indices = new Uint16Array( rings * segments * 6 );
  let k = 0;

  for ( let r = 0; r < rings; r++ ) {
    for ( let c = 0; c < segments; c++ ) {
      const i0 = r * cols + c;
      const i1 = i0 + 1;
      const i2 = i0 + cols;
      const i3 = i2 + 1;

      indices[ k++ ] = i0;
      indices[ k++ ] = i2;
      indices[ k++ ] = i1;
      indices[ k++ ] = i1;
      indices[ k++ ] = i2;
      indices[ k++ ] = i3;
    }
  }

  return {
    params,
    indices,
    indexCount: indices.length
  };
}

function drawElementsInstanced(
  gl, ext, count, primCount
) {
  if ( ext ) {
    ext.drawElementsInstancedANGLE(
      gl.TRIANGLES,
      count,
      gl.UNSIGNED_SHORT,
      0,
      primCount
    );
  } else {
    gl.drawElementsInstanced(
      gl.TRIANGLES,
      count,
      gl.UNSIGNED_SHORT,
      0,
      primCount
    );
  }
}

function clampInt(
  value, min, max
) {
  return Math.max(
    min,
    Math.min(
      max,
      Math.round( value )
    )
  );
}

/**
 * Create a solid-surface peaks renderer for one sketch.
 *
 * @param {object} sources
 * @param {string} sources.spikeBody GLSL defining
 *   `void computeSpike( float col, float row, out vec3 base, out vec3 dir,
 *   out float len, out float radiusMul, out float extra, out float visible )`
 *   plus its own uniforms. The peaks stdlib (perlinNoise, mapEase,
 *   applyEasing…) is injected before it.
 * @param {string} [sources.bodyBody] GLSL defining
 *   `vec4 bodyPoint( float t, float a )` — a parametric surface (xyz) and the
 *   `extra` channel (w) for the material, drawn once beneath the spikes. It
 *   may also live inside `spikeBody` (handy when both share helpers).
 * @param {string} sources.shadeBody GLSL defining
 *   `vec3 shade( vec3 n, vec3 v, vec3 viewPos, vec3 cell, vec3 pos, float extra )`
 *   — the material, given the camera-facing view-space normal, the direction
 *   to the eye, the view-space position, the cell as (column, row, index)
 *   fractions, the model-space position and the placement's extra channel —
 *   plus its uniforms. `applyEasing( int, float )`, PI and TAU are available.
 * @returns {{ render: Function }}
 */
export default function createSpikeMeshRenderer( {
  spikeBody,
  bodyBody = null,
  shadeBody = ""
} ) {
  // GL resources live with one context, and one renderer serves every surface
  // its sketch ever draws on (the page across re-navigations, every layer
  // embedding it), so they are kept per surface — see instanceState.js.
  const store = createKeyedStore(
    getP5,
    () => ( {
      graphics: null,
      gl: null,
      program: null,
      ext: null,
      locs: {},
      aParamLoc: -1,
      aCellLoc: -1,
      meshes: {},
      cellVBO: null,
      cellKey: null,
      cellCount: 0,
      perlinTexture: null,
      perlinSeed: null,
      rampTexture: null,
      rampKey: null,
      shadeKey: null
    } )
  );

  // A sketch may define its bodyPoint() next to computeSpike() in one GLSL
  // block rather than as a separate `bodyBody`; either way counts as a body.
  const hasBody = Boolean( bodyBody ) || /vec4\s+bodyPoint\s*\(/.test( spikeBody );

  let state = null;

  function ensureGraphics(
    width, height
  ) {
    if ( !state.graphics ) {
      state.graphics = graphics.createAutoResizableGraphics(
        width,
        height,
        "webgl"
      );
    }

    const g = state.graphics;

    // The auto-resize handler follows the host canvas 1:1; the supersampled
    // size is re-asserted here on every frame it differs.
    if ( g.width !== width || g.height !== height ) {
      g.resizeCanvas(
        width,
        height
      );
      g.width = width;
      g.height = height;
    }

    return g;
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

  function ensureProgram(
    gl, shade
  ) {
    const shadeKey = shade?.key ?? "static";

    if ( state.gl === gl && state.program && state.shadeKey === shadeKey ) {
      return true;
    }

    if ( state.program && state.gl ) {
      state.gl.deleteProgram( state.program );
    }

    const vertSrc = PEAKS_STDLIB_GLSL
      + VERT_HEADER
      + spikeBody
      + ( bodyBody ?? ( hasBody ? "" : DEFAULT_BODY_GLSL ) )
      + VERT_MAIN;
    const fragSrc = FRAG_HEADER + ( shade?.glsl ?? shadeBody ) + FRAG_MAIN;

    state.program = buildProgram(
      gl,
      vertSrc,
      fragSrc
    );
    state.gl = gl;
    state.shadeKey = shadeKey;
    state.locs = {};
    state.meshes = {};
    state.cellVBO = null;
    state.cellKey = null;
    state.perlinTexture = null;
    state.perlinSeed = null;
    state.rampTexture = null;
    state.rampKey = null;
    state.ext = getInstancingExt( gl );

    if ( !state.program ) {
      return false;
    }

    if ( !isWebGL2( gl ) && !state.ext ) {
      console.error( "Spike mesh needs WebGL2 or ANGLE_instanced_arrays." );
      return false;
    }

    state.aParamLoc = gl.getAttribLocation(
      state.program,
      "aParam"
    );
    state.aCellLoc = gl.getAttribLocation(
      state.program,
      "aCell"
    );

    return true;
  }

  function ensureMesh(
    gl, name, rings, segments
  ) {
    const key = `${ rings }x${ segments }`;
    const cached = state.meshes[ name ];

    if ( cached && cached.key === key ) {
      return cached;
    }

    const mesh = buildGridMesh(
      rings,
      segments
    );
    const vbo = cached?.vbo ?? gl.createBuffer();
    const ibo = cached?.ibo ?? gl.createBuffer();

    gl.bindBuffer(
      gl.ARRAY_BUFFER,
      vbo
    );
    gl.bufferData(
      gl.ARRAY_BUFFER,
      mesh.params,
      gl.STATIC_DRAW
    );
    gl.bindBuffer(
      gl.ELEMENT_ARRAY_BUFFER,
      ibo
    );
    gl.bufferData(
      gl.ELEMENT_ARRAY_BUFFER,
      mesh.indices,
      gl.STATIC_DRAW
    );

    const entry = {
      key,
      vbo,
      ibo,
      indexCount: mesh.indexCount,
      rings,
      segments
    };

    state.meshes[ name ] = entry;

    return entry;
  }

  // One (col, row) pair per instance; rebuilt only when the grid changes.
  function ensureCells(
    gl, cols, rows
  ) {
    const key = `${ cols }x${ rows }`;

    if ( state.cellKey === key && state.cellVBO ) {
      return;
    }

    const data = new Float32Array( cols * rows * 2 );
    let i = 0;

    for ( let col = 0; col < cols; col++ ) {
      for ( let row = 0; row < rows; row++ ) {
        data[ i++ ] = col;
        data[ i++ ] = row;
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

    state.cellCount = cols * rows;
    state.cellKey = key;
  }

  function ensurePerlin(
    gl, seed
  ) {
    if ( state.perlinSeed === seed && state.perlinTexture ) {
      return;
    }

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

  // A 1D lookup (width × 1 RGBA8) the material samples with REPEAT wrapping;
  // re-uploaded only when its key changes.
  function ensureRamp(
    gl, ramp
  ) {
    if ( !ramp ) {
      return;
    }

    if ( !state.rampTexture ) {
      state.rampTexture = gl.createTexture();
    }

    if ( state.rampKey === ramp.key ) {
      return;
    }

    gl.activeTexture( gl.TEXTURE0 + RAMP_UNIT );
    gl.bindTexture(
      gl.TEXTURE_2D,
      state.rampTexture
    );
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      ramp.width,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      ramp.bytes
    );
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_MIN_FILTER,
      gl.LINEAR
    );
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_MAG_FILTER,
      gl.LINEAR
    );
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_WRAP_S,
      gl.REPEAT
    );
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_WRAP_T,
      gl.CLAMP_TO_EDGE
    );
    state.rampKey = ramp.key;
  }

  function bindMesh(
    gl, mesh
  ) {
    gl.bindBuffer(
      gl.ARRAY_BUFFER,
      mesh.vbo
    );
    gl.enableVertexAttribArray( state.aParamLoc );
    gl.vertexAttribPointer(
      state.aParamLoc,
      2,
      gl.FLOAT,
      false,
      0,
      0
    );
    setDivisor(
      gl,
      state.ext,
      state.aParamLoc,
      0
    );
    gl.bindBuffer(
      gl.ELEMENT_ARRAY_BUFFER,
      mesh.ibo
    );

    setUniformValue(
      gl,
      getLocation( "uDeltaT" ),
      0.5 / mesh.rings
    );
    setUniformValue(
      gl,
      getLocation( "uDeltaA" ),
      0.5 / mesh.segments
    );
  }

  /**
   * Render one frame and composite it onto the main canvas.
   *
   * @param {object} params
   * @param {{x:number,y:number,z:number}} [params.rotation] rotateX/Y/Z (radians), p5 order
   * @param {number[]} [params.translate] model translation applied before the rotations
   * @param {{cols:number,rows:number}} params.grid one spike instance per cell
   * @param {{rings:number,segments:number}} [params.spikeMesh] spike tessellation
   * @param {{rings:number,segments:number}} [params.bodyMesh] body tessellation (needs bodyBody)
   * @param {boolean} [params.body=true] draw the body surface
   * @param {number} [params.supersample=1] buffer scale for antialiasing (1–3)
   * @param {number} [params.seed=42] Perlin seed
   * @param {number} [params.octaves=4] Perlin octaves (≤ 8)
   * @param {number} [params.falloff=0.5] Perlin falloff
   * @param {object} params.profile { lengthEasing, radiusMin, radiusMax, radiusEasing, baseCapDepth }
   *   (easingId payloads for the easings; baseCapDepth is the base dome's depth × its radius, default 0.5 — a
   *   full hemisphere pokes out of the far side of a body thinner than the spike is wide)
   * @param {{key:string,width:number,bytes:Uint8Array}} [params.ramp] 1D lookup for the material (sampler `uRamp`)
   * @param {{key:string,glsl:string}} [params.shade] a material variant replacing the constructor's
   *   `shadeBody`: the program is rebuilt whenever `key` changes (a shader permutation per dropdown
   *   choice beats a uniform branch chain per fragment)
   * @param {object} [params.uniforms] sketch and material uniforms (see setUniformValue)
   */
  function render( {
    rotation = {
      x: 0,
      y: 0,
      z: 0
    },
    translate = null,
    grid,
    spikeMesh = {
      rings: 48,
      segments: 24
    },
    bodyMesh = {
      rings: 48,
      segments: 64
    },
    body = true,
    supersample = 1,
    seed = 42,
    octaves = 4,
    falloff = 0.5,
    profile,
    ramp = null,
    shade = null,
    uniforms = {}
  } ) {
    state = store.current();

    const p = getP5();
    const layoutWidth = p.width;
    const layoutHeight = p.height;
    const ss = Math.max(
      1,
      Math.min(
        3,
        supersample
      )
    );
    const g = ensureGraphics(
      Math.round( layoutWidth * ss ),
      Math.round( layoutHeight * ss )
    );
    const gl = g.drawingContext;

    if ( !ensureProgram(
      gl,
      shade
    ) ) {
      return;
    }

    const cols = clampInt(
      grid.cols,
      1,
      4096
    );
    const rows = clampInt(
      grid.rows,
      1,
      4096
    );

    ensureCells(
      gl,
      cols,
      rows
    );
    ensurePerlin(
      gl,
      seed
    );
    ensureRamp(
      gl,
      ramp
    );

    const spike = ensureMesh(
      gl,
      "spike",
      clampInt(
        spikeMesh.rings,
        4,
        256
      ),
      clampInt(
        spikeMesh.segments,
        3,
        128
      )
    );
    const bodySurface = body && hasBody
      ? ensureMesh(
        gl,
        "body",
        clampInt(
          bodyMesh.rings,
          4,
          256
        ),
        clampInt(
          bodyMesh.segments,
          3,
          128
        )
      )
      : null;

    // The projection is p5's default camera for the LAYOUT size — pixel units
    // stay those of the disc originals whatever the buffer's supersampling.
    const mvMat = modelViewMat4(
      rotation,
      translate
    );
    const pMat = perspectiveMat4(
      layoutWidth,
      layoutHeight
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
    gl.disable( gl.CULL_FACE );
    gl.disable( gl.BLEND );
    gl.clearColor(
      0,
      0,
      0,
      0
    );
    gl.clearDepth( 1 );
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
      getLocation( "uCapFrac" ),
      CAP_FRACTION
    );
    setUniformValue(
      gl,
      getLocation( "uCellCount" ),
      [
        cols,
        rows
      ]
    );
    setUniformValue(
      gl,
      getLocation( "uOctaves" ),
      {
        int: Math.min(
          octaves,
          8
        )
      }
    );
    setUniformValue(
      gl,
      getLocation( "uFalloff" ),
      falloff
    );
    setUniformValue(
      gl,
      getLocation( "uBaseCapDepth" ),
      profile.baseCapDepth ?? 0.5
    );
    setUniformValue(
      gl,
      getLocation( "uRadiusMin" ),
      profile.radiusMin
    );
    setUniformValue(
      gl,
      getLocation( "uRadiusMax" ),
      profile.radiusMax
    );
    setUniformValue(
      gl,
      getLocation( "uRadiusEaseId" ),
      profile.radiusEasing
    );
    setUniformValue(
      gl,
      getLocation( "uLengthEaseId" ),
      profile.lengthEasing
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

    if ( state.rampTexture ) {
      gl.activeTexture( gl.TEXTURE0 + RAMP_UNIT );
      gl.bindTexture(
        gl.TEXTURE_2D,
        state.rampTexture
      );
      setUniformValue(
        gl,
        getLocation( "uRamp" ),
        {
          int: RAMP_UNIT
        }
      );
    }

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

    // The per-instance cell is bound for both passes; the body pass simply
    // draws one instance and never reads it.
    gl.bindBuffer(
      gl.ARRAY_BUFFER,
      state.cellVBO
    );
    gl.enableVertexAttribArray( state.aCellLoc );
    gl.vertexAttribPointer(
      state.aCellLoc,
      2,
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

    if ( bodySurface ) {
      setUniformValue(
        gl,
        getLocation( "uMode" ),
        1
      );
      bindMesh(
        gl,
        bodySurface
      );
      drawElementsInstanced(
        gl,
        state.ext,
        bodySurface.indexCount,
        1
      );
    }

    setUniformValue(
      gl,
      getLocation( "uMode" ),
      0
    );
    bindMesh(
      gl,
      spike
    );
    drawElementsInstanced(
      gl,
      state.ext,
      spike.indexCount,
      state.cellCount
    );

    // Restore GL state so p5 keeps working with the buffer.
    gl.disableVertexAttribArray( state.aParamLoc );
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
    gl.bindBuffer(
      gl.ELEMENT_ARRAY_BUFFER,
      null
    );
    gl.activeTexture( gl.TEXTURE0 );
    gl.disable( gl.DEPTH_TEST );
    g.resetShader();

    p.image(
      g,
      0,
      0,
      layoutWidth,
      layoutHeight
    );
  }

  return {
    render
  };
}

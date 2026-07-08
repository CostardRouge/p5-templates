import graphics from "./graphics.js";
import {
  getP5
} from "./sketch.js";

// ─────────────────────────────────────────────────────────────────────────────
// Shared GPU batch for 2D "glow" primitives (capsules / discs), rainbow-shaded
// on the GPU.
//
// Several sketches paint the same shape thousands of times per frame:
//   - neonGraffiti draws shadowsCount × stepsCount filled circles;
//   - the spline family strokes a dense Chaikin polyline segment-by-segment,
//     once per glow layer, once per detected entity.
//
// The generative MATH stays on the CPU (so the look matches the originals), but
// the RENDERING and the COLOUR move to the GPU. Every primitive is a capsule (a
// round-capped segment A→B with a half thickness; a disc is a zero-length
// capsule), and the fragment shader computes the rainbow palette itself — a GLSL
// port of utils/colors.js `rainbow`, identical to the CPU version. Sketches pass
// the palette inputs (hueOffset, hueIndex, opacityFactor) instead of building a
// p5.Color per primitive, which removes the per-segment colour allocation that
// dominated the CPU cost once the work moved off the draw calls.
//
// Two ways to feed it:
//
//   Mode A — per-instance primitives (every disc independent), one draw call:
//     batch.begin();
//     batch.disc(x, y, radius, hueOffset, hueIndex, opacityFactor);
//     batch.end();
//
//   Mode B — stroke layers (one polyline drawn once, re-drawn per glow layer):
//     batch.beginStrokes();
//     batch.openStroke();                                              // one per spline
//     batch.strokeSegment(ax, ay, bx, by, hueIndex, halfFactor);       // per dense segment
//     batch.drawStrokes({ weight, glow });                             // hueOffset defaults 0
//
//   `halfFactor` is an optional per-segment multiplier on the per-layer half
//   thickness (defaults to 1.0 — uniform stroke). Pass a 0..1 factor that varies
//   along the polyline to taper the ends to a point, swell the middle, etc.
//
//   In Mode B the geometry is uploaded once and re-drawn `glow + 1` times with
//   the per-layer half-thickness and opacityFactor supplied as constants, so the
//   CPU emits each segment once instead of once per layer. Strokes are drawn in
//   submission order, spline by spline, layer widest-and-dimmest first, matching
//   the CPU stacking exactly.
//
// Both modes render into an off-screen WebGL buffer cleared to transparent and
// composite it over the p2d canvas with premultiplied "over" blending, so they
// drop into an existing sketch (background, overlays, …) with no edge fringing.
// ─────────────────────────────────────────────────────────────────────────────

// Mode A instance: vec4 segment, half-thickness, hueOffset, hueIndex, opacity.
const FLOATS_A = 8;

// Mode B segment: vec4 segment + hueIndex + halfFactor (per-segment thickness
// multiplier; half/hueOffset/opacity remain per-layer constants).
const FLOATS_B = 6;

const BYTES_PER_FLOAT = 4;
const STRIDE_A = FLOATS_A * BYTES_PER_FLOAT; // 32
const STRIDE_B = FLOATS_B * BYTES_PER_FLOAT; // 24

// Antialiasing half-band, in pixels, applied around every capsule edge.
const EDGE_PAD = 1.0;

const VERT_SRC = `
  precision highp float;

  attribute vec2  aCorner;     // unit quad: x in [0,1] along the segment, y in [-1,1] across
  attribute vec4  aSeg;        // (ax, ay, bx, by) in pixels, top-left origin
  attribute float aHalf;       // base half thickness in pixels (per-layer constant)
  attribute float aHalfFactor; // per-segment multiplier for variable thickness; 1.0 = uniform
  attribute float aHueOffset;
  attribute float aHueIndex;
  attribute float aOpacity;    // opacityFactor for the rainbow palette

  uniform vec2  uResolution;
  uniform float uPad;

  varying vec2  vPos;
  varying vec2  vA;
  varying vec2  vB;
  varying float vHalf;
  varying float vHueOffset;
  varying float vHueIndex;
  varying float vOpacity;

  void main() {
    vec2 a = aSeg.xy;
    vec2 b = aSeg.zw;

    vec2  axis = b - a;
    float len  = length(axis);
    vec2  dir  = len > 1e-4 ? axis / len : vec2(1.0, 0.0);
    vec2  nrm  = vec2(-dir.y, dir.x);

    float halfWidth = aHalf * aHalfFactor;

    // Expand the quad past both ends and both sides by half-thickness + AA pad so
    // the round caps and antialiased rim always fall inside the rasterised area.
    float ext   = halfWidth + uPad;
    vec2  along = mix(a - dir * ext, b + dir * ext, aCorner.x);
    vec2  pos   = along + nrm * (aCorner.y * ext);

    vPos       = pos;
    vA         = a;
    vB         = b;
    vHalf      = halfWidth;
    vHueOffset = aHueOffset;
    vHueIndex  = aHueIndex;
    vOpacity   = aOpacity;

    vec2 ndc = vec2(
      (pos.x / uResolution.x) * 2.0 - 1.0,
      1.0 - (pos.y / uResolution.y) * 2.0
    );
    gl_Position = vec4(ndc, 0.0, 1.0);
  }
`;

const FRAG_SRC = `
  precision highp float;

  uniform float uPad;

  varying vec2  vPos;
  varying vec2  vA;
  varying vec2  vB;
  varying float vHalf;
  varying float vHueOffset;
  varying float vHueIndex;
  varying float vOpacity;

  // Distance from p to the segment a→b (round caps), i.e. the capsule axis.
  float segmentDistance(vec2 p, vec2 a, vec2 b) {
    vec2  pa = p - a;
    vec2  ba = b - a;
    float h  = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);

    return length(pa - ba * h);
  }

  // GLSL port of utils/colors.js rainbow() (default Math.sin/cos easing), bit-for
  // -bit with the CPU version: p5 builds each channel in 0..360 then divides by
  // opacityFactor, clamped to 0..255.
  vec3 paletteRainbow(float hueOffset, float hueIndex, float opacityFactor) {
    float a = hueOffset + hueIndex;
    float b = hueOffset - hueIndex;

    float red   = (sin(a) * 0.5 + 0.5) * 360.0 / opacityFactor;
    float green = (1.0 - cos(b)) * 0.5 * 360.0 / opacityFactor;
    float blue  = (1.0 - sin(a)) * 0.5 * 360.0 / opacityFactor;

    return clamp(vec3(red, green, blue) / 255.0, 0.0, 1.0);
  }

  void main() {
    float d   = segmentDistance(vPos, vA, vB) - vHalf;
    float cov = 1.0 - smoothstep(-uPad, uPad, d);

    if (cov <= 0.0) {
      discard;
    }

    // The rainbow palette is opaque (alpha 255), so coverage IS the alpha. Emit
    // premultiplied colour: the p5.Graphics WebGL canvas is premultipliedAlpha,
    // so p.image() composites the buffer onto the p2d canvas with no fringing.
    vec3 rgb = paletteRainbow(vHueOffset, vHueIndex, vOpacity);

    gl_FragColor = vec4(rgb * cov, cov);
  }
`;

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
      "Glow batch shader compile error:",
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
      "Glow batch program link error:",
      gl.getProgramInfoLog( program )
    );
    return null;
  }

  gl.deleteShader( vert );
  gl.deleteShader( frag );
  return program;
}

// Instancing is native in WebGL2 and via ANGLE_instanced_arrays in WebGL1.
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

/**
 * Create a GPU batch renderer for rainbow-shaded round-capped 2D primitives.
 *
 * @returns {{
 *   begin: Function, disc: Function, capsule: Function, end: Function,
 *   beginStrokes: Function, openStroke: Function, strokeSegment: Function,
 *   drawStrokes: Function
 * }}
 */
export default function createGlowBatchRenderer() {
  const state = {
    graphics: null,
    program: null,
    quadVBO: null,
    instanceVBO: null,
    locs: {},
    ext: null,
    ctxRef: null,
    p5Ref: null,

    // Mode A — per-instance primitives.
    dataA: new Float32Array( 1024 * FLOATS_A ),
    capacityA: 1024,
    countA: 0,

    // Mode B — stroke layers.
    dataB: new Float32Array( 1024 * FLOATS_B ),
    capacityB: 1024,
    countB: 0,
    groups: [],
    currentGroup: null
  };

  function ensureGraphics() {
    const p = getP5();

    // The renderer lives at module scope, so it survives sketch re-navigation
    // (ES modules are cached and not re-run). When p5 is torn down and recreated
    // the cached buffer belongs to the old instance/context, so recreate it — and
    // force the program + VBOs to rebuild against the fresh context.
    if ( !state.graphics || state.p5Ref !== p ) {
      state.graphics = graphics.createAutoResizableGraphics(
        p.width,
        p.height,
        "webgl"
      );
      state.p5Ref = p;
      state.program = null;
      state.ctxRef = null;
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
      FRAG_SRC
    );
    state.locs = {};
    state.quadVBO = null;
    state.instanceVBO = null;
    state.ctxRef = gl;
    state.ext = getInstancingExt( gl );

    if ( !state.program ) {
      return false;
    }

    if ( !isWebGL2( gl ) && !state.ext ) {
      console.error( "Glow batch needs WebGL2 or ANGLE_instanced_arrays." );
      return false;
    }

    [
      "aCorner",
      "aSeg",
      "aHalf",
      "aHalfFactor",
      "aHueOffset",
      "aHueIndex",
      "aOpacity"
    ].forEach( ( name ) => {
      state.locs[ name ] = gl.getAttribLocation(
        state.program,
        name
      );
    } );

    [
      "uResolution",
      "uPad"
    ].forEach( ( name ) => {
      state.locs[ name ] = gl.getUniformLocation(
        state.program,
        name
      );
    } );

    state.quadVBO = gl.createBuffer();

    // Unit quad: x in [0,1] runs along the segment, y in [-1,1] across it.
    const quad = new Float32Array( [
      0,
      -1,
      1,
      -1,
      0,
      1,
      0,
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

    state.instanceVBO = gl.createBuffer();

    return true;
  }

  // Common per-frame GL setup: viewport, premultiplied "over" blend, clear to
  // transparent, activate the program and its shared uniforms, bind the quad.
  function beginPass(
    gl, g
  ) {
    gl.viewport(
      0,
      0,
      gl.drawingBufferWidth,
      gl.drawingBufferHeight
    );
    gl.disable( gl.DEPTH_TEST );
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
    gl.clear( gl.COLOR_BUFFER_BIT );

    gl.useProgram( state.program );

    gl.uniform2f(
      state.locs.uResolution,
      g.width,
      g.height
    );
    gl.uniform1f(
      state.locs.uPad,
      EDGE_PAD
    );

    gl.bindBuffer(
      gl.ARRAY_BUFFER,
      state.quadVBO
    );
    gl.enableVertexAttribArray( state.locs.aCorner );
    gl.vertexAttribPointer(
      state.locs.aCorner,
      2,
      gl.FLOAT,
      false,
      0,
      0
    );
    setDivisor(
      gl,
      state.ext,
      state.locs.aCorner,
      0
    );
  }

  // Restore GL state so p5 keeps working with the buffer, then composite onto the
  // main p2d canvas.
  function endPass(
    gl, g, p
  ) {
    [
      "aCorner",
      "aSeg",
      "aHalf",
      "aHalfFactor",
      "aHueOffset",
      "aHueIndex",
      "aOpacity"
    ].forEach( ( name ) => {
      const loc = state.locs[ name ];

      if ( loc < 0 ) {
        return;
      }

      gl.disableVertexAttribArray( loc );
      setDivisor(
        gl,
        state.ext,
        loc,
        0
      );
    } );

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

  // ── Mode A: per-instance primitives ───────────────────────────────────────

  function ensureCapacityA( needed ) {
    if ( needed <= state.capacityA ) {
      return;
    }

    let capacity = state.capacityA;

    while ( capacity < needed ) {
      capacity *= 2;
    }

    const grown = new Float32Array( capacity * FLOATS_A );

    grown.set( state.dataA.subarray(
      0,
      state.countA * FLOATS_A
    ) );

    state.dataA = grown;
    state.capacityA = capacity;
  }

  /**
   * Start a per-instance batch. Discards primitives left over from a prior frame.
   */
  function begin() {
    state.countA = 0;
  }

  /**
   * Queue a round-capped segment from (ax, ay) to (bx, by), rainbow-shaded by
   * (hueOffset, hueIndex, opacityFactor) on the GPU.
   */
  function capsule(
    ax, ay, bx, by, halfWidth, hueOffset, hueIndex, opacityFactor
  ) {
    ensureCapacityA( state.countA + 1 );

    const base = state.countA * FLOATS_A;
    const out = state.dataA;

    out[ base ] = ax;
    out[ base + 1 ] = ay;
    out[ base + 2 ] = bx;
    out[ base + 3 ] = by;
    out[ base + 4 ] = halfWidth;
    out[ base + 5 ] = hueOffset;
    out[ base + 6 ] = hueIndex;
    out[ base + 7 ] = opacityFactor;

    state.countA++;
  }

  /**
   * Queue a filled disc (a zero-length capsule), rainbow-shaded on the GPU.
   */
  function disc(
    x, y, radius, hueOffset, hueIndex, opacityFactor
  ) {
    capsule(
      x,
      y,
      x,
      y,
      radius,
      hueOffset,
      hueIndex,
      opacityFactor
    );
  }

  /**
   * Draw every queued per-instance primitive in one instanced call and composite.
   */
  function end() {
    if ( state.countA === 0 ) {
      return;
    }

    const p = getP5();
    const g = ensureGraphics();
    const gl = g.drawingContext;

    if ( !ensureProgram( gl ) ) {
      return;
    }

    gl.bindBuffer(
      gl.ARRAY_BUFFER,
      state.instanceVBO
    );
    gl.bufferData(
      gl.ARRAY_BUFFER,
      state.dataA.subarray(
        0,
        state.countA * FLOATS_A
      ),
      gl.DYNAMIC_DRAW
    );

    beginPass(
      gl,
      g
    );

    // beginPass leaves the quad bound (for aCorner); rebind the instance buffer so
    // the per-instance attribute pointers below capture it.
    gl.bindBuffer(
      gl.ARRAY_BUFFER,
      state.instanceVBO
    );

    // Per-instance attributes. aHalfFactor is a Mode B knob (variable thickness
    // along a polyline) and stays at 1.0 here so Mode A discs/capsules use aHalf
    // verbatim.
    const perInstance = [
      [
        "aSeg",
        4,
        0
      ],
      [
        "aHalf",
        1,
        16
      ],
      [
        "aHueOffset",
        1,
        20
      ],
      [
        "aHueIndex",
        1,
        24
      ],
      [
        "aOpacity",
        1,
        28
      ]
    ];

    perInstance.forEach( ( [
      name,
      size,
      offset
    ] ) => {
      const loc = state.locs[ name ];

      if ( loc < 0 ) {
        return;
      }

      gl.enableVertexAttribArray( loc );
      gl.vertexAttribPointer(
        loc,
        size,
        gl.FLOAT,
        false,
        STRIDE_A,
        offset
      );
      setDivisor(
        gl,
        state.ext,
        loc,
        1
      );
    } );

    if ( state.locs.aHalfFactor >= 0 ) {
      gl.disableVertexAttribArray( state.locs.aHalfFactor );
      gl.vertexAttrib1f(
        state.locs.aHalfFactor,
        1.0
      );
    }

    drawArraysInstanced(
      gl,
      state.ext,
      gl.TRIANGLES,
      0,
      6,
      state.countA
    );

    endPass(
      gl,
      g,
      p
    );
  }

  // ── Mode B: stroke layers ─────────────────────────────────────────────────

  function ensureCapacityB( needed ) {
    if ( needed <= state.capacityB ) {
      return;
    }

    let capacity = state.capacityB;

    while ( capacity < needed ) {
      capacity *= 2;
    }

    const grown = new Float32Array( capacity * FLOATS_B );

    grown.set( state.dataB.subarray(
      0,
      state.countB * FLOATS_B
    ) );

    state.dataB = grown;
    state.capacityB = capacity;
  }

  /**
   * Start a stroke-layer batch. Discards strokes left over from a prior frame.
   */
  function beginStrokes() {
    state.countB = 0;
    state.groups = [];
    state.currentGroup = null;
  }

  /**
   * Begin a new spline. Its segments are drawn together, in submission order,
   * before the next spline — so per-spline layer stacking is preserved.
   */
  function openStroke() {
    state.currentGroup = {
      offset: state.countB,
      count: 0
    };
    state.groups.push( state.currentGroup );
  }

  /**
   * Queue one dense segment of the current spline, hued by `hueIndex` on the GPU
   * and optionally tapered: `halfFactor` is a 0..N multiplier on the per-layer
   * half-thickness, so 1 keeps the segment at the base weight, 0 collapses it to
   * nothing (a pointy cap), and >1 swells it past the base weight. Defaults to 1
   * for callers that don't care about variable thickness.
   */
  function strokeSegment(
    ax, ay, bx, by, hueIndex, halfFactor = 1.0
  ) {
    if ( !state.currentGroup ) {
      openStroke();
    }

    ensureCapacityB( state.countB + 1 );

    const base = state.countB * FLOATS_B;
    const out = state.dataB;

    out[ base ] = ax;
    out[ base + 1 ] = ay;
    out[ base + 2 ] = bx;
    out[ base + 3 ] = by;
    out[ base + 4 ] = hueIndex;
    out[ base + 5 ] = halfFactor;

    state.countB++;
    state.currentGroup.count++;
  }

  /**
   * Draw every queued spline, each re-drawn once per glow layer (widest and
   * dimmest first) with the layer half-thickness and opacityFactor supplied as
   * constants, then composite once.
   *
   * @param {object} params
   * @param {number} params.weight    base stroke weight (px)
   * @param {number} params.glow      extra glow layers below the core
   * @param {number} [params.hueOffset=0]
   */
  function drawStrokes( {
    weight, glow, hueOffset = 0
  } ) {
    if ( state.countB === 0 ) {
      return;
    }

    const p = getP5();
    const g = ensureGraphics();
    const gl = g.drawingContext;

    if ( !ensureProgram( gl ) ) {
      return;
    }

    gl.bindBuffer(
      gl.ARRAY_BUFFER,
      state.instanceVBO
    );
    gl.bufferData(
      gl.ARRAY_BUFFER,
      state.dataB.subarray(
        0,
        state.countB * FLOATS_B
      ),
      gl.DYNAMIC_DRAW
    );

    beginPass(
      gl,
      g
    );

    // beginPass leaves the quad bound (for aCorner); rebind the instance buffer so
    // the per-group attribute pointers below capture it.
    gl.bindBuffer(
      gl.ARRAY_BUFFER,
      state.instanceVBO
    );

    // hueIndex and halfFactor vary per segment; the base half-thickness,
    // opacityFactor and hueOffset are constant within a layer, so they ride on
    // disabled attributes set per pass.
    const aSeg = state.locs.aSeg;
    const aHueIndex = state.locs.aHueIndex;
    const aHalfFactor = state.locs.aHalfFactor;

    gl.disableVertexAttribArray( state.locs.aHalf );
    gl.disableVertexAttribArray( state.locs.aOpacity );
    gl.disableVertexAttribArray( state.locs.aHueOffset );
    gl.vertexAttrib1f(
      state.locs.aHueOffset,
      hueOffset
    );

    const layers = Math.max(
      0,
      Math.floor( glow )
    );
    const denom = Math.max(
      1,
      layers
    );

    for ( const group of state.groups ) {
      if ( group.count === 0 ) {
        continue;
      }

      const byteOffset = group.offset * STRIDE_B;

      gl.enableVertexAttribArray( aSeg );
      gl.vertexAttribPointer(
        aSeg,
        4,
        gl.FLOAT,
        false,
        STRIDE_B,
        byteOffset
      );
      setDivisor(
        gl,
        state.ext,
        aSeg,
        1
      );

      gl.enableVertexAttribArray( aHueIndex );
      gl.vertexAttribPointer(
        aHueIndex,
        1,
        gl.FLOAT,
        false,
        STRIDE_B,
        byteOffset + 16
      );
      setDivisor(
        gl,
        state.ext,
        aHueIndex,
        1
      );

      if ( aHalfFactor >= 0 ) {
        gl.enableVertexAttribArray( aHalfFactor );
        gl.vertexAttribPointer(
          aHalfFactor,
          1,
          gl.FLOAT,
          false,
          STRIDE_B,
          byteOffset + 20
        );
        setDivisor(
          gl,
          state.ext,
          aHalfFactor,
          1
        );
      }

      // Widest, dimmest layer first; the bright core lands on top.
      for ( let shadow = layers; shadow >= 0; shadow-- ) {
        const layerWeight = weight * ( 1 + shadow * 1.3 );
        const opacityFactor = 1 + ( shadow / denom ) * 3;

        gl.vertexAttrib1f(
          state.locs.aHalf,
          layerWeight / 2
        );
        gl.vertexAttrib1f(
          state.locs.aOpacity,
          opacityFactor
        );

        drawArraysInstanced(
          gl,
          state.ext,
          gl.TRIANGLES,
          0,
          6,
          group.count
        );
      }
    }

    endPass(
      gl,
      g,
      p
    );
  }

  return {
    begin,
    disc,
    capsule,
    end,
    beginStrokes,
    openStroke,
    strokeSegment,
    drawStrokes
  };
}

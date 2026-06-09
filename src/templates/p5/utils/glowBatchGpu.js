import graphics from "./graphics.js";
import {
  getP5
} from "./sketch.js";

// ─────────────────────────────────────────────────────────────────────────────
// Shared GPU batch for 2D "glow" primitives (capsules / discs).
//
// Several sketches paint the same shape thousands of times per frame on the CPU:
//   - neonGraffiti draws shadowsCount × stepsCount filled circles (fill + circle
//     immediate-mode call each);
//   - the spline family strokes a dense Chaikin polyline segment-by-segment,
//     once per glow layer, once per detected entity.
//
// The generative MATH stays on the CPU (so the look is bit-for-bit identical to
// the originals), but the RENDERING — the part that actually slows the draw loop
// — moves to a single instanced draw call. Every primitive is expressed as ONE
// unified shape: a capsule (a round-capped segment from A to B with a given half
// thickness). A disc is just a capsule with A == B, so the same shader covers
// circles, glow strokes and point markers.
//
// Usage:
//   const batch = createGlowBatchRenderer();
//   batch.begin();                                   // start a frame
//   batch.disc(x, y, radius, r, g, b, a);            // colours in 0..1
//   batch.capsule(ax, ay, bx, by, halfWidth, r, g, b, a);
//   batch.end();                                     // draw + composite onto p2d
//
// Instances are drawn in submission order with premultiplied "over" blending, so
// painter's order (and overlap) matches the CPU originals exactly. The batch
// renders into an off-screen WebGL buffer cleared to transparent and composites
// it over whatever is already on the p2d canvas (background, overlays, …), so it
// can be dropped into an existing sketch without owning the whole frame.
// ─────────────────────────────────────────────────────────────────────────────

// 9 floats per instance: vec4 segment (ax, ay, bx, by), vec4 colour (r,g,b,a),
// float half-thickness.
const FLOATS_PER_INSTANCE = 9;
const BYTES_PER_FLOAT = 4;
const INSTANCE_STRIDE = FLOATS_PER_INSTANCE * BYTES_PER_FLOAT; // 36

// Antialiasing half-band, in pixels, applied around every capsule edge.
const EDGE_PAD = 1.0;

const VERT_SRC = `
  precision highp float;

  attribute vec2  aCorner; // unit quad: x in [0,1] along the segment, y in [-1,1] across
  attribute vec4  aSeg;    // (ax, ay, bx, by) in pixels, top-left origin
  attribute vec4  aColor;  // straight-alpha rgba, 0..1
  attribute float aHalf;   // half thickness in pixels

  uniform vec2  uResolution;
  uniform float uPad;

  varying vec2  vPos;
  varying vec2  vA;
  varying vec2  vB;
  varying vec4  vColor;
  varying float vHalf;

  void main() {
    vec2 a = aSeg.xy;
    vec2 b = aSeg.zw;

    vec2  axis = b - a;
    float len  = length(axis);
    vec2  dir  = len > 1e-4 ? axis / len : vec2(1.0, 0.0);
    vec2  nrm  = vec2(-dir.y, dir.x);

    // Expand the quad past both ends and both sides by half-thickness + AA pad so
    // the round caps and antialiased rim always fall inside the rasterised area.
    float ext   = aHalf + uPad;
    vec2  along = mix(a - dir * ext, b + dir * ext, aCorner.x);
    vec2  pos   = along + nrm * (aCorner.y * ext);

    vPos   = pos;
    vA     = a;
    vB     = b;
    vColor = aColor;
    vHalf  = aHalf;

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
  varying vec4  vColor;
  varying float vHalf;

  // Distance from p to the segment a→b (round caps), i.e. the capsule axis.
  float segmentDistance(vec2 p, vec2 a, vec2 b) {
    vec2  pa = p - a;
    vec2  ba = b - a;
    float h  = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);

    return length(pa - ba * h);
  }

  void main() {
    float d   = segmentDistance(vPos, vA, vB) - vHalf;
    float cov = 1.0 - smoothstep(-uPad, uPad, d);

    if (cov <= 0.0) {
      discard;
    }

    // Premultiplied "over": the p5.Graphics WebGL canvas is premultipliedAlpha,
    // so emitting premultiplied colour lets p.image() composite the buffer onto
    // the p2d canvas with no dark edge fringing.
    float alpha = vColor.a * cov;

    gl_FragColor = vec4(vColor.rgb * alpha, alpha);
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
 * Extract a p5.Color's channels as 0..1 floats, so a colour built by the usual
 * `colors.*` helpers can be fed straight into the batch.
 *
 * @param {object} c p5.Color (or anything exposing a `levels` [r,g,b,a] 0..255)
 * @returns {[number, number, number, number]}
 */
export function colorLevels( c ) {
  const levels = c?.levels ?? [
    255,
    255,
    255,
    255
  ];

  return [
    levels[ 0 ] / 255,
    ( levels[ 1 ] ?? 255 ) / 255,
    ( levels[ 2 ] ?? 255 ) / 255,
    ( levels[ 3 ] ?? 255 ) / 255
  ];
}

/**
 * Create a GPU batch renderer for round-capped 2D primitives.
 *
 * @returns {{ begin: Function, capsule: Function, disc: Function, end: Function }}
 */
export default function createGlowBatchRenderer() {
  const state = {
    graphics: null,
    program: null,
    quadVBO: null,
    instanceVBO: null,
    locs: {},
    aCornerLoc: -1,
    aSegLoc: -1,
    aColorLoc: -1,
    aHalfLoc: -1,
    ext: null,
    ctxRef: null,
    p5Ref: null,
    data: new Float32Array( 1024 * FLOATS_PER_INSTANCE ),
    capacity: 1024,
    count: 0,
    additive: false
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

    state.aCornerLoc = gl.getAttribLocation(
      state.program,
      "aCorner"
    );
    state.aSegLoc = gl.getAttribLocation(
      state.program,
      "aSeg"
    );
    state.aColorLoc = gl.getAttribLocation(
      state.program,
      "aColor"
    );
    state.aHalfLoc = gl.getAttribLocation(
      state.program,
      "aHalf"
    );

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

  function ensureCapacity( needed ) {
    if ( needed <= state.capacity ) {
      return;
    }

    let capacity = state.capacity;

    while ( capacity < needed ) {
      capacity *= 2;
    }

    const grown = new Float32Array( capacity * FLOATS_PER_INSTANCE );

    grown.set( state.data.subarray(
      0,
      state.count * FLOATS_PER_INSTANCE
    ) );

    state.data = grown;
    state.capacity = capacity;
  }

  function setUniform(
    gl, name, value
  ) {
    if ( !( name in state.locs ) ) {
      state.locs[ name ] = gl.getUniformLocation(
        state.program,
        name
      );
    }

    const loc = state.locs[ name ];

    if ( loc === null ) {
      return;
    }

    if ( Array.isArray( value ) ) {
      gl.uniform2f(
        loc,
        value[ 0 ],
        value[ 1 ]
      );

      return;
    }

    gl.uniform1f(
      loc,
      value
    );
  }

  /**
   * Start a new batch. Discards any primitives left over from a previous frame.
   *
   * @param {object} [opts]
   * @param {boolean} [opts.additive=false] add colours instead of "over" blending
   */
  function begin( opts = {} ) {
    state.count = 0;
    state.additive = opts.additive ?? false;
  }

  /**
   * Queue a round-capped segment from (ax, ay) to (bx, by). Colours are 0..1.
   */
  function capsule(
    ax, ay, bx, by, halfWidth, r, g, b, a = 1
  ) {
    ensureCapacity( state.count + 1 );

    const base = state.count * FLOATS_PER_INSTANCE;
    const out = state.data;

    out[ base ] = ax;
    out[ base + 1 ] = ay;
    out[ base + 2 ] = bx;
    out[ base + 3 ] = by;
    out[ base + 4 ] = r;
    out[ base + 5 ] = g;
    out[ base + 6 ] = b;
    out[ base + 7 ] = a;
    out[ base + 8 ] = halfWidth;

    state.count++;
  }

  /**
   * Queue a filled disc (a capsule whose endpoints coincide). Colours are 0..1.
   */
  function disc(
    x, y, radius, r, g, b, a = 1
  ) {
    capsule(
      x,
      y,
      x,
      y,
      radius,
      r,
      g,
      b,
      a
    );
  }

  // Bind a float attribute from the currently-bound ARRAY_BUFFER.
  function bindAttrib(
    gl, loc, size, offset
  ) {
    if ( loc < 0 ) {
      return;
    }

    gl.enableVertexAttribArray( loc );
    gl.vertexAttribPointer(
      loc,
      size,
      gl.FLOAT,
      false,
      INSTANCE_STRIDE,
      offset
    );
    setDivisor(
      gl,
      state.ext,
      loc,
      1
    );
  }

  /**
   * Draw every queued primitive in one instanced call and composite the result
   * onto the main p2d canvas.
   */
  function end() {
    if ( state.count === 0 ) {
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
      state.data.subarray(
        0,
        state.count * FLOATS_PER_INSTANCE
      ),
      gl.DYNAMIC_DRAW
    );

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
      state.additive
        ? gl.ONE
        : gl.ONE_MINUS_SRC_ALPHA
    );
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
        g.width,
        g.height
      ]
    );
    setUniform(
      gl,
      "uPad",
      EDGE_PAD
    );

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
      state.instanceVBO
    );
    bindAttrib(
      gl,
      state.aSegLoc,
      4,
      0
    );
    bindAttrib(
      gl,
      state.aColorLoc,
      4,
      16
    );
    bindAttrib(
      gl,
      state.aHalfLoc,
      1,
      32
    );

    drawArraysInstanced(
      gl,
      state.ext,
      gl.TRIANGLES,
      0,
      6,
      state.count
    );

    // Restore GL state so p5 keeps working with the buffer.
    gl.disableVertexAttribArray( state.aCornerLoc );

    [
      state.aSegLoc,
      state.aColorLoc,
      state.aHalfLoc
    ].forEach( ( loc ) => {
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

  return {
    begin,
    capsule,
    disc,
    end
  };
}

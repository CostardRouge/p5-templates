// ── The sequence compositor: two scene buffers in, one graded frame out ─────
//
// A sequence item owns one WEBGL p5.Graphics the size of its composite buffer.
// Each frame the two scene buffers a transition straddles (or the one scene on
// screen) are uploaded as textures and a fragment program — one per transition
// kind, compiled on first use and kept for the life of the record — draws the
// transition, the two cameras and the film grade in a single pass
// (transitionGlsl.js). The renderer then blits the graphics onto the host.
//
// Records are keyed like every other layer resource ("<scope>:<index>") and
// swept when a sequence stops being drawn, because each one holds a GL
// context. GL objects belong to that context: programs and textures live on
// the record, never shared between sequences or across a sketch reset.
//
// Raw WebGL rather than p5's shader API, as the other GPU helpers do: p5's
// `setUniform` re-looks every name up per call and re-wraps every texture, and
// this runs once per frame on a buffer the size of the canvas.

import {
  getHostP5
} from "../sketch.js";
import {
  SEQUENCE_VERTEX_GLSL, fragmentSourceFor
} from "./transitionGlsl.js";

/** Frames a record survives without being drawn before its context is freed. */
const IDLE_FRAMES_BEFORE_DISPOSE = 180;

/** Same cap as a sketch layer's buffer: a slider slip must not allocate 16k². */
const MAX_SIDE = 4096;

const records = new Map();

let lastSweepFrame = -1;

function compileShader(
  gl, type, source
) {
  const shader = gl.createShader( type );

  gl.shaderSource(
    shader,
    source
  );
  gl.compileShader( shader );

  if ( !gl.getShaderParameter(
    shader,
    gl.COMPILE_STATUS
  ) ) {
    console.error(
      "[sequence] shader compile error:",
      gl.getShaderInfoLog( shader )
    );
    gl.deleteShader( shader );

    return null;
  }

  return shader;
}

function buildProgram(
  gl, kind
) {
  const vertex = compileShader(
    gl,
    gl.VERTEX_SHADER,
    SEQUENCE_VERTEX_GLSL
  );
  const fragment = compileShader(
    gl,
    gl.FRAGMENT_SHADER,
    fragmentSourceFor( kind )
  );

  if ( !vertex || !fragment ) {
    return null;
  }

  const program = gl.createProgram();

  gl.attachShader(
    program,
    vertex
  );
  gl.attachShader(
    program,
    fragment
  );
  gl.linkProgram( program );
  gl.deleteShader( vertex );
  gl.deleteShader( fragment );

  if ( !gl.getProgramParameter(
    program,
    gl.LINK_STATUS
  ) ) {
    console.error(
      `[sequence] program link error (${ kind }):`,
      gl.getProgramInfoLog( program )
    );
    gl.deleteProgram( program );

    return null;
  }

  return {
    program,
    locations: {},
    aPos: gl.getAttribLocation(
      program,
      "aPos"
    )
  };
}

function location(
  gl, entry, name
) {
  if ( !( name in entry.locations ) ) {
    entry.locations[ name ] = gl.getUniformLocation(
      entry.program,
      name
    );
  }

  return entry.locations[ name ];
}

// number → float, { int } → int / sampler, [2|3|4] → vecN.
function setUniform(
  gl, entry, name, value
) {
  const loc = location(
    gl,
    entry,
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
    Number( value ) || 0
  );
}

const TRANSPARENT_TEXEL = new Uint8Array( [
  0,
  0,
  0,
  0
] );

function createTexture(
  gl, filter
) {
  const texture = gl.createTexture();

  gl.bindTexture(
    gl.TEXTURE_2D,
    texture
  );
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    1,
    1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    TRANSPARENT_TEXEL
  );
  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_MIN_FILTER,
    filter
  );
  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_MAG_FILTER,
    filter
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

  return texture;
}

// Upload a canvas (a p5.Graphics' element — P2D or WEBGL, both are
// TexImageSources) into `texture` on `unit`. The canvases are read as they
// are: no flip (the vertex shader puts row 0 at the top), no premultiply (p5
// leaves that GL flag on after its own uploads, so it is set every time).
function uploadCanvas(
  gl, texture, unit, canvas
) {
  gl.activeTexture( gl.TEXTURE0 + unit );
  gl.bindTexture(
    gl.TEXTURE_2D,
    texture
  );

  if ( !canvas ) {
    return;
  }

  gl.pixelStorei(
    gl.UNPACK_FLIP_Y_WEBGL,
    false
  );
  gl.pixelStorei(
    gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,
    false
  );

  try {
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      canvas
    );
  } catch( error ) {
    // A zero-sized or tainted canvas: leave the previous frame in the texture
    // rather than take the whole composite down.
    console.warn(
      "[sequence] texture upload failed",
      error
    );
  }
}

function uploadRamp(
  gl, record, ramp
) {
  gl.activeTexture( gl.TEXTURE2 );
  gl.bindTexture(
    gl.TEXTURE_2D,
    record.texRamp
  );

  if ( !ramp || record.rampKey === ramp.key ) {
    return;
  }

  gl.pixelStorei(
    gl.UNPACK_FLIP_Y_WEBGL,
    false
  );
  gl.pixelStorei(
    gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,
    false
  );
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    ramp.width,
    ramp.height ?? 1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    ramp.data
  );
  record.rampKey = ramp.key;
}

function disposeRecord( record ) {
  const gl = record.gl;

  if ( gl ) {
    record.programs.forEach( ( entry ) => gl.deleteProgram( entry.program ) );

    if ( record.quad ) {
      gl.deleteBuffer( record.quad );
    }

    [
      record.texFrom,
      record.texTo,
      record.texRamp
    ].forEach( ( texture ) => texture && gl.deleteTexture( texture ) );
  }

  try {
    record.graphics?.remove?.();
  } catch {
    // Already gone.
  }

  record.graphics = null;
  record.gl = null;
  record.programs = new Map();
}

function ensureRecord(
  key, host, width, height
) {
  let record = records.get( key );

  if ( !record ) {
    record = {
      key,
      graphics: null,
      gl: null,
      programs: new Map(),
      quad: null,
      texFrom: null,
      texTo: null,
      texRamp: null,
      rampKey: null,
      width: 0,
      height: 0,
      lastSeenFrame: 0
    };
    records.set(
      key,
      record
    );
  }

  if ( !record.graphics ) {
    const graphics = host.createGraphics(
      width,
      height,
      host.WEBGL
    );

    // Detached from the document like every other helper buffer: the pixels
    // only ever travel as a texture into the host canvas.
    graphics.canvas?.remove?.();

    const gl = graphics.drawingContext;

    record.graphics = graphics;
    record.gl = gl;
    record.width = width;
    record.height = height;
    record.programs = new Map();
    record.rampKey = null;
    record.quad = gl.createBuffer();
    gl.bindBuffer(
      gl.ARRAY_BUFFER,
      record.quad
    );
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array( [
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
      ] ),
      gl.STATIC_DRAW
    );
    record.texFrom = createTexture(
      gl,
      gl.LINEAR
    );
    record.texTo = createTexture(
      gl,
      gl.LINEAR
    );
    record.texRamp = createTexture(
      gl,
      gl.LINEAR
    );
  } else if ( record.width !== width || record.height !== height ) {
    // Same canvas element, same GL context: the programs and textures stay
    // valid across a resize (noiseFieldGpu relies on the same fact).
    record.graphics.resizeCanvas(
      width,
      height
    );
    record.graphics.width = width;
    record.graphics.height = height;
    record.width = width;
    record.height = height;
  }

  return record;
}

/**
 * Composite one frame of a sequence.
 *
 * @param {string} key the sequence item's layer key
 * @param {object} params
 * @param {number} params.width composite buffer width, pixels
 * @param {number} params.height composite buffer height, pixels
 * @param {string} params.kind transition kind (transitionGlsl.js)
 * @param {HTMLCanvasElement|null} params.from the outgoing scene's canvas, or null
 * @param {HTMLCanvasElement} params.to the incoming / current scene's canvas
 * @param {number} params.progress eased transition progress (1 = settled)
 * @param {number} params.time loop seconds
 * @param {number[]} params.fromXform camera vec4 for the outgoing scene
 * @param {number[]} params.toXform camera vec4 for the incoming scene
 * @param {number[]} params.color transition colour, 0–255 rgb(a)
 * @param {number} params.glow edge light
 * @param {{ key: string, data: Uint8Array, width: number, height?: number }|null} params.ramp palette ramp, or null for the colour
 * @param {object} params.effect generic effect uniforms (effectUniforms())
 * @param {object} params.grade the item's grade block
 * @returns {import("p5").Graphics|null} the composite, or null when GL refused
 */
export function renderComposite(
  key, {
    width,
    height,
    kind,
    from,
    to,
    progress,
    time,
    fromXform,
    toXform,
    color,
    glow,
    ramp,
    effect,
    grade
  }
) {
  const host = getHostP5();

  if ( !host || !to || !( width > 0 ) || !( height > 0 ) || width > MAX_SIDE || height > MAX_SIDE ) {
    return null;
  }

  const frame = host.frameCount ?? 0;

  if ( frame !== lastSweepFrame ) {
    lastSweepFrame = frame;
    sweepComposites( frame );
  }

  const record = ensureRecord(
    key,
    host,
    width,
    height
  );

  record.lastSeenFrame = frame;

  const gl = record.gl;

  if ( !gl ) {
    return null;
  }

  let entry = record.programs.get( kind );

  if ( entry === undefined ) {
    entry = buildProgram(
      gl,
      kind
    );
    // A failed build is remembered as null, so a broken kind costs one compile
    // and then draws nothing rather than recompiling every frame.
    record.programs.set(
      kind,
      entry
    );
  }

  if ( !entry ) {
    return null;
  }

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
  gl.useProgram( entry.program );

  uploadCanvas(
    gl,
    record.texFrom,
    0,
    from
  );
  uploadCanvas(
    gl,
    record.texTo,
    1,
    to
  );
  uploadRamp(
    gl,
    record,
    ramp
  );

  const set = (
    name, value
  ) => setUniform(
    gl,
    entry,
    name,
    value
  );

  set(
    "uFrom",
    {
      int: 0
    }
  );
  set(
    "uTo",
    {
      int: 1
    }
  );
  set(
    "uRamp",
    {
      int: 2
    }
  );
  set(
    "uRampOn",
    ramp ? 1 : 0
  );
  set(
    "uFromValid",
    from ? 1 : 0
  );
  set(
    "uProgress",
    progress
  );
  set(
    "uTime",
    time
  );
  set(
    "uResolution",
    [
      width,
      height
    ]
  );
  set(
    "uRatio",
    width / height
  );
  set(
    "uFromXform",
    fromXform
  );
  set(
    "uToXform",
    toXform
  );
  set(
    "uColor",
    [
      ( color?.[ 0 ] ?? 0 ) / 255,
      ( color?.[ 1 ] ?? 0 ) / 255,
      ( color?.[ 2 ] ?? 0 ) / 255
    ]
  );
  set(
    "uGlow",
    glow
  );

  Object.entries( effect ?? {} ).forEach( ( [
    name,
    value
  ] ) => set(
    name,
    value
  ) );

  set(
    "uLetterbox",
    grade?.letterbox ?? 0
  );
  set(
    "uVignette",
    grade?.vignette ?? 0
  );
  set(
    "uGrain",
    grade?.grain ?? 0
  );
  set(
    "uAberration",
    grade?.aberration ?? 0
  );
  set(
    "uSaturation",
    grade?.saturation ?? 1
  );
  set(
    "uContrast",
    grade?.contrast ?? 1
  );
  set(
    "uTint",
    [
      ( grade?.tint?.[ 0 ] ?? 255 ) / 255,
      ( grade?.tint?.[ 1 ] ?? 255 ) / 255,
      ( grade?.tint?.[ 2 ] ?? 255 ) / 255
    ]
  );
  set(
    "uTintAmount",
    grade?.tintAmount ?? 0
  );
  set(
    "uScanlines",
    grade?.scanlines ?? 0
  );

  gl.bindBuffer(
    gl.ARRAY_BUFFER,
    record.quad
  );
  gl.enableVertexAttribArray( entry.aPos );
  gl.vertexAttribPointer(
    entry.aPos,
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

  gl.disableVertexAttribArray( entry.aPos );
  gl.bindBuffer(
    gl.ARRAY_BUFFER,
    null
  );
  gl.activeTexture( gl.TEXTURE0 );

  return record.graphics;
}

/** Free the composites of sequences that stopped being drawn. */
export function sweepComposites( frame = getHostP5()?.frameCount ?? 0 ) {
  records.forEach( (
    record, key
  ) => {
    if ( frame - ( record.lastSeenFrame ?? 0 ) > IDLE_FRAMES_BEFORE_DISPOSE ) {
      disposeRecord( record );
      records.delete( key );
    }
  } );
}

/** Drop every composite. Called between sketches. */
export function disposeComposites() {
  records.forEach( disposeRecord );
  records.clear();
  lastSweepFrame = -1;
}

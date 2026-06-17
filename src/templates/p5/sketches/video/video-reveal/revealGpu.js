import graphics from "@/p5/utils/graphics.js";
import {
  getP5
} from "@/p5/utils/sketch.js";

// ─────────────────────────────────────────────────────────────────────────────
// GPU renderer for video-reveal.
//
// The 2D original drew the composite per cell: one tinted image() crop for every
// revealed cell plus up to four line() calls per cell for the outline — a few
// thousand draw calls per frame at 64 × 64. This module does the whole thing in
// a single full-screen fragment-shader pass on an off-screen WebGL buffer, then
// composites it onto the p2d canvas.
//
// Two textures feed the shader:
//   - uVideo  : the live camera frame (cover-fit, mirrored and optionally
//               desaturated entirely on the GPU — no CPU blit),
//   - uReveal : a columns × rows LUMINANCE texture holding each cell's 0..1 fade
//               value, uploaded fresh each frame from the CPU integration.
//
// The outline is the interesting part: for each pixel we find its cell, compare
// the cell's "revealed?" state against its four neighbours, and draw a white
// edge straddling any boundary where exactly one side is revealed. Shared edges
// between two revealed cells are never boundaries, so internal borders vanish
// and the revealed blob reads as a single clean cut-out — same rule as the CPU
// version, evaluated per pixel.
// ─────────────────────────────────────────────────────────────────────────────

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

  varying vec2 vUv;

  uniform vec2  uResolution;
  uniform float uColumns;
  uniform float uRows;

  uniform sampler2D uReveal;  // columns x rows, .r = reveal value 0..1
  uniform sampler2D uVideo;   // live camera frame
  uniform vec2  uVideoRes;    // intrinsic video size (px)
  uniform float uHasVideo;    // 1 when a decodable frame is bound

  uniform vec4  uHiddenColor; // rgba, 0..1
  uniform float uFlip;        // mirror the camera horizontally
  uniform float uGrayscale;   // desaturate the revealed pixels
  uniform float uCellGap;     // gap between cells, 0..1 fraction of a cell

  uniform float uOutlineShow;
  uniform float uOutlineWeight;    // px (full stroke, straddling the edge)
  uniform vec4  uOutlineColor;     // rgba, 0..1
  uniform float uOutlineThreshold; // a cell counts as revealed past this value
  uniform float uSoftEdge;         // outline opacity follows the reveal value

  // Reveal value of cell (cx, cy); off-grid cells read as hidden (0).
  float revealAt( float cx, float cy ) {
    if ( cx < 0.0 || cy < 0.0 || cx > uColumns - 1.0 || cy > uRows - 1.0 ) {
      return 0.0;
    }

    vec2 uv = ( vec2( cx, cy ) + 0.5 ) / vec2( uColumns, uRows );

    return texture2D( uReveal, uv ).r;
  }

  // Cover-fit + mirror the camera frame, sampled at canvas pixel px.
  vec3 sampleVideo( vec2 px ) {
    if ( uHasVideo < 0.5 ) {
      return uHiddenColor.rgb;
    }

    float scale = max(
      uResolution.x / uVideoRes.x,
      uResolution.y / uVideoRes.y
    );
    vec2 drawSize = uVideoRes * scale;
    vec2 origin = ( uResolution - drawSize ) * 0.5;
    vec2 vidUv = ( px - origin ) / drawSize;

    if ( uFlip > 0.5 ) {
      vidUv.x = 1.0 - vidUv.x;
    }

    vec3 color = texture2D( uVideo, vidUv ).rgb;

    if ( uGrayscale > 0.5 ) {
      color = vec3( dot( color, vec3( 0.299, 0.587, 0.114 ) ) );
    }

    return color;
  }

  // Accumulate the outline coverage contributed by one edge: when this cell and
  // the neighbour across the edge disagree on "revealed?", the white stroke
  // straddles the shared edge at pixel distance dist.
  void edge(
    float aHere, float neighbourValue, float dist, float halfWeight,
    inout float cov, inout float edgeReveal, float here
  ) {
    float aN = step( uOutlineThreshold, neighbourValue );

    if ( abs( aHere - aN ) > 0.5 ) {
      float c = 1.0 - smoothstep( halfWeight - 1.0, halfWeight + 1.0, dist );

      if ( c > cov ) {
        cov = c;
        edgeReveal = max( here, neighbourValue );
      }
    }
  }

  void main() {
    // Top-left origin, matching p5's 2D coordinates.
    vec2 px = vec2( vUv.x * uResolution.x, ( 1.0 - vUv.y ) * uResolution.y );

    float cellWidth = uResolution.x / uColumns;
    float cellHeight = uResolution.y / uRows;
    float cx = floor( px.x / cellWidth );
    float cy = floor( px.y / cellHeight );
    vec2 f = vec2( px.x / cellWidth - cx, px.y / cellHeight - cy ); // 0..1 in cell

    float here = revealAt( cx, cy );

    // Cell gap → the grout band shows the hidden colour, never the video.
    float halfGap = uCellGap * 0.5;
    float inside =
      step( halfGap, f.x ) * step( f.x, 1.0 - halfGap ) *
      step( halfGap, f.y ) * step( f.y, 1.0 - halfGap );

    vec3 video = sampleVideo( px );
    float amount = clamp( here * inside, 0.0, 1.0 );
    vec3 col = mix( uHiddenColor.rgb, video, amount );

    if ( uOutlineShow > 0.5 ) {
      float halfWeight = max( uOutlineWeight * 0.5, 0.0 );
      float aHere = step( uOutlineThreshold, here );
      float cov = 0.0;
      float edgeReveal = 0.0;

      edge( aHere, revealAt( cx - 1.0, cy ), f.x * cellWidth, halfWeight, cov, edgeReveal, here );
      edge( aHere, revealAt( cx + 1.0, cy ), ( 1.0 - f.x ) * cellWidth, halfWeight, cov, edgeReveal, here );
      edge( aHere, revealAt( cx, cy - 1.0 ), f.y * cellHeight, halfWeight, cov, edgeReveal, here );
      edge( aHere, revealAt( cx, cy + 1.0 ), ( 1.0 - f.y ) * cellHeight, halfWeight, cov, edgeReveal, here );

      float softAlpha = uSoftEdge > 0.5 ? edgeReveal : 1.0;

      col = mix( col, uOutlineColor.rgb, cov * softAlpha * uOutlineColor.a );
    }

    gl_FragColor = vec4( col, 1.0 );
  }
`;

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
      "[video-reveal] shader compile error:",
      gl.getShaderInfoLog( shader )
    );
    gl.deleteShader( shader );

    return null;
  }

  return shader;
}

function buildProgram( gl ) {
  const vert = compileShader(
    gl,
    gl.VERTEX_SHADER,
    VERT_SRC
  );
  const frag = compileShader(
    gl,
    gl.FRAGMENT_SHADER,
    FRAG_SRC
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
      "[video-reveal] program link error:",
      gl.getProgramInfoLog( program )
    );

    return null;
  }

  gl.deleteShader( vert );
  gl.deleteShader( frag );

  return program;
}

// Normalise a [r, g, b, a?] colour in 0..255 to a vec4 in 0..1 (alpha → 1).
function normalizeColor( color ) {
  const r = ( color?.[ 0 ] ?? 0 ) / 255;
  const g = ( color?.[ 1 ] ?? 0 ) / 255;
  const b = ( color?.[ 2 ] ?? 0 ) / 255;
  const a = ( color?.[ 3 ] ?? 255 ) / 255;

  return [
    r,
    g,
    b,
    a
  ];
}

/**
 * Create the video-reveal GPU renderer.
 *
 * @returns {{ render: Function }}
 */
export default function createRevealRenderer() {
  const state = {
    graphics: null,
    program: null,
    quadVBO: null,
    aPosLoc: -1,
    revealTexture: null,
    revealWidth: 0,
    revealHeight: 0,
    videoTexture: null,
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

    state.program = buildProgram( gl );
    state.locs = {};
    state.revealTexture = null;
    state.revealWidth = 0;
    state.revealHeight = 0;
    state.videoTexture = null;
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

  function getLocation(
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

  function setFloat(
    gl, name, value
  ) {
    gl.uniform1f(
      getLocation(
        gl,
        name
      ),
      value
    );
  }

  function setVec2(
    gl, name, x, y
  ) {
    gl.uniform2f(
      getLocation(
        gl,
        name
      ),
      x,
      y
    );
  }

  function setVec4(
    gl, name, value
  ) {
    gl.uniform4f(
      getLocation(
        gl,
        name
      ),
      value[ 0 ],
      value[ 1 ],
      value[ 2 ],
      value[ 3 ]
    );
  }

  // (Re)allocate + upload the reveal grid into a LUMINANCE texture on unit 0.
  function uploadReveal(
    gl, data, columns, rows
  ) {
    if ( !state.revealTexture ) {
      state.revealTexture = gl.createTexture();
    }

    gl.activeTexture( gl.TEXTURE0 );
    gl.bindTexture(
      gl.TEXTURE_2D,
      state.revealTexture
    );

    // LUMINANCE rows are byte-tight; arbitrary (odd) widths need alignment 1.
    gl.pixelStorei(
      gl.UNPACK_ALIGNMENT,
      1
    );
    gl.pixelStorei(
      gl.UNPACK_FLIP_Y_WEBGL,
      false
    );

    if ( state.revealWidth !== columns || state.revealHeight !== rows ) {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.LUMINANCE,
        columns,
        rows,
        0,
        gl.LUMINANCE,
        gl.UNSIGNED_BYTE,
        data
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

      state.revealWidth = columns;
      state.revealHeight = rows;
    } else {
      gl.texSubImage2D(
        gl.TEXTURE_2D,
        0,
        0,
        0,
        columns,
        rows,
        gl.LUMINANCE,
        gl.UNSIGNED_BYTE,
        data
      );
    }
  }

  // Upload the live camera frame into a texture on unit 1. Returns whether a
  // decodable frame was available this call.
  function uploadVideo(
    gl, video
  ) {
    if ( !state.videoTexture ) {
      state.videoTexture = gl.createTexture();

      gl.activeTexture( gl.TEXTURE1 );
      gl.bindTexture(
        gl.TEXTURE_2D,
        state.videoTexture
      );
      // Seed a 1×1 pixel so the sampler is always complete, even before the
      // first frame decodes.
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        1,
        1,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        new Uint8Array( [
          0,
          0,
          0,
          255
        ] )
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
        gl.CLAMP_TO_EDGE
      );
      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_WRAP_T,
        gl.CLAMP_TO_EDGE
      );
    }

    gl.activeTexture( gl.TEXTURE1 );
    gl.bindTexture(
      gl.TEXTURE_2D,
      state.videoTexture
    );

    if ( !video ) {
      return false;
    }

    gl.pixelStorei(
      gl.UNPACK_ALIGNMENT,
      4
    );
    gl.pixelStorei(
      gl.UNPACK_FLIP_Y_WEBGL,
      false
    );

    try {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        video
      );
    } catch {
      // A frame can be momentarily unuploadable (dimension change mid-decode);
      // keep the previous texture rather than crashing the draw loop.
      return false;
    }

    return true;
  }

  /**
   * Render one frame and composite it onto the main canvas.
   *
   * @param {object} params
   * @param {number}     params.columns
   * @param {number}     params.rows
   * @param {Uint8Array} params.revealData     columns*rows bytes, cell fade × 255
   * @param {HTMLVideoElement|null} params.video    live frame, or null when not ready
   * @param {number}     params.videoWidth
   * @param {number}     params.videoHeight
   * @param {boolean}    params.flip
   * @param {number[]}   params.hiddenColor     [r,g,b,a?] 0..255
   * @param {boolean}    params.grayscale
   * @param {number}     params.cellGap         0..1
   * @param {object}     params.outline         { show, weight, color, threshold, softEdge }
   */
  function render( params ) {
    const {
      columns,
      rows,
      revealData,
      video,
      videoWidth,
      videoHeight,
      flip,
      hiddenColor,
      grayscale,
      cellGap,
      outline
    } = params;

    const p = getP5();
    const g = ensureGraphics();
    const gl = g.drawingContext;

    if ( !ensureProgram( gl ) ) {
      return;
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
      1
    );
    gl.clear( gl.COLOR_BUFFER_BIT );

    gl.useProgram( state.program );

    uploadReveal(
      gl,
      revealData,
      columns,
      rows
    );
    const hasVideo = uploadVideo(
      gl,
      video
    );

    // Samplers → texture units.
    gl.uniform1i(
      getLocation(
        gl,
        "uReveal"
      ),
      0
    );
    gl.uniform1i(
      getLocation(
        gl,
        "uVideo"
      ),
      1
    );

    setVec2(
      gl,
      "uResolution",
      width,
      height
    );
    setFloat(
      gl,
      "uColumns",
      columns
    );
    setFloat(
      gl,
      "uRows",
      rows
    );
    setVec2(
      gl,
      "uVideoRes",
      Math.max(
        1,
        videoWidth || 1
      ),
      Math.max(
        1,
        videoHeight || 1
      )
    );
    setFloat(
      gl,
      "uHasVideo",
      hasVideo ? 1 : 0
    );
    setVec4(
      gl,
      "uHiddenColor",
      normalizeColor( hiddenColor )
    );
    setFloat(
      gl,
      "uFlip",
      flip ? 1 : 0
    );
    setFloat(
      gl,
      "uGrayscale",
      grayscale ? 1 : 0
    );
    setFloat(
      gl,
      "uCellGap",
      Math.max(
        0,
        Math.min(
          0.9,
          cellGap ?? 0
        )
      )
    );

    setFloat(
      gl,
      "uOutlineShow",
      outline?.show ? 1 : 0
    );
    setFloat(
      gl,
      "uOutlineWeight",
      outline?.weight ?? 2
    );
    setVec4(
      gl,
      "uOutlineColor",
      normalizeColor( outline?.color ?? [
        255,
        255,
        255,
        255
      ] )
    );
    setFloat(
      gl,
      "uOutlineThreshold",
      outline?.threshold ?? 0.18
    );
    setFloat(
      gl,
      "uSoftEdge",
      outline?.softEdge ? 1 : 0
    );

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

    // Restore GL state so p5 keeps using the buffer cleanly.
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

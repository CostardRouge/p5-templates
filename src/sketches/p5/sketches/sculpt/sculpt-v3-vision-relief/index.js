import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import easing from "@/p5/utils/easing.js";
import createNoiseFieldRenderer from "@/p5/utils/noiseFieldGpu.js";
import {
  BRAID_UNIFORMS_GLSL,
  IRIDESCENT_GLSL,
  braidShadingGlsl,
  lightDirFrom,
  focalFromFov
} from "@/p5/utils/braidShader.js";
import {
  initInteraction,
  getPointerGroups
} from "@/p5/utils/interaction/index.js";
import {
  drawInteractionCameraPreview
} from "@/p5/utils/interaction/overlay.js";
import mediapipe, {
  getTaskResult
} from "@/p5/utils/mediapipe/mediapipe.js";
import {
  DURATION_DEFAULT
} from "@/lib/animationConfig";
import {
  getSheet,
  sheetFrame,
  canvasToSheet,
  sheetToCanvas,
  rowScaleFor,
  createHeightState,
  liftRank,
  computeTargets,
  spreadTargets,
  integrateHeights,
  packSheet,
  sheetDriftAt,
  rateFor
} from "../_sheet.js";
import {
  handEntity,
  faceEntity,
  faceBoxEntity,
  bodyEntity,
  cursorEntity,
  makeEntity,
  disc,
  entityDistance,
  shapePresence,
  processMask,
  maskPresenceAt
} from "../_silhouette.js";

// ─────────────────────────────────────────────────────────────────────────────
// sculpt v3 — vision relief.
//
// A sheet of nodes seen from above, at rest a field of small beads. What the
// camera sees — a hand, a face, a body — is traced as a SURFACE on the sheet
// (_silhouette.js), the nodes under that surface lift, and the rings material's
// tubes tighten between neighbours that are up. The relief draws the
// silhouette; the tubes only ever join two lifted nodes, so the hole of an O or
// the gap between two fingers stays empty.
//
// ── Why a grid, and why a texture ────────────────────────────────────────────
// v1 uploads its capsules as uniform arrays, which caps a sculpture at 96
// links. A face lifts several hundred at once. Here the sheet is a regular
// lattice, so the shader finds the cell a sample falls in with a `floor` and
// evaluates only the links of the 3 × 3 cells around it — at most 9 beads and
// 36 capsules whatever the node count — and everything per node (a 16-bit
// height, the x / z jitter) rides in one small RGBA texture (`packSheet`).
// The sphere-trace step is clamped to the cell wall (plus a slack above the
// hit threshold, the flip-v3 lesson) so a ray can never cross into a cell
// whose links it did not evaluate, and the jitter is bounded so no link can
// reach a cell two away (`jitterBudget`).
//
// ── Presence → height ────────────────────────────────────────────────────────
// Per node: a signed distance to the nearest silhouette, shaped into a
// presence (feather, plateau / dome / rim); a rank inside the silhouette that
// delays the lift (radial, sweep, noise); contagion to the neighbours; then an
// exponential rise / hold / fall on the loop clock's dt, so the relief moves
// the same at 30 and at 60 fps. The mouse and touch stamp the same brush, and
// a virtual hand wanders the sheet when nothing has been seen for a while —
// that is what a headless export shows, from frame 0, so it stays a pure
// function of the frame index.
//
// ── Camera ───────────────────────────────────────────────────────────────────
// Top-down by construction, tilted and turned by sliders (so bindable), ortho
// by default: at tilt 0 the sheet's cells are the canvas's pixels and a
// landmark lands under the pixel it was seen at. The mouse is unprojected
// through the same rig, so its brush lands under the pointer at any tilt.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_STEPS = 96;
const SURF_EPS = 0.002; // cells
const VISION_TTL_MS = 1500; // matches the interaction layer's result TTL

const FRAGMENT = `
  ${ BRAID_UNIFORMS_GLSL }

  // ── The sheet: one texel per node ──
  uniform sampler2D uSheet;      // R,G = height (16 bit), B = x jitter, A = z jitter (row units)
  uniform vec2  uGrid;           // columns, rows
  uniform float uRowScale;       // world z per row (1 square, 0.866 hex)
  uniform float uHeightMax;      // world height at height 1
  uniform float uBeadRest;       // bead radius at rest
  uniform float uBeadLift;       // bead radius gained at height 1
  uniform float uTubeRest;       // tube radius always present (0 = no tube at rest)
  uniform float uTubeOn;         // tube radius gained once the link is lit
  uniform float uTubeLift;       // tube radius gained with the lower end's height
  uniform float uLinkThreshold;  // height that lights a link
  uniform float uLinkFade;       // height span over which it fattens in
  uniform float uLinkAny;        // 1 = either end lifts the link, 0 = both
  uniform int   uLinkMode;       // 0 four neighbours, 1 eight, 2 hex
  uniform float uSmoothK;        // smooth-union fillet
  uniform float uTaper;          // 0 = uniform tube, 1 = each end its own radius
  uniform float uBoundR;         // widest primitive (box bound)

  // ── Camera: an explicit basis, top-down and tilted ──
  uniform vec3  uRo;
  uniform vec3  uFwd;
  uniform vec3  uRight;
  uniform vec3  uUp;
  uniform float uViewH;          // orthographic view height (world units)
  uniform float uOrtho;

  ${ IRIDESCENT_GLSL }

  // A bound must never read as a surface: kept above SURF_EPS.
  const float SLACK = 0.006;

  float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);

    return mix(b, a, h) - k * h * (1.0 - h);
  }

  // Union of the field so far with one more primitive. EMPTY (1e9, a dark
  // link or nothing yet) must never reach smin: mix(1e9, x, 1.0) cancels x
  // away in float32 and returns ~0, which reads as a surface everywhere.
  const float EMPTY = 1e9;

  float join(float d, float x) {
    if (x >= 1e8) { return d; }
    if (d >= 1e8) { return x; }

    return smin(d, x, uSmoothK);
  }

  // The node of a cell: world xyz, and its height fraction in w.
  vec4 nodeAt(vec2 cell) {
    vec4 t = texture2D(uSheet, (cell + 0.5) / uGrid);
    float h = (t.r * 65280.0 + t.g * 255.0) / 65535.0;

    return vec4(cell.x + (t.b - 0.5), h * uHeightMax, (cell.y + (t.a - 0.5)) * uRowScale, h);
  }

  bool inGrid(vec2 cell) {
    return cell.x >= 0.0 && cell.y >= 0.0 && cell.x <= uGrid.x - 1.0 && cell.y <= uGrid.y - 1.0;
  }

  // Round-capped segment with a radius sliding from ra to rb.
  float capsuleDist(vec3 p, vec3 a, vec3 b, float ra, float rb) {
    vec3 pa = p - a;
    vec3 ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);

    return length(pa - ba * h) - mix(ra, rb, h);
  }

  // The link from node a to the node of cellB, or nothing when it is dark.
  float linkDist(vec3 p, vec4 a, vec2 cellB) {
    if (!inGrid(cellB)) { return EMPTY; }

    vec4 b = nodeAt(cellB);
    float lo = min(a.w, b.w);
    float gate = uLinkAny > 0.5 ? max(a.w, b.w) : lo;
    float s = smoothstep(uLinkThreshold, uLinkThreshold + uLinkFade, gate);
    float ra = uTubeRest + s * (uTubeOn + uTubeLift * mix(lo, a.w, uTaper));
    float rb = uTubeRest + s * (uTubeOn + uTubeLift * mix(lo, b.w, uTaper));

    if (ra <= 0.0005 && rb <= 0.0005) { return EMPTY; }

    return capsuleDist(p, a.xyz, b.xyz, ra, rb);
  }

  float mapScene(vec3 p) {
    // Box bound around the whole sheet: outside it, the distance to it.
    vec3 lo = vec3(-1.0, -uBoundR, -uRowScale);
    vec3 hi = vec3(uGrid.x, uHeightMax + uBoundR, uGrid.y * uRowScale);
    vec3 q = max(lo - p, p - hi);
    float outside = length(max(q, 0.0));

    if (outside > 0.0) { return max(outside, SLACK); }

    vec2 c = vec2(floor(p.x), floor(p.z / uRowScale));
    vec2 f = vec2(p.x - c.x, p.z / uRowScale - c.y);
    float wall = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y) * uRowScale);
    float d = EMPTY;

    for (int dj = -1; dj <= 1; dj++) {
      for (int di = -1; di <= 1; di++) {
        vec2 cell = c + vec2(float(di), float(dj));

        if (!inGrid(cell)) { continue; }

        vec4 n = nodeAt(cell);
        float br = uBeadRest + uBeadLift * n.w;

        if (br > 0.0005) { d = join(d, length(p - n.xyz) - br); }

        // Each node owns its links east and south — and, when diagonals are
        // on, south-east and north-east. A hex row owns its diagonals only on
        // odd rows: the even rows' six neighbours are then all covered once.
        d = join(d, linkDist(p, n, cell + vec2(1.0, 0.0)));
        d = join(d, linkDist(p, n, cell + vec2(0.0, 1.0)));

        bool odd = mod(cell.y, 2.0) > 0.5;
        bool diag = uLinkMode == 1 || (uLinkMode == 2 && odd);

        if (diag) {
          d = join(d, linkDist(p, n, cell + vec2(1.0, 1.0)));
          d = join(d, linkDist(p, n, cell + vec2(1.0, -1.0)));
        }
      }
    }

    // Never step past the cell wall: the next cell has links this one did
    // not evaluate.
    return min(d, wall + SLACK);
  }

  // A per-node identity for the hue shift: the nearest node's cell, hashed.
  float nearestPipe(vec3 p) {
    vec2 c = vec2(floor(p.x), floor(p.z / uRowScale));
    float best = 1e9;
    float id = 0.0;

    for (int dj = -1; dj <= 1; dj++) {
      for (int di = -1; di <= 1; di++) {
        vec2 cell = c + vec2(float(di), float(dj));

        if (!inGrid(cell)) { continue; }

        float d = length(p - nodeAt(cell).xyz);

        if (d < best) { best = d; id = cell.x + cell.y * uGrid.x; }
      }
    }

    return fract(sin(id * 12.9898) * 43758.5453);
  }

  ${ braidShadingGlsl( {
    maxSteps: MAX_STEPS,
    surfEps: SURF_EPS
  } ) }

  void main() {
    vec2 frag = vec2(vUv.x * uResolution.x, vUv.y * uResolution.y);
    vec2 uv = (frag - 0.5 * uResolution) / uResolution.y;

    if (uAberration < 0.5) {
      vec3 ro = uOrtho > 0.5
        ? uRo + uRight * (uv.x * uViewH) + uUp * (uv.y * uViewH)
        : uRo;
      vec3 rd = uOrtho > 0.5
        ? uFwd
        : normalize(uFwd * uFocal + uRight * uv.x + uUp * uv.y);

      gl_FragColor = traceRay(ro, rd);
      return;
    }

    // R / B re-traced along slightly offset rays, as in the family's camera.
    vec2 dir = uAberrationMode == 1 ? vec2(1.0, 0.0) : normalize(uv + vec2(1e-4));
    vec2 off = dir * (uAberration / uResolution.y);
    vec4 acc = vec4(0.0);

    for (int k = 0; k < 3; k++) {
      vec2 o = k == 0 ? off : (k == 1 ? vec2(0.0) : -off);
      vec2 u = uv + o;
      vec3 ro = uOrtho > 0.5
        ? uRo + uRight * (u.x * uViewH) + uUp * (u.y * uViewH)
        : uRo;
      vec3 rd = uOrtho > 0.5
        ? uFwd
        : normalize(uFwd * uFocal + uRight * u.x + uUp * u.y);
      vec4 c = traceRay(ro, rd);

      if (k == 0) { acc.r = c.r; }
      if (k == 1) { acc.g = c.g; }
      if (k == 2) { acc.b = c.b; }

      acc.a = max(acc.a, c.a);
    }

    gl_FragColor = acc;
  }
`;

const reliefRenderer = createNoiseFieldRenderer( FRAGMENT );

// ── Per-instance state ───────────────────────────────────────────────────────
const state = sketch.state( () => ( {
  sheetKey: null,
  heights: null,
  ranks: null,
  spread: null,
  packed: null,
  driftX: null,
  driftZ: null,
  lastNow: null,
  // Landmark smoothing, keyed "source:entity:index".
  smooth: new Map(),
  seen: new Set(),
  // The processed segmentation mask and the raw result it came from.
  mask: null,
  maskSource: null,
  maskKey: "",
  // Idle: nothing seen yet means the virtual hand is fully on from frame 0.
  seenOnce: false,
  lastSeen: 0,
  idleGain: 1
} ) );

function clamp(
  value, min, max
) {
  return Math.min(
    max,
    Math.max(
      min,
      value
    )
  );
}

function vRotY(
  v, a
) {
  const c = Math.cos( a );
  const s = Math.sin( a );

  return [
    v[ 0 ] * c + v[ 2 ] * s,
    v[ 1 ],
    -v[ 0 ] * s + v[ 2 ] * c
  ];
}

function vCross(
  a, b
) {
  return [
    a[ 1 ] * b[ 2 ] - a[ 2 ] * b[ 1 ],
    a[ 2 ] * b[ 0 ] - a[ 0 ] * b[ 2 ],
    a[ 0 ] * b[ 1 ] - a[ 1 ] * b[ 0 ]
  ];
}

function vNormalize( v ) {
  const l = Math.hypot(
    v[ 0 ],
    v[ 1 ],
    v[ 2 ]
  ) || 1;

  return [
    v[ 0 ] / l,
    v[ 1 ] / l,
    v[ 2 ] / l
  ];
}

// ── Camera rig ───────────────────────────────────────────────────────────────
// Tilt 0 looks straight down with row 0 at the top of the screen; tilting
// swings the eye toward the bottom rows, yaw turns it around the sheet's
// centre. Ortho at tilt 0 and zoom 1 maps one cell to `frame.cellPx` pixels,
// exactly the CPU mapping the landmarks use.
function cameraRig(
  camera, loop, frame, heightMax
) {
  const swayCycles = Math.max(
    0,
    Math.round( camera.swayCycles ?? 1 )
  );
  const tilt = clamp(
    ( camera.tilt ?? 0.38 ) + ( camera.sway ?? 0 ) * Math.sin( swayCycles * loop * Math.PI * 2 ),
    0,
    1.45
  );
  const yaw = ( camera.yaw ?? 0 ) + Math.round( camera.orbit ?? 0 ) * loop * Math.PI * 2;
  const ct = Math.cos( tilt );
  const st = Math.sin( tilt );
  const fwd = vRotY(
    [
      0,
      -ct,
      -st
    ],
    yaw
  );
  const up = vRotY(
    [
      0,
      st,
      -ct
    ],
    yaw
  );
  const right = vNormalize( vCross(
    fwd,
    up
  ) );
  const zoom = Math.max(
    camera.zoom ?? 1,
    0.1
  );
  const viewH = frame.height / frame.cellPx / zoom;
  const ortho = ( camera.projection ?? "ortho" ) !== "perspective";
  const focal = focalFromFov( camera.fov ?? 45 );
  const extent = Math.max(
    frame.columns,
    frame.rows * frame.rowScale,
    viewH
  );
  const dist = ortho
    ? extent * 1.2 + heightMax + 2
    : viewH * focal;
  const centre = [
    ( frame.columns - 1 ) / 2,
    0,
    ( frame.rows - 1 ) * frame.rowScale / 2
  ];
  const ro = [
    centre[ 0 ] - fwd[ 0 ] * dist,
    centre[ 1 ] - fwd[ 1 ] * dist,
    centre[ 2 ] - fwd[ 2 ] * dist
  ];

  return {
    ro,
    fwd,
    up,
    right,
    viewH,
    ortho,
    focal,
    dist,
    yaw,
    tilt,
    extent
  };
}

// Canvas pixel → the point of the sheet plane (y = 0) under it.
function unprojectToSheet(
  rig, frame, px, py
) {
  const ux = ( px - frame.width / 2 ) / frame.height;
  const uy = ( frame.height / 2 - py ) / frame.height;
  let o;
  let d;

  if ( rig.ortho ) {
    o = [
      rig.ro[ 0 ] + rig.right[ 0 ] * ux * rig.viewH + rig.up[ 0 ] * uy * rig.viewH,
      rig.ro[ 1 ] + rig.right[ 1 ] * ux * rig.viewH + rig.up[ 1 ] * uy * rig.viewH,
      rig.ro[ 2 ] + rig.right[ 2 ] * ux * rig.viewH + rig.up[ 2 ] * uy * rig.viewH
    ];
    d = rig.fwd;
  } else {
    o = rig.ro;
    d = vNormalize( [
      rig.fwd[ 0 ] * rig.focal + rig.right[ 0 ] * ux + rig.up[ 0 ] * uy,
      rig.fwd[ 1 ] * rig.focal + rig.right[ 1 ] * ux + rig.up[ 1 ] * uy,
      rig.fwd[ 2 ] * rig.focal + rig.right[ 2 ] * ux + rig.up[ 2 ] * uy
    ] );
  }

  if ( d[ 1 ] > -1e-4 ) {
    return null;
  }

  const t = -o[ 1 ] / d[ 1 ];

  return {
    x: o[ 0 ] + d[ 0 ] * t,
    z: o[ 2 ] + d[ 2 ] * t
  };
}

// ── Vision ───────────────────────────────────────────────────────────────────

// Mirror rule of the interaction layer (_visionFlip): a webcam is mirrored by
// default, a recorded video / image is not.
function visionFlip( vision ) {
  const mode = vision?.source?.mode || "webcam";

  if ( mode === "video" || mode === "image" ) {
    return vision?.source?.flip ?? false;
  }

  return vision?.source?.flip ?? vision?.camera?.flip ?? true;
}

// The options the interaction layer runs on: the sketch's block, plus the
// segmenter task when the silhouette comes from the mask.
function interactionFor( o ) {
  const interaction = o.interaction ?? {};

  if ( ( o.detect?.mode ?? "landmarks" ) !== "mask" ) {
    return interaction;
  }

  return {
    ...interaction,
    vision: {
      ...( interaction.vision ?? {} ),
      segmenter: {
        enabled: true
      }
    }
  };
}

// Normalised landmark → sheet world units, through the canvas mapping.
function landmarkToSheet(
  lm, flip, frame
) {
  const x = ( flip ? 1 - lm.x : lm.x ) * frame.width;
  const y = lm.y * frame.height;
  const pt = canvasToSheet(
    frame,
    x,
    y
  );

  pt.visibility = lm.visibility;

  return pt;
}

// Exponential smoothing of a landmark set, keyed so a hand that leaves and
// comes back does not snap from a stale position.
function smoothPoints(
  key, points, amount
) {
  if ( !( amount > 0 ) ) {
    return points;
  }

  const keep = 1 - amount;

  return points.map( (
    pt, i
  ) => {
    const id = `${ key }:${ i }`;
    const prev = state.smooth.get( id );

    state.seen.add( id );

    if ( !prev ) {
      state.smooth.set(
        id,
        {
          x: pt.x,
          z: pt.z
        }
      );

      return pt;
    }

    prev.x += ( pt.x - prev.x ) * keep;
    prev.z += ( pt.z - prev.z ) * keep;

    return {
      x: prev.x,
      z: prev.z,
      visibility: pt.visibility
    };
  } );
}

function collectVisionEntities(
  interaction, detect, frame, out
) {
  const vision = interaction.vision;

  if ( interaction.enabled === false || !vision?.enabled ) {
    return;
  }

  const flip = visionFlip( vision );
  const smoothing = clamp(
    detect.smoothing ?? 0.5,
    0,
    0.95
  );
  const thickness = Math.max(
    detect.thickness ?? 1,
    0.1
  );
  const convert = (
    key, landmarks
  ) => smoothPoints(
    key,
    landmarks.map( ( lm ) => landmarkToSheet(
      lm,
      flip,
      frame
    ) ),
    smoothing
  );

  if ( vision.hands?.enabled ) {
    const hands = getTaskResult(
      "hands",
      VISION_TTL_MS
    )?.landmarks ?? [];

    hands.slice(
      0,
      vision.hands.maxHands ?? 2
    ).forEach( (
      hand, index
    ) => {
      const entity = handEntity(
        convert(
          `hand:${ index }`,
          hand
        ),
        {
          thickness
        }
      );

      if ( entity ) {
        out.push( entity );
      }
    } );
  }

  if ( vision.faceMesh?.enabled ) {
    const faces = getTaskResult(
      "faceMesh",
      VISION_TTL_MS
    )?.faceLandmarks ?? [];

    faces.slice(
      0,
      vision.faceMesh.maxFaces ?? 1
    ).forEach( (
      face, index
    ) => {
      const entity = faceEntity( convert(
        `faceMesh:${ index }`,
        face
      ) );

      if ( entity ) {
        out.push( entity );
      }
    } );
  } else if ( vision.face?.enabled ) {
    const detections = getTaskResult(
      "faces",
      VISION_TTL_MS
    )?.detections ?? [];
    const capW = mediapipe.capture?.size?.width ?? 320;
    const capH = mediapipe.capture?.size?.height ?? 240;

    detections.slice(
      0,
      vision.face.maxFaces ?? 1
    ).forEach( ( det ) => {
      const box = det.boundingBox;

      if ( !box ) {
        return;
      }

      const cu = ( box.originX + box.width / 2 ) / capW;
      const cv = ( box.originY + box.height / 2 ) / capH;
      const centre = canvasToSheet(
        frame,
        ( flip ? 1 - cu : cu ) * frame.width,
        cv * frame.height
      );

      out.push( faceBoxEntity(
        centre.x,
        centre.z,
        box.width / capW * frame.width / frame.cellPx,
        box.height / capH * frame.height / frame.cellPx
      ) );
    } );
  }

  if ( vision.body?.enabled ) {
    const poses = getTaskResult(
      "poses",
      VISION_TTL_MS
    )?.landmarks ?? [];

    poses.slice(
      0,
      vision.body.maxPoses ?? 1
    ).forEach( (
      pose, index
    ) => {
      const entity = bodyEntity(
        convert(
          `pose:${ index }`,
          pose
        ),
        {
          thickness,
          minVisibility: vision.body.confidence ?? 0.3
        }
      );

      if ( entity ) {
        out.push( entity );
      }
    } );
  }
}

// The segmentation mask, processed once per new result (or per new knobs).
function currentMask( detect ) {
  const raw = getTaskResult(
    "segmenter",
    VISION_TTL_MS
  );

  if ( !raw?.data ) {
    state.mask = null;
    state.maskSource = null;

    return null;
  }

  const key = `${ Math.round( detect.maskDilate ?? 1 ) }|${ Math.round( detect.maskBlur ?? 2 ) }`;

  if ( raw !== state.maskSource || key !== state.maskKey ) {
    state.mask = processMask(
      raw,
      {
        dilate: detect.maskDilate ?? 1,
        blur: detect.maskBlur ?? 2
      }
    );
    state.maskSource = raw;
    state.maskKey = key;
  }

  return state.mask;
}

// ── The virtual hand ─────────────────────────────────────────────────────────
// Stateless on the loop clock: a closed path that starts and ends off the
// sheet, so a capture opens on a resting sheet, and an angle that turns whole
// times per loop.
function idleEntity(
  idle, loop, frame
) {
  const cycles = Math.max(
    1,
    Math.round( idle.cycles ?? 1 )
  );
  const spin = Math.round( idle.spin ?? 1 );
  const cx = ( frame.columns - 1 ) / 2;
  const cz = ( frame.rows - 1 ) * frame.rowScale / 2;
  const size = Math.max(
    idle.size ?? 3.5,
    0.2
  );
  // `manual` parks the hand at a loop position: what a headless check drives.
  const at = ( idle.headMode ?? "clock" ) === "manual"
    ? clamp(
      idle.head ?? 0.25,
      0,
      1
    )
    : loop;
  const a = at * Math.PI * 2 * cycles;
  let x;
  let z;

  switch ( idle.path ) {
    case "circle":
      x = cx + Math.cos( a ) * cx * 0.65;
      z = cz + Math.sin( a ) * cz * 0.65;
      break;
    case "sweep":
      x = cx + Math.cos( a ) * ( cx + size );
      z = cz;
      break;
    default:
      x = cx + Math.cos( a ) * ( cx + size );
      z = cz + Math.sin( 2 * a + 1.1 ) * cz * 0.6;
  }

  return cursorEntity(
    idle.shape ?? "hand",
    x,
    z,
    size,
    spin * at * Math.PI * 2 + Math.sin( a ) * 0.3
  );
}

sketch.setup( async() => {
  state.sheetKey = null;
  state.lastNow = null;
  state.smooth.clear();
  state.seen.clear();
  state.mask = null;
  state.maskSource = null;
  state.seenOnce = false;
  state.lastSeen = 0;
  state.idleGain = 1;

  await initInteraction( interactionFor( options.sketch ?? {} ) );
} );

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};
  const sheetCfg = o.sheet ?? {};
  const detect = o.detect ?? {};
  const lift = o.lift ?? {};
  const links = o.links ?? {};
  const material = o.material ?? {};
  const camera = o.camera ?? {};
  const cursor = o.cursor ?? {};
  const idle = o.idle ?? {};
  const colors = o.colors ?? {};
  const light = o.light ?? {};
  const rendering = o.rendering ?? {};
  const interaction = interactionFor( o );

  p.clear();
  p.background( ...( o.backgroundColor ?? [
    0,
    0,
    0
  ] ) );

  // ── The clock ──────────────────────────────────────────────────────────────
  const loop = ( ( animation.progression % 1 ) + 1 ) % 1;
  const now = animation.loopTime;
  let dt = state.lastNow === null ? 1 / 60 : now - state.lastNow;

  if ( dt < 0 ) {
    dt += DURATION_DEFAULT;
  }

  dt = clamp(
    dt,
    0,
    0.1
  );
  state.lastNow = now;

  // ── Sizes (world units = cells) ────────────────────────────────────────────
  const heightMax = Math.max(
    lift.height ?? 1,
    0
  );
  const thickness = Math.max(
    material.thickness ?? 0.05,
    0
  );
  const restMode = links.rest ?? "none";
  const tubeRest = restMode === "full" ? thickness : ( restMode === "thin" ? thickness * 0.35 : 0 );
  const tubeOn = thickness - tubeRest;
  const tubeLift = Math.max(
    material.thicknessLift ?? 0.1,
    0
  );
  const beadRest = Math.max(
    material.beads ?? 0.06,
    0
  );
  const beadLift = Math.max(
    material.beadsLift ?? 0.08,
    0
  );
  const fusion = Math.max(
    material.fusion ?? 0.05,
    0.001
  );
  const maxRadius = Math.max(
    tubeRest + tubeOn + tubeLift,
    beadRest + beadLift
  ) + fusion;
  const driftAmplitude = Math.max(
    sheetCfg.drift ?? 0,
    0
  );

  // ── The sheet ──────────────────────────────────────────────────────────────
  const layout = sheetCfg.layout === "hex" ? "hex" : "square";
  const frame = sheetFrame( {
    columns: sheetCfg.columns ?? 36,
    rowScale: rowScaleFor( layout ),
    width: p.width,
    height: p.height,
    margin: sheetCfg.margin ?? 0.06
  } );
  const sheet = getSheet( {
    columns: frame.columns,
    rows: frame.rows,
    layout,
    jitter: sheetCfg.jitter ?? 0.18,
    seed: Math.round( sheetCfg.seed ?? 7 ),
    maxRadius: maxRadius + driftAmplitude
  } );
  const n = sheet.columns * sheet.rows;

  if ( state.sheetKey !== sheet.key ) {
    state.sheetKey = sheet.key;
    state.heights = createHeightState( n );
    state.ranks = new Float32Array( n );
    state.spread = new Float32Array( n );
    state.packed = new Uint8Array( n * 4 );
    state.driftX = new Float32Array( n );
    state.driftZ = new Float32Array( n );
  }

  const hs = state.heights;

  if ( driftAmplitude > 0 ) {
    const driftCfg = {
      amplitude: Math.min(
        driftAmplitude,
        Math.max(
          sheet.budget.x,
          sheet.budget.z
        )
      ),
      cycles: sheetCfg.driftCycles ?? 1,
      scale: 0.25,
      seed: Math.round( sheetCfg.seed ?? 7 ) + 101
    };

    for ( let j = 0; j < sheet.rows; j++ ) {
      for ( let i = 0; i < sheet.columns; i++ ) {
        const k = j * sheet.columns + i;
        const d = sheetDriftAt(
          i,
          j,
          loop,
          driftCfg
        );

        state.driftX[ k ] = d[ 0 ];
        state.driftZ[ k ] = d[ 1 ];
      }
    }
  } else {
    state.driftX.fill( 0 );
    state.driftZ.fill( 0 );
  }

  // ── Camera ─────────────────────────────────────────────────────────────────
  const rig = cameraRig(
    camera,
    loop,
    frame,
    heightMax
  );

  // ── What is present: vision, the mask, the pointers, the virtual hand ──────
  state.seen.clear();

  const entities = [];
  const mode = detect.mode ?? "landmarks";
  const mask = mode === "mask" ? currentMask( detect ) : null;

  if ( mode !== "mask" ) {
    collectVisionEntities(
      interaction,
      detect,
      frame,
      entities
    );
  }

  // Landmarks not seen this frame are forgotten, so they never snap back.
  for ( const key of state.smooth.keys() ) {
    if ( !state.seen.has( key ) ) {
      state.smooth.delete( key );
    }
  }

  let maskEntity = null;

  if ( mask && mask.count > 0 ) {
    const flip = visionFlip( interaction.vision );
    const centre = canvasToSheet(
      frame,
      ( flip ? 1 - mask.cu : mask.cu ) * frame.width,
      mask.cv * frame.height
    );
    const radius = Math.max(
      mask.radius * frame.width / frame.cellPx,
      0.5
    );

    maskEntity = makeEntity(
      [
        disc(
          centre.x,
          centre.z,
          radius
        )
      ],
      "mask"
    );
  }

  const pointers = [];

  if ( cursor.enabled !== false ) {
    getPointerGroups( interaction ).forEach( ( group ) => {
      if ( group.source !== "mouse" && group.source !== "touch" ) {
        return;
      }

      group.points.forEach( ( pt ) => {
        const onSheet = unprojectToSheet(
          rig,
          frame,
          pt.x,
          pt.y
        );

        if ( onSheet ) {
          pointers.push( pt );
          entities.push( cursorEntity(
            cursor.shape ?? "hand",
            onSheet.x,
            onSheet.z,
            Math.max(
              cursor.size ?? 3,
              0.2
            ),
            0
          ) );
        }
      } );
    } );
  } else {
    // Keep the interaction layer ticking (vision init, source upkeep).
    getPointerGroups( interaction );
  }

  const seenNow = entities.length > 0 || maskEntity !== null;

  if ( seenNow ) {
    state.seenOnce = true;
    state.lastSeen = now;
  }

  let since = Infinity;

  if ( state.seenOnce ) {
    since = now - state.lastSeen;

    if ( since < 0 ) {
      since += DURATION_DEFAULT;
    }
  }

  const idleWanted = idle.enabled !== false && since >= ( idle.after ?? 2 );

  state.idleGain += ( ( idleWanted ? 1 : 0 ) - state.idleGain ) * rateFor(
    dt,
    idle.fade ?? 1
  );

  if ( state.idleGain < 0.002 ) {
    state.idleGain = 0;
  }

  entities.forEach( ( entity ) => {
    entity.gain = 1;
  } );

  if ( state.idleGain > 0 ) {
    const virtual = idleEntity(
      idle,
      loop,
      frame
    );

    virtual.gain = state.idleGain;
    entities.push( virtual );
  }

  // ── Presence per node ──────────────────────────────────────────────────────
  const shape = {
    feather: Math.max(
      detect.feather ?? 0.8,
      0
    ),
    profile: lift.profile ?? "plateau",
    dome: lift.dome ?? 1.5,
    rim: lift.rim ?? 0.6
  };
  const pad = shape.feather;
  const threshold = clamp(
    lift.threshold ?? 0.08,
    0,
    1
  );
  const order = lift.order ?? "radial";
  const seed = Math.round( sheetCfg.seed ?? 7 );
  const flipMask = mask ? visionFlip( interaction.vision ) : false;

  for ( let k = 0; k < n; k++ ) {
    const x = sheet.px[ k ] + state.driftX[ k ];
    const z = sheet.pz[ k ] + state.driftZ[ k ];
    let best = 0;
    let bestEntity = null;

    for ( let e = 0; e < entities.length; e++ ) {
      const entity = entities[ e ];
      const d = entityDistance(
        entity,
        x,
        z,
        pad
      );

      if ( d === Infinity ) {
        continue;
      }

      const v = shapePresence(
        d,
        shape
      ) * entity.gain;

      if ( v > best ) {
        best = v;
        bestEntity = entity;
      }
    }

    if ( mask ) {
      const px = sheetToCanvas(
        frame,
        x,
        z
      );
      const u = px.x / frame.width;
      const v = maskPresenceAt(
        mask,
        flipMask ? 1 - u : u,
        px.y / frame.height
      );

      if ( v > best ) {
        best = v;
        bestEntity = maskEntity;
      }
    }

    hs.presence[ k ] = best >= threshold ? best : 0;
    state.ranks[ k ] = bestEntity
      ? liftRank(
        order,
        x,
        z,
        bestEntity,
        seed
      )
      : 0;
  }

  // ── Targets → heights ──────────────────────────────────────────────────────
  computeTargets(
    hs,
    state.ranks,
    dt,
    Math.max(
      lift.stagger ?? 0.3,
      0
    )
  );
  spreadTargets(
    sheet,
    hs.targets,
    state.spread,
    lift.spread ?? 1,
    lift.spreadGain ?? 0.35
  );

  const curve = typeof easing[ lift.curve ] === "function" ? easing[ lift.curve ] : null;

  for ( let k = 0; k < n; k++ ) {
    const t = clamp(
      state.spread[ k ],
      0,
      1
    );

    hs.targets[ k ] = curve ? curve( t ) : t;
  }

  integrateHeights(
    hs,
    dt,
    {
      rise: lift.rise ?? 0.25,
      fall: lift.fall ?? 1.2,
      hold: lift.hold ?? 0.4
    }
  );

  packSheet(
    sheet,
    hs.heights,
    state.packed,
    state.driftX,
    state.driftZ
  );

  // ── Palette / lighting / render ────────────────────────────────────────────
  const hueSpread = colors.hueSpread ?? 2;
  const hueCycles = Math.round( ( colors.hueSpeed ?? 0.5 ) * p.TAU * hueSpread );
  const lightDir = lightDirFrom(
    ( light.azimuth ?? -1.1 ) + ( light.follow !== false ? rig.yaw : 0 ),
    light.elevation ?? 0.45
  );
  const linkMode = layout === "hex" ? 2 : ( links.diagonals !== false ? 1 : 0 );
  const aberration = o.aberration ?? {};

  reliefRenderer.render( {
    columns: 1,
    rows: 1,
    resolutionScale: rendering.resolutionScale ?? 0.6,
    textures: {
      uSheet: {
        data: state.packed,
        width: sheet.columns,
        height: sheet.rows
      }
    },
    uniforms: {
      uT: loop * p.TAU,
      uGrid: [
        sheet.columns,
        sheet.rows
      ],
      uRowScale: sheet.rowScale,
      uHeightMax: heightMax,
      uBeadRest: beadRest,
      uBeadLift: beadLift,
      uTubeRest: tubeRest,
      uTubeOn: tubeOn,
      uTubeLift: tubeLift,
      uLinkThreshold: clamp(
        links.threshold ?? 0.15,
        0,
        1
      ),
      uLinkFade: Math.max(
        links.fade ?? 0.3,
        0.001
      ),
      uLinkAny: ( links.require ?? "both" ) === "any" ? 1 : 0,
      uLinkMode: {
        int: linkMode
      },
      uSmoothK: fusion,
      uTaper: clamp(
        material.taper ?? 0,
        0,
        1
      ),
      uBoundR: maxRadius + driftAmplitude + 0.05,
      uRo: rig.ro,
      uFwd: rig.fwd,
      uRight: rig.right,
      uUp: rig.up,
      uViewH: rig.viewH,
      uOrtho: rig.ortho ? 1 : 0,
      uFocal: rig.focal,
      uCamDist: rig.dist,
      uYaw: rig.yaw,
      uPitch: rig.tilt,
      uRoll: 0,
      uHueSpeed: hueSpread ? hueCycles / ( p.TAU * hueSpread ) : 0,
      uHueSpread: hueSpread,
      uHuePhase: colors.huePhase ?? 2.6,
      uLengthHueShift: colors.lengthHueShift ?? -0.6,
      uPipeHueShift: colors.pipeHueShift ?? 0.3,
      uShimmer: colors.shimmer ?? 2.2,
      uSaturation: colors.saturation ?? 0.8,
      uBrightness: colors.brightness ?? 1.25,
      uLightDir: lightDir,
      uAmbient: light.ambient ?? 0.3,
      uDiffuse: light.diffuse ?? 0.75,
      uSpecular: light.specular ?? 1.1,
      uSpecPower: light.specPower ?? 42,
      uFresnelPower: light.fresnelPower ?? 2.2,
      uRimStrength: light.rimStrength ?? 0.6,
      uShadowSoft: light.shadowSoftness ?? 0,
      uFogDensity: camera.fog ?? 0,
      uFogStart: rig.dist - rig.extent,
      uMaxDist: rig.dist * 2 + rig.extent + heightMax + 2,
      uAberration: aberration.amount ?? 0,
      uAberrationMode: {
        int: ( aberration.mode ?? "radial" ) === "horizontal" ? 1 : 0
      }
    }
  } );

  // ── Pointer markers, then the optional vision preview ──────────────────────
  if ( cursor.showMarkers && pointers.length ) {
    p.push();
    p.noFill();
    p.stroke(
      255,
      255,
      255,
      200
    );
    p.strokeWeight( 2 );

    pointers.forEach( ( pt ) => {
      p.circle(
        pt.x,
        pt.y,
        18
      );
    } );

    p.pop();
  }

  drawInteractionCameraPreview( interaction );
} );

import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import * as common from "@/p5/utils/common.js";
import mediapipe, {
  init as mediapipeInit,
  dispose as mediapipeDispose,
  setEnabled as setMediapipeEnabled
} from "@/p5/utils/mediapipe/mediapipe.js";
import animation from "@/p5/utils/animation.js";
import createRevealRenderer from "./revealGpu.js";

// video-reveal — see options.ts for the concept. The webcam hides under a grid
// of "hidden"-colour cells; hands (via MediaPipe) wipe cells open to expose the
// video, which fades back to the hidden colour when the hand leaves. The blob of
// currently-open cells is outlined in white on its outer edge only.
//
// Hot path is on the GPU: a single full-screen shader (revealGpu.js) does the
// per-pixel composite + cut-out outline + camera cover-fit/flip/grayscale. The
// CPU only marks which cells a finger touches and eases each cell's fade value,
// then hands the grid to the shader as a small texture.

// Fingertip landmark indices (thumb, index, middle, ring, pinky tips).
const FINGERTIP_INDICES = [
  4,
  8,
  12,
  16,
  20
];

const reveal = createRevealRenderer();

// Per-cell reveal state, row-major (index = row * columns + column).
let revealValues = new Float32Array( 0 );
let revealBytes = new Uint8Array( 0 ); // = revealValues × 255, uploaded to the GPU
let touched = new Uint8Array( 0 );
let gridColumns = 0;
let gridRows = 0;

// Camera (re)init bookkeeping — mirrors the video-atlas single-camera flow.
let cameraSignature = "";
let initializing = false;

function clamp(
  value, min, max
) {
  return Math.max(
    min,
    Math.min(
      max,
      value
    )
  );
}

function cameraConfig( cfg ) {
  const camera = cfg.camera ?? {};

  return {
    deviceId: camera.deviceId || "",
    width: Math.max(
      1,
      Math.round( camera.width ?? 1280 )
    ),
    height: Math.max(
      1,
      Math.round( camera.height ?? 720 )
    )
  };
}

// Open (or reopen) the webcam + hand tracker when the picked device / resolution
// changes. captureFlip stays false — the frame is mirrored on the GPU and the
// landmarks via common.inverseX, so pixels and hands come from the same source.
async function ensureCamera( cfg ) {
  const camera = cameraConfig( cfg );
  const signature = `${ camera.deviceId }|${ camera.width }|${ camera.height }`;

  if ( initializing || signature === cameraSignature ) {
    return;
  }

  initializing = true;
  cameraSignature = signature;

  try {
    mediapipeDispose();
    await mediapipeInit( {
      worker: false,
      enableCapture: true,
      captureFlip: false,
      captureSize: {
        width: camera.width,
        height: camera.height
      },
      source: {
        type: "webcam",
        deviceId: camera.deviceId
      },
      tasks: [
        "hands"
      ]
    } );
  } catch( error ) {
    // Let a later frame retry if init failed (permission prompt, device busy…).
    cameraSignature = "";
    console.warn(
      "[video-reveal] camera init failed:",
      error
    );
  } finally {
    initializing = false;
  }
}

// (Re)allocate the per-cell state arrays when the grid size changed.
function ensureGrid(
  columns, rows
) {
  if ( columns === gridColumns && rows === gridRows ) {
    return;
  }

  gridColumns = columns;
  gridRows = rows;

  const count = columns * rows;

  revealValues = new Float32Array( count );
  revealBytes = new Uint8Array( count );
  touched = new Uint8Array( count );
}

// Stamp a soft disc of cells (Euclidean radius, in cells) around a canvas point.
function stampPoint(
  px, py, cellWidth, cellHeight, radius
) {
  const centerColumn = px / cellWidth;
  const centerRow = py / cellHeight;
  const reach = Math.ceil( radius );

  const columnStart = Math.max(
    0,
    Math.floor( centerColumn - reach )
  );
  const columnEnd = Math.min(
    gridColumns - 1,
    Math.floor( centerColumn + reach )
  );
  const rowStart = Math.max(
    0,
    Math.floor( centerRow - reach )
  );
  const rowEnd = Math.min(
    gridRows - 1,
    Math.floor( centerRow + reach )
  );

  // radius 0 → just the cell under the point; otherwise a filled disc.
  if ( radius <= 0 ) {
    const column = Math.floor( centerColumn );
    const row = Math.floor( centerRow );

    if (
      column >= 0 && column < gridColumns &&
      row >= 0 && row < gridRows
    ) {
      touched[ row * gridColumns + column ] = 1;
    }

    return;
  }

  const radiusSquared = ( radius + 0.001 ) * ( radius + 0.001 );

  for ( let row = rowStart; row <= rowEnd; row++ ) {
    for ( let column = columnStart; column <= columnEnd; column++ ) {
      const dColumn = column + 0.5 - centerColumn;
      const dRow = row + 0.5 - centerRow;

      if ( dColumn * dColumn + dRow * dRow <= radiusSquared ) {
        touched[ row * gridColumns + column ] = 1;
      }
    }
  }
}

// Stamp the straight segment between two canvas points so a fast swipe paints a
// continuous trail rather than dotted stamps.
function stampSegment(
  ax, ay, bx, by, cellWidth, cellHeight, radius
) {
  const distance = Math.hypot(
    bx - ax,
    by - ay
  );
  const steps = Math.max(
    1,
    Math.ceil( distance / ( Math.min(
      cellWidth,
      cellHeight
    ) * 0.5 ) )
  );

  for ( let step = 0; step <= steps; step++ ) {
    const t = step / steps;

    stampPoint(
      ax + ( bx - ax ) * t,
      ay + ( by - ay ) * t,
      cellWidth,
      cellHeight,
      radius
    );
  }
}

// Paint the cells covered by the detected hands into `touched`.
function stampHands(
  cfg, cellWidth, cellHeight
) {
  const p = getP5();
  const hands = mediapipe.tasks?.hands?.result?.landmarks;

  if ( !hands?.length ) {
    return;
  }

  const revealCfg = cfg.reveal ?? {};
  const fingertipsOnly = Boolean( revealCfg.fingertipsOnly ?? false );
  const maxHands = Math.round( clamp(
    revealCfg.maxHands ?? 2,
    1,
    2
  ) );
  const radius = Math.max(
    0,
    revealCfg.brushRadius ?? 1.2
  );

  for (
    let handIndex = 0;
    handIndex < Math.min(
      hands.length,
      maxHands
    );
    handIndex++
  ) {
    const hand = hands[ handIndex ];

    // Map a landmark (normalised, unflipped) to a mirrored canvas point.
    const toCanvas = ( landmark ) => ( {
      x: common.inverseX( landmark.x ) * p.width,
      y: landmark.y * p.height
    } );

    if ( fingertipsOnly ) {
      for ( const index of FINGERTIP_INDICES ) {
        const landmark = hand[ index ];

        if ( landmark ) {
          const point = toCanvas( landmark );

          stampPoint(
            point.x,
            point.y,
            cellWidth,
            cellHeight,
            radius
          );
        }
      }

      continue;
    }

    // Whole hand: stamp every joint and connect consecutive landmarks so the
    // palm and fingers fill in rather than leaving gaps between joints.
    let previous = null;

    for ( let index = 0; index < hand.length; index++ ) {
      const landmark = hand[ index ];

      if ( !landmark ) {
        continue;
      }

      const point = toCanvas( landmark );

      if ( previous ) {
        stampSegment(
          previous.x,
          previous.y,
          point.x,
          point.y,
          cellWidth,
          cellHeight,
          radius
        );
      } else {
        stampPoint(
          point.x,
          point.y,
          cellWidth,
          cellHeight,
          radius
        );
      }

      previous = point;
    }
  }
}

// Animate virtual pointer(s) along a Lissajous path so the reveal is alive
// without a camera (and previews / thumbnails are not just black).
function stampDemo(
  cfg, cellWidth, cellHeight
) {
  const p = getP5();
  const demo = cfg.demo ?? {};

  if ( !( demo.enabled ?? false ) ) {
    return;
  }

  const pointers = Math.round( clamp(
    demo.pointers ?? 2,
    1,
    5
  ) );
  const speed = demo.speed ?? 1;
  const radius = Math.max(
    0.6,
    cfg.reveal?.brushRadius ?? 1.2
  );

  // Loop-exact clock: animation.angle sweeps exactly TAU per loop, so the two
  // Lissajous rates (x and y × 1.3) are snapped to whole wave cycles per loop —
  // otherwise the demo pointer path didn't land back on its start position.
  const t = animation.angle;
  const xCycles = Math.round( speed );
  const yCycles = Math.round( speed * 1.3 );
  const marginX = p.width * 0.12;
  const marginY = p.height * 0.12;

  for ( let pointer = 0; pointer < pointers; pointer++ ) {
    const phase = ( pointer / pointers ) * Math.PI * 2;
    const x = p.map(
      Math.sin( t * xCycles + phase ),
      -1,
      1,
      marginX,
      p.width - marginX
    );
    const y = p.map(
      Math.cos( t * yCycles + phase * 1.7 ),
      -1,
      1,
      marginY,
      p.height - marginY
    );

    stampPoint(
      x,
      y,
      cellWidth,
      cellHeight,
      radius
    );
  }
}

sketch.setup( async() => {
  const p = getP5();

  p.clear();

  // Force a fresh camera / hand tracker for this mount.
  cameraSignature = "";
  await ensureCamera( options.sketch ?? {} );
} );

sketch.draw( () => {
  const p = getP5();
  const cfg = options.sketch ?? {};

  // Reconcile the camera with the picker (no-op unless the device changed).
  ensureCamera( cfg );

  const useHands = Boolean( cfg.reveal?.useHands ?? true );

  // Pause inference when hands aren't driving the reveal.
  setMediapipeEnabled( useHands );

  const columns = Math.round( clamp(
    cfg.grid?.columns ?? 32,
    1,
    64
  ) );
  const rows = Math.round( clamp(
    cfg.grid?.rows ?? 18,
    1,
    64
  ) );

  ensureGrid(
    columns,
    rows
  );

  const cellWidth = p.width / columns;
  const cellHeight = p.height / rows;

  // ── 1. Which cells are under a finger / demo pointer this frame ─────────────
  touched.fill( 0 );

  if ( useHands ) {
    stampHands(
      cfg,
      cellWidth,
      cellHeight
    );
  }

  stampDemo(
    cfg,
    cellWidth,
    cellHeight
  );

  // ── 2. Ease each cell toward its target (attack on reveal, slow release) and
  //       pack the 0..1 value into the byte grid the shader samples ────────────
  const revealSpeed = clamp(
    cfg.reveal?.revealSpeed ?? 0.4,
    0.02,
    1
  );
  const fadeSpeed = clamp(
    cfg.reveal?.fadeSpeed ?? 0.08,
    0.01,
    1
  );

  for ( let index = 0; index < revealValues.length; index++ ) {
    const target = touched[ index ] ? 1 : 0;
    const speed = target > revealValues[ index ] ? revealSpeed : fadeSpeed;
    const value = revealValues[ index ] + ( target - revealValues[ index ] ) * speed;

    revealValues[ index ] = value;
    revealBytes[ index ] = value <= 0
      ? 0
      : value >= 1
        ? 255
        : ( value * 255 ) | 0;
  }

  // ── 3. GPU composite: hidden bg, revealed video, cut-out outline ────────────
  const captureElement = mediapipe.capture?.element;
  const video = captureElement?.elt ?? null;
  const videoReady = Boolean( video?.videoWidth && video?.videoHeight && video.readyState >= 2 );

  p.clear();

  reveal.render( {
    columns,
    rows,
    revealData: revealBytes,
    video: videoReady ? video : null,
    videoWidth: video?.videoWidth ?? 1,
    videoHeight: video?.videoHeight ?? 1,
    flip: Boolean( cfg.camera?.flip ?? true ),
    hiddenColor: cfg.look?.hiddenColor ?? [
      0,
      0,
      0,
      255
    ],
    grayscale: Boolean( cfg.look?.grayscale ?? false ),
    cellGap: cfg.look?.cellGap ?? 0,
    outline: {
      show: cfg.outline?.show ?? true,
      weight: cfg.outline?.weight ?? 2,
      color: cfg.outline?.color ?? [
        255,
        255,
        255,
        255
      ],
      threshold: clamp(
        cfg.outline?.threshold ?? 0.18,
        0.01,
        0.95
      ),
      softEdge: cfg.outline?.softEdge ?? true
    }
  } );
} );

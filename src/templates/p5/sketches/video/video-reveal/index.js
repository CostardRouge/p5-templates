import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import graphics from "@/p5/utils/graphics.js";
import * as common from "@/p5/utils/common.js";
import mediapipe, {
  init as mediapipeInit,
  dispose as mediapipeDispose,
  setEnabled as setMediapipeEnabled
} from "@/p5/utils/mediapipe/mediapipe.js";

// video-reveal — see options.ts for the concept. The webcam is hidden under a
// grid of "hidden"-colour cells; hands (via MediaPipe) wipe cells open to expose
// the video, which fades back to the hidden colour when the hand leaves. The
// blob of currently-open cells is outlined in white on its outer edge only.

// Fingertip landmark indices (thumb, index, middle, ring, pinky tips).
const FINGERTIP_INDICES = [
  4,
  8,
  12,
  16,
  20
];

// Cover-fit frame buffer (flipped, canvas-sized) we sample each revealed cell
// from, so the cell→source mapping is a 1:1 identity crop.
let frame;

// Per-cell reveal state, laid out row-major (index = row * columns + column).
let revealValues = new Float32Array( 0 );
let revealActive = new Uint8Array( 0 );
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

// Cover-fit a (sw × sh) source into a (dw × dh) box, centered.
function coverRect(
  sw, sh, dw, dh
) {
  const scale = Math.max(
    dw / sw,
    dh / sh
  );
  const w = sw * scale;
  const h = sh * scale;

  return {
    x: ( dw - w ) / 2,
    y: ( dh - h ) / 2,
    w,
    h
  };
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
// changes. captureFlip stays false — we mirror at draw time so the revealed
// pixels and the hand landmarks come from the same unflipped source.
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
  revealActive = new Uint8Array( count );
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
  const radiusSquared = ( radius + 0.001 ) * ( radius + 0.001 );

  for ( let row = rowStart; row <= rowEnd; row++ ) {
    for ( let column = columnStart; column <= columnEnd; column++ ) {
      const cellCenterColumn = column + 0.5;
      const cellCenterRow = row + 0.5;
      const dColumn = cellCenterColumn - centerColumn;
      const dRow = cellCenterRow - centerRow;

      if ( radius <= 0 ) {
        if (
          Math.floor( centerColumn ) === column &&
          Math.floor( centerRow ) === row
        ) {
          touched[ row * gridColumns + column ] = 1;
        }

        continue;
      }

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

  const reveal = cfg.reveal ?? {};
  const fingertipsOnly = Boolean( reveal.fingertipsOnly ?? false );
  const maxHands = Math.round( clamp(
    reveal.maxHands ?? 2,
    1,
    2
  ) );
  const radius = Math.max(
    0,
    reveal.brushRadius ?? 1.2
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
  const time = p.frameCount * 0.02 * speed;
  const marginX = p.width * 0.12;
  const marginY = p.height * 0.12;

  for ( let pointer = 0; pointer < pointers; pointer++ ) {
    const phase = ( pointer / pointers ) * Math.PI * 2;
    const x = p.map(
      Math.sin( time + phase ),
      -1,
      1,
      marginX,
      p.width - marginX
    );
    const y = p.map(
      Math.cos( time * 1.3 + phase * 1.7 ),
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

// Blit the (optionally mirrored, optionally desaturated) cover-fit webcam frame
// into the sampling buffer. Returns whether a decodable frame was available.
function updateFrame( cfg ) {
  const p = getP5();
  const captureElement = mediapipe.capture?.element;
  const video = captureElement?.elt;

  if ( !video?.videoWidth || !video?.videoHeight ) {
    return false;
  }

  const flip = Boolean( cfg.camera?.flip ?? true );
  const cover = coverRect(
    video.videoWidth,
    video.videoHeight,
    frame.width,
    frame.height
  );

  frame.clear();
  frame.push();
  frame.imageMode( p.CORNER );

  if ( flip ) {
    frame.translate(
      frame.width,
      0
    );
    frame.scale(
      -1,
      1
    );
  }

  frame.image(
    captureElement,
    cover.x,
    cover.y,
    cover.w,
    cover.h
  );
  frame.pop();

  if ( cfg.look?.grayscale ) {
    frame.filter( p.GRAY );
  }

  return true;
}

// Draw the revealed video (per cell, opacity = fade value) over the hidden bg.
function drawReveal(
  cfg, cellWidth, cellHeight, hasFrame
) {
  const p = getP5();
  const gap = clamp(
    cfg.look?.cellGap ?? 0,
    0,
    0.9
  );
  const insetX = cellWidth * gap * 0.5;
  const insetY = cellHeight * gap * 0.5;
  const innerWidth = cellWidth - insetX * 2;
  const innerHeight = cellHeight - insetY * 2;

  if ( !hasFrame || innerWidth <= 0 || innerHeight <= 0 ) {
    return;
  }

  p.push();
  p.imageMode( p.CORNER );
  p.noStroke();

  for ( let row = 0; row < gridRows; row++ ) {
    for ( let column = 0; column < gridColumns; column++ ) {
      const value = revealValues[ row * gridColumns + column ];

      if ( value <= 0.01 ) {
        continue;
      }

      const x = column * cellWidth;
      const y = row * cellHeight;

      p.tint(
        255,
        value * 255
      );
      p.image(
        frame,
        x + insetX,
        y + insetY,
        innerWidth,
        innerHeight,
        x + insetX,
        y + insetY,
        innerWidth,
        innerHeight
      );
    }
  }

  p.pop();
  p.noTint();
}

// Outline the OUTER boundary of the revealed blob: for each active cell, draw
// only the edges whose neighbour is inactive (or off-grid). Shared internal
// edges are never drawn, so the cluster reads as one clean cut-out.
function drawOutline(
  cfg, cellWidth, cellHeight
) {
  const p = getP5();
  const outline = cfg.outline ?? {};

  if ( !( outline.show ?? true ) ) {
    return;
  }

  const color = outline.color ?? [
    255,
    255,
    255,
    255
  ];
  const softEdge = Boolean( outline.softEdge ?? true );
  const baseAlpha = color[ 3 ] ?? 255;

  p.push();
  p.strokeWeight( outline.weight ?? 2 );
  p.strokeCap( p.SQUARE );
  p.noFill();

  if ( !softEdge ) {
    p.stroke(
      color[ 0 ],
      color[ 1 ],
      color[ 2 ],
      baseAlpha
    );
  }

  for ( let row = 0; row < gridRows; row++ ) {
    for ( let column = 0; column < gridColumns; column++ ) {
      const index = row * gridColumns + column;

      if ( !revealActive[ index ] ) {
        continue;
      }

      if ( softEdge ) {
        p.stroke(
          color[ 0 ],
          color[ 1 ],
          color[ 2 ],
          baseAlpha * revealValues[ index ]
        );
      }

      const x = column * cellWidth;
      const y = row * cellHeight;
      const right = x + cellWidth;
      const bottom = y + cellHeight;

      // top
      if ( row === 0 || !revealActive[ index - gridColumns ] ) {
        p.line(
          x,
          y,
          right,
          y
        );
      }

      // bottom
      if ( row === gridRows - 1 || !revealActive[ index + gridColumns ] ) {
        p.line(
          x,
          bottom,
          right,
          bottom
        );
      }

      // left
      if ( column === 0 || !revealActive[ index - 1 ] ) {
        p.line(
          x,
          y,
          x,
          bottom
        );
      }

      // right
      if ( column === gridColumns - 1 || !revealActive[ index + 1 ] ) {
        p.line(
          right,
          y,
          right,
          bottom
        );
      }
    }
  }

  p.pop();
}

sketch.setup( async() => {
  const p = getP5();

  p.clear();

  frame = graphics.createAutoResizableGraphics(
    p.width,
    p.height
  );

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

  // Pause inference (and the camera light's work) when hands aren't driving it.
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

  // ── 2. Integrate each cell toward its target (attack on reveal, slow release)
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
  const threshold = clamp(
    cfg.outline?.threshold ?? 0.18,
    0.01,
    0.95
  );

  for ( let index = 0; index < revealValues.length; index++ ) {
    const target = touched[ index ] ? 1 : 0;
    const speed = target > revealValues[ index ] ? revealSpeed : fadeSpeed;

    revealValues[ index ] += ( target - revealValues[ index ] ) * speed;
    revealActive[ index ] = revealValues[ index ] > threshold ? 1 : 0;
  }

  // ── 3. Render: hidden background, revealed video, cut-out outline ───────────
  const hasFrame = updateFrame( cfg );

  p.clear();
  p.background( ...( cfg.look?.hiddenColor ?? [
    0,
    0,
    0,
    255
  ] ) );

  drawReveal(
    cfg,
    cellWidth,
    cellHeight,
    hasFrame
  );

  drawOutline(
    cfg,
    cellWidth,
    cellHeight
  );
} );

import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import graphics from "@/p5/utils/graphics.js";
import mediapipe, {
  init as mediapipeInit,
  dispose as mediapipeDispose
} from "@/p5/utils/mediapipe/mediapipe.js";
import {
  drawSegmentationMask
} from "@/p5/utils/segmentation.js";

// video-atlas — the "Bicep / Atlas" look from a plain webcam. MediaPipe
// (DeepLabV3) mattes you out of the background every frame; the cutout is
// pushed onto a ring of recent frames, and those frames are redrawn as a stack
// of progressively offset, depth-tinted echo layers — warm/real up front,
// shifting through magenta into blue as they recede — over a flat saturated
// background. Still parts of you pile into smooth skin; movement fans the
// layers apart into the rippling, finned ribbons.

// WEBGL buffer the echo stack is drawn into (cheap per-layer tint), then
// composited onto the 2D canvas.
let stack;

// 2D buffer holding the current segmentation silhouette (opaque person /
// transparent background).
let maskGraphics;

// Ring of recent cutout frames (2D buffers) — the time axis of the echo.
let ring = [];
let ringWidth = 0;
let ringHeight = 0;
let writeIndex = -1;

// Camera (re)init bookkeeping.
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

// Three-stop colour ramp (front → mid → back) sampled at t ∈ [0, 1].
function rampColor(
  p, front, mid, back, t
) {
  if ( t <= 0.5 ) {
    const u = t * 2;

    return [
      p.lerp(
        front[ 0 ],
        mid[ 0 ],
        u
      ),
      p.lerp(
        front[ 1 ],
        mid[ 1 ],
        u
      ),
      p.lerp(
        front[ 2 ],
        mid[ 2 ],
        u
      )
    ];
  }

  const u = ( t - 0.5 ) * 2;

  return [
    p.lerp(
      mid[ 0 ],
      back[ 0 ],
      u
    ),
    p.lerp(
      mid[ 1 ],
      back[ 1 ],
      u
    ),
    p.lerp(
      mid[ 2 ],
      back[ 2 ],
      u
    )
  ];
}

function disposeRing() {
  for ( const buffer of ring ) {
    try {
      buffer?.remove?.();
    } catch {}
  }

  ring = [];
  ringWidth = 0;
  ringHeight = 0;
  writeIndex = -1;
}

// (Re)allocate the ring when the layer count or canvas size changed.
function ensureRing(
  p, layers
) {
  const cap = 420;
  const scale = Math.min(
    1,
    cap / Math.max(
      p.width,
      p.height
    )
  );
  const w = Math.max(
    1,
    Math.round( p.width * scale )
  );
  const h = Math.max(
    1,
    Math.round( p.height * scale )
  );

  if ( ring.length === layers && ringWidth === w && ringHeight === h ) {
    return;
  }

  disposeRing();

  ring = Array.from(
    {
      length: layers
    },
    () => {
      const buffer = p.createGraphics(
        w,
        h
      );

      buffer.pixelDensity( 1 );

      return buffer;
    }
  );
  ringWidth = w;
  ringHeight = h;
  writeIndex = -1;
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

// Open (or reopen) the webcam + segmenter when the picked device / resolution
// changes. captureFlip stays false — we mirror ourselves so the silhouette and
// the pixels always come from the same (unflipped) source and stay aligned.
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
        "segmenter"
      ]
    } );
  } catch( error ) {
    // Let a later frame retry if init failed (permission prompt, device busy…).
    cameraSignature = "";
    console.warn(
      "[video-atlas] camera init failed:",
      error
    );
  } finally {
    initializing = false;
  }
}

// Composite the current webcam frame, masked by the silhouette, into the next
// ring slot.
function writeCutout(
  cfg, captureElement
) {
  writeIndex = ( writeIndex + 1 ) % ring.length;

  const buffer = ring[ writeIndex ];
  const flip = Boolean( cfg.camera?.flip ?? true );
  const video = captureElement.elt;
  const cover = coverRect(
    video.videoWidth,
    video.videoHeight,
    ringWidth,
    ringHeight
  );
  // Composite straight on the 2D context so the masking is independent of p5's
  // own blend/tint state.
  const ctx = buffer.drawingContext;

  buffer.clear();
  ctx.save();

  if ( flip ) {
    ctx.translate(
      ringWidth,
      0
    );
    ctx.scale(
      -1,
      1
    );
  }

  // 1. lay down the silhouette (opaque where the person is),
  ctx.globalCompositeOperation = "source-over";
  ctx.drawImage(
    maskGraphics.canvas,
    cover.x,
    cover.y,
    cover.w,
    cover.h
  );
  // 2. keep the live pixels only inside it.
  ctx.globalCompositeOperation = "source-in";
  ctx.drawImage(
    video,
    cover.x,
    cover.y,
    cover.w,
    cover.h
  );

  ctx.globalCompositeOperation = "source-over";
  ctx.restore();
}

// Draw the ring as a stack of offset, depth-tinted echo layers: oldest +
// most-offset + bluest at the back, newest + real-coloured on top.
function drawStack(
  p, cfg
) {
  stack.clear();

  const layers = ring.length;

  if ( !layers || writeIndex < 0 ) {
    return;
  }

  const offset = cfg.offset ?? {
    x: 6,
    y: -8
  };
  const scaleStep = cfg.scaleStep ?? 0.006;
  const rotateStep = cfg.rotateStep ?? 0.4;
  const front = cfg.frontColor ?? [
    255,
    240,
    230
  ];
  const mid = cfg.midColor ?? [
    255,
    90,
    170
  ];
  const back = cfg.backColor ?? [
    70,
    110,
    255
  ];
  const width = stack.width;
  const height = stack.height;

  stack.push();
  stack.imageMode( p.CORNER );
  stack.noStroke();

  for ( let rank = layers - 1; rank >= 0; rank-- ) {
    const slot = ( ( writeIndex - rank ) % layers + layers ) % layers;
    const buffer = ring[ slot ];
    const t = layers > 1 ? rank / ( layers - 1 ) : 0;
    const [
      red,
      green,
      blue
    ] = rampColor(
      p,
      front,
      mid,
      back,
      t
    );
    const drawScale = 1 + rank * scaleStep;
    const drawWidth = width * drawScale;
    const drawHeight = height * drawScale;

    stack.push();
    stack.translate(
      offset.x * rank,
      offset.y * rank
    );
    stack.rotate( p.radians( rotateStep * rank ) );
    stack.tint(
      red,
      green,
      blue,
      255
    );
    stack.image(
      buffer,
      -drawWidth / 2,
      -drawHeight / 2,
      drawWidth,
      drawHeight
    );
    stack.pop();
  }

  stack.pop();
}

sketch.setup( async() => {
  const p = getP5();

  p.clear();

  stack = graphics.createAutoResizableGraphics(
    p.width,
    p.height,
    "webgl"
  );

  maskGraphics = p.createGraphics(
    1,
    1
  );
  maskGraphics.pixelDensity( 1 );

  disposeRing();

  // Force a fresh camera/segmenter for this mount.
  cameraSignature = "";
  await ensureCamera( options.sketch ?? {} );
} );

sketch.draw( () => {
  const p = getP5();
  const cfg = options.sketch ?? {};

  // Reconcile the camera with the picker (no-op unless the device changed).
  ensureCamera( cfg );

  p.clear();
  p.background( ...( cfg.backgroundColor ?? [
    240,
    52,
    40
  ] ) );

  const layers = Math.round( clamp(
    cfg.layers ?? 24,
    2,
    36
  ) );

  ensureRing(
    p,
    layers
  );

  const segmentation = mediapipe.tasks?.segmenter?.result;
  const captureElement = mediapipe.capture?.element;
  const captureReady = Boolean( captureElement?.elt?.videoWidth && captureElement.elt.videoHeight );

  if ( captureReady && segmentation?.data ) {
    if (
      maskGraphics.width !== segmentation.width ||
      maskGraphics.height !== segmentation.height
    ) {
      maskGraphics.resizeCanvas(
        segmentation.width,
        segmentation.height
      );
      maskGraphics.pixelDensity( 1 );
    }

    drawSegmentationMask(
      maskGraphics,
      segmentation.data,
      [
        0,
        0,
        0,
        255
      ],
      false
    );

    writeCutout(
      cfg,
      captureElement
    );
  }

  drawStack(
    p,
    cfg
  );

  p.image(
    stack,
    0,
    0,
    p.width,
    p.height
  );
} );

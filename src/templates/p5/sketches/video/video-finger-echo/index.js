import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import {
  initInteraction,
  getPointerGroups
} from "@/p5/utils/interaction/index.js";
import {
  drawInteractionOverlay
} from "@/p5/utils/interaction/overlay.js";
import mediapipe from "@/p5/utils/mediapipe/mediapipe.js";

// ── video-finger-echo ──────────────────────────────────────────────────────
// A POV-camera sketch built for the "first-person hands" footage you get from
// smart glasses (Meta Ray-Ban) or any webcam: the full source video plays, and
// the hands MediaPipe detects in it leave a fading, drifting ECHO of their own
// pixels — a trail cut straight out of the footage that follows the movement
// and melts away.
//
// It reuses the shared interaction layer, so the SAME options as the
// splines-v1-interactive sketch drive it: pick the source under Vision → Source
// (webcam by default, or a recorded video / image asset), and inference runs on
// whatever you choose. Turn on Vision → Fingers (default) and/or Hands to feed
// the mask.
//
// How a frame is built:
//   1. paintCutout — draw a soft mask over every detected finger/hand and keep
//      only the live footage inside it → the hand region of THIS frame.
//   2. advanceEcho — age a persistent feedback buffer (fade + optional drift)
//      with a single self-blit, then stamp the fresh cutout on top. This is
//      O(1) in trail length: the trail is one accumulator, not N redrawn poses.
//   3. compose   — full video underneath (optional / dimmable), the fading hand
//      trail on top.
//
// Alignment: the interaction layer maps normalized landmarks straight onto
// 0..width / 0..height, so the source frame is stretched to fill the canvas
// (not cover-cropped) — that is the only fit that keeps the cutout glued to the
// fingers it traces. The mask + trail buffers live at a fraction of the canvas
// resolution (performance.bufferScale) to keep the per-frame fill cheap; a
// future GPU/shader feedback pass could replace the canvas compositing here.

const TAU = Math.PI * 2;

// Interaction groups whose points sit on the body in the frame, so masking the
// video at them carves out a real piece of the footage. Pointer-only sources
// (mouse, orbit, …) are excluded from the default "vision" region but can be
// opted back in with the "all" region for camera-less previewing.
const VISION_SOURCES = new Set( [
  "fingers",
  "hands",
  "body",
  "face"
] );

// Persistent feedback buffer the masked cutouts accumulate into (the trail) and
// a scratch buffer holding only the current frame's cutout. Both live at
// performance.bufferScale of the canvas size.
let echoBuffer = null;
let maskBuffer = null;
let bufferSignature = "";

// Previous centroid of the masked points, for the motion-follow drift mode.
let prevCentroid = null;

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

// Mirror handling mirrors the interaction layer's own rule (_visionFlip): a
// webcam is mirrored by default, a recorded video / image is not. Drawing the
// source with this same flip keeps the footage and the (already flipped)
// landmarks in the same orientation.
function visionFlip( vision ) {
  const mode = vision?.source?.mode || "webcam";

  if ( mode === "video" || mode === "image" ) {
    return vision?.source?.flip ?? false;
  }

  return vision?.source?.flip ?? vision?.camera?.flip ?? true;
}

// The raw DOM element MediaPipe is reading frames from: the <video> for a
// webcam, the offscreen <canvas> the interaction layer blits a seeked video
// frame into, or the <img> for an image source. Drawing THIS element keeps a
// single code path for every source kind.
function sourceElement() {
  return mediapipe.capture?.element?.elt ?? null;
}

function sourceReady( elt ) {
  if ( !elt ) {
    return false;
  }

  // <canvas>: always drawable. <video>: needs decoded dimensions. <img>: needs
  // a natural size. A zero-sized element makes drawImage draw nothing / throw.
  if ( typeof elt.getContext === "function" ) {
    return elt.width > 0 && elt.height > 0;
  }

  if ( elt.videoWidth !== undefined ) {
    return elt.videoWidth > 0 && elt.videoHeight > 0;
  }

  return ( elt.naturalWidth ?? 0 ) > 0;
}

// Stretch-draw the source frame to fill a (w × h) context, mirrored when the
// vision layer is mirroring its landmarks.
function drawSourceFill(
  ctx, elt, w, h, flip
) {
  ctx.save();

  if ( flip ) {
    ctx.translate(
      w,
      0
    );
    ctx.scale(
      -1,
      1
    );
  }

  try {
    ctx.drawImage(
      elt,
      0,
      0,
      w,
      h
    );
  } catch {
    // Frame not decodable this tick — keep whatever was already there.
  }

  ctx.restore();
}

// (Re)allocate the work buffers when the canvas size or the buffer scale
// changes. Recreating drops the current trail, which is acceptable for a live
// slider change and keeps the per-frame path branch-free.
function ensureBuffers(
  p, scale
) {
  const w = Math.max(
    1,
    Math.round( p.width * scale )
  );
  const h = Math.max(
    1,
    Math.round( p.height * scale )
  );
  const signature = `${ w }x${ h }`;

  if ( signature === bufferSignature && echoBuffer && maskBuffer ) {
    return;
  }

  bufferSignature = signature;

  echoBuffer?.remove?.();
  maskBuffer?.remove?.();

  echoBuffer = p.createGraphics(
    w,
    h
  );
  echoBuffer.pixelDensity( 1 );

  maskBuffer = p.createGraphics(
    w,
    h
  );
  maskBuffer.pixelDensity( 1 );
}

// The interaction groups that should carve into the video this frame, filtered
// by the chosen region. "vision" keeps every camera-detected entity; "fingers"
// / "hands" isolate one tracker; "all" also lets pointer sources (mouse, orbit,
// …) drive the mask — handy for previewing over a video asset with no camera.
function maskGroups(
  groups, region
) {
  if ( region === "all" ) {
    return groups;
  }

  if ( region === "fingers" || region === "hands" ) {
    return groups.filter( ( group ) => group.source === region );
  }

  return groups.filter( ( group ) => VISION_SOURCES.has( group.source ) );
}

function groupsCentroid(
  groups, p
) {
  let sx = 0;
  let sy = 0;
  let count = 0;

  for ( const group of groups ) {
    for ( const point of group.points ) {
      sx += point.x;
      sy += point.y;
      count += 1;
    }
  }

  if ( count === 0 ) {
    return null;
  }

  return p.createVector(
    sx / count,
    sy / count
  );
}

// One soft, radial-falloff brush stamp in buffer space. `feather` 0 → hard
// disk, 1 → a barely-there gradient, so the cutout edges can be crisp or melt
// into the footage.
function stampBrush(
  ctx, x, y, radius, feather
) {
  if ( radius <= 0 ) {
    return;
  }

  const gradient = ctx.createRadialGradient(
    x,
    y,
    0,
    x,
    y,
    radius
  );
  const core = clamp(
    1 - feather,
    0,
    0.99
  );

  gradient.addColorStop(
    0,
    "rgba(255, 255, 255, 1)"
  );
  gradient.addColorStop(
    core,
    "rgba(255, 255, 255, 1)"
  );
  gradient.addColorStop(
    1,
    "rgba(255, 255, 255, 0)"
  );

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(
    x,
    y,
    radius,
    0,
    TAU
  );
  ctx.fill();
}

// Walk a finger/hand chain (base → tip) and lay overlapping brush stamps along
// it, so the cutout reads as one continuous soft capsule rather than separate
// dots at each joint.
function paintCapsule(
  ctx, points, sx, sy, radius, feather, spacing
) {
  let previous = null;

  for ( const point of points ) {
    const x = point.x * sx;
    const y = point.y * sy;

    if ( previous ) {
      const dx = x - previous.x;
      const dy = y - previous.y;
      const distance = Math.hypot(
        dx,
        dy
      );
      const steps = Math.max(
        1,
        Math.floor( distance / spacing )
      );

      for ( let i = 1; i <= steps; i++ ) {
        const t = i / steps;

        stampBrush(
          ctx,
          previous.x + dx * t,
          previous.y + dy * t,
          radius,
          feather
        );
      }
    } else {
      stampBrush(
        ctx,
        x,
        y,
        radius,
        feather
      );
    }

    previous = {
      x,
      y
    };
  }
}

// Build this frame's hand cutout into maskBuffer: paint the soft mask over the
// detected points, then keep only the live footage inside it.
function paintCutout(
  groups, opts, sx, sy, flip, elt
) {
  const ctx = maskBuffer.drawingContext;
  const radius = Math.max(
    1,
    opts.brushSize * sx
  );
  const feather = clamp(
    opts.feather,
    0,
    1
  );
  const spacing = Math.max(
    2,
    radius * 0.5
  );

  maskBuffer.clear();

  ctx.save();
  // Overlapping stamps fuse into one region instead of seaming where two soft
  // edges meet — additive blending unions their alpha cleanly.
  ctx.globalCompositeOperation = "lighter";

  for ( const group of groups ) {
    const points = group.points;

    if ( opts.shape === "capsule" && points.length >= 2 ) {
      paintCapsule(
        ctx,
        points,
        sx,
        sy,
        radius,
        feather,
        spacing
      );
    } else {
      for ( const point of points ) {
        stampBrush(
          ctx,
          point.x * sx,
          point.y * sy,
          radius,
          feather
        );
      }
    }
  }

  // Keep the footage only inside the painted mask: source-in weights the video
  // by the mask's alpha, so soft edges yield soft-edged cutouts.
  ctx.globalCompositeOperation = "source-in";
  drawSourceFill(
    ctx,
    elt,
    maskBuffer.width,
    maskBuffer.height,
    flip
  );

  ctx.restore();
  ctx.globalCompositeOperation = "source-over";
}

// Transform the accumulator for one ageing step, per the chosen drift mode.
function applyDriftTransform(
  ctx, opts, w, h, sx, sy, velocity
) {
  const mode = opts.mode;

  if ( mode === "grow" ) {
    const factor = 1 + opts.grow;
    const cx = w / 2;
    const cy = h / 2;

    ctx.translate(
      cx,
      cy
    );
    ctx.scale(
      factor,
      factor
    );
    ctx.translate(
      -cx,
      -cy
    );

    return;
  }

  if ( mode === "motion" && velocity ) {
    // Push the trail a fraction of the hand's per-frame travel, so the echoes
    // smear toward where the hand is heading.
    ctx.translate(
      velocity.x * sx * opts.amount * 0.1,
      velocity.y * sy * opts.amount * 0.1
    );

    return;
  }

  const shiftX = opts.amount * sx;
  const shiftY = opts.amount * sy;

  if ( mode === "up" ) {
    ctx.translate(
      0,
      -shiftY
    );
  } else if ( mode === "down" ) {
    ctx.translate(
      0,
      shiftY
    );
  } else if ( mode === "left" ) {
    ctx.translate(
      -shiftX,
      0
    );
  } else if ( mode === "right" ) {
    ctx.translate(
      shiftX,
      0
    );
  }
}

// Age the trail (fade + drift) with a single self-copy, optionally bleed it
// toward a colour as it ages, then stamp the fresh cutout on top.
function advanceEcho(
  opts, velocity, sx, sy
) {
  const ctx = echoBuffer.drawingContext;
  const w = echoBuffer.width;
  const h = echoBuffer.height;

  ctx.save();
  ctx.globalCompositeOperation = "copy";
  ctx.globalAlpha = clamp(
    opts.decay,
    0,
    0.999
  );
  applyDriftTransform(
    ctx,
    opts,
    w,
    h,
    sx,
    sy,
    velocity
  );
  ctx.drawImage(
    ctx.canvas,
    0,
    0
  );
  ctx.restore();

  if ( opts.tintAmount > 0 ) {
    // source-atop only touches pixels that already exist, so the trail's shape
    // and alpha are kept while its colour drifts toward the tint.
    ctx.save();
    ctx.globalCompositeOperation = "source-atop";
    ctx.globalAlpha = clamp(
      opts.tintAmount,
      0,
      1
    );
    ctx.fillStyle = `rgb(${ opts.tintColor[ 0 ] }, ${ opts.tintColor[ 1 ] }, ${ opts.tintColor[ 2 ] })`;
    ctx.fillRect(
      0,
      0,
      w,
      h
    );
    ctx.restore();
  }

  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.drawImage(
    maskBuffer.canvas,
    0,
    0
  );
  ctx.restore();
}

sketch.setup( async() => {
  const p = getP5();

  p.clear();
  prevCentroid = null;
  bufferSignature = "";

  await initInteraction( options.sketch?.interaction ?? {} );
} );

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};
  const interaction = o.interaction ?? {};
  const display = o.display ?? {};
  const mask = o.mask ?? {};
  const echo = o.echo ?? {};
  const perf = o.performance ?? {};
  const background = display.backgroundColor ?? [
    0,
    0,
    0
  ];
  const scale = clamp(
    perf.bufferScale ?? 0.5,
    0.2,
    1
  );

  ensureBuffers(
    p,
    scale
  );

  const groups = getPointerGroups( {
    ...interaction,
    smoothing: mask.smoothing ?? 0
  } );
  const selected = maskGroups(
    groups,
    mask.region ?? "vision"
  );
  const flip = visionFlip( interaction.vision ?? {} );
  const elt = sourceElement();
  const ready = sourceReady( elt );
  const sx = echoBuffer.width / p.width;
  const sy = echoBuffer.height / p.height;

  if ( ready && selected.length > 0 ) {
    paintCutout(
      selected,
      {
        brushSize: mask.brushSize ?? 45,
        feather: mask.feather ?? 0.6,
        shape: mask.shape ?? "capsule"
      },
      sx,
      sy,
      flip,
      elt
    );
  } else {
    maskBuffer.clear();
  }

  const centroid = groupsCentroid(
    selected,
    p
  );
  let velocity = null;

  if ( centroid && prevCentroid ) {
    velocity = p.createVector(
      centroid.x - prevCentroid.x,
      centroid.y - prevCentroid.y
    );
  }

  prevCentroid = centroid;

  advanceEcho(
    {
      decay: echo.decay ?? 0.92,
      mode: echo.mode ?? "fade",
      amount: echo.amount ?? 8,
      grow: echo.grow ?? 0.02,
      tintColor: echo.tintColor ?? [
        120,
        0,
        255
      ],
      tintAmount: echo.tintAmount ?? 0
    },
    velocity,
    sx,
    sy
  );

  // ── Compose to the canvas ────────────────────────────────────────────────
  p.clear();
  p.background( ...background );

  const ctx = p.drawingContext;

  // Full source frame underneath (optional / dimmable) so the trail reads as
  // ghosts of the hands over the live footage.
  if ( ready && display.showVideo !== false ) {
    ctx.save();
    ctx.globalAlpha = clamp(
      display.videoOpacity ?? 1,
      0,
      1
    );
    drawSourceFill(
      ctx,
      elt,
      p.width,
      p.height,
      flip
    );
    ctx.restore();
  }

  // The accumulated, fading hand trail, scaled from the work buffer back up to
  // full canvas size.
  ctx.save();
  ctx.globalAlpha = clamp(
    echo.opacity ?? 1,
    0,
    1
  );
  ctx.drawImage(
    echoBuffer.canvas,
    0,
    0,
    p.width,
    p.height
  );
  ctx.restore();

  // Optional debug overlay (finger chains, camera preview, legend), gated by
  // the interaction → Visualization options just like the other vision sketches.
  drawInteractionOverlay( interaction );
} );

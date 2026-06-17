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
import {
  renderSplines
} from "../../splines/_shared.js";

// ── video-finger-echo ──────────────────────────────────────────────────────
// A POV-camera sketch built for the "first-person hands" footage you get from
// smart glasses (Meta Ray-Ban) or any webcam: the full source video plays, and
// the hands MediaPipe detects in it are drawn as glowing splines that leave a
// fading, drifting ECHO — a trail that follows the movement and melts away.
//
// The hand is drawn with the SAME GPU spline pipeline as the splines-v1-
// interactive sketch (renderSplines → utils/glowBatchGpu): every detected
// finger / hand becomes one ordered point list, rounded with Chaikin and glowed
// in a single instanced shader pass. That is far cheaper than stroking the trail
// on the CPU, and the trail itself is an O(1) feedback buffer (one self-blit per
// frame to fade + drift it), not N redrawn poses.
//
// It reuses the shared interaction layer, so the SAME options as splines-v1-
// interactive pick the source under Vision → Source (webcam by default, or a
// recorded video / image asset); inference runs on whatever you choose. Turn on
// Vision → Fingers (default) and/or Hands to feed the splines.
//
// Per frame:
//   1. ageEcho     — fade + drift the persistent trail buffer (one blit).
//   2. renderSplines — draw the live hand onto the cleared main canvas, then
//                      stamp it into the trail (newest = brightest echo).
//   3. compose     — background, the full source frame (optional / dimmable),
//                    then the glowing trail on top.
//
// Alignment: the interaction layer maps normalized landmarks straight onto
// 0..width / 0..height, so the source frame is stretched to fill the canvas
// (not cover-cropped) — that keeps the splines glued to the fingers they trace.

// Camera-sourced interaction groups that sit on the body in the frame. Pointer
// sources (mouse, orbit, …) are excluded from the default "vision" region but
// can be opted back in with the "all" region for camera-less previewing.
const VISION_SOURCES = new Set( [
  "fingers",
  "hands",
  "body",
  "face"
] );

// Persistent feedback buffer the glowing hand accumulates into (the trail), at
// full canvas resolution — the spline pass is GPU, so a full-res self-blit per
// frame stays cheap.
let echoLayer = null;
let echoSignature = "";

// Previous centroid of the tracked points, for the motion-follow drift mode.
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

// (Re)allocate the trail buffer when the canvas size changes.
function ensureEchoLayer( p ) {
  const signature = `${ p.width }x${ p.height }`;

  if ( signature === echoSignature && echoLayer ) {
    return;
  }

  echoSignature = signature;

  echoLayer?.remove?.();

  echoLayer = p.createGraphics(
    p.width,
    p.height
  );
  echoLayer.pixelDensity( 1 );
}

// The interaction groups that should be drawn this frame, filtered by region.
// "vision" keeps every camera-detected entity; "fingers" / "hands" isolate one
// tracker; "all" also lets pointer sources (mouse, orbit, …) drive the splines
// — handy for previewing over a video asset with no camera.
function selectGroups(
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

// One ordered point list per spline. Multi-point groups (finger chains, the
// hand fan, body) pass through as their own spline; same-source single points
// (e.g. fingertip-only, orbit) are re-aggregated into one polyline so they can
// still form a curve — matching splines-v1-interactive's live collector.
function collectLive( groups ) {
  const lists = [];
  const singletonsBySource = new Map();

  groups.forEach( ( group ) => {
    if ( group.points.length >= 2 ) {
      lists.push( group.points );

      return;
    }

    if ( group.points.length === 1 ) {
      const accumulator = singletonsBySource.get( group.source ) ?? [];

      accumulator.push( group.points[ 0 ] );
      singletonsBySource.set(
        group.source,
        accumulator
      );
    }
  } );

  for ( const points of singletonsBySource.values() ) {
    if ( points.length >= 2 ) {
      lists.push( points );
    }
  }

  return lists;
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

// Transform the accumulator for one ageing step, per the chosen drift mode.
function applyDriftTransform(
  ctx, opts, w, h, velocity
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
      velocity.x * opts.amount * 0.1,
      velocity.y * opts.amount * 0.1
    );

    return;
  }

  if ( mode === "up" ) {
    ctx.translate(
      0,
      -opts.amount
    );
  } else if ( mode === "down" ) {
    ctx.translate(
      0,
      opts.amount
    );
  } else if ( mode === "left" ) {
    ctx.translate(
      -opts.amount,
      0
    );
  } else if ( mode === "right" ) {
    ctx.translate(
      opts.amount,
      0
    );
  }
}

// Age the trail (fade + drift) with a single self-copy, then optionally bleed it
// toward a colour as it ages. The fresh hand is stamped in by the draw loop.
function ageEcho(
  opts, velocity
) {
  const ctx = echoLayer.drawingContext;
  const w = echoLayer.width;
  const h = echoLayer.height;

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
}

sketch.setup( async() => {
  const p = getP5();

  p.clear();
  prevCentroid = null;
  echoSignature = "";

  await initInteraction( options.sketch?.interaction ?? {} );
} );

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};
  const interaction = o.interaction ?? {};
  const display = o.display ?? {};
  const hand = o.hand ?? {};
  const stroke = o.stroke ?? {};
  const curve = o.curve ?? {};
  const echo = o.echo ?? {};
  const background = display.backgroundColor ?? [
    0,
    0,
    0
  ];

  ensureEchoLayer( p );

  const groups = getPointerGroups( {
    ...interaction,
    smoothing: hand.smoothing ?? 0
  } );
  const selected = selectGroups(
    groups,
    hand.region ?? "vision"
  );
  const lists = collectLive( selected );
  const flip = visionFlip( interaction.vision ?? {} );
  const elt = sourceElement();
  const ready = sourceReady( elt );
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

  // 1. Age the trail (fade + drift), independent of how long it is.
  ageEcho(
    {
      decay: echo.decay ?? 0.9,
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
    velocity
  );

  // 2. Draw the live hand as glowing GPU splines onto the cleared main canvas,
  //    then stamp it into the trail so it becomes the newest, brightest echo.
  p.clear();

  if ( lists.length > 0 ) {
    renderSplines(
      lists,
      {
        curve: {
          method: "chaikin",
          closed: curve.closed ?? false,
          iterations: curve.iterations ?? 5
        },
        stroke: {
          weight: stroke.weight ?? 16,
          glow: stroke.glow ?? 2,
          hueSpeed: stroke.hueSpeed ?? 1.5,
          hueSpread: stroke.hueSpread ?? 2,
          gradient: stroke.gradient ?? true
        },
        overlay: {
          polygon: {
            show: false
          },
          points: {
            show: false
          }
        }
      }
    );
    echoLayer.drawingContext.drawImage(
      p.drawingContext.canvas,
      0,
      0
    );
  }

  // 3. Compose: background, the full source frame, then the glowing trail.
  p.clear();
  p.background( ...background );

  const ctx = p.drawingContext;

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

  ctx.save();
  ctx.globalAlpha = clamp(
    echo.opacity ?? 1,
    0,
    1
  );
  ctx.drawImage(
    echoLayer.canvas,
    0,
    0
  );
  ctx.restore();

  // Optional debug overlay (finger chains, camera preview, legend), gated by
  // the interaction → Visualization options like the other vision sketches.
  drawInteractionOverlay( interaction );
} );

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

// ── video-hand-cutout ──────────────────────────────────────────────────────
// The video-atlas idea, but the cutout is your HANDS instead of a full-body
// selfie segmentation. The full source video plays; MediaPipe tracks the hands
// in it; the footage inside the hand region is copied out and the recent
// cutouts are stacked as offset, depth-tinted, fading echo layers — so the
// hands repeat and trail away while the rest of the picture stays put.
//
// Like video-atlas it keeps a RING of recent cutout frames and redraws them as
// a stack: newest on top (aligned with the live hand), older ones pushed
// further along the offset, scaled, twisted, colour-ramped and faded. The
// difference is the mask — a soft brush over the tracked finger/hand chains,
// not a body silhouette — and that the live video shows underneath.
//
// Source + tracking come from the shared interaction layer, so the SAME Vision
// → Source options as splines-v1-interactive choose what inference (and the
// picture) run on: webcam by default, or a recorded video / image asset.
//
// Nothing is drawn ON the hands by default (the whole point is to copy the
// footage). The Splines block adds an optional glowing overlay on top, using
// the same GPU spline pipeline as the video-finger-echo sketch.

// Camera-sourced interaction groups that sit on the body in the frame. Pointer
// sources (mouse, orbit, …) are excluded from the default "vision" region but
// can be opted back in with "all" for camera-less previewing.
const VISION_SOURCES = new Set( [
  "fingers",
  "hands",
  "body",
  "face"
] );

// Ring of recent cutout frames (2D buffers) — the time axis of the echo — at a
// fraction of the canvas resolution (performance.bufferScale).
let ring = [];
let ringWidth = 0;
let ringHeight = 0;
let writeIndex = -1;
let ringSignature = "";
let frameCounter = 0;

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
// webcam is mirrored by default, a recorded video / image is not.
function visionFlip( vision ) {
  const mode = vision?.source?.mode || "webcam";

  if ( mode === "video" || mode === "image" ) {
    return vision?.source?.flip ?? false;
  }

  return vision?.source?.flip ?? vision?.camera?.flip ?? true;
}

// The raw DOM element MediaPipe is reading frames from: the <video> for a
// webcam, the offscreen <canvas> the interaction layer blits a seeked video
// frame into, or the <img> for an image source.
function sourceElement() {
  return mediapipe.capture?.element?.elt ?? null;
}

function sourceReady( elt ) {
  if ( !elt ) {
    return false;
  }

  if ( typeof elt.getContext === "function" ) {
    return elt.width > 0 && elt.height > 0;
  }

  if ( elt.videoWidth !== undefined ) {
    return elt.videoWidth > 0 && elt.videoHeight > 0;
  }

  return ( elt.naturalWidth ?? 0 ) > 0;
}

// Stretch-draw the source frame to fill a (w × h) context, mirrored when the
// vision layer is mirroring its landmarks. Stretch (not cover) keeps the cutout
// aligned with the landmarks, which map onto 0..width / 0..height.
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

// The interaction groups that should be cut out this frame, filtered by region.
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

// One ordered point list per spline, for the optional overlay (matches the
// splines-v1-interactive live collector: multi-point groups pass through,
// same-source single points re-aggregate into one polyline).
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

// One soft, radial-falloff brush stamp. `feather` 0 → hard disk, 1 → barely-
// there gradient, so the cutout edges can be crisp or melt into the footage.
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
    Math.PI * 2
  );
  ctx.fill();
}

// Lay overlapping brush stamps along a finger/hand chain so the cutout reads as
// one continuous soft capsule rather than separate dots at each joint.
function paintCapsule(
  ctx, points, sx, sy, radius, feather, step
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
        Math.floor( distance / step )
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

// Three-stop colour ramp (front → mid → back) sampled at t ∈ [0, 1], for the
// depth tint of the echo layers (same shape as video-atlas).
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
    buffer?.remove?.();
  }

  ring = [];
  ringWidth = 0;
  ringHeight = 0;
  writeIndex = -1;
}

// (Re)allocate the ring when the layer count, canvas size or buffer scale
// changed.
function ensureRing(
  p, layers, scale
) {
  const rw = Math.max(
    1,
    Math.round( p.width * scale )
  );
  const rh = Math.max(
    1,
    Math.round( p.height * scale )
  );
  const signature = `${ layers }:${ rw }x${ rh }`;

  if ( signature === ringSignature && ring.length === layers ) {
    return;
  }

  ringSignature = signature;

  disposeRing();

  ringWidth = rw;
  ringHeight = rh;
  writeIndex = -1;

  ring = Array.from(
    {
      length: layers
    },
    () => {
      const buffer = p.createGraphics(
        rw,
        rh
      );

      buffer.pixelDensity( 1 );

      return buffer;
    }
  );
}

// Copy this frame's hand region of the footage into the next ring slot. An empty
// `groups` writes a cleared frame, so the trail ages away when the hands leave.
function writeCutout(
  p, groups, maskCfg, flip, elt
) {
  if ( ring.length === 0 ) {
    return;
  }

  writeIndex = ( writeIndex + 1 ) % ring.length;

  const buffer = ring[ writeIndex ];

  buffer.clear();

  if ( groups.length === 0 ) {
    return;
  }

  const ctx = buffer.drawingContext;
  const sx = ringWidth / p.width;
  const sy = ringHeight / p.height;
  const radius = Math.max(
    1,
    ( maskCfg.brushSize ?? 45 ) * sx
  );
  const feather = clamp(
    maskCfg.feather ?? 0.6,
    0,
    1
  );
  const step = Math.max(
    2,
    radius * 0.5
  );
  const shape = maskCfg.shape ?? "capsule";

  ctx.save();
  // Overlapping stamps fuse into one region instead of seaming where two soft
  // edges meet — additive blending unions their alpha cleanly.
  ctx.globalCompositeOperation = "lighter";

  for ( const group of groups ) {
    const points = group.points;

    if ( shape === "capsule" && points.length >= 2 ) {
      paintCapsule(
        ctx,
        points,
        sx,
        sy,
        radius,
        feather,
        step
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
    ringWidth,
    ringHeight,
    flip
  );

  ctx.restore();
  ctx.globalCompositeOperation = "source-over";
}

// Draw the ring as a stack of offset, depth-tinted, fading echo layers straight
// onto the canvas: newest on top (no offset, aligned with the live hand), older
// ones pushed along the offset, grown, twisted, ramped and faded out.
function drawStack(
  p, cfg
) {
  const layers = ring.length;

  if ( layers === 0 || writeIndex < 0 ) {
    return;
  }

  const w = p.width;
  const h = p.height;
  const cx = w / 2;
  const cy = h / 2;
  const offset = cfg.offset ?? {
    x: 6,
    y: -8
  };
  const scaleStep = cfg.scaleStep ?? 0.006;
  const rotateStep = cfg.rotateStep ?? 0.4;
  const minAlpha = clamp(
    cfg.minAlpha ?? 0,
    0,
    255
  );
  const colorMix = clamp(
    cfg.colorMix ?? 0.3,
    0,
    1
  );
  const echoOpacity = clamp(
    cfg.opacity ?? 1,
    0,
    1
  );
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

  p.push();
  p.imageMode( p.CORNER );
  p.noStroke();

  for ( let rank = layers - 1; rank >= 0; rank-- ) {
    const slot = ( ( writeIndex - rank ) % layers + layers ) % layers;
    const buffer = ring[ slot ];
    const t = layers > 1 ? rank / ( layers - 1 ) : 0;
    const ramp = rampColor(
      p,
      front,
      mid,
      back,
      t
    );
    const red = p.lerp(
      255,
      ramp[ 0 ],
      colorMix
    );
    const green = p.lerp(
      255,
      ramp[ 1 ],
      colorMix
    );
    const blue = p.lerp(
      255,
      ramp[ 2 ],
      colorMix
    );
    const alpha = p.lerp(
      255,
      minAlpha,
      t
    ) * echoOpacity;
    const drawScale = 1 + rank * scaleStep;

    p.push();
    p.translate(
      cx + offset.x * rank,
      cy + offset.y * rank
    );
    p.rotate( p.radians( rotateStep * rank ) );
    p.scale( drawScale );
    p.tint(
      red,
      green,
      blue,
      alpha
    );
    p.image(
      buffer,
      -w / 2,
      -h / 2,
      w,
      h
    );
    p.pop();
  }

  p.pop();
}

sketch.setup( async() => {
  const p = getP5();

  p.clear();
  ringSignature = "";
  frameCounter = 0;
  disposeRing();

  await initInteraction( options.sketch?.interaction ?? {} );
} );

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};
  const interaction = o.interaction ?? {};
  const display = o.display ?? {};
  const maskCfg = o.mask ?? {};
  const echo = o.echo ?? {};
  const splines = o.splines ?? {};
  const perf = o.performance ?? {};
  const background = display.backgroundColor ?? [
    0,
    0,
    0
  ];
  const layers = Math.round( clamp(
    echo.layers ?? 24,
    2,
    48
  ) );
  const scale = clamp(
    perf.bufferScale ?? 0.5,
    0.2,
    1
  );
  const spacing = Math.max(
    1,
    Math.round( echo.spacing ?? 1 )
  );

  ensureRing(
    p,
    layers,
    scale
  );

  const groups = getPointerGroups( {
    ...interaction,
    smoothing: maskCfg.smoothing ?? 0
  } );
  const selected = selectGroups(
    groups,
    maskCfg.region ?? "vision"
  );
  const flip = visionFlip( interaction.vision ?? {} );
  const elt = sourceElement();
  const ready = sourceReady( elt );

  frameCounter += 1;

  // Push a new cutout every `spacing` frames (higher = longer, steppier trail).
  if ( frameCounter % spacing === 0 ) {
    writeCutout(
      p,
      ready ? selected : [],
      maskCfg,
      flip,
      elt
    );
  }

  // ── Compose ───────────────────────────────────────────────────────────────
  p.clear();
  p.background( ...background );

  // Full source frame underneath, so most of the picture stays visible.
  if ( ready && display.showVideo !== false ) {
    const ctx = p.drawingContext;

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

  // The stacked, fading cutout echoes of the hands.
  drawStack(
    p,
    echo
  );

  // Optional glowing spline overlay drawn live on top of the hands.
  if ( splines.enabled ) {
    renderSplines(
      collectLive( selected ),
      {
        curve: {
          method: "chaikin",
          closed: false,
          iterations: splines.iterations ?? 5
        },
        stroke: {
          weight: splines.weight ?? 14,
          glow: splines.glow ?? 2,
          hueSpeed: splines.hueSpeed ?? 1.5,
          hueSpread: splines.hueSpread ?? 2,
          gradient: splines.gradient ?? true
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
  }

  drawInteractionOverlay( interaction );
} );

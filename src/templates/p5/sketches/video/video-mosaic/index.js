import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import mediapipe, {
  init as mediapipeInit,
  dispose as mediapipeDispose,
  setEnabled as mediapipeSetEnabled
} from "@/p5/utils/mediapipe/mediapipe.js";
import {
  initInteraction,
  getPointerGroups
} from "@/p5/utils/interaction/index.js";

// video-mosaic — the live webcam, carved into a rows × columns grid. Each cell
// samples a (slightly displaced) crop of the same blurred frame and is tinted
// with a chromatic-aberration colour shift, so the feed reads as a drifting,
// smeared mosaic of itself.
//
// The per-cell displacement is driven by whichever interaction handlers are
// enabled — Mouse, Touch, Microphone, or Hands (fingertips on the webcam).
// Mouse / touch / audio come from the shared interaction module; hands run
// MediaPipe on this sketch's own camera (the same one being displayed), so the
// shared module never touches the MediaPipe singleton. With no handler active
// the cells fall back to a drifting noise offset.

const buffers = {};
let cameraSignature = "";
let initializing = false;

// Fingertip landmark indices: thumb, index, middle, ring, pinky.
const FINGERTIP_INDICES = [
  4,
  8,
  12,
  16,
  20
];

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

// (Re)create an offscreen buffer when missing or when its size changed.
function ensureBuffer(
  p, name, w, h
) {
  const existing = buffers[ name ];

  if ( !existing || existing.width !== w || existing.height !== h ) {
    // remove() can throw if the old renderer was already torn down — dispose
    // defensively so a stray failure never crashes the draw loop.
    try {
      existing?.remove?.();
    } catch {}

    buffers[ name ] = p.createGraphics(
      w,
      h
    );
  }

  return buffers[ name ];
}

// Cover-fit a source of (sw × sh) into a (dw × dh) box, centered.
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

// Whether the Hands handler wants MediaPipe hand tracking on the camera.
function handsEnabled( cfg ) {
  const interaction = cfg.interaction ?? {};

  return interaction.enabled !== false && Boolean( interaction.hands?.enabled );
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
    ),
    // The displayed feed is always on; hand tracking is added only when the
    // Hands handler is enabled, so the other modes never pay for inference.
    hands: handsEnabled( cfg ),
    maxHands: Math.round( clamp(
      cfg.interaction?.hands?.maxHands ?? 2,
      1,
      2
    ) )
  };
}

// Open (or reopen) the single camera. The hands task is added/removed with the
// Hands handler; toggling it reinitialises (a brief camera blink).
// captureFlip stays false — the sketch mirrors the feed itself so the drawn
// pixels and the fingertip coordinates share one orientation.
async function ensureCamera( cfg ) {
  const camera = cameraConfig( cfg );
  const signature =
    `${ camera.deviceId }|${ camera.width }|${ camera.height }|${ camera.hands }|${ camera.maxHands }`;

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
      tasks: camera.hands ? [
        "hands"
      ] : [],
      taskOptions: camera.hands ? {
        hands: {
          numHands: camera.maxHands
        }
      } : {}
    } );
    // init() doesn't restore mediapipe.enabled if a previously-mounted sketch
    // left the singleton disabled, so flip it back on explicitly.
    mediapipeSetEnabled( true );
  } catch( error ) {
    // Let a later frame retry if init failed (permission prompt, device busy…).
    cameraSignature = "";
    console.warn(
      "[video-mosaic] camera init failed:",
      error
    );
  } finally {
    initializing = false;
  }
}

// Append every detected fingertip (canvas space) to the pointer list. Hands run
// on this sketch's own camera, so x is mirrored to match the displayed feed.
function collectHandPointers(
  p, flip, out
) {
  const hands = mediapipe.tasks?.hands?.result?.landmarks;

  if ( !Array.isArray( hands ) ) {
    return;
  }

  for ( const hand of hands ) {
    for ( const index of FINGERTIP_INDICES ) {
      const point = hand[ index ];

      if ( point ) {
        out.push( {
          x: ( flip ? 1 - point.x : point.x ) * p.width,
          y: point.y * p.height
        } );
      }
    }
  }
}

// All active pointers this frame, in canvas space. Mouse / touch / audio come
// from the shared interaction module (vision intentionally left untouched, so
// it never grabs the MediaPipe singleton this sketch owns); fingertips come
// from this sketch's own hand tracking.
function collectPointers(
  p, interaction, flip
) {
  const pointers = [];

  const groups = getPointerGroups( interaction );

  for ( const group of groups ) {
    for ( const point of group.points ) {
      pointers.push( {
        x: point.x,
        y: point.y
      } );
    }
  }

  if ( interaction.hands?.enabled ) {
    collectHandPointers(
      p,
      flip,
      pointers
    );
  }

  return pointers;
}

sketch.setup( async() => {
  const p = getP5();

  p.clear();

  // Drop buffers left over from a previous mount / hot reload so we never draw
  // onto a torn-down renderer.
  for ( const key of Object.keys( buffers ) ) {
    try {
      buffers[ key ]?.remove?.();
    } catch {}

    delete buffers[ key ];
  }

  const cfg = options.sketch ?? {};

  // Set up mouse / touch / audio listeners first. With no `vision` key this
  // also clears any stale vision state a previously-mounted sketch left in the
  // shared module, so it won't disable the camera we open next.
  await initInteraction( cfg.interaction ?? {} );

  // Force a fresh camera for this mount.
  cameraSignature = "";
  await ensureCamera( cfg );
} );

sketch.draw( () => {
  const p = getP5();
  const cfg = options.sketch ?? {};

  // Reconcile the camera with the picker / hands handler (no-op unless changed).
  ensureCamera( cfg );

  p.clear();
  p.background( ...( cfg.backgroundColor ?? [
    10,
    10,
    12
  ] ) );

  const captureElement = mediapipe.capture?.element;
  const captureReady = Boolean( captureElement?.elt?.videoWidth && captureElement.elt.videoHeight );

  if ( !captureReady ) {
    return; // camera still opening / permission denied / mid-reinit
  }

  const video = captureElement.elt;
  const vw = video.videoWidth;
  const vh = video.videoHeight;

  // Work buffer matched to the canvas aspect but capped, so the blur cost stays
  // bounded regardless of the (possibly huge) recording resolution. Cells then
  // map proportionally between this buffer and the canvas.
  const cap = 1280;
  const scale = Math.min(
    1,
    cap / Math.max(
      p.width,
      p.height
    )
  );
  const bw = Math.max(
    1,
    Math.round( p.width * scale )
  );
  const bh = Math.max(
    1,
    Math.round( p.height * scale )
  );

  const flip = Boolean( cfg.camera?.flip ?? true );
  const blur = clamp(
    cfg.blur ?? 6,
    0,
    20
  );
  const displacement = clamp(
    cfg.displacement ?? 0.4,
    0,
    10
  );
  const colorShift = clamp(
    cfg.colorShift ?? 0.4,
    0,
    1
  );
  const columns = Math.round( clamp(
    cfg.columns ?? 9,
    1,
    32
  ) );
  const rows = Math.round( clamp(
    cfg.rows ?? 3,
    1,
    32
  ) );

  // ── 1. Blit the (optionally mirrored) cover-fit frame into the work buffer ──
  const src = ensureBuffer(
    p,
    "src",
    bw,
    bh
  );
  const cover = coverRect(
    vw,
    vh,
    bw,
    bh
  );

  src.push();

  if ( flip ) {
    src.translate(
      bw,
      0
    );
    src.scale(
      -1,
      1
    );
  }

  // Pass the p5.MediaElement (not the raw <video>) so the 2D renderer can read
  // its backing element.
  src.image(
    captureElement,
    cover.x,
    cover.y,
    cover.w,
    cover.h
  );
  src.pop();

  if ( blur > 0 ) {
    src.filter(
      p.BLUR,
      blur
    );
  }

  // ── 2. Chromatic-aberration colour shift, applied once to the whole buffer ──
  // Red and blue channels are pushed apart horizontally and additively
  // recombined; offsets of 0 reconstruct the original colours exactly.
  let sampled = src;

  if ( colorShift > 0 ) {
    const aber = ensureBuffer(
      p,
      "aber",
      bw,
      bh
    );
    const offset = colorShift * 0.02 * bw;

    aber.clear();
    aber.blendMode( p.ADD );
    aber.tint(
      255,
      0,
      0
    );
    aber.image(
      src,
      offset,
      0
    );
    aber.tint(
      0,
      255,
      0
    );
    aber.image(
      src,
      0,
      0
    );
    aber.tint(
      0,
      0,
      255
    );
    aber.image(
      src,
      -offset,
      0
    );
    aber.blendMode( p.BLEND );
    aber.noTint();

    sampled = aber;
  }

  // ── 3. Carve the grid, sampling a displaced crop per cell ──────────────────
  const cellW = p.width / columns;
  const cellH = p.height / rows;
  const cellBW = bw / columns;
  const cellBH = bh / rows;
  const time = p.frameCount * 0.01;

  // Gather the enabled handlers' pointers; a cell is pulled toward nearby ones.
  // With no handler producing a pointer, fall back to drifting noise. Pointers
  // are canvas-space.
  const interaction = cfg.interaction ?? {};
  const pointers = interaction.enabled !== false ? collectPointers(
    p,
    interaction,
    flip
  ) : [];
  const interactive = pointers.length > 0;
  const reach = clamp(
    cfg.reach ?? 0.5,
    0.05,
    1
  );
  const radius = reach * Math.max(
    p.width,
    p.height
  );

  p.push();
  p.imageMode( p.CORNER );

  for ( let row = 0; row < rows; row++ ) {
    for ( let column = 0; column < columns; column++ ) {
      let offsetX;
      let offsetY;

      if ( interactive ) {
        // Sum a pull toward every pointer, weighted by closeness, so a cell
        // follows the nearest mouse / fingertip and eases off with distance.
        const centerX = ( column + 0.5 ) * cellW;
        const centerY = ( row + 0.5 ) * cellH;
        let accumX = 0;
        let accumY = 0;

        for ( const pointer of pointers ) {
          const dx = pointer.x - centerX;
          const dy = pointer.y - centerY;
          const distance = Math.hypot(
            dx,
            dy
          ) || 1;
          const influence = clamp(
            1 - distance / radius,
            0,
            1
          );

          if ( influence > 0 ) {
            accumX += ( dx / distance ) * influence;
            accumY += ( dy / distance ) * influence;
          }
        }

        offsetX = clamp(
          accumX,
          -1.5,
          1.5
        ) * displacement * cellBW;
        offsetY = clamp(
          accumY,
          -1.5,
          1.5
        ) * displacement * cellBH;
      } else {
        // Automatic: a smooth noise offset, seeded by the cell, drifting over
        // time, that pulls the sampled crop off its home position.
        const noiseX = p.noise(
          column * 0.35,
          row * 0.35,
          time
        );
        const noiseY = p.noise(
          column * 0.35 + 50,
          row * 0.35 + 50,
          time
        );

        offsetX = ( noiseX - 0.5 ) * 2 * displacement * cellBW;
        offsetY = ( noiseY - 0.5 ) * 2 * displacement * cellBH;
      }

      const sampleX = clamp(
        column * cellBW + offsetX,
        0,
        bw - cellBW
      );
      const sampleY = clamp(
        row * cellBH + offsetY,
        0,
        bh - cellBH
      );

      p.image(
        sampled,
        column * cellW,
        row * cellH,
        cellW,
        cellH,
        sampleX,
        sampleY,
        cellBW,
        cellBH
      );
    }
  }

  p.pop();
} );

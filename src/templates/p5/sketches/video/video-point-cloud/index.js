import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import graphics from "@/p5/utils/graphics.js";
import colors from "@/p5/utils/colors.js";
import easing from "@/p5/utils/easing.js";
import mappers from "@/p5/utils/mappers.js";
import animation from "@/p5/utils/animation.js";
import videos from "@/p5/utils/videos.js";
import mediapipe, {
  init as mediapipeInit,
  dispose as mediapipeDispose
} from "@/p5/utils/mediapipe/mediapipe.js";
import {
  channelValue,
  computeDepth
} from "./modes.js";

// video-point-cloud — the webcam (or a video asset) is run through MediaPipe
// segmentation, then instead of showing the footage we draw a 3D field of
// points that only exist where the silhouette is. Each point's DEPTH comes from
// a swappable algorithm ("mode"): the perceived colour of the pixel (relative
// min/max spread), an animated wave, a Perlin field, or live motion (flat at
// rest, pushed in/out where the subject moves). A depth-map model mode is a
// planned phase-2 addition.

// WEBGL buffer the point cloud is drawn into, then composited onto the canvas.
let cloudGraphics;

// Tiny buffer the source frame is drawn into at grid resolution — one pixel per
// cell averages each cell's colour for free (same trick as video-halftone).
let sampleBuffer;

// Video-asset pool (only used when the source is a clip rather than the webcam).
let pool;

// Per-cell working buffers (length = columns * rows), reallocated on resize.
let cellValue = null;
let cellMask = null;
let cellTarget = null;
let cellDisplay = null;

// Persistent per-mode scratch (e.g. motion keeps the previous frame here).
let modeState = {
  color: {},
  wave: {},
  perlin: {},
  motion: {}
};

// Source (re)init bookkeeping.
let sourceSignature = "";
let adoptedElement = null;
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

// Open (or reopen) the webcam / adopt the asset canvas + segmenter whenever the
// picked source changes. Fire-and-forget from draw, exactly like video-atlas.
async function ensureSource(
  cfg, poolItem
) {
  if ( initializing ) {
    return;
  }

  const source = cfg.source ?? {};
  const input = source.input ?? "webcam";

  if ( input === "video" ) {
    // The asset path hands MediaPipe the pool's offscreen canvas (the seeked
    // frame is blitted into it every pre-draw) — a stable inference source.
    const element = poolItem?.graphics?.canvas ?? null;

    if ( !element ) {
      return;
    }

    if ( sourceSignature === "video" && adoptedElement === element ) {
      return;
    }

    initializing = true;
    sourceSignature = "video";
    adoptedElement = element;

    try {
      mediapipeDispose();
      await mediapipeInit( {
        worker: false,
        enableCapture: true,
        captureFlip: false,
        source: {
          type: "video",
          element
        },
        tasks: [
          "segmenter"
        ]
      } );
    } catch( error ) {
      sourceSignature = "";
      adoptedElement = null;
      console.warn(
        "[video-point-cloud] video source init failed:",
        error
      );
    } finally {
      initializing = false;
    }

    return;
  }

  const deviceId = source.deviceId || "";
  const width = Math.max(
    1,
    Math.round( source.width ?? 640 )
  );
  const height = Math.max(
    1,
    Math.round( source.height ?? 480 )
  );
  const signature = `webcam|${ deviceId }|${ width }|${ height }`;

  if ( sourceSignature === signature ) {
    return;
  }

  initializing = true;
  sourceSignature = signature;
  adoptedElement = null;

  try {
    mediapipeDispose();
    await mediapipeInit( {
      worker: false,
      enableCapture: true,
      // We own the mirroring (point X is flipped at render) so the silhouette
      // and the sampled pixels always come from the same unflipped source.
      captureFlip: false,
      captureSize: {
        width,
        height
      },
      source: {
        type: "webcam",
        deviceId
      },
      tasks: [
        "segmenter"
      ]
    } );
  } catch( error ) {
    sourceSignature = "";
    console.warn(
      "[video-point-cloud] camera init failed:",
      error
    );
  } finally {
    initializing = false;
  }
}

// (Re)allocate the per-cell buffers when the grid size changes.
function ensureArrays( count ) {
  if ( cellValue && cellValue.length === count ) {
    return;
  }

  cellValue = new Float32Array( count );
  cellMask = new Uint8Array( count );
  cellTarget = new Float32Array( count );
  cellDisplay = new Float32Array( count ).fill( 0.5 );

  // Motion keeps a previous-frame buffer sized to the grid — drop it on resize.
  modeState.motion = {};
}

sketch.setup( async() => {
  const p = getP5();

  p.clear();

  cloudGraphics = graphics.createAutoResizableGraphics(
    p.width,
    p.height,
    "webgl"
  );

  pool = videos.attach( () => options.sketch?.source?.videos );

  try {
    sampleBuffer?.remove?.();
  } catch {}

  sampleBuffer = null;
  cellValue = null;
  cellMask = null;
  cellTarget = null;
  cellDisplay = null;
  modeState = {
    color: {},
    wave: {},
    perlin: {},
    motion: {}
  };

  // Force a fresh source/segmenter for this mount.
  sourceSignature = "";
  adoptedElement = null;
  await ensureSource(
    options.sketch ?? {},
    null
  );
} );

sketch.draw( ( time ) => {
  const p = getP5();
  const cfg = options.sketch ?? {};
  const source = cfg.source ?? {};
  const input = source.input ?? "webcam";

  // Resolve the asset clip up front (video source only).
  let poolItem = null;

  if ( input === "video" ) {
    const items = ( pool?.list() ?? [] ).filter( ( v ) => v.ready );

    poolItem = items[ 0 ] ?? null;
  }

  ensureSource(
    cfg,
    poolItem
  );

  p.clear();
  p.background( ...( cfg.backgroundColor ?? [
    8,
    8,
    10
  ] ) );

  const segmentation = mediapipe.tasks?.segmenter?.result;

  // The drawable colour source + its native resolution for this frame.
  let colorSource = null;
  let srcW = 0;
  let srcH = 0;

  if ( input === "video" ) {
    if ( poolItem?.graphics ) {
      colorSource = poolItem.graphics;
      srcW = poolItem.graphics.width;
      srcH = poolItem.graphics.height;
    }
  } else {
    const captureElement = mediapipe.capture?.element;
    const elt = captureElement?.elt;

    if ( elt?.videoWidth && elt?.videoHeight ) {
      colorSource = captureElement;
      srcW = elt.videoWidth;
      srcH = elt.videoHeight;
    }
  }

  // Wait until the source has a frame and the segmenter produced a mask.
  if ( !colorSource || !srcW || !srcH || !segmentation?.data ) {
    return;
  }

  // ── Grid sized to the SOURCE aspect so cells stay square (no face squash) ──
  const columns = Math.max(
    8,
    Math.round( cfg.grid?.columns ?? 100 )
  );
  const rows = Math.max(
    4,
    Math.round( columns * srcH / srcW )
  );
  const count = columns * rows;

  ensureArrays( count );

  if (
    !sampleBuffer ||
    sampleBuffer.width !== columns ||
    sampleBuffer.height !== rows
  ) {
    try {
      sampleBuffer?.remove?.();
    } catch {}

    sampleBuffer = p.createGraphics(
      columns,
      rows
    );
    sampleBuffer.pixelDensity( 1 );
  }

  sampleBuffer.clear();
  sampleBuffer.image(
    colorSource,
    0,
    0,
    columns,
    rows
  );
  sampleBuffer.loadPixels();

  const px = sampleBuffer.pixels;
  const maskData = segmentation.data;
  const maskW = segmentation.width;
  const maskH = segmentation.height;
  const channel = cfg.depth?.channel ?? "luminance";

  // ── Pass 1: perceived value + silhouette membership per cell ───────────────
  for ( let cy = 0; cy < rows; cy++ ) {
    const v = rows > 1 ? cy / ( rows - 1 ) : 0;
    const my = Math.min(
      maskH - 1,
      Math.floor( v * maskH )
    );

    for ( let cx = 0; cx < columns; cx++ ) {
      const i = cy * columns + cx;
      const o = i * 4;

      cellValue[ i ] = channelValue(
        px[ o ],
        px[ o + 1 ],
        px[ o + 2 ],
        channel
      );

      const u = columns > 1 ? cx / ( columns - 1 ) : 0;
      const mx = Math.min(
        maskW - 1,
        Math.floor( u * maskW )
      );

      cellMask[ i ] = maskData[ my * maskW + mx ] > 0 ? 1 : 0;
    }
  }

  // ── Pass 2: the active mode turns that into a normalised depth ─────────────
  const mode = cfg.mode ?? "color";

  if ( !modeState[ mode ] ) {
    modeState[ mode ] = {};
  }

  computeDepth(
    mode,
    {
      columns,
      rows,
      value: cellValue,
      mask: cellMask,
      target: cellTarget,
      params: cfg.modes?.[ mode ] ?? {},
      state: modeState[ mode ],
      p,
      time,
      noiseTime: animation.angle
    }
  );

  // ── Temporal smoothing: each point eases toward its target depth ───────────
  const smoothing = clamp(
    cfg.depth?.smoothing ?? 0.25,
    0,
    0.98
  );
  const lerpAmount = 1 - smoothing;

  for ( let i = 0; i < count; i++ ) {
    cellDisplay[ i ] += ( cellTarget[ i ] - cellDisplay[ i ] ) * lerpAmount;
  }

  // ── Render the cloud ───────────────────────────────────────────────────────
  const g = cloudGraphics;

  // Fit the source rectangle into the canvas, preserving its aspect ratio.
  const fit = cfg.grid?.fit ?? "contain";

  let cloudW;
  let cloudH;

  if ( fit === "stretch" ) {
    cloudW = p.width;
    cloudH = p.height;
  } else {
    const scale = fit === "cover"
      ? Math.max(
        p.width / srcW,
        p.height / srcH
      )
      : Math.min(
        p.width / srcW,
        p.height / srcH
      );

    cloudW = srcW * scale;
    cloudH = srcH * scale;
  }

  // Depth mapping (common to every mode).
  const nearZ = cfg.depth?.near ?? 320;
  const farZ = cfg.depth?.far ?? -320;
  const depthEasingFn = easing?.[ cfg.depth?.easing ] ?? easing.linear;
  const invert = Boolean( cfg.depth?.invert );

  // Point look.
  const pointSize = cfg.point?.size ?? 4;
  const sizeByDepth = cfg.point?.sizeByDepth ?? 0.4;
  const colorMode = cfg.color?.source ?? "video";
  const opacity = cfg.color?.opacity ?? 255;
  const hueOffset = cfg.color?.hueOffset ?? 0;
  const hueScale = cfg.color?.hueScale ?? 3;

  // Mirror by flipping the rendered X (source stays unflipped, so colour and
  // mask remain aligned). Webcam defaults to mirrored, assets to as-shot.
  const flip = Boolean( source.flip ?? ( input === "webcam" ) );
  const flipSign = flip ? -1 : 1;

  // Camera wobble (subtle parallax that sells the depth), à la peaks-*.
  const rotationEnabled = cfg.rotation?.enabled ?? true;
  const angleMax = cfg.rotation?.angleMax ?? 0.15;
  const xBase = cfg.rotation?.xBase ?? 0;
  const yBase = cfg.rotation?.yBase ?? 0;
  const xMultiplier = cfg.rotation?.xMultiplier ?? 0;
  const yMultiplier = cfg.rotation?.yMultiplier ?? 0.5;
  const zMultiplier = cfg.rotation?.zMultiplier ?? 0;

  const rX = xBase + ( rotationEnabled
    ? mappers.fn(
      p.sin( animation.angle * xMultiplier ),
      -1,
      1,
      -angleMax,
      angleMax
    )
    : 0 );
  const rY = yBase + ( rotationEnabled
    ? mappers.fn(
      p.sin( animation.angle * yMultiplier ),
      -1,
      1,
      -angleMax,
      angleMax
    )
    : 0 );
  const rZ = rotationEnabled
    ? mappers.fn(
      p.sin( animation.angle * zMultiplier ),
      -1,
      1,
      -angleMax,
      angleMax
    )
    : 0;

  g.push();
  g.rotateX( rX );
  g.rotateY( rY );
  g.rotateZ( rZ );
  g.noFill();

  for ( let cy = 0; cy < rows; cy++ ) {
    const v = rows > 1 ? cy / ( rows - 1 ) : 0;
    const y = ( v - 0.5 ) * cloudH;

    for ( let cx = 0; cx < columns; cx++ ) {
      const i = cy * columns + cx;

      if ( !cellMask[ i ] ) {
        continue;
      }

      const raw = cellDisplay[ i ];
      const depth = invert ? 1 - raw : raw;
      const z = mappers.fn(
        depth,
        0,
        1,
        farZ,
        nearZ,
        depthEasingFn
      );

      const u = columns > 1 ? cx / ( columns - 1 ) : 0;
      const x = flipSign * ( u - 0.5 ) * cloudW;

      if ( colorMode === "palette" ) {
        g.stroke( colors.rainbow( {
          hueOffset,
          hueIndex: mappers.fn(
            raw,
            0,
            1,
            -p.PI,
            p.PI
          ) * hueScale
        } ) );
      } else {
        const o = i * 4;

        g.stroke(
          px[ o ],
          px[ o + 1 ],
          px[ o + 2 ],
          opacity
        );
      }

      g.strokeWeight( pointSize * p.lerp(
        1 - sizeByDepth,
        1 + sizeByDepth,
        raw
      ) );

      g.point(
        x,
        y,
        z
      );
    }
  }

  g.pop();

  p.image(
    g,
    0,
    0
  );
  g.clear();
  g.reset();
} );

import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import webcam from "@/p5/utils/webcam/index.js";

// video-mosaic — the live webcam, carved into a rows × columns grid. Each cell
// samples a (slightly displaced) crop of the same blurred frame and is tinted
// with a chromatic-aberration colour shift, so the feed reads as a drifting,
// smeared mosaic of itself.

let cam;
const buffers = {};

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

sketch.setup( () => {
  cam = webcam.attach( () => options.sketch?.camera );

  // Drop buffers left over from a previous mount / hot reload so we never draw
  // onto a torn-down renderer.
  for ( const key of Object.keys( buffers ) ) {
    try {
      buffers[ key ]?.remove?.();
    } catch {}

    delete buffers[ key ];
  }
} );

sketch.draw( () => {
  const p = getP5();
  const cfg = options.sketch ?? {};

  p.clear();
  p.background( ...( cfg.backgroundColor ?? [
    10,
    10,
    12
  ] ) );

  const element = cam?.element();

  if ( !element ) {
    return; // camera still opening / permission denied
  }

  const video = element.elt;
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
    1
  );
  const colorShift = clamp(
    cfg.colorShift ?? 0.4,
    0,
    1
  );
  const columns = Math.round( clamp(
    cfg.columns ?? 9,
    1,
    12
  ) );
  const rows = Math.round( clamp(
    cfg.rows ?? 3,
    1,
    12
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
    element,
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

  p.push();
  p.imageMode( p.CORNER );

  for ( let row = 0; row < rows; row++ ) {
    for ( let column = 0; column < columns; column++ ) {
      // Per-cell displacement: a smooth noise offset (seeded by the cell, drifting
      // over time) that pulls the sampled crop off its home position.
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
      const offsetX = ( noiseX - 0.5 ) * 2 * displacement * cellBW;
      const offsetY = ( noiseY - 0.5 ) * 2 * displacement * cellBH;

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

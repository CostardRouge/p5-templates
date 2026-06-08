import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import videos from "@/p5/utils/videos.js";

let pool;
let sampleBuffer;

// Dark → light glyph ramp for the ASCII mode.
const ASCII_RAMP = " .:-=+*#%@";

sketch.setup( () => {
  pool = videos.attach( () => options.sketch?.videos );

  // Drop any buffer left over from a previous mount / hot reload so we never
  // draw onto a torn-down renderer.
  try {
    sampleBuffer?.remove?.();
  } catch {}

  sampleBuffer = null;
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

  const items = ( pool?.list() ?? [] ).filter( ( v ) => v.ready );

  if ( items.length === 0 ) {
    return;
  }

  // Halftone reads a single clip — the first ready one.
  const item = items[ 0 ];

  const cellSize = Math.max(
    2,
    Math.round( cfg.cellSize ?? 12 )
  );
  const columns = Math.max(
    1,
    Math.floor( p.width / cellSize )
  );
  const rows = Math.max(
    1,
    Math.floor( p.height / cellSize )
  );

  const glyph = cfg.glyph ?? "dot";
  const colorMode = cfg.colorMode ?? "mono";
  const monoColor = cfg.monoColor ?? [
    235,
    235,
    240
  ];
  const dotScale = cfg.dotScale ?? 0.9;
  const invert = Boolean( cfg.invert );

  // One sampling pixel per cell: drawing the native-res frame into a tiny
  // buffer averages each cell's color for free. Cache it across frames.
  if ( !sampleBuffer || sampleBuffer.width !== columns || sampleBuffer.height !== rows ) {
    // remove() can throw if the previous buffer's renderer was already torn
    // down (rapid slider changes / hot reload) — dispose defensively.
    try {
      sampleBuffer?.remove?.();
    } catch {}

    sampleBuffer = p.createGraphics(
      columns,
      rows
    );
  }

  sampleBuffer.clear();
  sampleBuffer.image(
    item.graphics,
    0,
    0,
    columns,
    rows
  );
  sampleBuffer.loadPixels();

  const px = sampleBuffer.pixels;
  const cellW = p.width / columns;
  const cellH = p.height / rows;
  const maxGlyph = Math.min(
    cellW,
    cellH
  ) * dotScale;

  p.noStroke();
  p.rectMode( p.CENTER );

  if ( glyph === "ascii" ) {
    p.textAlign(
      p.CENTER,
      p.CENTER
    );
    p.textSize( Math.min(
      cellW,
      cellH
    ) * 1.2 );
  }

  for ( let cy = 0; cy < rows; cy++ ) {
    for ( let cx = 0; cx < columns; cx++ ) {
      const idx = ( cy * columns + cx ) * 4;
      const r = px[ idx ];
      const g = px[ idx + 1 ];
      const b = px[ idx + 2 ];

      let lum = ( 0.299 * r + 0.587 * g + 0.114 * b ) / 255;

      if ( invert ) {
        lum = 1 - lum;
      }

      if ( colorMode === "from-video" ) {
        p.fill(
          r,
          g,
          b
        );
      } else {
        p.fill( ...monoColor );
      }

      const x = cx * cellW + cellW / 2;
      const y = cy * cellH + cellH / 2;

      if ( glyph === "ascii" ) {
        const ci = Math.min(
          ASCII_RAMP.length - 1,
          Math.floor( lum * ASCII_RAMP.length )
        );

        p.text(
          ASCII_RAMP[ ci ],
          x,
          y
        );
      } else if ( glyph === "square" ) {
        p.rect(
          x,
          y,
          lum * maxGlyph,
          lum * maxGlyph
        );
      } else {
        p.circle(
          x,
          y,
          lum * maxGlyph
        );
      }
    }
  }
} );

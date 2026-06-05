import {
  computeVideoLayout
} from "@/lib/assets/kinds/videos/types";

import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import videos from "@/p5/utils/videos.js";
import string from "@/p5/utils/string.js";

let pool;
const buffers = {};

const getFont = () => {
  const key = options.sketch?.font ?? "martian";

  return ( string.fonts && string.fonts[ key ] ) || string.fonts.martian;
};

// (Re)create a buffer when missing or when the canvas was resized.
function ensure(
  p, name, w, h
) {
  if ( !buffers[ name ] || buffers[ name ].width !== w || buffers[ name ].height !== h ) {
    // remove() can throw if the old renderer was already torn down — dispose
    // defensively so a stray failure never crashes the draw loop.
    try {
      buffers[ name ]?.remove?.();
    } catch {}

    buffers[ name ] = p.createGraphics(
      w,
      h
    );
  }

  return buffers[ name ];
}

sketch.setup( () => {
  pool = videos.attach( () => options.sketch?.videos );

  // Drop buffers left over from a previous mount / hot reload so we never
  // draw onto a torn-down renderer.
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

  p.background( ...( cfg.backgroundColor ?? [
    10,
    10,
    12
  ] ) );

  const items = ( pool?.list() ?? [] ).filter( ( v ) => v.ready );

  if ( items.length === 0 ) {
    return;
  }

  const mask = ensure(
    p,
    "mask",
    p.width,
    p.height
  );
  const frame = ensure(
    p,
    "frame",
    p.width,
    p.height
  );

  const divisor = Math.max(
    0.5,
    cfg.textSizeDivisor ?? 2.3
  );
  const fontSize = ( p.width + p.height ) / divisor;

  // Render the title into the mask buffer. Opaque glyphs (alpha 255) become
  // the only place the video will show through.
  mask.clear();

  const textBox = string.write(
    cfg.text ?? "VIDEO",
    0,
    p.height / 2 - fontSize / 8,
    {
      size: fontSize,
      font: getFont(),
      fill: 255,
      stroke: 255,
      strokeWeight: 0,
      textWidth: p.width,
      textAlign: [
        p.CENTER,
        p.CENTER
      ],
      graphics: mask,
      popPush: false
    }
  );

  // Font may still be loading on the first frames.
  if ( !textBox ) {
    return;
  }

  // Composite every video full-canvas into the frame buffer (each honors its
  // own scale / position / fit — `cover` recommended to fill behind the text).
  frame.clear();

  const box = {
    x: 0,
    y: 0,
    width: p.width,
    height: p.height
  };

  items.forEach( ( item ) => {
    const element = item.source?.element;
    const layout = computeVideoLayout(
      item.source?.params,
      box,
      {
        width: element?.videoWidth ?? 0,
        height: element?.videoHeight ?? 0
      }
    );

    frame.image(
      item.graphics,
      layout.x,
      layout.y,
      layout.width,
      layout.height
    );
  } );

  // Keep the video only inside the glyphs.
  const masked = frame.get();

  masked.mask( mask );
  p.image(
    masked,
    0,
    0
  );
} );

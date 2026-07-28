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

const ALIGN = {
  left: "LEFT",
  center: "CENTER",
  right: "RIGHT"
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

  const font = getFont();

  // Font may still be loading on the first frames.
  if ( !font?.data ) {
    return;
  }

  const text = cfg.text ?? "VIDEO";
  // Intuitive size: a percentage of the canvas height (bigger = bigger).
  const fontSize = p.height * ( ( cfg.fontSize ?? 60 ) / 100 );
  const align = p[ ALIGN[ cfg.align ?? "center" ] ?? "CENTER" ];
  const lineHeight = cfg.lineHeight ?? 1;
  const margin = Math.max(
    0,
    cfg.margin ?? 0
  );
  const style = cfg.style ?? "fill";
  const outlineWeight = Math.max(
    1,
    cfg.outlineWeight ?? 8
  );
  const invert = Boolean( cfg.invert );
  const blur = Math.max(
    0,
    cfg.blur ?? 0
  );

  // Where the masking text sits, as a fraction of the canvas (0.5 = centered,
  // matching the previous always-centered behaviour). Y points down.
  const textPosition = cfg.textPosition ?? {};
  const textPosX =
    typeof textPosition.x === "number" ? textPosition.x : 0.5;
  const textPosY =
    typeof textPosition.y === "number" ? textPosition.y : 0.5;

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

  // Paint the title (fill or outline) into a graphics, in white/opaque so its
  // alpha defines where the video shows.
  const paintText = ( g ) => {
    g.push();
    g.textFont( font );
    g.textSize( fontSize );
    g.textAlign(
      align,
      g.CENTER
    );
    g.textLeading( fontSize * lineHeight );

    // Shift the whole (centered) text block by the configured position. At
    // 0.5/0.5 the offset is zero, preserving the original centered layout.
    g.translate(
      ( textPosX - 0.5 ) * ( g.width - margin * 2 ),
      ( textPosY - 0.5 ) * ( g.height - margin * 2 )
    );

    if ( style === "outline" ) {
      g.noFill();
      g.stroke( 255 );
      g.strokeWeight( outlineWeight );
    } else {
      g.noStroke();
      g.fill( 255 );
    }

    g.text(
      text,
      margin,
      margin,
      g.width - margin * 2,
      g.height - margin * 2
    );
    g.pop();
  };

  // Build the mask. Normally the glyphs are the opaque area; when inverted we
  // fill everything and cut the glyphs out, so the video shows *around* them.
  mask.clear();

  if ( invert ) {
    mask.noStroke();
    mask.fill( 255 );
    mask.rect(
      0,
      0,
      mask.width,
      mask.height
    );
    mask.erase();
    paintText( mask );
    mask.noErase();
  } else {
    paintText( mask );
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

  // Blur the composited video layer; the text mask stays sharp so the video
  // shows softly through crisp glyphs.
  if ( blur > 0 ) {
    frame.filter(
      p.BLUR,
      blur
    );
  }

  // Keep the video only where the mask is opaque.
  const masked = frame.get();

  masked.mask( mask );
  p.image(
    masked,
    0,
    0
  );
} );

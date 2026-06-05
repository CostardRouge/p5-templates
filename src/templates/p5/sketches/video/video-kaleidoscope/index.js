import {
  computeVideoLayout
} from "@/lib/assets/kinds/videos/types";

import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import videos from "@/p5/utils/videos.js";
import animation from "@/p5/utils/animation.js";

let pool;
const buffers = {};

// (Re)create a buffer when missing or when the canvas was resized.
function ensure(
  p, name, w, h
) {
  if ( !buffers[ name ] || buffers[ name ].width !== w || buffers[ name ].height !== h ) {
    buffers[ name ]?.remove?.();
    buffers[ name ] = p.createGraphics(
      w,
      h
    );
  }

  return buffers[ name ];
}

sketch.setup( () => {
  pool = videos.attach( () => options.sketch?.videos );
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

  // Kaleidoscope mirrors a single clip — the first ready one.
  const item = items[ 0 ];
  const src = ensure(
    p,
    "src",
    p.width,
    p.height
  );

  // Keep the segment count even so mirrored wedges tile seamlessly.
  const segments = Math.max(
    2,
    Math.round( ( cfg.segments ?? 8 ) / 2 ) * 2
  );
  const sourceZoom = cfg.sourceZoom ?? 1;
  const offsetX = cfg.sourceOffsetX ?? 0;
  const offsetY = cfg.sourceOffsetY ?? 0;
  const autoSpin = cfg.autoSpin ?? true;
  const rotation =
    ( cfg.rotation ?? 0 ) + ( autoSpin ? animation.progression * 360 : 0 );

  // Draw the clip into the source buffer (cover), with zoom / offset choosing
  // which region of the frame gets mirrored.
  src.clear();

  const element = item.source?.element;
  const params = {
    ...( item.source?.params ?? {} ),
    fit: "cover",
    scale: sourceZoom,
    posX: offsetX,
    posY: offsetY
  };
  const layout = computeVideoLayout(
    params,
    {
      x: 0,
      y: 0,
      width: src.width,
      height: src.height
    },
    {
      width: element?.videoWidth ?? 0,
      height: element?.videoHeight ?? 0
    }
  );

  src.image(
    item.graphics,
    layout.x,
    layout.y,
    layout.width,
    layout.height
  );

  const angle = ( Math.PI * 2 ) / segments;
  const radius = Math.hypot(
    p.width,
    p.height
  );

  p.push();
  p.translate(
    p.width / 2,
    p.height / 2
  );
  p.rotate( p.radians( rotation ) );

  for ( let i = 0; i < segments; i++ ) {
    p.push();
    p.rotate( i * angle );

    // Clip to a single wedge [0, angle] in this rotated frame.
    p.clip( () => {
      p.beginShape();
      p.vertex(
        0,
        0
      );

      const steps = 12;

      for ( let s = 0; s <= steps; s++ ) {
        const a = ( angle * s ) / steps;

        p.vertex(
          Math.cos( a ) * radius,
          Math.sin( a ) * radius
        );
      }

      p.endShape( p.CLOSE );
    } );

    // Mirror every other wedge so neighboring slices meet edge-to-edge.
    if ( i % 2 === 1 ) {
      p.scale(
        1,
        -1
      );
    }

    p.imageMode( p.CENTER );
    p.image(
      src,
      0,
      0
    );
    p.pop();
  }

  p.pop();
} );

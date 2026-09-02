import {
  computeVideoLayout
} from "@/lib/assets/kinds/videos/types";

import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import videos from "@/p5/utils/videos.js";

let pool;
const buffers = sketch.state( () => ( {} ) );

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

  const trail = ensure(
    p,
    "trail",
    p.width,
    p.height
  );
  const tmp = ensure(
    p,
    "tmp",
    p.width,
    p.height
  );

  const decay = Math.min(
    1,
    Math.max(
      0,
      cfg.decay ?? 0.92
    )
  );
  const zoom = cfg.zoom ?? 1;
  const rotation = cfg.rotation ?? 0;
  const blur = Math.max(
    0,
    cfg.blur ?? 0
  );
  const blendName = cfg.blendMode ?? p.BLEND;

  // Snapshot the previous accumulation, then re-inject it transformed and
  // dimmed by `decay`. The ping-pong avoids drawing a buffer onto itself.
  tmp.clear();
  tmp.image(
    trail,
    0,
    0
  );

  trail.clear();
  trail.push();
  trail.imageMode( p.CENTER );
  trail.translate(
    p.width / 2,
    p.height / 2
  );
  trail.scale( zoom );
  trail.rotate( p.radians( rotation ) );
  trail.tint(
    255,
    255 * decay
  );
  trail.image(
    tmp,
    0,
    0
  );
  trail.pop();
  trail.noTint();

  if ( blur > 0 ) {
    trail.filter(
      p.BLUR,
      blur
    );
  }

  // Draw the current frame(s) over the trail with the chosen blend mode.
  const items = ( pool?.list() ?? [] ).filter( ( v ) => v.ready );

  if ( items.length > 0 ) {
    const box = {
      x: 0,
      y: 0,
      width: p.width,
      height: p.height
    };

    trail.push();
    trail.blendMode( blendName );

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

      trail.image(
        item.graphics,
        layout.x,
        layout.y,
        layout.width,
        layout.height
      );
    } );

    trail.blendMode( p.BLEND );
    trail.pop();
  }

  p.clear();
  p.background( ...( cfg.backgroundColor ?? [
    10,
    10,
    12
  ] ) );
  p.image(
    trail,
    0,
    0
  );
} );

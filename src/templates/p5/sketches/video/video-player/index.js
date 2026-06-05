import {
  computeVideoLayout
} from "@/lib/assets/kinds/videos/types";

import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import videos from "@/p5/utils/videos.js";

let pool;

sketch.setup( () => {
  pool = videos.attach( () => options.sketch?.videos );
} );

sketch.draw( () => {
  const p = getP5();

  p.background( ...( options.sketch?.backgroundColor ?? [
    10,
    10,
    12
  ] ) );

  const items = ( pool?.list() ?? [] ).filter( ( v ) => v.ready );

  if ( items.length === 0 ) {
    return;
  }

  // Free layout: every video is laid out against the *whole* canvas using its
  // own scale / position / fit, independent of how many videos there are. They
  // simply stack in option order — no grid carving up the canvas (a dedicated
  // `video-grid` template can own that behavior later).
  const canvas = {
    x: 0,
    y: 0,
    width: p.width,
    height: p.height
  };

  items.forEach( ( item ) => {
    const element = item.source?.element;
    const layout = computeVideoLayout(
      item.source?.params,
      canvas,
      {
        width: element?.videoWidth ?? 0,
        height: element?.videoHeight ?? 0
      }
    );

    p.image(
      item.graphics,
      layout.x,
      layout.y,
      layout.width,
      layout.height
    );
  } );
} );

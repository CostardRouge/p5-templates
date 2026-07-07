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

  // Grid geometry. `autoColumns` mimics the old auto-fit behavior
  // (≈ square grid); otherwise the user picks the column count and the rows
  // follow from how many videos there are.
  const columns = cfg.autoColumns
    ? Math.ceil( Math.sqrt( items.length ) )
    : Math.max(
      1,
      Math.round( cfg.columns ?? 2 )
    );
  const rows = Math.ceil( items.length / columns );

  const gap = Math.max(
    0,
    cfg.gap ?? 0
  );
  const padding = Math.max(
    0,
    cfg.padding ?? 0
  );

  const cellWidth = ( p.width - 2 * padding - ( columns - 1 ) * gap ) / columns;
  const cellHeight = ( p.height - 2 * padding - ( rows - 1 ) * gap ) / rows;

  // Bail if the gap / padding leave no room to draw anything.
  if ( cellWidth <= 0 || cellHeight <= 0 ) {
    return;
  }

  const cellColor = cfg.cellColor ?? [
    20,
    20,
    24
  ];
  const drawCellBackground = Boolean( cfg.showCellBackground );

  items.forEach( (
    item, index
  ) => {
    const column = index % columns;
    const row = Math.floor( index / columns );
    const cell = {
      x: padding + column * ( cellWidth + gap ),
      y: padding + row * ( cellHeight + gap ),
      width: cellWidth,
      height: cellHeight
    };

    // Optional per-cell backdrop, so letterboxed clips read as distinct tiles
    // instead of blending into the canvas background.
    if ( drawCellBackground ) {
      p.push();
      p.noStroke();
      p.fill( ...cellColor );
      p.rect(
        cell.x,
        cell.y,
        cell.width,
        cell.height
      );
      p.pop();
    }

    // Each video honors its own scale / position / fit, but *within its cell*
    // — that's the whole point of the grid template.
    const element = item.source?.element;
    const layout = computeVideoLayout(
      item.source?.params,
      cell,
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

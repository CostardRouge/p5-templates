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

  const columns = Math.ceil( Math.sqrt( items.length ) );
  const rows = Math.ceil( items.length / columns );
  const cellWidth = p.width / columns;
  const cellHeight = p.height / rows;

  items.forEach( (
    item, index
  ) => {
    p.image(
      item.graphics,
      ( index % columns ) * cellWidth,
      Math.floor( index / columns ) * cellHeight,
      cellWidth,
      cellHeight
    );
  } );
} );

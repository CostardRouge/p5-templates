import {
  shapes
} from "/assets/scripts/p5-sketches/utils/index.js";

export default function drawSlideBackground( backgroundOption ) {
  background( ...backgroundOption.background );

  const backgroundPattern = backgroundOption.pattern;

  if ( backgroundPattern !== undefined ) {
    if ( backgroundPattern.type === "grid" ) {
      const columns = backgroundPattern.columns || 9;
      const rows = columns * height / width;

      stroke( ...backgroundPattern.stroke );
      strokeWeight( backgroundPattern.strokeWeight || 1 );

      shapes.grid( {
        columns,
        rows
      } );

      shapes.vl( width );
      shapes.hl( height );
    }
  }
}
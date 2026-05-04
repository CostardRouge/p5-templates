import shapes from "../../shapes.js";
import {
  getP5
} from "../../sketch.js";

export default function drawSlideBackground( backgroundOption ) {
  const p = getP5();

  p.push();
  p.background( ...backgroundOption.background );

  const backgroundPattern = backgroundOption.pattern;

  if ( backgroundPattern !== undefined ) {
    if ( backgroundPattern.type === "grid" ) {
      const columns = backgroundPattern.columns || 9;
      const rows = ( columns * p.height ) / p.width;

      p.stroke( ...backgroundPattern.stroke );
      p.strokeWeight( backgroundPattern.strokeWeight || 1 );

      shapes.grid( {
        borders: backgroundPattern.borders,
        columns,
        rows
      } );
    }

    if ( backgroundPattern.type === "dots" ) {
      const columns = backgroundPattern.columns || 50;
      const rows = ( columns * p.height ) / p.width;

      p.stroke( ...backgroundPattern.stroke );
      p.strokeWeight( backgroundPattern.strokeWeight || 4 );

      shapes.dots( {
        border: backgroundPattern.borders,
        columns,
        rows
      } );
    }
  }
  p.pop();
}

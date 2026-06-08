import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import shapes from "@/p5/utils/shapes.js";
import colors from "@/p5/utils/colors.js";
import animation from "@/p5/utils/animation.js";

sketch.setup( () => {} );

const PALETTES = {
  rainbow: colors.rainbow,
  rainbowCrazy: colors.rainbowCrazy,
  purple: colors.purple,
  purpleSimple: colors.purpleSimple,
  darkBlueYellow: colors.darkBlueYellow,
  green: colors.green,
  black: colors.black
};

sketch.draw( () => {
  const p = getP5();
  const cfg = options.sketch ?? {};

  p.clear();
  p.background( ...( cfg.backgroundColor ?? [
    0,
    0,
    0
  ] ) );

  const columns = cfg.columns ?? 9;
  const proportional = cfg.proportional ?? true;
  const rows = proportional
    ? Math.max(
      1,
      Math.round( columns * p.height / p.width )
    )
    : cfg.rows ?? 9;

  const colorFunction = PALETTES[ cfg.palette ] ?? colors.rainbow;
  const size = cfg.size ?? 18;
  const amount = cfg.amount ?? 2;
  const strokeWeight = cfg.strokeWeight ?? 3;
  const opacityFactor = cfg.opacityFactor ?? 1.5;
  const hueMultiplier = cfg.hueMultiplier ?? 3;
  const rotationSpeed = cfg.rotationSpeed ?? 1;

  const cellWidth = p.width / columns;
  const cellHeight = p.height / rows;

  p.push();
  p.noFill();
  p.strokeWeight( strokeWeight );

  for ( let x = 0; x < columns; x++ ) {
    for ( let y = 0; y < rows; y++ ) {
      // hueIndex advances by a whole turn over the loop, so the colour cycle
      // is seamless; the same goes for an integer rotation speed.
      const hueIndex =
        ( x / columns + y / rows ) * hueMultiplier + animation.angle;

      p.stroke( colorFunction( {
        hueOffset: 0,
        hueIndex,
        opacityFactor
      } ) );

      shapes.cross( {
        position: p.createVector(
          x * cellWidth + cellWidth / 2,
          y * cellHeight + cellHeight / 2
        ),
        size,
        amount,
        angle: animation.angle * rotationSpeed
      } );
    }
  }

  p.pop();
} );

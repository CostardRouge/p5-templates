import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import shapes from "@/p5/utils/shapes.js";

sketch.setup( () => {} );

sketch.draw( () => {
  const p = getP5();
  const cfg = options.sketch ?? {};

  p.background( ...( cfg.backgroundColor ?? [
    0,
    0,
    0
  ] ) );

  const columns = cfg.columns ?? 12;
  const proportional = cfg.proportional ?? true;
  const rows = proportional
    ? Math.max(
      1,
      Math.round( columns * p.height / p.width )
    )
    : cfg.rows ?? 12;

  p.push();
  p.noFill();
  p.stroke( ...( cfg.color ?? [
    255,
    255,
    255
  ] ) );
  p.strokeWeight( cfg.strokeWeight ?? 1 );

  shapes.grid( {
    columns,
    rows,
    border: cfg.border ?? false
  } );

  p.pop();
} );

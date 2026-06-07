import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import shapes from "@/p5/utils/shapes.js";
import animation from "@/p5/utils/animation.js";

sketch.setup( () => {} );

sketch.draw( () => {
  const p = getP5();
  const cfg = options.sketch ?? {};

  p.background( ...( cfg.backgroundColor ?? [
    0,
    0,
    0
  ] ) );

  const columns = cfg.columns ?? 24;
  const proportional = cfg.proportional ?? true;
  const rows = proportional
    ? Math.max(
      1,
      Math.round( columns * p.height / p.width )
    )
    : cfg.rows ?? 24;

  // p5 draws a point as a disc whose diameter is the current stroke weight.
  // A periodic sine keeps the optional size pulse loop-safe.
  const baseSize = cfg.dotSize ?? 6;
  const pulse = cfg.pulse ?? 0;
  const size = Math.max(
    0.1,
    baseSize + pulse * baseSize * p.sin( animation.angle )
  );

  p.push();
  p.stroke( ...( cfg.color ?? [
    255,
    255,
    255
  ] ) );
  p.strokeWeight( size );

  shapes.dots( {
    columns,
    rows,
    border: cfg.border ?? false
  } );

  p.pop();
} );

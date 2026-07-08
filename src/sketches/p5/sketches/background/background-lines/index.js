import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import easing from "@/p5/utils/easing.js";
import animation from "@/p5/utils/animation.js";
import drawBackgroundPattern from "@/p5/utils/backgroundPattern.js";

sketch.setup( () => {} );

sketch.draw( () => {
  const p = getP5();
  const cfg = options.sketch ?? {};

  p.clear();
  p.background( ...( cfg.backgroundColor ?? [
    0,
    0,
    0
  ] ) );

  // Smoothly breathe the line count between min and max so the newest line
  // fades/slides in progressively (the signature behaviour of the util) and
  // the loop closes seamlessly (cos is periodic over a full turn).
  const columnsMin = cfg.columnsMin ?? 2;
  const columnsMax = cfg.columnsMax ?? 8;
  const wave = ( 1 - p.cos( animation.angle ) ) / 2;
  const columns = Math.max(
    1,
    p.lerp(
      columnsMin,
      columnsMax,
      wave
    )
  );

  drawBackgroundPattern( {
    columns,
    time: animation.angle,
    weight: cfg.weight ?? 6,
    color: cfg.color ?? [
      255,
      255,
      255
    ],
    overshoot: cfg.overshoot ?? 0,
    easingFn: easing[ cfg.easing ] ?? easing.easeInOutBack
  } );
} );

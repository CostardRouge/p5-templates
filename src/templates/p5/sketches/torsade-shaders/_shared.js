import sketch from "@/p5/utils/sketch.js";
import {
  resolveAnimation
} from "@/lib/animationConfig";

const TAU = Math.PI * 2;

// ── Loop-exact rate snapping ────────────────────────────────────────────────
// Every torsade-shaders variant drives its motion straight off the raw,
// non-wrapping `time.seconds()` clock handed to `sketch.draw` (passed through
// as the uT/uTime uniform), multiplying it by a rate before feeding it into a
// sin/cos in GLSL. That only closes the loop when the rate completes a WHOLE
// number of cycles over the resolved loop duration, so raw slider/literal
// rates are rounded here — on the CPU, before being uploaded — snapped to
// whole cycles per loop, staying as close as possible to the tuned speed.
// Same idiom as ../torsade/_shared.js#snapLoopRate.
function snapToWholeCycles(
  rawRate, cycleLength
) {
  const {
    duration
  } = resolveAnimation( sketch.sketchOptions?.animation );

  if ( !( duration > 0 ) || !( cycleLength > 0 ) ) {
    return rawRate;
  }

  const cycles = Math.round( rawRate * duration / cycleLength );

  return cycles * cycleLength / duration;
}

// For a rate (radians/sec) that feeds sin()/cos() directly: snap so it
// completes whole turns per loop.
export function snapLoopRate( rawRate ) {
  return snapToWholeCycles(
    rawRate,
    TAU
  );
}

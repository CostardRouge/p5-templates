import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import {
  resolveAnimation
} from "@/lib/animationConfig";

const TAU = Math.PI * 2;

// ── Loop-exact rate snapping ────────────────────────────────────────────────
// Every torsade variant drives its motion straight off the raw, non-wrapping
// `time.seconds()` clock handed to `sketch.draw` (not `animation.angle`),
// multiplying it by a rate before feeding it into sin/cos (or into a
// circularIndex() array walk). That only closes the loop when the rate
// completes a WHOLE number of cycles over the resolved loop duration, so raw
// slider/literal rates are rounded here — snapped to whole cycles per loop,
// staying as close as possible to the tuned speed.
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

// For a rate that feeds a circularIndex()/animation.ease() array walk: snap
// so it completes whole walks through `valuesLength` entries per loop.
export function snapLoopIndexRate(
  rawRate, valuesLength
) {
  return snapToWholeCycles(
    rawRate,
    valuesLength
  );
}

export class SpiralBase {
  constructor( opts ) {
    Object.assign(
      this,
      opts
    );
    this.calculateRelativePosition();
  }

  calculateRelativePosition() {
    const p = getP5();

    this.position = p.createVector(
      p.lerp(
        0,
        p.width,
        this.relativePosition.x
      ),
      p.lerp(
        0,
        p.height,
        this.relativePosition.y
      )
    );
  }
}

export function makeStartEnd( axis ) {
  const p = getP5();

  if ( axis === "horizontal" ) {
    return {
      start: p.createVector(
        p.width / 2,
        0
      ),
      end: p.createVector(
        -p.width / 2,
        0
      )
    };
  }
  if ( axis === "horizontal-narrow" ) {
    return {
      start: p.createVector(
        p.width / 2 - 100,
        0
      ),
      end: p.createVector(
        -p.width / 2 + 100,
        0
      )
    };
  }
  if ( axis === "horizontal-third" ) {
    return {
      start: p.createVector(
        -p.width / 3,
        0
      ),
      end: p.createVector(
        p.width / 3,
        0
      )
    };
  }
  if ( axis === "vertical-third" ) {
    return {
      start: p.createVector(
        0,
        -p.height / 3
      ),
      end: p.createVector(
        0,
        p.height / 3
      )
    };
  }

  return {
    start: p.createVector(
      0,
      -p.height / 2
    ),
    end: p.createVector(
      0,
      p.height / 2
    )
  };
}

export function rebuildGrid( {
  state, options, SpiralClass, layoutKeySuffix = "", extraProps = () => ( {} )
} ) {
  const p = getP5();
  const layout = options?.layout ?? {};

  const xCount = layout.xCount ?? 1;
  const yCount = layout.yCount ?? 1;
  const sizeDivisor = layout.sizeDivisor ?? 3.5;
  const axis = layout.axis ?? "vertical";

  const key = `${ xCount }x${ yCount }-${ sizeDivisor }-${ axis }-${ p.width }x${ p.height }-${ layoutKeySuffix }`;

  if ( key === state.lastLayout ) {
    return;
  }
  state.lastLayout = key;

  const size = ( p.width + p.height ) / 2 / ( xCount + yCount ) / sizeDivisor;
  const startEnd = makeStartEnd( axis );

  state.shapes = [];

  for ( let x = 1; x <= xCount; x++ ) {
    for ( let y = 1; y <= yCount; y++ ) {
      state.shapes.push( new SpiralClass( {
        size,
        ...startEnd,
        relativePosition: {
          x: x / ( xCount + 1 ),
          y: y / ( yCount + 1 )
        },
        ...extraProps( {
          x,
          y,
          xCount,
          yCount,
          size
        } )
      } ) );
    }
  }
}

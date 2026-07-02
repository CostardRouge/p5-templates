import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import converters from "@/p5/utils/converters.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";
import {
  SpiralBase, rebuildGrid
} from "../_shared.js";

const sketchState = {
  shapes: [],
  lastLayout: ""
};

class Spiral extends SpiralBase {
  draw(
    time, index
  ) {
    const p = getP5();
    const o = options.sketch ?? {};
    const spiralOpts = o.spiral ?? {};
    const motion = o.motion ?? {};
    const colorOpts = o.colors ?? {};

    const {
      position
    } = this;

    const sizeStart = spiralOpts.sizeStart ?? 50;
    const sizeEnd = spiralOpts.sizeEnd ?? 15;
    const opacityStart = spiralOpts.opacityStart ?? 3;
    const opacityEnd = spiralOpts.opacityEnd ?? 1;
    const shadowsCountMin = spiralOpts.shadowsCountMin ?? 1;
    const shadowsCountMax = spiralOpts.shadowsCountMax ?? 2;
    const shadowsCountSpeedA = spiralOpts.shadowsCountSpeedA ?? 3;
    const shadowsCountSpeedB = spiralOpts.shadowsCountSpeedB ?? 0.333;
    const shadowIndexStep = spiralOpts.shadowIndexStep ?? 0.01;
    const linesCount = spiralOpts.linesCount ?? 7;
    const sizeRatio = spiralOpts.sizeRatio ?? 6;
    const driftDivisor = motion.driftDivisor ?? 3;
    const xDriftMult = motion.xDriftMult ?? 5;
    const yDriftMult = motion.yDriftMult ?? 10;
    const eccentricAmp = motion.eccentricAmp ?? 5;
    const rotateSpinSpeed = motion.rotateSpinSpeed ?? 20;
    const opacityPulseSpeed = colorOpts.opacityPulseSpeed ?? 5;
    const opacityPulseMaxFactor = colorOpts.opacityPulseMaxFactor ?? 5;
    const opacityPulseFreq = colorOpts.opacityPulseFreq ?? 5;
    const hueShadowMixA = colorOpts.hueShadowMixA ?? 2;
    const hueShadowMixB = colorOpts.hueShadowMixB ?? 2;
    const hueShadowMixC = colorOpts.hueShadowMixC ?? 1;

    p.push();
    p.translate(
      position.x,
      position.y
    );

    // Rates that multiply the loop-exact clock (see sketch.draw below) are
    // snapped to whole cycles per loop so the last frame matches the first.
    const shadowsCountSpeedATurns = Math.round( shadowsCountSpeedA );
    const shadowsCountSpeedBTurns = Math.round( shadowsCountSpeedB );
    const opacityPulseSpeedTurns = Math.round( opacityPulseSpeed );
    const rotateSpinSpeedTurns = Math.round( rotateSpinSpeed );

    const shadowsCount = p.map(
      p.cos( index + time * shadowsCountSpeedATurns ) + p.sin( -time * shadowsCountSpeedBTurns + index ),
      -1,
      1,
      shadowsCountMin,
      shadowsCountMax,
      true
    );

    for (
      let shadowIndex = 0;
      shadowIndex <= shadowsCount;
      shadowIndex += shadowIndexStep
    ) {
      const size = p.map(
        shadowIndex,
        0,
        shadowsCount,
        sizeStart,
        sizeEnd
      );

      const opacityFactor = p.map(
        shadowIndex,
        0,
        shadowsCount,
        p.map(
          p.sin( index - time * opacityPulseSpeedTurns + shadowIndex * opacityPulseFreq ),
          -1,
          1,
          opacityStart,
          opacityStart * opacityPulseMaxFactor
        ),
        opacityEnd
      );

      const ys = p.map(
        p.cos( index - time ),
        -1,
        1,
        -eccentricAmp,
        eccentricAmp
      );
      const ySpeed = p.map(
        p.cos( index + time ),
        -1,
        1,
        -ys,
        ys
      );
      const xs = p.map(
        p.sin( index - time ),
        -1,
        1,
        -eccentricAmp,
        eccentricAmp
      );
      const xSpeed = p.map(
        p.sin( index + time ),
        -1,
        1,
        xs,
        -xs
      );

      const l = shadowIndex / driftDivisor;
      const indexCoefficient = shadowIndex + index;
      const x = p.map(
        p.sin( time + xSpeed - indexCoefficient ),
        -1,
        1,
        -l,
        l
      );
      const y = p.map(
        p.cos( time + ySpeed - indexCoefficient ),
        -1,
        1,
        -l,
        l
      );

      p.translate(
        x * xDriftMult,
        y * yDriftMult
      );

      const angleStep = p.TAU / linesCount;

      for ( let angle = 0; angle < p.TAU; angle += angleStep ) {
        const vector = converters.polar.vector(
          angle,
          size * sizeRatio
        );

        p.push();

        p.beginShape();
        p.strokeWeight( size );

        p.rotate( p.radians( time * rotateSpinSpeedTurns + angle * xSpeed ) );

        p.stroke( p.color(
          p.map(
            p.sin( -time + shadowIndex + index + shadowIndex * hueShadowMixA ),
            -1,
            1,
            0,
            360
          ) / opacityFactor,
          p.map(
            p.cos( -time - shadowIndex + index - shadowIndex * hueShadowMixB ),
            -1,
            1,
            360,
            0
          ) / opacityFactor,
          p.map(
            p.sin( -time + shadowIndex + index + shadowIndex * hueShadowMixC ),
            -1,
            1,
            360,
            0
          ) / opacityFactor
        ) );

        p.vertex(
          vector.x,
          vector.y
        );
        p.vertex(
          -vector.x,
          -vector.y
        );

        p.endShape();
        p.pop();
      }
    }

    p.pop();
  }
}

function drawGrid( time ) {
  const p = getP5();
  const grid = options.sketch?.grid ?? {};

  if ( !( grid.enabled ?? true ) ) {
    return;
  }

  const xCount = grid.xCount ?? 5;
  const yCount = grid.yCount ?? 7;
  const c = grid.color ?? [
    128,
    128,
    255
  ];
  const driftSpeed = grid.driftSpeed ?? 100;
  const opacityMax = grid.opacityMax ?? 100;
  const weight = grid.strokeWeight ?? 2;

  const xSize = p.width / xCount;
  const ySize = p.height / yCount;

  p.rectMode( p.CENTER );
  p.stroke(
    c[ 0 ],
    c[ 1 ],
    c[ 2 ],
    p.map(
      p.sin( time ),
      -1,
      1,
      0,
      opacityMax
    )
  );

  const offset = -4;

  // The scroll pattern is a repeating grid of identical lines spaced xSize /
  // ySize apart, so it redraws bit-for-bit identical once it has scrolled a
  // WHOLE number of cell-widths — snap the drift to complete exactly that
  // many per loop instead of the raw (never-wrapping) rate.
  const xCellsPerLoop = xSize > 0
    ? Math.round( driftSpeed * p.TAU / xSize )
    : 0;
  const yCellsPerLoop = ySize > 0
    ? Math.round( driftSpeed * p.TAU / ySize )
    : 0;
  const xx = xCellsPerLoop * xSize * animation.progression;
  const yy = yCellsPerLoop * ySize * animation.progression;

  for ( let x = offset; x <= xCount - offset; x++ ) {
    for ( let y = offset; y <= yCount - offset; y++ ) {
      p.strokeWeight( weight );
      p.line(
        0,
        ( yy + y * ySize ) % p.height,
        p.width,
        ( y * ySize + yy ) % p.height
      );
      p.line(
        ( xx + x * xSize ) % p.width,
        0,
        ( xx + x * xSize ) % p.width,
        p.height
      );
    }
  }
}

sketch.setup( () => {
  rebuildGrid( {
    state: sketchState,
    options: options.sketch,
    SpiralClass: Spiral
  } );
} );

sketch.draw( () => {
  const p = getP5();

  rebuildGrid( {
    state: sketchState,
    options: options.sketch,
    SpiralClass: Spiral
  } );

  p.clear();
  p.background( ...( options.sketch?.background?.color ?? [
    0
  ] ) );

  // Loop-exact clock: animation.angle sweeps exactly TAU per loop, unlike the
  // raw time.seconds() clock previously passed in here (it never wrapped, so
  // the last frame never matched the first). Rates that scale it are snapped
  // to whole cycles per loop inside drawGrid / Spiral.draw.
  const time = animation.angle;

  drawGrid( time );

  sketchState.shapes.forEach( (
    shape, index
  ) => shape.draw(
    time,
    index
  ) );

  renderTitle();
} );

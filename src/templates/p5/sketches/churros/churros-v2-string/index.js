import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";

import converters from "@/p5/utils/converters.js";
import mappers from "@/p5/utils/mappers.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";

sketch.setup( () => {} );

function drawGrid(
  p, xCount, yCount, t, animSpeed
) {
  const xSize = p.width / xCount;
  const ySize = p.height / yCount;

  p.strokeWeight( 2 );
  p.stroke(
    128,
    128,
    255,
    p.map(
      p.sin( t ),
      -1,
      1,
      0,
      100
    )
  );

  // The vertical scroll (yy) accumulates linearly and wraps via `% p.height`,
  // so it only lands on the same wrapped position at the seam when it covers
  // a WHOLE number of screen-heights per loop — snap its rate accordingly.
  // (The horizontal xx term is a bounded sin() oscillation with a coefficient
  // of 1 on t, so it is already exactly one whole cycle per loop.)
  const yySpeed = 100 * animSpeed;
  const yyCycles = Math.round( yySpeed * p.TAU / p.height );
  const yySnapped = p.height ? yyCycles * p.height / p.TAU : 0;

  const xx = 100 * p.sin( t ) * 2 * animSpeed;
  const yy = yySnapped * t;

  for ( let x = 0; x <= xCount; x++ ) {
    for ( let y = 0; y <= yCount; y++ ) {
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

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch;

  p.clear();
  p.background( ...( o.backgroundColor ?? [
    0
  ] ) );

  // Loop-exact clock: animation.angle sweeps exactly TAU per loop (the raw,
  // non-wrapping `time.seconds()` this draw loop used to receive never
  // returns to its start), so every oscillator driven by it below is snapped
  // to a WHOLE number of cycles per loop.
  const t = animation.angle;

  if ( o.grid?.enabled ?? true ) {
    drawGrid(
      p,
      o.grid?.xCount ?? 2,
      o.grid?.yCount ?? 3,
      t,
      o.grid?.animSpeed ?? 1
    );
  }

  p.push();
  p.translate(
    p.width / 2,
    p.height / 2
  );

  const angleMin = 0;
  const angleMax = p.PI - ( o.shape?.angleMaxOffset ?? 0.3 );
  const quality = o.shape?.quality ?? 800;
  const angleStep = angleMax / quality;

  const radiusX = o.shape?.radiusXDivisor ?? 4;
  const radiusY = o.shape?.radiusYDivisor ?? 3.5;
  const wobbleSpeed = o.shape?.wobbleSpeed ?? 0.1;
  const accumulatorAmp = o.shape?.accumulatorAmp ?? 1;

  const opacitySpeed = o.opacity?.speed ?? 3;
  const opacityCount = o.opacity?.groupCount ?? 3;
  const startOpacity = o.opacity?.startFactor ?? 3;
  const endOpacity = o.opacity?.endFactor ?? 1;
  const pingPong = o.opacity?.pingPong ?? true;
  const pingPongMax = o.opacity?.pingPongMax ?? 35;

  const rotationSpeed = o.rotation?.speed ?? 2;
  const rotationCount = o.rotation?.count ?? 1;

  const maxLinesCount = o.lines?.maxCount ?? 3;
  const changeLinesCount = o.lines?.changeOverTime ?? false;
  const linesLength = o.lines?.length ?? 50;
  const linesWeight = o.lines?.weight ?? 20;

  const hueSpeedOption = o.colors?.hueSpeed ?? 2;
  const greenAngleMult = o.colors?.greenAngleMultiplier ?? 10;

  // Every rate multiplying t below is snapped to a WHOLE number of cycles per
  // loop. The accumulator's secondary term (raw rate 1/3) rounds to 0 — it
  // becomes a static per-angle offset instead of animating, which is the
  // closest whole-cycle rate to the original.
  const accumulatorSecondaryCycles = Math.round( 1 / 3 );
  const wobbleCycles = Math.round( wobbleSpeed );
  const rotationCycles = Math.round( rotationSpeed );
  const opacityCycles = Math.round( opacitySpeed );
  const hueCycles = Math.round( hueSpeedOption );

  for ( let angle = angleMin; angle <= angleMax; angle += angleStep ) {
    // Outer accumulating spin — preserves the “string” curl from the original.
    p.rotate( p.radians( p.cos( t + angle * 2 ) - p.sin( t * accumulatorSecondaryCycles - angle * 2 ) ) * accumulatorAmp );

    p.push();
    p.translate(
      converters.polar.get(
        p.sin.bind( p ),
        p.width / radiusX,
        angle,
        p.map(
          p.sin( t * wobbleCycles ),
          -1,
          1,
          -3,
          3
        )
      ),
      converters.polar.get(
        p.cos.bind( p ),
        p.height / radiusY,
        angle,
        p.map(
          p.cos( t * wobbleCycles ),
          -1,
          1,
          2,
          -2
        )
      )
    );

    p.rotate( t * rotationCycles + angle * rotationCount );

    let opacityFactor = mappers.circularMap(
      angle,
      angleMax * 4,
      p.map(
        p.sin( -t * opacityCycles + angle * opacityCount ),
        -1,
        1,
        startOpacity,
        startOpacity * 5
      ),
      endOpacity
    );

    if ( pingPong ) {
      opacityFactor = p.map(
        p.map(
          p.sin( angle * opacityCount - t * opacityCycles ),
          -1,
          1,
          -1,
          1
        ),
        -1,
        1,
        p.map(
          p.cos( angle * opacityCount + t * opacityCycles ),
          -1,
          1,
          1,
          pingPongMax
        ),
        1
      );
    }

    let linesCount = maxLinesCount;

    if ( changeLinesCount ) {
      linesCount = p.map(
        p.cos( angle * 2 + t ),
        -1,
        1,
        1,
        maxLinesCount
      );
    }

    const lineStep = p.TAU / linesCount;
    const hueSpeed = -t * hueCycles;

    for ( let lineIndex = 0; lineIndex < p.TAU; lineIndex += lineStep ) {
      const vector = converters.polar.vector(
        angle - lineIndex,
        linesLength
      );

      p.push();
      p.beginShape();
      p.strokeWeight( linesWeight );

      p.stroke( p.color(
        p.map(
          p.sin( hueSpeed + angle ),
          -1,
          1,
          0,
          360
        ) / opacityFactor,
        p.map(
          p.sin( hueSpeed - angle * greenAngleMult ),
          -1,
          1,
          360,
          0
        ) / opacityFactor,
        p.map(
          p.sin( hueSpeed + angle ),
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

    p.pop();
  }

  p.pop();

  renderTitle();
} );

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

  p.strokeWeight( 3 );
  p.stroke(
    128,
    128,
    255
  );

  // The vertical scroll (yy) accumulates linearly and wraps via `% p.height`,
  // so it only lands on the same wrapped position at the seam when it covers
  // a WHOLE number of screen-heights per loop — snap its rate accordingly.
  const yySpeed = ySize * animSpeed;
  const yyCycles = Math.round( yySpeed * p.TAU / p.height );
  const yySnapped = p.height ? yyCycles * p.height / p.TAU : 0;

  const xx = xSize / 2;
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
      o.grid?.xCount ?? 5,
      o.grid?.yCount ?? 6,
      t,
      o.grid?.animSpeed ?? 1
    );
  }

  p.push();
  p.translate(
    p.width / 2,
    p.height / 2
  );

  // Symmetric loop angle bounds that pulse with cos(t)
  const angleBoundMin = o.shape?.angleBoundMin ?? 0.5;
  const angleBoundMax = o.shape?.angleBoundMax ?? p.PI;
  const angleMax = p.map(
    p.cos( t ),
    -1,
    1,
    angleBoundMin,
    angleBoundMax
  );
  const angleMin = -angleMax;
  const quality = o.shape?.quality ?? 400;
  const angleStep = angleMax / quality;

  const radiusX = o.shape?.radiusXDivisor ?? 4;
  const radiusY = o.shape?.radiusYDivisor ?? 4;

  const opacitySpeed = o.opacity?.speed ?? 3;
  const opacityCount = o.opacity?.groupCount ?? 3;
  const startOpacity = o.opacity?.startFactor ?? 3;
  const endOpacity = o.opacity?.endFactor ?? 1;
  const pingPong = o.opacity?.pingPong ?? true;
  const pingPongMax = o.opacity?.pingPongMax ?? 15;

  const rotationSpeed = o.rotation?.speed ?? 2;
  const rotationCount = o.rotation?.count ?? 1;
  const rotationAngleSquared = o.rotation?.angleSquaredFactor ?? 0.5;

  const maxLinesCount = o.lines?.maxCount ?? 3;
  const changeLinesCount = o.lines?.changeOverTime ?? false;
  const linesLength = o.lines?.length ?? 100;
  const linesWeight = o.lines?.weight ?? 40;

  const hueSpeedOption = o.colors?.hueSpeed ?? 2;
  const greenAngleMult = o.colors?.greenAngleMultiplier ?? 2.5;

  // Every rate multiplying t below is snapped to a WHOLE number of cycles
  // per loop so the last frame matches the first at the seam.
  const rotationCycles = Math.round( rotationSpeed );
  const opacityCycles = Math.round( opacitySpeed );
  const hueCycles = Math.round( hueSpeedOption );

  for ( let angle = angleMin; angle <= angleMax - 1; angle += angleStep ) {
    p.push();
    p.translate(
      converters.polar.get(
        p.sin.bind( p ),
        p.width / radiusX,
        angle,
        1
      ),
      converters.polar.get(
        p.cos.bind( p ),
        p.height / radiusY,
        angle,
        1
      )
    );

    // Original uses angle*angle/2 — yields a curling acceleration outwards.
    p.rotate( t * rotationCycles + angle * angle * rotationAngleSquared * rotationCount );

    let opacityFactor = mappers.circularMap(
      angle,
      angleMax * 4,
      p.map(
        p.sin( -t * opacityCycles + angle * opacityCount ),
        -1,
        1,
        startOpacity,
        endOpacity
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
        p.cos( angle + t ),
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

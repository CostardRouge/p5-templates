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

  // Both scrolls (xx, yy) accumulate linearly and wrap via `% p.width` /
  // `% p.height`, so each only lands on the same wrapped position at the
  // seam when it covers a WHOLE number of screen-widths/heights per loop —
  // snap their rates accordingly.
  const xxSpeed = 100 * animSpeed;
  const xxCycles = Math.round( xxSpeed * p.TAU / p.width );
  const xxSnapped = p.width ? xxCycles * p.width / p.TAU : 0;
  const yySpeed = ySize * animSpeed;
  const yyCycles = Math.round( yySpeed * p.TAU / p.height );
  const yySnapped = p.height ? yyCycles * p.height / p.TAU : 0;

  const xx = xxSnapped * t;
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

  const quality = o.shape?.quality ?? 400;
  const lerpMin = 0;
  const lerpMax = p.TAU;
  const lerpStep = lerpMax / quality;

  const verticalMargin = o.shape?.verticalMargin ?? 150;
  const lineAngleSpan = o.shape?.lineAngleSpan ?? p.PI;
  const lineLengthOsc = o.shape?.lineLengthOscillation ?? 2;

  const opacitySpeed = o.opacity?.speed ?? 3;
  const opacityCount = o.opacity?.groupCount ?? 3;
  const startOpacity = o.opacity?.startFactor ?? 3;
  const endOpacity = o.opacity?.endFactor ?? 1;
  const pingPong = o.opacity?.pingPong ?? true;
  const pingPongMax = o.opacity?.pingPongMax ?? 15;

  const rotationSpeed = o.rotation?.speed ?? 2;
  const rotationCount = o.rotation?.count ?? 1;

  const maxLinesCount = o.lines?.maxCount ?? 3;
  const changeLinesCount = o.lines?.changeOverTime ?? false;
  const linesLength = o.lines?.length ?? 75;
  const linesWeight = o.lines?.weight ?? 20;

  const hueSpeedOption = o.colors?.hueSpeed ?? 2;
  const hueAngleMult = o.colors?.hueAngleMultiplier ?? 1;

  // Every rate multiplying t below is snapped to a WHOLE number of cycles
  // per loop so the last frame matches the first at the seam. (lineLengthOsc
  // also scales lerpIndex — a spatial term, not a rate — so it keeps its raw
  // value there and only gets a rounded copy for the t-driven oscillation.)
  const rotationCycles = Math.round( rotationSpeed );
  const opacityCycles = Math.round( opacitySpeed );
  const hueCycles = Math.round( hueSpeedOption );
  const lineLengthOscCycles = Math.round( lineLengthOsc );

  for ( let lerpIndex = lerpMin; lerpIndex <= lerpMax; lerpIndex += lerpStep ) {
    p.push();

    // Positioner: vertical column
    p.translate(
      p.width / 2,
      p.map(
        lerpIndex,
        lerpMin,
        lerpMax,
        verticalMargin,
        p.height - verticalMargin
      )
    );

    p.rotate( t * rotationCycles + lerpIndex * rotationCount );

    let opacityFactor = mappers.circularMap(
      lerpIndex,
      lerpMax * 4,
      p.map(
        p.sin( -t * opacityCycles + lerpIndex * opacityCount ),
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
          p.sin( lerpIndex * opacityCount - t * opacityCycles ),
          -1,
          1,
          -1,
          1
        ),
        -1,
        1,
        p.map(
          p.cos( lerpIndex * opacityCount + t * opacityCycles ),
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
        p.cos( lerpIndex * 5 + t ),
        -1,
        1,
        1,
        maxLinesCount
      );
    }

    const lineStep = lineAngleSpan / linesCount;
    const hueSpeed = -t * hueCycles;

    for ( let lineIndex = 0; lineIndex < lineAngleSpan; lineIndex += lineStep ) {
      const vector = converters.polar.vector(
        lineIndex,
        p.map(
          p.sin( lerpIndex * lineLengthOsc + t * lineLengthOscCycles ),
          -1,
          1,
          1,
          linesLength,
          true
        )
      );

      p.push();
      p.beginShape();
      p.strokeWeight( linesWeight );

      p.stroke( p.color(
        p.map(
          p.sin( hueSpeed + lerpIndex * hueAngleMult ),
          -1,
          1,
          0,
          360
        ) / opacityFactor,
        p.map(
          p.sin( hueSpeed - lerpIndex ),
          -1,
          1,
          360,
          0
        ) / opacityFactor,
        p.map(
          p.sin( hueSpeed + lerpIndex ),
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

  renderTitle();
} );

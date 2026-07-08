import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";

import converters from "@/p5/utils/converters.js";
import mappers from "@/p5/utils/mappers.js";

sketch.setup( () => {} );

function drawGrid(
  p, xCount, yCount, time, animSpeed, weight = 3
) {
  if ( xCount <= 0 || yCount <= 0 ) {
    return;
  }

  const xSize = p.width / xCount;
  const ySize = p.height / yCount;

  p.strokeWeight( weight );
  p.stroke(
    128,
    128,
    255
  );

  const xx = xSize * p.cos( time + xSize ) * animSpeed;
  const yy = ySize * p.sin( time + ySize ) * animSpeed;

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

sketch.draw( ( time ) => {
  const p = getP5();
  const o = options.sketch;

  p.clear();
  p.background( ...( o.backgroundColor ?? [
    0
  ] ) );

  if ( o.grids?.outerEnabled ?? true ) {
    drawGrid(
      p,
      o.grids?.outerXCount ?? 1,
      o.grids?.outerYCount ?? 1,
      time / 4,
      o.grids?.outerAnimSpeed ?? 1
    );
  }

  if ( o.grids?.innerEnabled ?? true ) {
    drawGrid(
      p,
      o.grids?.innerXCount ?? 3,
      o.grids?.innerYCount ?? 4,
      time,
      o.grids?.innerAnimSpeed ?? 1
    );
  }

  const quality = o.shape?.quality ?? 400;
  const angleBoundMin = o.shape?.angleBoundMin ?? 0.5;
  const angleBoundMax = o.shape?.angleBoundMax ?? p.PI;
  const lerpMin = 0;
  const lerpMax = p.map(
    p.sin( time ),
    -1,
    1,
    angleBoundMin,
    angleBoundMax
  );
  const lerpStep = ( lerpMax || 0.0001 ) / quality;

  const horizontalSwing = o.shape?.horizontalSwing ?? 200;
  const horizontalSwingFreq = o.shape?.horizontalSwingFreq ?? 1.5;
  const horizontalSwingSpeed = o.shape?.horizontalSwingSpeed ?? 2;
  const verticalMargin = o.shape?.verticalMargin ?? 150;
  const lineAngleMax = o.shape?.lineAngleMax ?? p.PI;

  const opacitySpeed = o.opacity?.speed ?? 3;
  const opacityCount = o.opacity?.groupCount ?? 3;
  const startOpacity = o.opacity?.startFactor ?? 3;
  const endOpacity = o.opacity?.endFactor ?? 1;
  const pingPong = o.opacity?.pingPong ?? false;
  const pingPongMax = o.opacity?.pingPongMax ?? 15;

  const rotationSpeed = o.rotation?.speed ?? 2;
  const rotationCount = o.rotation?.count ?? 1;
  const rotationWaveAmp = o.rotation?.waveAmplitude ?? 1.5;
  const rotationWaveMult = o.rotation?.waveMultiplier ?? 2;

  const maxLinesCount = o.lines?.maxCount ?? 3;
  const changeLinesCount = o.lines?.changeOverTime ?? true;
  const linesLength = o.lines?.length ?? 75;
  const linesWeight = o.lines?.weight ?? 80;

  const hueSpeedOption = o.colors?.hueSpeed ?? 2;
  const hueAngleMult = o.colors?.hueAngleMultiplier ?? 7;

  for ( let lerpIndex = lerpMin; lerpIndex <= lerpMax; lerpIndex += lerpStep ) {
    p.push();

    const l = p.map(
      p.cos( lerpIndex - time ),
      -1,
      1,
      -rotationWaveAmp,
      rotationWaveAmp
    );

    p.translate(
      p.map(
        p.sin( lerpIndex * horizontalSwingFreq - time * horizontalSwingSpeed ),
        -1,
        1,
        p.width / 2 - horizontalSwing,
        p.width / 2 + horizontalSwing
      ),
      p.map(
        lerpIndex,
        lerpMin,
        lerpMax,
        p.map(
          p.cos( time ),
          -1,
          1,
          verticalMargin,
          p.height - verticalMargin
        ),
        p.map(
          p.sin( time ),
          -1,
          1,
          verticalMargin,
          p.height - verticalMargin
        ),
        true
      )
    );

    p.rotate( time * rotationSpeed + lerpIndex * l * rotationWaveMult * rotationCount );

    let opacityFactor = mappers.circularMap(
      lerpIndex,
      lerpMax * 4,
      p.map(
        p.sin( -time * opacitySpeed + lerpIndex * opacityCount ),
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
          p.sin( lerpIndex * opacityCount - time * opacitySpeed ),
          -1,
          1,
          -1,
          1
        ),
        -1,
        1,
        p.map(
          p.cos( lerpIndex * opacityCount + time * opacitySpeed ),
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
        p.sin( lerpIndex - time * 3 ),
        0,
        1,
        1,
        maxLinesCount,
        true
      );
    }

    const lineStep = lineAngleMax / linesCount;
    const hueSpeed = -time * hueSpeedOption;

    for ( let lineIndex = 0; lineIndex < lineAngleMax; lineIndex += lineStep ) {
      const vector = converters.polar.vector(
        lineIndex,
        linesLength
      );

      p.push();
      p.beginShape();
      p.strokeWeight( linesWeight );

      const alpha = mappers.circularMap(
        lerpIndex,
        lerpMax,
        0,
        100
      );

      p.stroke( p.color(
        p.map(
          p.sin( hueSpeed + lerpIndex * hueAngleMult ),
          -1,
          1,
          0,
          360
        ) / opacityFactor,
        p.map(
          p.sin( hueSpeed - lerpIndex * hueAngleMult ),
          -1,
          1,
          360,
          0
        ) / opacityFactor,
        p.map(
          p.sin( hueSpeed + lerpIndex * hueAngleMult ),
          -1,
          1,
          360,
          0
        ) / opacityFactor,
        alpha
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
} );

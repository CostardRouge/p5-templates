import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";

import converters from "@/p5/utils/converters.js";
import mappers from "@/p5/utils/mappers.js";

sketch.setup( () => {} );

function drawGrid(
  p, xCount, yCount, time, animSpeed
) {
  const xSize = p.width / xCount;
  const ySize = p.height / yCount;

  p.strokeWeight( 3 );
  p.stroke(
    128,
    128,
    255
  );

  const xx = xSize / 2;
  const yy = ySize * p.cos( time ) * 3 * animSpeed;

  for ( let x = -10; x <= xCount + 10; x++ ) {
    for ( let y = -10; y <= yCount + 10; y++ ) {
      p.line(
        0,
        ( y * ySize + yy ) % p.height,
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

  if ( o.grid?.enabled ?? true ) {
    drawGrid(
      p,
      o.grid?.xCount ?? 6,
      o.grid?.yCount ?? 8,
      time,
      o.grid?.animSpeed ?? 1
    );
  }

  const quality = o.shape?.quality ?? 400;
  const angleBoundMin = o.shape?.angleBoundMin ?? 0.5;
  const angleBoundMax = o.shape?.angleBoundMax ?? p.PI;
  const halfSpan = p.map(
    p.sin( time ),
    -1,
    1,
    angleBoundMin,
    angleBoundMax
  );
  const lerpMin = -halfSpan;
  const lerpMax = halfSpan;
  const lerpStep = ( lerpMax || 0.0001 ) / quality;

  const baseRadius = o.shape?.baseRadius ?? 200;
  const horizontalSwing = o.shape?.horizontalSwing ?? 200;
  const horizontalSwingSpeed = o.shape?.horizontalSwingSpeed ?? 2;
  const horizontalSwingMult = o.shape?.horizontalSwingMultiplier ?? -2.5;
  const verticalMargin = o.shape?.verticalMargin ?? 150;
  const lineAngleMult = o.shape?.lineAngleMultiplier ?? 5;

  const opacitySpeed = o.opacity?.speed ?? 4;
  const opacityCount = o.opacity?.groupCount ?? 5;
  const startOpacity = o.opacity?.startFactor ?? 3;
  const endOpacity = o.opacity?.endFactor ?? 1;
  const pingPong = o.opacity?.pingPong ?? true;
  const pingPongMax = o.opacity?.pingPongMax ?? 10;

  const rotationSpeed = o.rotation?.speed ?? 2;
  const rotationCount = o.rotation?.count ?? 1;

  const maxLinesCount = o.lines?.maxCount ?? 1;
  const changeLinesCount = o.lines?.changeOverTime ?? false;
  const linesLength = o.lines?.length ?? 90;
  const linesWeight = o.lines?.weight ?? 70;

  const hueSpeedOption = o.colors?.hueSpeed ?? 2;
  const hueAngleMult = o.colors?.hueAngleMultiplier ?? 5;

  for ( let lerpIndex = lerpMin; lerpIndex <= lerpMax; lerpIndex += lerpStep ) {
    p.push();

    // First offset: project along an angle on a fixed radius — gives a tight bundle.
    p.translate(
      p.cos( lerpIndex ) * baseRadius,
      p.sin( lerpIndex ) * baseRadius
    );

    const l = p.map(
      p.cos( lerpIndex - time ),
      -1,
      1,
      0,
      3,
      true
    );

    p.translate(
      p.map(
        p.sin( -lerpIndex * horizontalSwingMult + time * horizontalSwingSpeed ),
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
          verticalMargin * 2,
          p.height - verticalMargin * 2
        ),
        p.map(
          p.sin( time ),
          -1,
          1,
          verticalMargin * 2,
          p.height - verticalMargin
        )
      )
    );

    p.rotate( p.cos( time + lerpIndex * l * 2 ) +
      rotationSpeed +
      lerpIndex * rotationCount );

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
        p.cos( lerpIndex / 2 - time * 3 ),
        0,
        1,
        1,
        maxLinesCount,
        true
      );
    }

    const lineMax = p.PI;
    const lineStep = lineMax / linesCount;
    const hueSpeed = -time * hueSpeedOption;

    for ( let lineIndex = 0; lineIndex < lineMax; lineIndex += lineStep ) {
      const vector = converters.polar.vector(
        lineIndex * lineAngleMult,
        linesLength
      );

      p.push();
      p.beginShape();
      p.strokeWeight( linesWeight );

      p.stroke( p.color(
        p.map(
          p.sin( hueSpeed - lerpIndex * hueAngleMult ),
          -1,
          1,
          0,
          360
        ) / opacityFactor,
        p.map(
          p.sin( hueSpeed ),
          -1,
          1,
          360,
          0
        ) / opacityFactor,
        p.map(
          p.sin( hueSpeed - lerpIndex * hueAngleMult ),
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
} );

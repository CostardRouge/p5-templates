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
  p.stroke( 255 );

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

  if ( o.grid?.enabled ?? true ) {
    drawGrid(
      p,
      o.grid?.xCount ?? 2,
      o.grid?.yCount ?? 2,
      -time / 2 * ( o.grid?.animSpeed ?? 1 ),
      1
    );
  }

  const quality = o.shape?.quality ?? 400;
  const lerpMin = 0;
  const lerpMax = o.shape?.angleMax ?? p.PI;
  const lerpStep = lerpMax / quality;

  const horizontalSwing = o.shape?.horizontalSwing ?? 200;
  const horizontalSwingSpeed = o.shape?.horizontalSwingSpeed ?? 2;
  const verticalMargin = o.shape?.verticalMargin ?? 150;
  const lineAngleMin = o.shape?.lineAngleMin ?? -p.PI;
  const lineAngleMax = o.shape?.lineAngleMax ?? p.PI;

  const cursorSpeed = o.cursor?.speed ?? 150;
  const cursorEnabled = o.cursor?.enabled ?? true;
  const cursorRotationMult = o.cursor?.rotationMultiplier ?? 4;
  const cursorMarkerSize = o.cursor?.markerSize ?? 300;
  const cursorOpacityBoost = o.cursor?.opacityBoost ?? 1.5;
  const cursorColor = o.cursor?.color ?? [
    128,
    128,
    255,
    255
  ];
  const cursorIndex = Math.ceil( time * cursorSpeed ) % quality;

  const opacitySpeed = o.opacity?.speed ?? 3;
  const opacityCount = o.opacity?.groupCount ?? 3;
  const startOpacity = o.opacity?.startFactor ?? 3;
  const endOpacity = o.opacity?.endFactor ?? 1;
  const pingPong = o.opacity?.pingPong ?? false;
  const pingPongMax = o.opacity?.pingPongMax ?? 15;

  const rotationSpeed = o.rotation?.speed ?? 2;
  const rotationCount = o.rotation?.count ?? 1;

  const maxLinesCount = o.lines?.maxCount ?? 2;
  const changeLinesCount = o.lines?.changeOverTime ?? false;
  const linesLength = o.lines?.length ?? 75;
  const linesWeight = o.lines?.weight ?? 80;

  const hueSpeedOption = o.colors?.hueSpeed ?? 2;
  const hueAngleMult = o.colors?.hueAngleMultiplier ?? 5;

  for ( let lerpIndex = lerpMin; lerpIndex <= lerpMax; lerpIndex += lerpStep ) {
    p.push();

    p.translate(
      p.map(
        p.sin( lerpIndex - time * horizontalSwingSpeed ),
        -1,
        1,
        p.width / 2 - horizontalSwing,
        p.width / 2 + horizontalSwing
      ),
      p.map(
        lerpIndex,
        lerpMin,
        lerpMax,
        verticalMargin,
        p.height - verticalMargin,
        true
      )
    );

    const shapeIndex = Math.ceil( p.map(
      lerpIndex,
      lerpMin,
      lerpMax,
      0,
      quality,
      true
    ) );

    const cursorHit = shapeIndex === cursorIndex;
    const beyondCursor = shapeIndex > cursorIndex;

    if ( cursorEnabled && cursorHit ) {
      p.strokeWeight( 3 );
      p.stroke( ...cursorColor );
      p.line(
        -p.width,
        0,
        p.width,
        0
      );
      p.line(
        0,
        -p.height,
        0,
        p.height
      );
      p.noFill();
      p.circle(
        0,
        0,
        cursorMarkerSize
      );
    }

    if ( cursorEnabled && beyondCursor ) {
      p.rotate( time * rotationSpeed + lerpIndex * cursorRotationMult * rotationCount );
    } else {
      p.rotate( time * rotationSpeed + lerpIndex * rotationCount );
    }

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

    if ( cursorEnabled && !beyondCursor ) {
      opacityFactor *= cursorOpacityBoost;
    }

    let linesCount = maxLinesCount;

    if ( changeLinesCount ) {
      linesCount = p.map(
        p.cos( lerpIndex / 2 - time * 2 ),
        0,
        1,
        1,
        maxLinesCount,
        true
      );
    }

    const lineStep = ( lineAngleMax - lineAngleMin ) / linesCount;
    const hueSpeed = -time * hueSpeedOption;

    for ( let lineIndex = lineAngleMin; lineIndex < lineAngleMax; lineIndex += lineStep ) {
      const vector = converters.polar.vector(
        lineIndex,
        linesLength
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

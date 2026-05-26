import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";

import converters from "@/p5/utils/converters.js";
import mappers from "@/p5/utils/mappers.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";

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
    255,
    2
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

sketch.draw( (
  time, center
) => {
  const p = getP5();
  const o = options.sketch;

  p.background( ...( o.backgroundColor ?? [
    0
  ] ) );

  if ( o.grid?.enabled ?? true ) {
    drawGrid(
      p,
      o.grid?.xCount ?? 3,
      o.grid?.yCount ?? 3,
      time * ( o.grid?.animSpeed ?? 1 ),
      1
    );
  }

  p.push();
  p.translate(
    center.x,
    center.y
  );
  p.rotate( -time * ( o.scene?.spinSpeed ?? 1 ) );

  const quality = o.shape?.quality ?? 400;
  const lerpMin = 0;
  const lerpMaxBoundA = o.shape?.angleBoundA ?? p.TAU - 0.3;
  const lerpMaxBoundB = o.shape?.angleBoundB ?? 0;
  const lerpMax = p.map(
    p.cos( time / 2 ),
    -1,
    1,
    lerpMaxBoundA,
    lerpMaxBoundB
  );
  const lerpStep = ( lerpMax || 0.0001 ) / quality;

  const spiralRadius = o.shape?.spiralRadius ?? -p.width / 3;
  const guideEnabled = o.guides?.enabled ?? true;
  const guideStart = o.guides?.showStart ?? true;
  const guideEnd = o.guides?.showEnd ?? true;
  const guideColor = o.guides?.color ?? [
    128,
    128,
    255,
    255
  ];
  const guideWeight = o.guides?.weight ?? 4;

  const opacitySpeed = o.opacity?.speed ?? 3;
  const opacityCount = o.opacity?.groupCount ?? 3;
  const startOpacity = o.opacity?.startFactor ?? 3;
  const endOpacity = o.opacity?.endFactor ?? 1;
  const pingPong = o.opacity?.pingPong ?? false;
  const pingPongMax = o.opacity?.pingPongMax ?? 15;

  const rotationSpeed = o.rotation?.speed ?? 2;
  const rotationCount = o.rotation?.count ?? 1;
  const rotationSpinFreq = o.rotation?.spinFreq ?? 3;

  const maxLinesCount = o.lines?.maxCount ?? 2;
  const changeLinesCount = o.lines?.changeOverTime ?? false;
  const linesLength = o.lines?.length ?? 100;
  const linesWeight = o.lines?.weight ?? 40;
  const lineAngleMax = o.lines?.angleMax ?? p.PI;

  const hueSpeedOption = o.colors?.hueSpeed ?? 2;
  const hueRedMult = o.colors?.hueRedAngleMultiplier ?? 5;
  const hueGreenMult = o.colors?.hueGreenAngleMultiplier ?? 3;

  for ( let lerpIndex = lerpMin; lerpIndex <= lerpMax; lerpIndex += lerpStep ) {
    p.push();

    const x = converters.polar.get(
      p.sin.bind( p ),
      spiralRadius,
      lerpIndex,
      1
    );
    const y = converters.polar.get(
      p.cos.bind( p ),
      spiralRadius,
      lerpIndex,
      1
    );

    p.translate(
      x,
      y
    );

    p.rotate( time );

    if ( guideEnabled ) {
      const isStart = lerpIndex === lerpMin;
      const isEnd = lerpIndex + lerpStep > lerpMax;

      if ( ( isStart && guideStart ) || ( isEnd && guideEnd ) ) {
        p.strokeWeight( guideWeight );
        p.stroke( ...guideColor );
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
      }
    }

    p.rotate( p.sin( lerpIndex * rotationSpinFreq - time ) * rotationSpeed +
      lerpIndex * 2 * rotationCount );

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
        p.cos( lerpIndex / 2 - time * 2 ),
        0,
        1,
        1,
        maxLinesCount,
        true
      );
    }

    const lineStep = lineAngleMax / linesCount;
    const hueSpeed = -time * hueSpeedOption;
    // c modulates per-line vector length — gives a “perspective breathing” effect.
    const c = p.map(
      p.sin( time / 2 + lerpIndex ),
      -1,
      1,
      0,
      3
    );
    const alpha = mappers.circularMap(
      lerpIndex,
      lerpMax,
      1,
      255
    );

    for ( let lineIndex = 0; lineIndex < lineAngleMax; lineIndex += lineStep ) {
      const vector = converters.polar.vector(
        lineIndex,
        p.map(
          p.sin( lerpIndex * c + time ),
          -1,
          1,
          -linesLength,
          linesLength,
          true
        )
      );

      p.push();
      p.beginShape();
      p.strokeWeight( linesWeight );

      p.stroke( p.color(
        p.map(
          p.sin( hueSpeed + lerpIndex * hueRedMult ),
          -1,
          1,
          0,
          360
        ) / opacityFactor,
        p.map(
          p.sin( hueSpeed - lerpIndex * hueGreenMult ),
          -1,
          1,
          360,
          0
        ) / opacityFactor,
        p.map(
          p.sin( hueSpeed + lerpIndex * hueRedMult ),
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

  p.pop();

  renderTitle();
} );

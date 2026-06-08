import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";

import converters from "@/p5/utils/converters.js";
import mappers from "@/p5/utils/mappers.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";

sketch.setup( () => {} );

sketch.draw( ( time ) => {
  const p = getP5();
  const o = options.sketch;

  p.clear();
  p.background( ...( o.backgroundColor ?? [
    0
  ] ) );

  p.push();
  p.translate(
    p.width / 2,
    p.height / 2
  );

  const angleMin = 0;
  const angleMax = p.TAU - ( o.shape?.angleMaxOffset ?? 0.5 );
  const quality = o.shape?.quality ?? 500;
  const angleStep = angleMax / quality;

  const radiusX = ( o.shape?.radiusXDivisor ?? 3 );
  const radiusY = ( o.shape?.radiusYDivisor ?? 3 );

  const xCoef = o.shape?.xCoefficient ?? 1;
  const yCoef = o.shape?.yCoefficient ?? 1;

  const opacitySpeed = o.opacity?.speed ?? 3;
  const opacityCount = o.opacity?.groupCount ?? 6;
  const startOpacity = o.opacity?.startFactor ?? 6;
  const endOpacity = o.opacity?.endFactor ?? 1;
  const pingPong = o.opacity?.pingPong ?? false;
  const pingPongMax = o.opacity?.pingPongMax ?? 50;

  const rotationSpeed = o.rotation?.speed ?? 2;
  const rotationCount = o.rotation?.count ?? 1;

  const maxLinesCount = o.lines?.maxCount ?? 3;
  const changeLinesCount = o.lines?.changeOverTime ?? false;
  const linesLength = o.lines?.length ?? 50;
  const linesWeight = o.lines?.weight ?? 20;

  const hueSpeedOption = o.colors?.hueSpeed ?? 2;
  const hueGreenMult = o.colors?.greenAngleMultiplier ?? 1;
  const hueBlueMult = o.colors?.blueAngleMultiplier ?? 1;

  for ( let angle = angleMin; angle <= angleMax; angle += angleStep ) {
    p.push();
    p.translate(
      converters.polar.get(
        p.sin.bind( p ),
        p.width / radiusX,
        angle,
        xCoef
      ),
      converters.polar.get(
        p.cos.bind( p ),
        p.width / radiusY,
        angle,
        yCoef
      )
    );

    p.rotate( time * rotationSpeed + angle * rotationCount );

    let opacityFactor = mappers.circularMap(
      angle,
      angleMax * 4,
      p.map(
        p.sin( -time * opacitySpeed + angle * opacityCount ),
        -1,
        1,
        endOpacity,
        startOpacity
      ),
      endOpacity
    );

    if ( pingPong ) {
      opacityFactor = p.map(
        p.map(
          p.sin( angle * opacityCount - time * opacitySpeed ),
          -1,
          1,
          -1,
          1
        ),
        -1,
        1,
        p.map(
          p.cos( angle * opacityCount + time * opacitySpeed ),
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
        p.cos( angle + time * 2 ),
        -1,
        1,
        1,
        maxLinesCount
      );
    }

    const lineMin = 0;
    const lineMax = p.TAU;
    const lineStep = lineMax / linesCount;

    const hueSpeed = -time * hueSpeedOption;

    for ( let lineIndex = lineMin; lineIndex < lineMax; lineIndex += lineStep ) {
      const vector = converters.polar.vector(
        angle + lineIndex,
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
          p.sin( hueSpeed - angle * hueGreenMult ),
          -1,
          1,
          360,
          0
        ) / opacityFactor,
        p.map(
          p.sin( hueSpeed + angle * hueBlueMult ),
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

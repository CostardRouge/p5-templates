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

  p.background( ...( o.backgroundColor ?? [
    0
  ] ) );

  const quality = o.shape?.quality ?? 600;
  const lerpMin = -p.PI;
  const lerpMax = p.PI;
  const lerpStep = lerpMax / quality;

  const horizontalMargin = o.shape?.horizontalMargin ?? 300;
  const verticalMargin = o.shape?.verticalMargin ?? 300;
  const serpentAmp = o.shape?.serpentAmplitude ?? 1.5;
  const lineAngleSpan = o.shape?.lineAngleSpan ?? p.PI;

  const opacitySpeed = o.opacity?.speed ?? 3;
  const opacityCount = o.opacity?.groupCount ?? 3;
  const startOpacity = o.opacity?.startFactor ?? 3;
  const endOpacity = o.opacity?.endFactor ?? 1;
  const pingPong = o.opacity?.pingPong ?? false;
  const pingPongMax = o.opacity?.pingPongMax ?? 15;

  const rotationSpeed = o.rotation?.speed ?? 2;
  const rotationCount = o.rotation?.count ?? 1;

  const maxLinesCount = o.lines?.maxCount ?? 3;
  const changeLinesCount = o.lines?.changeOverTime ?? true;
  const linesLength = o.lines?.length ?? 150;
  const linesWeight = o.lines?.weight ?? 80;

  const hueSpeedOption = o.colors?.hueSpeed ?? 2;
  const hueAngleMult = o.colors?.hueAngleMultiplier ?? 5;

  for ( let lerpIndex = lerpMin; lerpIndex <= lerpMax; lerpIndex += lerpStep ) {
    p.push();

    const wave = p.map(
      p.cos( lerpIndex - time ),
      -1,
      1,
      -serpentAmp,
      serpentAmp
    );

    p.translate(
      p.map(
        lerpIndex,
        lerpMin,
        lerpMax,
        horizontalMargin,
        p.width - horizontalMargin
      ),
      p.map(
        p.sin( -lerpIndex * wave + time ),
        -1,
        1,
        verticalMargin,
        p.height - verticalMargin
      )
    );

    p.rotate( time * rotationSpeed + lerpIndex * rotationCount );

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

    const lineStep = lineAngleSpan / linesCount;
    const hueSpeed = -time * hueSpeedOption;

    for ( let lineIndex = 0; lineIndex < lineAngleSpan; lineIndex += lineStep ) {
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

  renderTitle();
} );

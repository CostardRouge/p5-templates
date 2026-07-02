import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";

import converters from "@/p5/utils/converters.js";
import mappers from "@/p5/utils/mappers.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";

sketch.setup( () => {} );

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

  const quality = o.shape?.quality ?? 400;
  const lerpMin = -( o.shape?.angleHalfSpan ?? p.PI );
  const lerpMax = o.shape?.angleHalfSpan ?? p.PI;
  const lerpStep = lerpMax / quality;

  const horizontalSwing = o.shape?.horizontalSwing ?? 300;
  const verticalMargin = o.shape?.verticalMargin ?? 150;
  const lineAngleMax = o.shape?.lineAngleMax ?? p.PI;

  const fixerEnabled = o.fixer?.enabled ?? true;
  const fixerSpeed = o.fixer?.speed ?? 0.75;
  const fixerColor = o.fixer?.color ?? [
    128,
    128,
    255,
    255
  ];
  const fixerMarkerSize = o.fixer?.markerSize ?? 250;
  const fixerRotationMult = o.fixer?.rotationMultiplier ?? 4;

  // fixerIndex is a bounded sin() oscillation (not a linear accumulator), so
  // it only needs its rate snapped to a WHOLE number of cycles per loop.
  const fixerCycles = Math.round( fixerSpeed );
  const fixerIndex = Math.ceil( p.map(
    p.sin( t * fixerCycles ),
    -1,
    1,
    0,
    quality,
    true
  ) );

  const opacitySpeed = o.opacity?.speed ?? -2;
  const opacityCount = o.opacity?.groupCount ?? 2;
  const startOpacity = o.opacity?.startFactor ?? 3;
  const endOpacity = o.opacity?.endFactor ?? 1;
  const pingPong = o.opacity?.pingPong ?? true;
  const pingPongMax = o.opacity?.pingPongMax ?? 15;

  const rotationSpeed = o.rotation?.speed ?? 2;
  const rotationCount = o.rotation?.count ?? 1;

  const maxLinesCount = o.lines?.maxCount ?? 2;
  const changeLinesCount = o.lines?.changeOverTime ?? false;
  const linesLength = o.lines?.length ?? 75;
  const linesWeight = o.lines?.weight ?? 80;

  const hueSpeedOption = o.colors?.hueSpeed ?? 2;
  const hueAngleMult = o.colors?.hueAngleMultiplier ?? 5;
  const altRed = o.colors?.altRed ?? 128;
  const altBlue = o.colors?.altBlue ?? 360;
  const altGreenBoost = o.colors?.altGreenBoost ?? 1.5;

  // Every rate multiplying t below is snapped to a WHOLE number of cycles
  // per loop so the last frame matches the first at the seam.
  const rotationCycles = Math.round( rotationSpeed );
  const opacityCycles = Math.round( opacitySpeed );
  const hueCycles = Math.round( hueSpeedOption );

  for ( let lerpIndex = lerpMin; lerpIndex <= lerpMax; lerpIndex += lerpStep ) {
    p.push();

    p.translate(
      p.map(
        p.cos( lerpIndex - t ),
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
          p.cos( t + lerpIndex ),
          -1,
          1,
          verticalMargin,
          p.height - verticalMargin
        ),
        p.map(
          p.sin( -t + lerpIndex ),
          -1,
          1,
          verticalMargin,
          p.height - verticalMargin
        ),
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

    if ( fixerEnabled && shapeIndex === fixerIndex ) {
      p.strokeWeight( 3 );
      p.stroke( ...fixerColor );
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
        fixerMarkerSize
      );
    }

    if ( fixerEnabled && shapeIndex > fixerIndex ) {
      p.rotate( t * rotationCycles + lerpIndex * fixerRotationMult * rotationCount );
    } else {
      p.rotate( t * rotationCycles + lerpIndex * rotationCount );
    }

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
        p.cos( lerpIndex / 2 - t * 2 ),
        0,
        1,
        1,
        maxLinesCount,
        true
      );
    }

    const lineStep = lineAngleMax / linesCount;
    const hueSpeed = -t * hueCycles;
    const altRegion = fixerEnabled && shapeIndex < fixerIndex;

    for ( let lineIndex = 0; lineIndex < lineAngleMax; lineIndex += lineStep ) {
      const vector = converters.polar.vector(
        lineIndex,
        linesLength
      );

      p.push();
      p.beginShape();
      p.strokeWeight( linesWeight );

      if ( altRegion ) {
        p.stroke( p.color(
          altRed / opacityFactor,
          p.map(
            p.sin( hueSpeed - lerpIndex * hueAngleMult ),
            -1,
            1,
            altRed,
            0
          ) / opacityFactor * altGreenBoost,
          altBlue / opacityFactor
        ) );
      } else {
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
      }

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

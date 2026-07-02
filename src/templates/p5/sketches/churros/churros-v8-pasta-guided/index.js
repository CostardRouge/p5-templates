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
  const angleBoundMin = o.shape?.angleBoundMin ?? 0.5;
  const angleBoundMax = o.shape?.angleBoundMax ?? p.PI;
  const lerpMin = 0;
  const lerpMax = p.map(
    p.sin( t ),
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

  const guideEnabled = o.guides?.enabled ?? true;
  const guideStart = o.guides?.showStart ?? true;
  const guideEnd = o.guides?.showEnd ?? true;
  const guideWeight = o.guides?.weight ?? 4;
  const guideColor = o.guides?.color ?? [
    128,
    128,
    255,
    255
  ];

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

  // Every rate multiplying t below is snapped to a WHOLE number of cycles
  // per loop so the last frame matches the first at the seam.
  const horizontalSwingCycles = Math.round( horizontalSwingSpeed );
  const rotationCycles = Math.round( rotationSpeed );
  const opacityCycles = Math.round( opacitySpeed );
  const hueCycles = Math.round( hueSpeedOption );

  for ( let lerpIndex = lerpMin; lerpIndex <= lerpMax; lerpIndex += lerpStep ) {
    p.push();

    const l = p.map(
      p.cos( lerpIndex - t ),
      -1,
      1,
      -rotationWaveAmp,
      rotationWaveAmp
    );

    p.translate(
      p.map(
        p.sin( lerpIndex * horizontalSwingFreq - t * horizontalSwingCycles ),
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
          p.cos( t ),
          -1,
          1,
          verticalMargin,
          p.height - verticalMargin
        ),
        p.map(
          p.sin( t ),
          -1,
          1,
          verticalMargin,
          p.height - verticalMargin
        ),
        true
      )
    );

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

    p.rotate( t * rotationCycles + lerpIndex * l * rotationWaveMult * rotationCount );

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
        p.sin( lerpIndex - t * 3 ),
        0,
        1,
        1,
        maxLinesCount,
        true
      );
    }

    const lineStep = lineAngleMax / linesCount;
    const hueSpeed = -t * hueCycles;

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

  renderTitle();
} );

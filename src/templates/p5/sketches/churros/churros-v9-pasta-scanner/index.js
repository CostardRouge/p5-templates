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
  const lerpMin = 0;
  const lerpMax = o.shape?.angleMax ?? p.PI;
  const lerpStep = lerpMax / quality;

  const horizontalSwing = o.shape?.horizontalSwing ?? 200;
  const horizontalSwingSpeed = o.shape?.horizontalSwingSpeed ?? 2;
  const verticalMargin = o.shape?.verticalMargin ?? 150;
  const lineAngleMin = o.shape?.lineAngleMin ?? -p.PI;
  const lineAngleMax = o.shape?.lineAngleMax ?? p.PI;

  const scanEnabled = o.scanner?.enabled ?? true;
  const scanSpeed = o.scanner?.speed ?? 200;
  const scanMarkerSize = o.scanner?.markerSize ?? 300;
  const showStartMarker = o.scanner?.showStartMarker ?? true;
  const showEndMarker = o.scanner?.showEndMarker ?? true;
  const startMarkerColor = o.scanner?.startMarkerColor ?? [
    0,
    0,
    255,
    255
  ];
  const endMarkerColor = o.scanner?.endMarkerColor ?? [
    255,
    0,
    0,
    255
  ];
  const scannerColor = o.scanner?.markerColor ?? [
    128,
    128,
    255,
    255
  ];

  // The cursor index is a linear accumulator (Math.ceil(...) % quality), so
  // it only lands on the same wrapped index at the seam when it advances a
  // WHOLE number of full sweeps (quality steps) per loop — snap its rate
  // accordingly.
  const cursorLoopCycles = Math.round( scanSpeed * p.TAU / quality );
  const cursorSnappedSpeed = quality ? cursorLoopCycles * quality / p.TAU : 0;
  const cursorIndex = Math.ceil( t * cursorSnappedSpeed ) % quality;

  const opacitySpeed = o.opacity?.speed ?? 3;
  const opacityCount = o.opacity?.groupCount ?? 3;
  const startOpacity = o.opacity?.startFactor ?? 3;
  const endOpacity = o.opacity?.endFactor ?? 1;
  const pingPong = o.opacity?.pingPong ?? false;
  const pingPongMax = o.opacity?.pingPongMax ?? 15;

  const rotationSpeed = o.rotation?.speed ?? 2;
  const rotationCount = o.rotation?.count ?? 1;
  const rotationLerpMult = o.rotation?.lerpMultiplier ?? 2;

  const maxLinesCount = o.lines?.maxCount ?? 2;
  const changeLinesCount = o.lines?.changeOverTime ?? false;
  const linesLength = o.lines?.length ?? 75;
  const linesWeight = o.lines?.weight ?? 80;

  const hueSpeedOption = o.colors?.hueSpeed ?? 2;
  const hueAngleMult = o.colors?.hueAngleMultiplier ?? 5;

  // Every rate multiplying t below is snapped to a WHOLE number of cycles
  // per loop so the last frame matches the first at the seam.
  const horizontalSwingCycles = Math.round( horizontalSwingSpeed );
  const rotationCycles = Math.round( rotationSpeed );
  const opacityCycles = Math.round( opacitySpeed );
  const hueCycles = Math.round( hueSpeedOption );

  for ( let lerpIndex = lerpMin; lerpIndex <= lerpMax; lerpIndex += lerpStep ) {
    p.push();

    p.translate(
      p.map(
        p.sin( lerpIndex - t * horizontalSwingCycles ),
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

    const shapeIndex = p.map(
      lerpIndex,
      lerpMin,
      lerpMax,
      0,
      quality,
      true
    );

    p.strokeWeight( 4 );
    p.stroke( ...scannerColor );

    if ( scanEnabled && Math.ceil( shapeIndex ) === cursorIndex ) {
      p.noFill();
      p.circle(
        0,
        0,
        scanMarkerSize
      );
    }

    if ( showEndMarker && lerpIndex + lerpStep > lerpMax ) {
      p.stroke( ...endMarkerColor );
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

    if ( showStartMarker && lerpIndex - lerpStep < lerpMin ) {
      p.stroke( ...startMarkerColor );
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

    p.rotate( t * rotationCycles + lerpIndex * rotationLerpMult * rotationCount );

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

    const lineStep = ( lineAngleMax - lineAngleMin ) / linesCount;
    const hueSpeed = -t * hueCycles;

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

  renderTitle();
} );

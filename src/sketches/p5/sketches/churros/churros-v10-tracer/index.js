import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";

import converters from "@/p5/utils/converters.js";
import mappers from "@/p5/utils/mappers.js";

sketch.setup( () => {} );

sketch.draw( ( time ) => {
  const p = getP5();
  const o = options.sketch;

  p.clear();
  p.background( ...( o.backgroundColor ?? [
    0
  ] ) );

  const quality = o.shape?.quality ?? 400;
  const lerpMin = 0;
  const lerpMax = o.shape?.angleMax ?? p.PI;
  const lerpStep = lerpMax / quality;

  const horizontalSwing = o.shape?.horizontalSwing ?? 200;
  const horizontalSwingSpeed = o.shape?.horizontalSwingSpeed ?? 2;
  const verticalMargin = o.shape?.verticalMargin ?? 150;
  const lineAngleMin = o.shape?.lineAngleMin ?? -p.PI;
  const lineAngleMax = o.shape?.lineAngleMax ?? p.PI;

  const tracerEnabled = o.tracer?.enabled ?? true;
  const tracerWeight = o.tracer?.weight ?? 2;
  const tracerColor = o.tracer?.color ?? [
    200,
    200,
    255,
    120
  ];
  const tracerMarkerSize = o.tracer?.markerSize ?? 300;
  const tracerSpeed = o.tracer?.speed ?? 200;
  const cursorIndex = Math.ceil( time * tracerSpeed ) % quality;

  const showEndMarker = o.tracer?.showEndMarker ?? true;
  const showStartMarker = o.tracer?.showStartMarker ?? true;
  const startMarkerColor = o.tracer?.startMarkerColor ?? [
    0,
    0,
    255,
    255
  ];
  const endMarkerColor = o.tracer?.endMarkerColor ?? [
    255,
    0,
    0,
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
  const rotationLerpMult = o.rotation?.lerpMultiplier ?? 2;

  const maxLinesCount = o.lines?.maxCount ?? 2;
  const changeLinesCount = o.lines?.changeOverTime ?? false;
  const linesLength = o.lines?.length ?? 100;
  const linesWeight = o.lines?.weight ?? 40;

  const hueSpeedOption = o.colors?.hueSpeed ?? 2;
  const hueAngleMult = o.colors?.hueAngleMultiplier ?? 5;

  // Tracer trail: record each center, then draw a polyline through them all.
  const trail = [];

  for ( let lerpIndex = lerpMin; lerpIndex <= lerpMax; lerpIndex += lerpStep ) {
    const cx = p.map(
      p.sin( lerpIndex - time * horizontalSwingSpeed ),
      -1,
      1,
      p.width / 2 - horizontalSwing,
      p.width / 2 + horizontalSwing
    );
    const cy = p.map(
      lerpIndex,
      lerpMin,
      lerpMax,
      p.map(
        p.cos( time + lerpIndex ),
        -1,
        1,
        verticalMargin,
        p.height - verticalMargin
      ),
      p.map(
        p.sin( -time + lerpIndex ),
        -1,
        1,
        verticalMargin,
        p.height - verticalMargin
      ),
      true
    );

    trail.push( [
      cx,
      cy
    ] );

    p.push();
    p.translate(
      cx,
      cy
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
    p.stroke( ...tracerColor );

    if ( tracerEnabled && Math.ceil( shapeIndex ) === cursorIndex ) {
      p.noFill();
      p.circle(
        0,
        0,
        tracerMarkerSize
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

    p.rotate( time * rotationSpeed + lerpIndex * rotationLerpMult * rotationCount );

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

  if ( tracerEnabled && trail.length > 1 ) {
    p.push();
    p.noFill();
    p.strokeWeight( tracerWeight );
    p.stroke( ...tracerColor );
    p.beginShape();
    for ( const [
      tx,
      ty
    ] of trail ) {
      p.vertex(
        tx,
        ty
      );
    }
    p.endShape();
    p.pop();
  }
} );

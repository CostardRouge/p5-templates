import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import mappers from "@/p5/utils/mappers.js";
import converters from "@/p5/utils/converters.js";
import animation from "@/p5/utils/animation.js";
import graphics from "@/p5/utils/graphics.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";
import {
  drawer,
  computeOpacityFactor,
  drawRadialPattern,
  paletteStroke
} from "../_shared.js";

const sketchState = {
  pixilatedCanvas: null
};

sketch.setup( () => {
  const p = getP5();
  const o = options.sketch ?? {};

  sketchState.pixilatedCanvas = graphics.createAutoResizableGraphics(
    p.width,
    p.height
  );
  sketchState.pixilatedCanvas.pixelDensity( o.background?.pixelDensity ?? 0.1 );
} );

sketch.draw( ( time ) => {
  const p = getP5();
  const o = options.sketch ?? {};
  const buffer = sketchState.pixilatedCanvas;

  p.clear();
  p.background( ...( o.backgroundColor ?? [
    0,
    0,
    0,
    255
  ] ) );

  if ( buffer ) {
    buffer.filter(
      p.BLUR,
      o.background?.blur ?? 2
    );
    buffer.background(
      0,
      0,
      0,
      o.background?.trailAlpha ?? 16
    );
    p.image(
      buffer,
      0,
      0
    );
  }

  const bgTint = o.background?.tint ?? [
    128,
    128,
    255
  ];

  drawRadialPattern( {
    count: o.background?.linesAmount ?? 100,
    time: time * ( o.background?.animationSpeed ?? 0.25 ),
    strokeColor: p.color(
      bgTint[ 0 ],
      bgTint[ 1 ],
      bgTint[ 2 ],
      o.background?.radialAlpha ?? 40
    ),
    strokeWeight: o.background?.linesWeight ?? 8,
    innerLerpStep: 0.1,
    radiusXMult: o.background?.radiusXMult ?? 1.5,
    radiusYMult: o.background?.radiusYMult ?? 1.5
  } );

  const targets = buffer
    ? [
      buffer,
      p
    ]
    : [
      p
    ];

  const foldCycle = o.shape?.foldCycle ?? [
    1,
    2,
    3,
    4
  ];
  const foldLerp = o.shape?.foldLerp ?? 0.001;
  const linesCount = animation.sequence(
    "ribbons-v12-fold",
    time / 2,
    foldCycle,
    foldLerp
  );

  drawer(
    () => {
      const lerpMin = 0;
      const lerpMax = p.PI;
      const quality = o.shape?.quality ?? 200;

      return [
        lerpMin,
        lerpMax,
        lerpMax / quality
      ];
    },
    (
      lerpIndex, _lMin, _lMax, _lStep, t, _idx, canvas
    ) => {
      canvas.translate(
        p.width / 2,
        p.height / 2
      );
      canvas.rotate( -t * ( o.rotation?.speed ?? 0.5 ) );
      canvas.rotate( lerpIndex * ( o.rotation?.indexMultiplier ?? 1 )
          + p.cos( t ) * ( o.rotation?.wobble ?? 1 ) );
    },
    (
      lerpIndex, _lMin, lerpMax, t, _idx, canvas
    ) => {
      const lineMin = -p.PI;
      const lineMax = p.PI;
      const lineStep = lineMax / Math.max(
        0.1,
        linesCount
      );
      const hueSpeed = -t * ( o.colors?.hueSpeed ?? 2 );
      const palette = o.colors?.palette ?? "rainbow";
      const ll = o.lines?.length ?? 190;

      const breathSpeed = o.shape?.breathSpeed ?? 1;
      const breathPhase = o.shape?.breathPhase ?? 1;

      for ( let lineIndex = lineMin; lineIndex < lineMax; lineIndex += lineStep ) {
        const vector = converters.polar.vector(
          lineIndex,
          ll * Math.abs( p.sin( t * breathSpeed + lineIndex * breathPhase ) )
        );

        const opacityFactor = computeOpacityFactor( {
          lerpIndex,
          lerpMax,
          time: t,
          opacityCount: o.opacity?.groupCount ?? 1,
          opacitySpeed: o.opacity?.speed ?? 2,
          startOpacity: o.opacity?.startFactor ?? 12,
          endOpacity: o.opacity?.endFactor ?? 1,
          lineIndex,
          pingPong: o.opacity?.pingPong ?? true
        } );

        canvas.push();
        canvas.strokeWeight( mappers.circularMap(
          lerpIndex,
          lineMax,
          10,
          o.lines?.weight ?? 110
        ) );

        if ( o.colors?.lineKeyedRainbow ?? true ) {
          canvas.stroke( p.color(
            p.map(
              p.sin( hueSpeed + lineIndex * 5 ),
              -1,
              1,
              0,
              360
            ) / opacityFactor,
            p.map(
              p.sin( hueSpeed - lineIndex * 5 ),
              -1,
              1,
              360,
              0
            ) / opacityFactor,
            p.map(
              p.sin( hueSpeed + lineIndex * 5 ),
              -1,
              1,
              360,
              0
            ) / opacityFactor,
            mappers.circularMap(
              lerpIndex,
              lerpMax,
              1,
              255
            )
          ) );
        } else {
          paletteStroke( {
            canvas,
            paletteName: palette,
            hueSpeed,
            lerpIndex,
            opacityFactor,
            alpha: mappers.circularMap(
              lerpIndex,
              lerpMax,
              1,
              255
            )
          } );
        }

        canvas.beginShape();
        canvas.vertex(
          vector.x,
          vector.y
        );
        canvas.vertex(
          vector.x,
          vector.y
        );
        canvas.endShape();
        canvas.pop();
      }
    },
    time,
    0,
    targets
  );

  renderTitle();
} );

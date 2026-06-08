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
    count: o.background?.linesAmount ?? 90,
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
    radiusYMult: o.background?.radiusYMult ?? 2
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
    2,
    3,
    3,
    4,
    4,
    5
  ];
  const foldLerp = o.shape?.foldLerp ?? 0.0005;
  const linesCount = animation.sequence(
    "ribbons-v11-fold",
    time / 2,
    foldCycle,
    foldLerp
  );

  drawer(
    () => {
      const lerpMin = 0;
      const lerpMax = p.PI;
      const quality = o.shape?.quality ?? 220;

      return [
        lerpMin,
        lerpMax,
        lerpMax / quality
      ];
    },
    (
      _lerpIndex, _lMin, _lMax, _lStep, t, _idx, canvas
    ) => {
      canvas.translate(
        p.width / 2,
        p.height / 2
      );
      canvas.rotate( -t * ( o.rotation?.speed ?? 0.5 ) );
    },
    (
      lerpIndex, _lMin, lerpMax, t, _idx, canvas
    ) => {
      const c = p.map(
        p.sin( t + lerpIndex ),
        -1,
        1,
        -20,
        20
      );
      const zCycle = o.shape?.zCycle ?? [
        2,
        5,
        2,
        3,
        2,
        4,
        1
      ];
      const lc = mappers.circularIndex(
        t + c,
        zCycle
      ) / 3;
      const lw = 1.5;
      const z = o.lines?.regularLength ? lw : lc;

      const lineMin = -p.PI;
      const lineMax = p.PI;
      const lineStep = lineMax / Math.max(
        0.1,
        linesCount
      );
      const hueSpeed = -t * ( o.colors?.hueSpeed ?? 2 );
      const palette = o.colors?.palette ?? "rainbow";
      const ll = o.lines?.length ?? 190;
      const s = mappers.circularMap(
        lerpIndex,
        lineMax,
        0,
        ll
      );

      for ( let lineIndex = lineMin; lineIndex < lineMax; lineIndex += lineStep ) {
        const vector = converters.polar.vector(
          lineIndex,
          s * z
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

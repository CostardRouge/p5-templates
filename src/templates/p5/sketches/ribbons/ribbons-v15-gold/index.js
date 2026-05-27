import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import mappers from "@/p5/utils/mappers.js";
import converters from "@/p5/utils/converters.js";
import iterators from "@/p5/utils/iterators.js";
import animation from "@/p5/utils/animation.js";
import graphics from "@/p5/utils/graphics.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";
import {
  drawer,
  computeOpacityFactor,
  paletteStroke
} from "../_shared.js";

const sketchState = {
  pixilatedCanvas: null
};

function drawCoupledRadial( {
  count,
  time,
  strokeColor,
  weight,
  l,
  sinFreq = 5,
  cosFreq = 8,
  cosWeight = 2,
  cosOffset = 2
} ) {
  const p = getP5();

  p.push();
  p.stroke( strokeColor );
  p.strokeWeight( weight );
  p.translate(
    p.width / 2,
    p.height / 2
  );

  const center = p.createVector(
    0,
    0
  );
  const size = p.width + p.height;
  const lSafe = Math.max(
    0.5,
    l
  );

  iterators.angle(
    0,
    p.TAU,
    p.TAU / count,
    ( angle ) => {
      const radius = size * (
        Math.abs( p.sin( time + angle * sinFreq ) + lSafe )
          + cosWeight * Math.abs( p.cos( time + angle * cosFreq ) + cosOffset )
      ) / lSafe;
      const edge = converters.polar.vector(
        angle + time,
        radius,
        radius
      );

      p.beginShape();
      iterators.vector(
        edge,
        center,
        0.1,
        ( v ) => p.vertex(
          v.x,
          v.y
        )
      );
      p.endShape();
    }
  );

  p.pop();
}

sketch.setup( () => {
  const p = getP5();
  const o = options.sketch ?? {};

  sketchState.pixilatedCanvas = graphics.createAutoResizableGraphics(
    p.width,
    p.height
  );
  sketchState.pixilatedCanvas.pixelDensity( o.background?.pixelDensity ?? 0.05 );
} );

sketch.draw( ( time ) => {
  const p = getP5();
  const o = options.sketch ?? {};
  const buffer = sketchState.pixilatedCanvas;

  p.background( ...( o.backgroundColor ?? [
    0,
    0,
    0,
    255
  ] ) );

  if ( buffer ) {
    buffer.filter(
      p.BLUR,
      o.background?.blur ?? 4
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

  const foldCycle = o.shape?.foldCycle ?? [
    1.5,
    1.5,
    2,
    2.5,
    3,
    0.5,
    0.5,
    0.5
  ];
  const foldLerp = o.shape?.foldLerp ?? 0.05;
  const l = animation.sequence(
    "ribbons-v15-l",
    time,
    foldCycle,
    foldLerp
  );

  const bgTint = o.background?.tint ?? [
    255,
    225,
    0
  ];

  drawCoupledRadial( {
    count: o.background?.linesAmount ?? 60,
    time: time * ( o.background?.animationSpeed ?? 0.25 ),
    strokeColor: p.color(
      bgTint[ 0 ],
      bgTint[ 1 ],
      bgTint[ 2 ],
      o.background?.radialAlpha ?? 40
    ),
    weight: o.background?.linesWeight ?? 6,
    l,
    sinFreq: o.background?.sinFreq ?? 5,
    cosFreq: o.background?.cosFreq ?? 8,
    cosWeight: o.background?.cosWeight ?? 2,
    cosOffset: o.background?.cosOffset ?? 2
  } );

  const targets = buffer
    ? [
      buffer,
      p
    ]
    : [
      p
    ];

  drawer(
    () => {
      const lerpMin = 0;
      const lerpMax = p.PI * ( o.shape?.spreadFraction ?? 1 / 6 );
      const quality = o.shape?.quality ?? 80;

      return [
        lerpMin,
        lerpMax,
        lerpMax / quality
      ];
    },
    (
      _lerpIndex, _lMin, _lMax, _lStep, t, _idx, canvas
    ) => {
      const wobble = o.rotation?.wobble ?? 1;
      const rotationSpeed = o.rotation?.speed ?? 1;

      canvas.translate(
        p.width / 2,
        p.height / 2
      );
      canvas.rotate( t * rotationSpeed + wobble * p.cos( t ) );
    },
    (
      lerpIndex, _lMin, lerpMax, t, _idx, canvas
    ) => {
      const lineMin = -p.PI;
      const lineMax = p.PI;
      const lineStep = lineMax / Math.max(
        0.1,
        l
      );
      const hueSpeed = -t * ( o.colors?.hueSpeed ?? 2 );
      const palette = o.colors?.palette ?? "gold";
      const ll = o.lines?.length ?? 250;
      const radiusGain = o.shape?.radiusGain ?? 1.55;
      const s = mappers.circularMap(
        lerpIndex,
        lineMax,
        -ll,
        ll
      );

      for ( let lineIndex = lineMin; lineIndex < lineMax; lineIndex += lineStep ) {
        const vector = converters.polar.vector(
          lineIndex,
          s * radiusGain
        );

        const opacityFactor = computeOpacityFactor( {
          lerpIndex,
          lerpMax,
          time: t,
          opacityCount: o.opacity?.groupCount ?? 1,
          opacitySpeed: o.opacity?.speed ?? 2,
          startOpacity: o.opacity?.startFactor ?? 10,
          endOpacity: o.opacity?.endFactor ?? 1,
          lineIndex,
          pingPong: o.opacity?.pingPong ?? true
        } );

        canvas.push();
        canvas.strokeWeight( mappers.circularMap(
          lerpIndex,
          lineMax,
          10,
          o.lines?.weight ?? 250
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
          vector.y,
          vector.x
        );
        canvas.vertex(
          vector.y,
          vector.x
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

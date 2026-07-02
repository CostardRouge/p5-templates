import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import easing from "@/p5/utils/easing.js";
import grid from "@/p5/utils/grid.js";
import graphics from "@/p5/utils/graphics.js";
import colors from "@/p5/utils/colors.js";
import animation from "@/p5/utils/animation.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";

import {
  initInteraction,
  getPointers
} from "@/p5/utils/interaction/index.js";
import {
  drawInteractionOverlay
} from "@/p5/utils/interaction/overlay.js";

const sketchState = {
  shape: {
    graphics: null
  }
};

const getBackgroundColor = () =>
  options.sketch?.backgroundColor ?? [
    246,
    235,
    225
  ];

sketch.setup( async() => {
  const p = getP5();

  p.background( ...getBackgroundColor() );

  sketchState.shape.graphics = graphics.createAutoResizableGraphics(
    p.width,
    p.height,
    "webgl"
  );

  // One call boots every enabled interaction source (mouse, vision, orbit…)
  // declared in the shared `interaction` options.
  await initInteraction( options.sketch?.interaction ?? {} );
} );

// Interaction pointers arrive in top-left canvas space; the grid lives in
// centered WEBGL model space, so shift each pointer by half the canvas. This
// replaces the old per-source screenPosition round-trip (≈ identity at the base
// camera) with a deterministic, camera-independent conversion.
const toModelSpace = ( pointers ) => {
  const p = getP5();

  return pointers.map( ( v ) =>
    p.createVector(
      v.x - p.width / 2,
      v.y - p.height / 2
    ) );
};

sketch.draw( () => {
  const p = getP5();
  const g = sketchState.shape.graphics;
  const interaction = options.sketch?.interaction ?? {};
  const render = options.sketch?.animation ?? {};

  p.clear();
  p.background( ...getBackgroundColor() );

  renderTitle( options.sketch?.title );

  const columns = options.sketch?.grid?.columns ?? 65;
  const rows = ( columns * p.height ) / p.width;
  const cellSize = p.width / columns;

  const gridOptions = {
    topLeft: p.createVector(
      -p.width / 2,
      -p.height / 2
    ),
    topRight: p.createVector(
      p.width / 2,
      -p.height / 2
    ),
    bottomLeft: p.createVector(
      -p.width / 2,
      p.height / 2
    ),
    bottomRight: p.createVector(
      p.width / 2,
      p.height / 2
    ),
    rows,
    columns,
    centered: true
  };

  const gap = options.sketch.grid.gap ?? 3;
  const w = cellSize - gap;
  const h = cellSize - gap;
  const fillAlphaStart = options.sketch?.color?.fillAlphaStart ?? 240;
  const fillAlphaEnd = options.sketch?.color?.fillAlphaEnd ?? 0;
  const strokeAlpha = options.sketch?.color?.strokeAlpha ?? 200;

  const maxInfluenceDistance = render.maxInfluenceDistance ?? 150;

  // Every enabled source — mouse, hands, orbit, … — merged into one flat list
  // and mapped into the grid's centered coordinate space.
  const targetVectors = toModelSpace( getPointers( interaction ) );

  if ( render.showSpheres ?? true ) {
    targetVectors.forEach( ( vector ) => {
      g.push();
      g.translate(
        vector.x,
        vector.y,
        50
      );
      g.normalMaterial( vector );
      g.sphere( render.sphereSize ?? 30 );
      g.pop();
    } );
  }

  grid.draw(
    gridOptions,
    ( position ) => {
      g.push();
      g.translate( position );

      let minDistance = Infinity;

      for ( let i = 0; i < targetVectors.length; i++ ) {
        const target = targetVectors[ i ];
        const distance = position.dist( target );

        if ( distance < minDistance ) {
          minDistance = distance;
        }
      }

      const proximity = p.map(
        minDistance,
        0,
        maxInfluenceDistance,
        1,
        0
      );

      // Ensure the value is clamped between 0 and 1
      const switchIndex = p.constrain(
        proximity,
        0,
        1
      );

      const depthMax = cellSize * ( options.sketch?.grid?.depth ?? 20 );

      const depth = animation.ease( {
        values: [
          depthMax,
          cellSize
        ],
        currentTime: switchIndex,
        easingFn: easing?.[ render.easing ] ?? easing.easeOutBack
      } );

      const fillAlpha = animation.ease( {
        values: [
          fillAlphaStart,
          fillAlphaEnd
        ],
        currentTime: switchIndex
      } );

      const hue = g.noise(
        position.x / columns / 5,
        position.y / rows / 5
      // switchIndex
      );
      const hueMultiplier = options.sketch?.color?.hueMultiplier ?? 2;
      const opacityFactor = options.sketch?.color?.opacityFactor ?? 1.5;

      const tint = colors.rainbow( {
        hueOffset: switchIndex,
        hueIndex:
        g.map(
          hue,
          0,
          1,
          -p.PI,
          p.PI
        ) * hueMultiplier,
        opacityFactor
      } );

      const {
        levels: [
          red,
          green,
          blue
        ]
      } = tint;

      g.fill(
        red,
        green,
        blue,
        fillAlpha
      );
      g.stroke(
        red,
        green,
        blue,
        strokeAlpha
      );

      g.box(
        w,
        h,
        -depth
      );

      g.pop();
    }
  );

  // SHAPE
  p.image(
    g,
    0,
    0
  );
  g.clear();

  // Shared debug/demo overlay (crosshairs, markers, camera preview, legend),
  // gated by `interaction.visualization` — off by default so the 3D scene
  // stays clean, but available from the form.
  drawInteractionOverlay( interaction );
} );

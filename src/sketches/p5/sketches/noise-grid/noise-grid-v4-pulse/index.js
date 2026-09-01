import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import grid from "@/p5/utils/grid.js";
import colors from "@/p5/utils/colors.js";
import animation from "@/p5/utils/animation.js";

const sketchState = {
  min: Math.PI,
  max: 0
};

sketch.setup( () => {
  sketchState.min = Math.PI;
  sketchState.max = 0;
} );

sketch.draw( () => {
  const p = getP5();

  p.clear();
  p.background( ...( options.sketch.backgroundColor ?? [
    0
  ] ) );

  const t = animation.angle;

  const rows = options.sketch.grid?.rows ?? 40;
  const columns = options.sketch.grid?.columns ?? 40;

  const gridOptions = {
    topLeft: p.createVector(
      0,
      0
    ),
    topRight: p.createVector(
      p.width,
      0
    ),
    bottomLeft: p.createVector(
      0,
      p.height
    ),
    bottomRight: p.createVector(
      p.width,
      p.height
    ),
    rows,
    columns
  };

  p.noiseSeed( options.sketch.noise?.seed ?? 42 );
  p.noiseDetail(
    options.sketch.noise?.detail ?? 4,
    options.sketch.noise?.falloff ?? 0.5
  );

  // Pulse stands in for audio reactivity in the original: a triple-state
  // sequence (0.75 / 1 / 1.25) that scales spike weight every beat-ish.
  const pulseValues = options.sketch.pulse?.values ?? [
    0.75,
    1,
    1.25
  ];
  const pulseSpeed = options.sketch.pulse?.speed ?? 2;
  const pulseLerp = options.sketch.pulse?.lerp ?? 0.07;
  const pulse = animation.sequence(
    "noise-grid-v4-pulse",
    t * pulseSpeed,
    pulseValues,
    pulseLerp
  );

  const zSpeed = options.sketch.noise?.zSpeed ?? 0.05;
  const z = t * zSpeed;
  const yTimeMult = options.sketch.noise?.yTimeMultiplier ?? 0.2;
  const angleCycles = options.sketch.angle?.cycles ?? 4;
  const scale = ( p.width / columns ) * pulse;
  const cellWidth = p.width / columns;
  const cellHeight = p.height / rows;

  const holeThresholdMultiplier = options.sketch.holes?.thresholdMultiplier ?? 0.5;
  const holeStrokeWeight = options.sketch.holes?.strokeWeight ?? 2;
  const hueRange = options.sketch.colors?.hueRange ?? p.PI / 2;
  const hueOffset = options.sketch.colors?.hueOffset ?? 0;
  const opacityMax = options.sketch.colors?.opacityMax ?? 3;
  const opacityMin = options.sketch.colors?.opacityMin ?? 1;

  p.noFill();

  grid.draw(
    gridOptions,
    (
      position, {
        x, y
      }
    ) => {
      const angle = p.noise(
        x / columns,
        y / rows + t * yTimeMult,
        z
      ) * ( p.TAU * angleCycles );

      const weight = p.map(
        angle,
        sketchState.min,
        p.TAU,
        1,
        20,
        true
      ) * pulse;

      sketchState.min = Math.min(
        sketchState.min,
        angle
      );
      sketchState.max = Math.max(
        sketchState.max,
        angle
      );

      const opacityFactor = p.map(
        angle,
        sketchState.min,
        sketchState.max,
        opacityMax,
        opacityMin
      );

      p.push();
      p.translate(
        position.x + cellWidth / 2,
        position.y + cellHeight / 2
      );
      p.translate(
        scale * p.sin( angle ),
        scale * p.cos( angle )
      );

      if ( angle > sketchState.max * holeThresholdMultiplier ) {
        p.stroke( colors.rainbow( {
          hueOffset,
          hueIndex: p.map(
            angle,
            sketchState.min,
            p.TAU,
            -hueRange,
            hueRange
          ),
          opacityFactor
        } ) );
        p.strokeWeight( weight );
        p.point(
          0,
          0
        );
      } else {
        p.stroke( colors.darkBlueYellow( {
          hueOffset,
          hueIndex: p.map(
            angle,
            sketchState.min,
            p.TAU,
            -hueRange,
            hueRange
          ),
          opacityFactor
        } ) );
        p.strokeWeight( holeStrokeWeight );
        p.circle(
          0,
          0,
          weight
        );
      }

      p.pop();
    }
  );
} );

import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import converters from "@/p5/utils/converters.js";
import colors from "@/p5/utils/colors.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";
import {
  SpiralBase, rebuildGrid
} from "../_shared.js";

const sketchState = {
  shapes: [],
  lastLayout: ""
};

class Spiral extends SpiralBase {
  draw(
    time, index
  ) {
    const p = getP5();
    const o = options.sketch ?? {};
    const spiralOpts = o.spiral ?? {};
    const colorOpts = o.colors ?? {};

    const {
      position, size
    } = this;

    const weightStart = spiralOpts.weightStart ?? 600;
    const weightEnd = spiralOpts.weightEnd ?? 20;
    const opacityStart = spiralOpts.opacityStart ?? 10;
    const opacityEnd = spiralOpts.opacityEnd ?? 1;
    const shadowsCount = spiralOpts.shadowsCount ?? 10;
    const shadowIndexStep = spiralOpts.shadowIndexStep ?? 0.03;
    const sizeMinFactor = spiralOpts.sizeMinFactor ?? 0.1;
    const sizeMaxFactor = spiralOpts.sizeMaxFactor ?? 1.5;
    const angleSubdivisions = spiralOpts.angleSubdivisions ?? 3;
    const hueSpeed = colorOpts.hueSpeed ?? 1;
    const opacityPulseSpeed = colorOpts.opacityPulseSpeed ?? 3;
    const opacityPulseMaxFactor = colorOpts.opacityPulseMaxFactor ?? 25;
    const opacityEndDivisor = colorOpts.opacityEndDivisor ?? 2;

    const hueCadence = index + time * hueSpeed;

    p.push();
    p.translate(
      position.x,
      position.y
    );

    for (
      let shadowIndex = 0;
      shadowIndex <= shadowsCount;
      shadowIndex += shadowIndexStep
    ) {
      const weight = p.map(
        shadowIndex,
        0,
        shadowsCount,
        weightStart,
        weightEnd
      );

      const opacityFactor = p.map(
        shadowIndex,
        0,
        shadowsCount,
        p.map(
          p.sin( shadowIndex + time * opacityPulseSpeed ),
          -1,
          1,
          opacityStart,
          opacityStart * opacityPulseMaxFactor
        ),
        opacityEnd / opacityEndDivisor
      );

      const angleStep = p.TAU / angleSubdivisions;

      for ( let angle = 0; angle < p.TAU; angle += angleStep ) {
        p.push();
        const vector = converters.polar.vector(
          angle,
          p.map(
            p.sin( time + shadowIndex ),
            -1,
            1,
            size * sizeMinFactor,
            size * sizeMaxFactor
          )
        );

        p.beginShape();
        p.strokeWeight( weight );
        p.stroke( colors.rainbow( {
          hueIndex: hueCadence + angle,
          opacityFactor
        } ) );

        p.vertex(
          vector.x,
          vector.y
        );
        p.vertex(
          vector.x,
          vector.y
        );

        p.endShape();
        p.pop();
      }
    }

    p.pop();
  }
}

sketch.setup( () => {
  rebuildGrid( {
    state: sketchState,
    options: options.sketch,
    SpiralClass: Spiral
  } );
} );

sketch.draw( ( time ) => {
  const p = getP5();

  rebuildGrid( {
    state: sketchState,
    options: options.sketch,
    SpiralClass: Spiral
  } );

  p.background( ...( options.sketch?.background?.color ?? [
    0
  ] ) );

  sketchState.shapes.forEach( (
    shape, index
  ) => shape.draw(
    time,
    index
  ) );

  renderTitle();
} );
